-- =====================================================================
-- Embedding dimension fix (Task 55 — توصیه‌گر با دادهٔ واقعی)
-- The old vector(384) column matched NO configured embedder
-- (local lexical = 256, nomic = 768, OpenAI = 1536) so the ivfflat
-- index stayed empty forever. The default production embedder is the
-- deterministic local model `homeino-lexical-v1` (256 dims) — the
-- vector column now matches it. Rows with other dims keep the
-- portable `embedding double precision[]` column only.
-- =====================================================================

alter table public.entity_embeddings drop column if exists embedding_vec;
alter table public.entity_embeddings add column embedding_vec vector(256);
create index if not exists entity_embeddings_vec_idx
  on public.entity_embeddings using ivfflat (embedding_vec vector_cosine_ops);
