/*
  # Remove Agent System and Simplify to Chatbots Only

  1. Changes
    - Remove all agent-related tables (if they exist)
    - Remove agent_id column from messages table (if it exists)
    - Clean up agent-related indexes and functions
    - Simplify RLS policies for chatbot-only functionality
    - Update add_session_message function to remove agent parameters

  2. Security
    - Maintain proper RLS policies for chatbot functionality
    - Ensure public access for embedded chatbots
    - Clean up permissions
*/

-- Drop agent-related tables only if they exist
DO $$
BEGIN
  -- Drop agent_notifications table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_notifications') THEN
    DROP TABLE agent_notifications CASCADE;
  END IF;
  
  -- Drop conversation_agents table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_agents') THEN
    DROP TABLE conversation_agents CASCADE;
  END IF;
  
  -- Drop agent_assignments table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_assignments') THEN
    DROP TABLE agent_assignments CASCADE;
  END IF;
  
  -- Drop agents table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
    DROP TABLE agents CASCADE;
  END IF;
END $$;

-- Remove agent_id column from messages table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE messages DROP COLUMN agent_id;
  END IF;
END $$;

-- Drop agent-related indexes if they exist
DROP INDEX IF EXISTS idx_messages_agent_id;
DROP INDEX IF EXISTS idx_messages_agent_id_conversation_id;
DROP INDEX IF EXISTS idx_agents_user_id;
DROP INDEX IF EXISTS idx_agents_agent_id;
DROP INDEX IF EXISTS idx_agents_email;
DROP INDEX IF EXISTS idx_agent_assignments_agent_id;
DROP INDEX IF EXISTS idx_agent_assignments_chatbot_id;
DROP INDEX IF EXISTS idx_agent_assignments_check;
DROP INDEX IF EXISTS idx_conversation_agents_conversation_id;
DROP INDEX IF EXISTS idx_conversation_agents_agent_id;
DROP INDEX IF EXISTS idx_conversation_agents_conversation_id_agent_id;
DROP INDEX IF EXISTS idx_conversation_agents_check;
DROP INDEX IF EXISTS idx_agent_notifications_agent_id;
DROP INDEX IF EXISTS idx_agent_notifications_conversation_id;
DROP INDEX IF EXISTS idx_agent_notifications_created_at;
DROP INDEX IF EXISTS idx_agent_notifications_is_read;

-- Drop agent-related functions if they exist
DROP FUNCTION IF EXISTS update_agents_updated_at();
DROP FUNCTION IF EXISTS get_agent_assignments(UUID);

-- Drop the old add_session_message function with agent_id parameter
DROP FUNCTION IF EXISTS add_session_message(UUID, TEXT, TEXT, TEXT, UUID);

-- Create the simplified add_session_message function without agent_id parameter
CREATE OR REPLACE FUNCTION add_session_message(
  chatbot_id_param UUID,
  session_id_param TEXT,
  content_param TEXT,
  role_param TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conversation_id_hash TEXT;
  conversation_record_id UUID;
  message_id UUID;
  chatbot_record RECORD;
BEGIN
  -- Get chatbot information
  SELECT * INTO chatbot_record FROM chatbots WHERE id = chatbot_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chatbot not found';
  END IF;

  -- Generate consistent conversation ID from chatbot_id and session_id
  conversation_id_hash := encode(digest(chatbot_id_param::text || '_session_' || session_id_param, 'sha256'), 'hex');
  conversation_record_id := (substring(conversation_id_hash from 1 for 8) ||
                           '-' || substring(conversation_id_hash from 9 for 4) ||
                           '-4' || substring(conversation_id_hash from 13 for 3) ||
                           '-' || substring(conversation_id_hash from 16 for 4) ||
                           '-' || substring(conversation_id_hash from 20 for 12))::UUID;

  -- Create conversation record if it doesn't exist
  INSERT INTO conversations (id, chatbot_id, session_id, created_at, updated_at)
  VALUES (conversation_record_id, chatbot_id_param, session_id_param, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

  -- Insert the message
  INSERT INTO messages (conversation_id, content, role, created_at)
  VALUES (conversation_record_id, content_param, role_param, NOW())
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Clean up message policies - remove agent-related policies if they exist
DO $$
BEGIN
  -- Drop agent-related policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Agents can insert messages for assigned conversations" ON messages;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Agents can read messages from assigned conversations" ON messages;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Ensure clean message policies for chatbot functionality
DROP POLICY IF EXISTS "Public can read messages for active chatbot sessions" ON messages;
CREATE POLICY "Public can read messages for active chatbot sessions"
  ON messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Public can insert messages for active chatbot sessions" ON messages;
CREATE POLICY "Public can insert messages for active chatbot sessions"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

-- Ensure authenticated users can manage their chatbot messages
DROP POLICY IF EXISTS "Authenticated users can add messages to their chatbot conversat" ON messages;
DROP POLICY IF EXISTS "Authenticated users can add messages to their chatbot conversations" ON messages;
CREATE POLICY "Authenticated users can add messages to their chatbot conversations"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read their chatbot messages" ON messages;
CREATE POLICY "Authenticated users can read their chatbot messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.user_id = auth.uid()
    )
  );

-- Clean up conversation policies
DROP POLICY IF EXISTS "Allow conversation creation for active chatbots" ON conversations;
CREATE POLICY "Allow conversation creation for active chatbots"
  ON conversations
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Allow conversation updates for sessions" ON conversations;
CREATE POLICY "Allow conversation updates for sessions"
  ON conversations
  FOR UPDATE
  TO public
  USING (
    session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Public can read session conversations" ON conversations;
CREATE POLICY "Public can read session conversations"
  ON conversations
  FOR SELECT
  TO public
  USING (
    session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Allow conversation reading for chatbot owners" ON conversations;
CREATE POLICY "Allow conversation reading for chatbot owners"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "allow_anonymous_conversation_insert" ON conversations;
CREATE POLICY "allow_anonymous_conversation_insert"
  ON conversations
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Clean up any remaining agent-related policies on other tables
DO $$
BEGIN
  -- Try to revoke permissions from tables that might not exist
  BEGIN
    REVOKE ALL ON agent_assignments FROM anon;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  
  BEGIN
    REVOKE ALL ON conversation_agents FROM anon;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  
  BEGIN
    REVOKE ALL ON agent_notifications FROM anon;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  
  BEGIN
    REVOKE ALL ON agents FROM anon;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END $$;

-- Ensure proper permissions for simplified chatbot system
GRANT SELECT, INSERT, UPDATE ON conversations TO anon;
GRANT SELECT, INSERT ON messages TO anon;
GRANT SELECT ON chatbots TO anon;

-- Ensure proper permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatbots TO authenticated;