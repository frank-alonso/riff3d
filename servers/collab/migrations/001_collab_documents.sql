-- Migration: Create collab_documents table for Y.Doc persistence
-- This table stores the binary Yjs document state (base64-encoded)
-- for real-time collaboration sessions.

CREATE TABLE IF NOT EXISTS collab_documents (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  ydoc_state TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on updated_at for cleanup/monitoring queries
CREATE INDEX IF NOT EXISTS idx_collab_documents_updated_at
  ON collab_documents(updated_at);

-- RLS: Only the service role can read/write collab_documents
-- (Hocuspocus server uses service role key, not client-side access)
ALTER TABLE collab_documents ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (service_role bypasses RLS by default,
-- but explicit policy documents intent)
CREATE POLICY "Service role can manage collab documents"
  ON collab_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
