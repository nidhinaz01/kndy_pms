-- Disable Row-Level Security (RLS) on R&D document tables
-- This allows all operations without RLS policies

-- Disable RLS on rnd_document_submissions
ALTER TABLE public.rnd_document_submissions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on rnd_document_requirements
ALTER TABLE public.rnd_document_requirements DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
-- You can check with:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('rnd_document_submissions', 'rnd_document_requirements');

COMMENT ON TABLE public.rnd_document_submissions IS 'R&D document submissions - RLS disabled';
COMMENT ON TABLE public.rnd_document_requirements IS 'R&D document requirements - RLS disabled';

