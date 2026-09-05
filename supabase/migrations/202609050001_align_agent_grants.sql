-- ============================================================
-- ALIGN BUILT-IN AGENT GRANTS — defaults.ts ⇄ SQL seed
--
-- One idempotent migration that reconciles the SQL seed (inserted by
-- 202609040001_agentic_core.sql) with the in-process BUILTIN_AGENTS in
-- src/services/agents/defaults.ts, so both environments behave identically:
--
--   • customer-intelligence → + getProduct        (defaults has it; seed missed)
--   • designer              → + remember grant, + WRITE_CUSTOMER_MEMORY perm
--                             (the handler really uses them; seed missed them)
--   • designer              → − llmComplete, − CALL_LLM
--                             (dead grant: the designer never calls the LLM)
--   • inventory             → listProducts removed in defaults only — the SQL
--                             seed never granted it, so no DB change needed.
--   • recommendation        → remember / WRITE_CUSTOMER_MEMORY removed in
--                             defaults only — the handler never uses them.
--
-- Safe to run any number of times (all statements are guarded).
-- ============================================================

BEGIN;

-- 1) customer-intelligence: real product lookups for profile enrichment
INSERT INTO agent_tool_grants (agent_id, tool_key)
SELECT a.id, 'getProduct'
FROM agents a
WHERE a.key = 'customer-intelligence'
ON CONFLICT (agent_id, tool_key) DO NOTHING;

-- 2) designer: the handler calls remember → needs the grant + permission
INSERT INTO agent_permissions (agent_id, permission)
SELECT a.id, 'WRITE_CUSTOMER_MEMORY'
FROM agents a
WHERE a.key = 'designer'
ON CONFLICT (agent_id, permission) DO NOTHING;

INSERT INTO agent_tool_grants (agent_id, tool_key)
SELECT a.id, 'remember'
FROM agents a
WHERE a.key = 'designer'
ON CONFLICT (agent_id, tool_key) DO NOTHING;

-- 3) designer: remove the dead LLM grant/permission (the handler never
--    calls llmComplete, so CALL_LLM was pure noise in the seed)
DELETE FROM agent_tool_grants g
USING agents a
WHERE a.key = 'designer' AND g.agent_id = a.id AND g.tool_key = 'llmComplete';

DELETE FROM agent_permissions p
USING agents a
WHERE a.key = 'designer' AND p.agent_id = a.id AND p.permission = 'CALL_LLM';

COMMIT;
