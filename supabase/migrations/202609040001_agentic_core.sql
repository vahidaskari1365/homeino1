-- ============================================================
-- HOMEINO — AGENTIC CORE (agents · workflows · tasks · memory · recommendations · events)
--
-- Idempotent: safe to re-run. Applies on top of 202608210001_initial_schema.
-- No existing table, column, policy or row is dropped or modified.
--
-- Contents:
--   1. Enums
--   2. Tables (agents, tools, permissions, workflows graph, runs, steps,
--      agent_runs, tasks, task logs, approvals, budgets, customer profiles,
--      customer memory, recommendations, analytics events, embeddings,
--      integration connections)
--   3. Indexes + helper functions (cosine similarity, pgvector when available)
--   4. Row Level Security (deny-by-default; only own-row reads for customers)
--   5. Seed: tool registry, built-in agents, permissions, 3 real workflows
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------
DO $$ BEGIN CREATE TYPE agent_type AS ENUM ('analyzer','generator','executor','assistant','browser','notifier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_status AS ENUM ('draft','active','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_node_type AS ENUM ('trigger','condition','agent','db_query','db_update','recommendation','notification','delay','schedule','human_approval','http_request','browser_task','end'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_run_status AS ENUM ('queued','running','completed','failed','cancelled','waiting_approval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_step_status AS ENUM ('pending','running','completed','failed','skipped','cancelled','waiting_approval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_task_status AS ENUM ('pending','running','completed','failed','waiting_approval','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_approval_status AS ENUM ('pending','approved','rejected','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_risk_level AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recommendation_status AS ENUM ('active','dismissed','converted','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE customer_memory_kind AS ENUM ('preference','interaction','design','request','recommendation','dismissal','purchase','note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE embedding_entity AS ENUM ('product','customer','room','style','query'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_budget_scope AS ENUM ('global','agent','workflow','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_trigger_kind AS ENUM ('event','schedule','manual','webhook'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. TABLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  type agent_type NOT NULL DEFAULT 'analyzer',
  status agent_status NOT NULL DEFAULT 'draft',
  model varchar(120),
  runtime varchar(40) NOT NULL DEFAULT 'local',
  system_prompt text,
  handler varchar(80),
  config jsonb DEFAULT '{}'::jsonb,
  schedule jsonb,
  max_retries integer NOT NULL DEFAULT 2,
  timeout_ms integer NOT NULL DEFAULT 30000,
  max_cost_micro integer NOT NULL DEFAULT 0,
  is_builtin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  category varchar(60) NOT NULL DEFAULT 'general',
  required_permission varchar(80) NOT NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  is_destructive boolean NOT NULL DEFAULT false,
  input_schema jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tool_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_key varchar(80) NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  permission varchar(80) NOT NULL,
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  status workflow_status NOT NULL DEFAULT 'draft',
  runtime varchar(30) NOT NULL DEFAULT 'local',
  version integer NOT NULL DEFAULT 1,
  trigger_kind workflow_trigger_kind NOT NULL DEFAULT 'manual',
  trigger jsonb DEFAULT '{}'::jsonb,
  schedule jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_key varchar(40) NOT NULL,
  type workflow_node_type NOT NULL,
  label varchar(160),
  agent_key varchar(80),
  config jsonb DEFAULT '{}'::jsonb,
  position jsonb DEFAULT '{"x":0,"y":0}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_node varchar(40) NOT NULL,
  to_node varchar(40) NOT NULL,
  condition_label varchar(40),
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_key varchar(80),
  status agent_run_status NOT NULL DEFAULT 'queued',
  trigger_kind workflow_trigger_kind NOT NULL DEFAULT 'manual',
  trigger_payload jsonb DEFAULT '{}'::jsonb,
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id varchar(80),
  attempt integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 1,
  error text,
  error_code varchar(60),
  tools_used jsonb DEFAULT '[]'::jsonb,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_micro integer NOT NULL DEFAULT 0,
  model varchar(120),
  provider varchar(60),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workflow_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_key varchar(40) NOT NULL,
  type workflow_node_type NOT NULL,
  label varchar(160),
  agent_key varchar(80),
  status agent_step_status NOT NULL DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 1,
  input jsonb,
  output jsonb,
  error text,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_micro integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  agent_key varchar(80) NOT NULL,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE CASCADE,
  task_id uuid,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status agent_run_status NOT NULL DEFAULT 'queued',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb,
  tools_used jsonb DEFAULT '[]'::jsonb,
  provider varchar(60),
  model varchar(120),
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_micro integer NOT NULL DEFAULT 0,
  duration_ms integer,
  attempt integer NOT NULL DEFAULT 1,
  error text,
  error_code varchar(60),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  type varchar(80) NOT NULL DEFAULT 'generic',
  status agent_task_status NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  agent_key varchar(80),
  workflow_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  assignee_role varchar(40) NOT NULL DEFAULT 'admin',
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  level varchar(16) NOT NULL DEFAULT 'info',
  message text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key varchar(80),
  task_id uuid REFERENCES agent_tasks(id) ON DELETE CASCADE,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE CASCADE,
  action varchar(120) NOT NULL,
  reason text,
  risk_level agent_risk_level NOT NULL DEFAULT 'medium',
  payload jsonb DEFAULT '{}'::jsonb,
  status agent_approval_status NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decision_note text,
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope agent_budget_scope NOT NULL DEFAULT 'global',
  scope_key varchar(120),
  daily_limit_micro integer NOT NULL DEFAULT 0,
  monthly_limit_micro integer NOT NULL DEFAULT 0,
  per_run_limit_micro integer NOT NULL DEFAULT 0,
  max_runs_per_day integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_styles jsonb DEFAULT '[]'::jsonb,
  preferred_colors jsonb DEFAULT '[]'::jsonb,
  preferred_categories jsonb DEFAULT '[]'::jsonb,
  preferred_materials jsonb DEFAULT '[]'::jsonb,
  preferred_rooms jsonb DEFAULT '[]'::jsonb,
  preferred_stores jsonb DEFAULT '[]'::jsonb,
  preferred_price_min integer,
  preferred_price_max integer,
  recent_interests jsonb DEFAULT '[]'::jsonb,
  purchase_patterns jsonb DEFAULT '[]'::jsonb,
  confidence integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  source varchar(60) NOT NULL DEFAULT 'agent',
  last_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind customer_memory_kind NOT NULL DEFAULT 'note',
  memory_key varchar(160) NOT NULL,
  value jsonb DEFAULT '{}'::jsonb,
  text text,
  importance integer NOT NULL DEFAULT 1,
  hits integer NOT NULL DEFAULT 0,
  entity_type varchar(40),
  entity_id varchar(120),
  agent_key varchar(80),
  run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id varchar(80),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  scenario varchar(60) NOT NULL DEFAULT 'home',
  score double precision NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  reason_code varchar(80),
  reason_text varchar(240),
  breakdown jsonb DEFAULT '{}'::jsonb,
  agent_key varchar(80),
  run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  context_snapshot jsonb DEFAULT '{}'::jsonb,
  status recommendation_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id varchar(80),
  anonymous_id varchar(80),
  event_type varchar(60) NOT NULL,
  entity_type varchar(40),
  entity_id varchar(120),
  path varchar(300),
  metadata jsonb DEFAULT '{}'::jsonb,
  device varchar(20),
  platform varchar(20),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entity_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type embedding_entity NOT NULL,
  entity_id varchar(120) NOT NULL,
  model varchar(120) NOT NULL DEFAULT 'homeino-lexical-v1',
  dims integer NOT NULL DEFAULT 0,
  embedding double precision[] NOT NULL,
  source_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(40) NOT NULL,
  label varchar(120) NOT NULL,
  base_url text,
  secret_env_var varchar(80),
  auth_scheme varchar(40) NOT NULL DEFAULT 'bearer',
  config jsonb DEFAULT '{}'::jsonb,
  capabilities jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  health_status varchar(24) NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS agents_key_unique ON agents (key);
CREATE INDEX IF NOT EXISTS agents_status_idx ON agents (status);
CREATE INDEX IF NOT EXISTS agents_type_idx ON agents (type);
CREATE UNIQUE INDEX IF NOT EXISTS agent_tools_key_unique ON agent_tools (key);
CREATE UNIQUE INDEX IF NOT EXISTS agent_tool_grants_unique ON agent_tool_grants (agent_id, tool_key);
CREATE INDEX IF NOT EXISTS agent_tool_grants_agent_idx ON agent_tool_grants (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_permissions_unique ON agent_permissions (agent_id, permission);
CREATE INDEX IF NOT EXISTS agent_permissions_agent_idx ON agent_permissions (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflows_key_unique ON workflows (key);
CREATE INDEX IF NOT EXISTS workflows_status_idx ON workflows (status);
CREATE INDEX IF NOT EXISTS workflows_next_run_idx ON workflows (next_run_at);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_nodes_key_unique ON workflow_nodes (workflow_id, node_key);
CREATE INDEX IF NOT EXISTS workflow_nodes_workflow_idx ON workflow_nodes (workflow_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_edges_unique ON workflow_edges (workflow_id, from_node, to_node, condition_label);
CREATE INDEX IF NOT EXISTS workflow_edges_workflow_idx ON workflow_edges (workflow_id);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs (workflow_id);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS workflow_runs_started_idx ON workflow_runs (started_at);
CREATE INDEX IF NOT EXISTS workflow_runs_user_idx ON workflow_runs (user_id);
CREATE INDEX IF NOT EXISTS workflow_run_steps_run_idx ON workflow_run_steps (run_id);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON agent_runs (agent_key);
CREATE INDEX IF NOT EXISTS agent_runs_run_idx ON agent_runs (run_id);
CREATE INDEX IF NOT EXISTS agent_runs_status_idx ON agent_runs (status);
CREATE INDEX IF NOT EXISTS agent_runs_started_idx ON agent_runs (started_at);
CREATE INDEX IF NOT EXISTS agent_tasks_status_idx ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS agent_tasks_agent_idx ON agent_tasks (agent_key);
CREATE INDEX IF NOT EXISTS agent_tasks_priority_idx ON agent_tasks (priority, created_at);
CREATE INDEX IF NOT EXISTS agent_task_logs_task_idx ON agent_task_logs (task_id);
CREATE INDEX IF NOT EXISTS agent_approvals_status_idx ON agent_approvals (status);
CREATE INDEX IF NOT EXISTS agent_approvals_task_idx ON agent_approvals (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_budgets_scope_unique ON agent_budgets (scope, scope_key);
CREATE INDEX IF NOT EXISTS customer_profiles_confidence_idx ON customer_profiles (confidence);
CREATE UNIQUE INDEX IF NOT EXISTS customer_memories_unique ON customer_memories (user_id, kind, memory_key);
CREATE INDEX IF NOT EXISTS customer_memories_user_idx ON customer_memories (user_id);
CREATE INDEX IF NOT EXISTS customer_memories_kind_idx ON customer_memories (kind);
CREATE INDEX IF NOT EXISTS recommendations_user_idx ON recommendations (user_id, scenario, status);
CREATE INDEX IF NOT EXISTS recommendations_session_idx ON recommendations (session_id);
CREATE INDEX IF NOT EXISTS recommendations_product_idx ON recommendations (product_id);
CREATE INDEX IF NOT EXISTS recommendations_created_idx ON recommendations (created_at);
CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_events_entity_idx ON analytics_events (entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS entity_embeddings_unique ON entity_embeddings (entity_type, entity_id, model);
CREATE INDEX IF NOT EXISTS entity_embeddings_type_idx ON entity_embeddings (entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS integration_connections_provider_unique ON integration_connections (provider);

-- updated_at maintenance for the new tables
CREATE OR REPLACE FUNCTION homeino_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents','agent_tools','agent_tool_grants','workflows','workflow_nodes',
                           'agent_tasks','agent_budgets','customer_profiles','customer_memories',
                           'entity_embeddings','integration_connections']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON %I', t, t);
    IF t <> 'agent_tool_grants' THEN
      EXECUTE format('CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION homeino_touch_updated_at()', t, t);
    END IF;
  END LOOP;
END $$;

-- Cosine similarity for plain arrays (works without pgvector).
CREATE OR REPLACE FUNCTION homeino_cosine_similarity(a double precision[], b double precision[])
RETURNS double precision AS $$
DECLARE
  dot double precision := 0;
  na double precision := 0;
  nb double precision := 0;
  i int;
BEGIN
  IF a IS NULL OR b IS NULL OR array_length(a, 1) IS DISTINCT FROM array_length(b, 1) THEN
    RETURN 0;
  END IF;
  FOR i IN 1 .. array_length(a, 1) LOOP
    dot := dot + a[i] * b[i];
    na := na + a[i] * a[i];
    nb := nb + b[i] * b[i];
  END LOOP;
  IF na = 0 OR nb = 0 THEN RETURN 0; END IF;
  RETURN dot / (sqrt(na) * sqrt(nb));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- pgvector: optional. When available we add a native vector column + ANN index
-- so semantic search can run in-database; otherwise the array column above and
-- homeino_cosine_similarity() keep the feature working.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available — semantic search falls back to array cosine similarity: %', SQLERRM;
    RETURN;
  END;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'entity_embeddings' AND column_name = 'embedding_vec'
    ) THEN
      ALTER TABLE entity_embeddings ADD COLUMN embedding_vec vector(384);
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS entity_embeddings_vec_idx ON entity_embeddings USING ivfflat (embedding_vec vector_cosine_ops)';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Deny by default: orchestration tables are reachable only through the
--    trusted server (service role). Customers may read their own
--    recommendations / profile / memory and write their own events.
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents','agent_tools','agent_tool_grants','agent_permissions','workflows',
                           'workflow_nodes','workflow_edges','workflow_runs','workflow_run_steps',
                           'agent_runs','agent_tasks','agent_task_logs','agent_approvals','agent_budgets',
                           'customer_profiles','customer_memories','recommendations','analytics_events',
                           'entity_embeddings','integration_connections']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS events_insert_own ON public.analytics_events;
CREATE POLICY events_insert_own ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS events_read_own ON public.analytics_events;
CREATE POLICY events_read_own ON public.analytics_events FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS recommendations_read_own ON public.recommendations;
CREATE POLICY recommendations_read_own ON public.recommendations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id IS NULL AND session_id IS NOT NULL));
DROP POLICY IF EXISTS profiles_read_own ON public.customer_profiles;
CREATE POLICY profiles_read_own ON public.customer_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS memories_read_own ON public.customer_memories;
CREATE POLICY memories_read_own ON public.customer_memories FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS embeddings_read_public ON public.entity_embeddings;
CREATE POLICY embeddings_read_public ON public.entity_embeddings FOR SELECT TO anon, authenticated USING (entity_type = 'product');

-- ------------------------------------------------------------
-- 5. SEED — tool registry
-- ------------------------------------------------------------
INSERT INTO agent_tools (key, name, description, category, required_permission, requires_approval, is_destructive, input_schema)
VALUES
  ('getProduct','دریافت محصول','خواندن یک محصول واقعی از کاتالوگ با id یا SKU','catalog','READ_PRODUCTS',false,false,'{"productId":"string?","sku":"string?"}'),
  ('searchProducts','جستجوی محصول','جستجوی واقعی در کاتالوگ با فیلترهای سبک/رنگ/قیمت/دسته','catalog','READ_PRODUCTS',false,false,'{"q":"string?","categorySlug":"string?","styleSlug":"string?","minPrice":"number?","maxPrice":"number?","limit":"number?"}'),
  ('listProducts','فهرست محصولات','فهرست گرفتن از محصولات فعال برای رتبه‌بندی','catalog','READ_PRODUCTS',false,false,'{"limit":"number?","sort":"string?"}'),
  ('getLowStockProducts','محصولات کم‌موجود','کوئری موجودی زیر آستانه','catalog','READ_INVENTORY',false,false,'{"threshold":"number?"}'),
  ('getInventory','موجودی','خواندن موجودی یک محصول','catalog','READ_INVENTORY',false,false,'{"productId":"string"}'),
  ('getCustomer','پروفایل مشتری','خواندن کاربر و پروفایل او','customer','READ_CUSTOMERS',false,false,'{"userId":"string"}'),
  ('getCustomerPreferences','ترجیحات مشتری','خواندن ترجیحات محاسبه‌شده از رفتار واقعی','customer','READ_CUSTOMERS',false,false,'{"userId":"string"}'),
  ('getCustomerEvents','رویدادهای مشتری','خواندن رویدادهای رفتاری ثبت‌شده','customer','READ_ANALYTICS',false,false,'{"userId":"string?","sessionId":"string?","limit":"number?"}'),
  ('getOrders','سفارش‌ها','خواندن سفارش‌های مشتری','commerce','READ_ORDERS',false,false,'{"userId":"string?","limit":"number?"}'),
  ('getWishlist','علاقه‌مندی‌ها','خواندن لیست علاقه‌مندی مشتری','commerce','READ_CUSTOMERS',false,false,'{"userId":"string?","sessionId":"string?"}'),
  ('getCart','سبد خرید','خواندن سبد خرید','commerce','READ_ORDERS',false,false,'{"userId":"string?","sessionId":"string?"}'),
  ('updateCustomerProfile','به‌روزرسانی پروفایل مشتری','نوشتن پروفایل محاسبه‌شده توسط ایجنت','customer','WRITE_CUSTOMER_PROFILE',false,false,'{"userId":"string","profile":"object"}'),
  ('remember','ثبت حافظه','افزودن/به‌روزرسانی یک رکورد حافظه بلندمدت مشتری','memory','WRITE_CUSTOMER_MEMORY',false,false,'{"userId":"string","kind":"string","key":"string","value":"object"}'),
  ('recall','بازیابی حافظه','جستجوی حافظه مشتری','memory','READ_CUSTOMERS',false,false,'{"userId":"string","query":"string?","kind":"string?"}'),
  ('createRecommendation','ساخت پیشنهاد','ذخیره پیشنهاد محصولات واقعی برای مشتری','recommendation','WRITE_RECOMMENDATIONS',false,false,'{"userId":"string?","scenario":"string","items":"array"}'),
  ('matchProductsBySku','تطبیق SKU','یافتن محصول واقعی با SKU — بدون ساخت SKU جعلی','catalog','READ_PRODUCTS',false,false,'{"sku":"string"}'),
  ('createTask','ساخت وظیفه','افزودن وظیفه به صف وظایف','automation','WRITE_TASKS',false,false,'{"title":"string","type":"string?","payload":"object?"}'),
  ('sendNotification','ارسال اعلان','ثبت اعلان برای کاربر/ادمین (بدون ارسال بیرونی)','automation','SEND_NOTIFICATION',false,false,'{"userId":"string?","type":"string","title":"string","body":"string?"}'),
  ('requestApproval','درخواست تأیید انسانی','ثبت درخواست تأیید برای کارهای پرخطر','automation','REQUEST_APPROVAL',false,false,'{"action":"string","reason":"string?","risk":"string?"}'),
  ('llmComplete','فراخوانی LLM','یک فراخوانی ساختاریافته به لایه LLM (پروایدر قابل تعویض)','ai','CALL_LLM',false,false,'{"system":"string?","prompt":"string","json":"boolean?"}'),
  ('httpRequest','درخواست HTTP','فقط به دامنه‌های مجاز (allowlist)','integration','EXTERNAL_ACTION',true,false,'{"url":"string","method":"string?","body":"object?"}'),
  ('browserTask','وظیفه مرورگر','باز کردن دامنه مجاز و استخراج داده ساختاریافته','integration','BROWSER_AUTOMATION',true,false,'{"url":"string","instruction":"string","action":"string?"}'),
  ('deleteEntity','حذف موجودیت','هر حذف داده — همیشه نیازمند تأیید انسانی','danger','DATABASE_DESTRUCTIVE_WRITE',true,true,'{"entity":"string","id":"string"}'),
  ('updateProductPrice','تغییر قیمت محصول','تغییر قیمت — نیازمند تأیید انسانی','danger','WRITE_PRODUCTS',true,true,'{"productId":"string","price":"number"}'),
  ('cancelOrder','لغو سفارش','لغو سفارش — نیازمند تأیید انسانی','danger','ORDER_CANCEL',true,true,'{"orderId":"string"}'),
  ('refundPayment','بازگشت وجه','بازگشت وجه — نیازمند تأیید انسانی','danger','REFUND',true,true,'{"orderId":"string","amount":"number"}')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 5b. SEED — built-in agents
-- ------------------------------------------------------------
INSERT INTO agents (key, name, description, type, status, runtime, handler, is_builtin, max_retries, timeout_ms, config)
VALUES
  ('customer-intelligence','ایجنت هوش مشتری','تحلیل رفتار واقعی مشتری (رویدادها، بازدیدها، جستجو، سبد، علاقه‌مندی، خرید) و ساخت CustomerProfile','analyzer','active','local','customerIntelligence',true,2,20000,'{"minEvents":3}'::jsonb),
  ('recommendation','ایجنت پیشنهاد','پیشنهاد محصولات واقعی از کاتالوگ با رتبه‌بندی چندعاملی','generator','active','local','recommendation',true,2,25000,'{"limit":12,"scenarios":["home","product_detail","wishlist","cart","account","search","ai_designer"]}'::jsonb),
  ('shopping-assistant','دستیار خرید هوشمند','فهم قصد خرید از متن فارسی، استخراج سبک/رنگ/بودجه/اتاق و یافتن محصول واقعی','assistant','active','local','shoppingAssistant',true,2,25000,'{"maxResults":6}'::jsonb),
  ('inventory','ایجنت موجودی','پایش موجودی کم و ساخت وظیفه برای ادمین/فروشنده','executor','active','local','inventory',true,1,20000,'{"threshold":5}'::jsonb),
  ('designer','ایجنت طراحی AI','پل بین AI Designer و سیستم ایجنتی — تطبیق محصولات واقعی با طرح تولیدشده','generator','active','local','designer',true,2,45000,'{}'::jsonb),
  ('browser','ایجنت مرورگر','اجرای وظایف مرورگری فقط روی دامنه‌های مجاز (Browser Use / Stagehand)','browser','draft','local','browser',true,1,60000,'{"allowedDomains":[],"maxSteps":8}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- permissions for the built-in agents
INSERT INTO agent_permissions (agent_id, permission)
SELECT a.id, p.perm FROM agents a
CROSS JOIN (VALUES
  ('customer-intelligence','READ_CUSTOMERS'),
  ('customer-intelligence','READ_ANALYTICS'),
  ('customer-intelligence','READ_PRODUCTS'),
  ('customer-intelligence','READ_ORDERS'),
  ('customer-intelligence','WRITE_CUSTOMER_PROFILE'),
  ('customer-intelligence','WRITE_CUSTOMER_MEMORY'),
  ('recommendation','READ_PRODUCTS'),
  ('recommendation','READ_CUSTOMERS'),
  ('recommendation','READ_ANALYTICS'),
  ('recommendation','READ_INVENTORY'),
  ('recommendation','WRITE_RECOMMENDATIONS'),
  ('recommendation','CALL_LLM'),
  ('shopping-assistant','READ_PRODUCTS'),
  ('shopping-assistant','READ_CUSTOMERS'),
  ('shopping-assistant','READ_INVENTORY'),
  ('shopping-assistant','CALL_LLM'),
  ('shopping-assistant','WRITE_CUSTOMER_MEMORY'),
  ('inventory','READ_PRODUCTS'),
  ('inventory','READ_INVENTORY'),
  ('inventory','READ_VENDORS'),
  ('inventory','WRITE_TASKS'),
  ('inventory','SEND_NOTIFICATION'),
  ('designer','READ_PRODUCTS'),
  ('designer','READ_CUSTOMERS'),
  ('designer','CALL_LLM'),
  ('designer','WRITE_RECOMMENDATIONS'),
  ('browser','BROWSER_AUTOMATION'),
  ('browser','EXTERNAL_ACTION'),
  ('browser','READ_PRODUCTS')
) AS p(agent_key, perm)
WHERE a.key = p.agent_key
ON CONFLICT (agent_id, permission) DO NOTHING;

-- tool grants for the built-in agents
INSERT INTO agent_tool_grants (agent_id, tool_key)
SELECT a.id, t.tool_key FROM agents a
CROSS JOIN (VALUES
  ('customer-intelligence','getCustomerEvents'),
  ('customer-intelligence','getCustomer'),
  ('customer-intelligence','getCustomerPreferences'),
  ('customer-intelligence','getOrders'),
  ('customer-intelligence','getWishlist'),
  ('customer-intelligence','getCart'),
  ('customer-intelligence','listProducts'),
  ('customer-intelligence','updateCustomerProfile'),
  ('customer-intelligence','remember'),
  ('recommendation','searchProducts'),
  ('recommendation','listProducts'),
  ('recommendation','getProduct'),
  ('recommendation','getCustomerPreferences'),
  ('recommendation','getInventory'),
  ('recommendation','recall'),
  ('recommendation','createRecommendation'),
  ('recommendation','llmComplete'),
  ('shopping-assistant','searchProducts'),
  ('shopping-assistant','getProduct'),
  ('shopping-assistant','matchProductsBySku'),
  ('shopping-assistant','getCustomerPreferences'),
  ('shopping-assistant','getInventory'),
  ('shopping-assistant','llmComplete'),
  ('shopping-assistant','remember'),
  ('inventory','getLowStockProducts'),
  ('inventory','getInventory'),
  ('inventory','createTask'),
  ('inventory','sendNotification'),
  ('designer','getProduct'),
  ('designer','matchProductsBySku'),
  ('designer','searchProducts'),
  ('designer','getCustomerPreferences'),
  ('designer','createRecommendation'),
  ('designer','llmComplete'),
  ('browser','browserTask'),
  ('browser','httpRequest')
) AS t(agent_key, tool_key)
WHERE a.key = t.agent_key
ON CONFLICT (agent_id, tool_key) DO NOTHING;

-- ------------------------------------------------------------
-- 5c. SEED — the three real end-to-end workflows
-- ------------------------------------------------------------
INSERT INTO workflows (key, name, description, status, trigger_kind, trigger, schedule, is_builtin, config)
VALUES
  ('customer-view-intelligence','هوش مشتری از بازدید محصولات','با دیدن محصولات توسط مشتری: پروفایل به‌روز می‌شود و پیشنهادهای واقعی ساخته و ذخیره می‌شوند','active','event','{"eventTypes":["product_view","product_click","product_search","style_view"],"minEvents":3,"windowMinutes":1440}'::jsonb,NULL,true,'{"cooldownMinutes":15}'::jsonb),
  ('wishlist-similar-products','پیشنهاد مشابه از علاقه‌مندی','با افزودن محصول به علاقه‌مندی: تحلیل ترجیح، یافتن محصولات مشابه واقعی و ذخیره پیشنهادها','active','event','{"eventTypes":["wishlist_add"],"minEvents":1}'::jsonb,NULL,true,'{"cooldownMinutes":5}'::jsonb),
  ('low-stock-audit','ممیزی موجودی کم','اجرای دستی/زمان‌بندی‌شده: یافتن محصولات کم‌موجود و ساخت وظیفه برای ادمین و فروشنده','active','manual','{}'::jsonb,'{"kind":"daily","at":"09:00"}'::jsonb,true,'{"threshold":5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- nodes: workflow 1
INSERT INTO workflow_nodes (workflow_id, node_key, type, label, agent_key, config, order_index)
SELECT w.id, v.node_key, v.type::workflow_node_type, v.label, v.agent_key, v.config::jsonb, v.ord
FROM workflows w
CROSS JOIN (VALUES
  ('n1','trigger','روی بازدید محصول',NULL,'{"eventTypes":["product_view","product_click","product_search","style_view"]}',1),
  ('n2','condition','حداقل ۳ رویداد در ۲۴ ساعت',NULL,'{"expression":"eventCount >= 3"}',2),
  ('n3','agent','تحلیل رفتار مشتری','customer-intelligence','{"outputKey":"profile"}',3),
  ('n4','agent','ساخت پیشنهاد محصولات واقعی','recommendation','{"inputFrom":"profile","scenario":"home","outputKey":"recommendations"}',4),
  ('n5','db_update','ذخیره پیشنهادها',NULL,'{"table":"recommendations","from":"recommendations"}',5),
  ('n6','end','پایان',NULL,'{}',6)
) AS v(node_key, type, label, agent_key, config, ord)
WHERE w.key = 'customer-view-intelligence'
ON CONFLICT (workflow_id, node_key) DO NOTHING;

INSERT INTO workflow_edges (workflow_id, from_node, to_node, condition_label, order_index)
SELECT w.id, v.f, v.t, v.c, v.ord FROM workflows w
CROSS JOIN (VALUES ('n1','n2',NULL,1),('n2','n3','true',2),('n2','n6','false',3),('n3','n4',NULL,4),('n4','n5',NULL,5),('n5','n6',NULL,6)) AS v(f,t,c,ord)
WHERE w.key = 'customer-view-intelligence'
ON CONFLICT (workflow_id, from_node, to_node, condition_label) DO NOTHING;

-- nodes: workflow 2
INSERT INTO workflow_nodes (workflow_id, node_key, type, label, agent_key, config, order_index)
SELECT w.id, v.node_key, v.type::workflow_node_type, v.label, v.agent_key, v.config::jsonb, v.ord
FROM workflows w
CROSS JOIN (VALUES
  ('n1','trigger','روی افزودن به علاقه‌مندی',NULL,'{"eventTypes":["wishlist_add"]}',1),
  ('n2','db_query','خواندن محصول واقعی',NULL,'{"query":"product","from":"event.entityId","outputKey":"product"}',2),
  ('n3','agent','تحلیل ترجیح و به‌روزرسانی حافظه','customer-intelligence','{"inputFrom":"product","outputKey":"profile"}',3),
  ('n4','recommendation','یافتن محصولات مشابه واقعی','recommendation','{"scenario":"wishlist","seedFrom":"product","outputKey":"recommendations"}',4),
  ('n5','db_update','ذخیره لیست پیشنهاد',NULL,'{"table":"recommendations","from":"recommendations"}',5),
  ('n6','end','پایان',NULL,'{}',6)
) AS v(node_key, type, label, agent_key, config, ord)
WHERE w.key = 'wishlist-similar-products'
ON CONFLICT (workflow_id, node_key) DO NOTHING;

INSERT INTO workflow_edges (workflow_id, from_node, to_node, condition_label, order_index)
SELECT w.id, v.f, v.t, v.c, v.ord FROM workflows w
CROSS JOIN (VALUES ('n1','n2',NULL,1),('n2','n3',NULL,2),('n3','n4',NULL,3),('n4','n5',NULL,4),('n5','n6',NULL,5)) AS v(f,t,c,ord)
WHERE w.key = 'wishlist-similar-products'
ON CONFLICT (workflow_id, from_node, to_node, condition_label) DO NOTHING;

-- nodes: workflow 3
INSERT INTO workflow_nodes (workflow_id, node_key, type, label, agent_key, config, order_index)
SELECT w.id, v.node_key, v.type::workflow_node_type, v.label, v.agent_key, v.config::jsonb, v.ord
FROM workflows w
CROSS JOIN (VALUES
  ('n1','trigger','اجرای دستی/زمان‌بندی',NULL,'{"kind":"manual"}',1),
  ('n2','schedule','هر روز ساعت ۰۹:۰۰',NULL,'{"kind":"daily","at":"09:00"}',2),
  ('n3','agent','ممیزی موجودی','inventory','{"threshold":5,"outputKey":"lowStock"}',3),
  ('n4','condition','اگر محصول کم‌موجود وجود دارد',NULL,'{"expression":"lowStock.count > 0"}',4),
  ('n5','notification','اعلان به ادمین',NULL,'{"audience":"admin","title":"محصولات کم‌موجود","from":"lowStock"}',5),
  ('n6','end','پایان',NULL,'{}',6)
) AS v(node_key, type, label, agent_key, config, ord)
WHERE w.key = 'low-stock-audit'
ON CONFLICT (workflow_id, node_key) DO NOTHING;

INSERT INTO workflow_edges (workflow_id, from_node, to_node, condition_label, order_index)
SELECT w.id, v.f, v.t, v.c, v.ord FROM workflows w
CROSS JOIN (VALUES ('n1','n2',NULL,1),('n2','n3',NULL,2),('n3','n4',NULL,3),('n4','n5','true',4),('n4','n6','false',5),('n5','n6',NULL,6)) AS v(f,t,c,ord)
WHERE w.key = 'low-stock-audit'
ON CONFLICT (workflow_id, from_node, to_node, condition_label) DO NOTHING;

-- ------------------------------------------------------------
-- 5d. SEED — integration connection placeholders (inactive, no secrets)
-- ------------------------------------------------------------
INSERT INTO integration_connections (provider, label, base_url, secret_env_var, auth_scheme, capabilities, is_active, config)
VALUES
  ('dify','Dify — Workflow + Agent Platform','https://api.dify.ai/v1','DIFY_API_KEY','bearer',ARRAY['workflow','agent','tools'],false,'{"docs":"https://docs.dify.ai"}'::jsonb),
  ('langflow','Langflow — Agent/Workflow Builder',NULL,'LANGFLOW_API_KEY','x-api-key',ARRAY['workflow','agent'],false,'{"docs":"https://docs.langflow.org"}'::jsonb),
  ('ollama','Ollama — مدل‌های Open Source محلی','http://127.0.0.1:11434',NULL,'none',ARRAY['llm','embeddings'],false,'{"chatPath":"/api/chat","embedPath":"/api/embed","tagsPath":"/api/tags"}'::jsonb),
  ('mem0','Mem0 — حافظه بلندمدت ایجنت','https://api.mem0.ai','MEM0_API_KEY','token',ARRAY['memory'],false,'{"addPath":"/v2/memories/","searchPath":"/v2/memories/search/"}'::jsonb),
  ('browser_use','Browser Use — ایجنت مرورگر','https://api.browser-use.com','BROWSER_USE_API_KEY','x-api-key',ARRAY['browser'],false,'{"maxSteps":8,"allowedDomains":[]}'::jsonb),
  ('stagehand','Stagehand — اتوماسیون مرورگر (Playwright)',NULL,'BROWSERBASE_API_KEY','bearer',ARRAY['browser'],false,'{"primitives":["act","extract","observe"]}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

-- ------------------------------------------------------------
-- 5e. SEED — default global budget (0 = unlimited until admin sets it)
-- ------------------------------------------------------------
INSERT INTO agent_budgets (scope, scope_key, daily_limit_micro, monthly_limit_micro, per_run_limit_micro, max_runs_per_day, is_active)
VALUES ('global', NULL, 0, 0, 0, 0, true)
ON CONFLICT (scope, scope_key) DO NOTHING;
