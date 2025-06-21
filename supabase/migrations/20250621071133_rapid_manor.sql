-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS public_match_document_chunks(UUID, vector(1536), INT);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), INT, UUID);

-- Create or replace the public chunk search function
CREATE OR REPLACE FUNCTION public_match_document_chunks(
  chatbot_id_param UUID,
  query_embedding vector(1536),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  user_id UUID,
  chunk_text TEXT,
  embedding vector(1536),
  chunk_index INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the chatbot exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM chatbots 
    WHERE chatbots.id = chatbot_id_param 
    AND chatbots.status = 'active'
  ) THEN
    RETURN;
  END IF;

  -- Get the knowledge base ID for this chatbot
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.chunk_text,
    dc.embedding,
    dc.chunk_index,
    dc.created_at,
    dc.updated_at,
    (1 - (dc.embedding <=> query_embedding)) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  JOIN chatbots c ON d.knowledge_base_id = c.knowledge_base_id
  WHERE c.id = chatbot_id_param
    AND c.status = 'active'
    AND d.status = 'processed'
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public_match_document_chunks(UUID, vector(1536), INT) TO anon;
GRANT EXECUTE ON FUNCTION public_match_document_chunks(UUID, vector(1536), INT) TO authenticated;

-- Ensure the existing match_document_chunks function works for authenticated users
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  user_id UUID,
  chunk_text TEXT,
  embedding vector(1536),
  chunk_index INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.chunk_text,
    dc.embedding,
    dc.chunk_index,
    dc.created_at,
    dc.updated_at,
    (1 - (dc.embedding <=> query_embedding)) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE (user_id IS NULL OR dc.user_id = user_id)
    AND d.status = 'processed'
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), INT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), INT, UUID) TO authenticated;