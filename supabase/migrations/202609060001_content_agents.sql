-- ============================================================
-- HOMEINO — content agents (inspiration curator + magazine editor)
--
-- These two agents run on GitHub Actions (external cron). They are
-- registered in the agent registry so admins can see their config,
-- schedule and (via src/data/agent-runs.json) their execution
-- history in the /admin/automation panel.
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO agents (key, name, description, type, status, runtime, handler, is_builtin, max_retries, timeout_ms, config, schedule)
VALUES
  ('inspiration-curator','ایجنت الهام (Pinterest)','روزی ۳ بار: چرخش ماتریس ۱۲ سبک × ۵ فضا، یافتن چیدمان واقعی از Pinterest و منابع دیزاین، بازنویسی فارسی اورجینال و افزودن پین به بخش الهام.','generator','active','local',NULL,true,1,300000,'{"runsPerDay":3,"pinsPerRun":6,"matrix":"12 styles × 5 spaces","workflow":"inspiration-daily.yml","script":"scripts/inspiration-daily.mjs"}'::jsonb,'{"kind":"cron","cron":"30 3,8,13 * * *","timezone":"UTC"}'::jsonb),
  ('magazine-editor','ایجنت مجله ترندها','روزانه: جمع‌آوری اخبار دیزاین از Dezeen/ArchDaily/Design Milk/Yanko Design، بازنویسی اورجینال فارسی با منبع شفاف و انتشار در مجله ترندها.','generator','active','local',NULL,true,1,600000,'{"sources":["dezeen","archdaily","designmilk","yankodesign"],"workflow":"magazine-daily.yml","script":"scripts/magazine-daily.mjs"}'::jsonb,'{"kind":"cron","cron":"0 4 * * *","timezone":"UTC"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- permissions for the content agents
INSERT INTO agent_permissions (agent_id, permission)
SELECT a.id, p.perm FROM agents a
CROSS JOIN (VALUES
  ('inspiration-curator','CALL_LLM'),
  ('inspiration-curator','BROWSER_AUTOMATION'),
  ('inspiration-curator','EXTERNAL_ACTION'),
  ('magazine-editor','CALL_LLM'),
  ('magazine-editor','BROWSER_AUTOMATION'),
  ('magazine-editor','EXTERNAL_ACTION')
) AS p(agent_key, perm)
WHERE a.key = p.agent_key
ON CONFLICT (agent_id, permission) DO NOTHING;

-- tool grants for the content agents
INSERT INTO agent_tool_grants (agent_id, tool_key)
SELECT a.id, t.tool_key FROM agents a
CROSS JOIN (VALUES
  ('inspiration-curator','llmComplete'),
  ('inspiration-curator','browserTask'),
  ('inspiration-curator','httpRequest'),
  ('magazine-editor','llmComplete'),
  ('magazine-editor','browserTask'),
  ('magazine-editor','httpRequest')
) AS t(agent_key, tool_key)
WHERE a.key = t.agent_key
ON CONFLICT (agent_id, tool_key) DO NOTHING;

