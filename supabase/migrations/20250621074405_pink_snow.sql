/*
  # Add geolocation support and fix conversation schema

  1. Updates to user_interactions table
    - Add ip_address column for storing user IP
    - Add ip_geolocation column (JSONB) for storing location data
    - Add conversation_id column to link interactions to conversations

  2. Updates to conversations table
    - Add ip_address column for tracking conversation location
    - Add user_agent column for browser information

  3. Security
    - Update RLS policies to handle new columns
    - Ensure proper permissions for geolocation data
*/

-- Add columns to user_interactions table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interactions' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE user_interactions ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interactions' AND column_name = 'ip_geolocation'
  ) THEN
    ALTER TABLE user_interactions ADD COLUMN ip_geolocation jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interactions' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE user_interactions ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add columns to conversations table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE conversations ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE conversations ADD COLUMN user_agent text;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_ip_address ON user_interactions(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_interactions_conversation_id ON user_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_ip_address ON conversations(ip_address);

-- Update the add_session_message function to capture IP and user agent
CREATE OR REPLACE FUNCTION add_session_message(
  chatbot_id_param UUID,
  session_id_param TEXT,
  content_param TEXT,
  role_param TEXT,
  ip_address_param TEXT DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
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

  -- Create conversation record if it doesn't exist, with IP and user agent
  INSERT INTO conversations (id, chatbot_id, session_id, ip_address, user_agent, created_at, updated_at)
  VALUES (conversation_record_id, chatbot_id_param, session_id_param, ip_address_param, user_agent_param, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET 
    updated_at = NOW(),
    ip_address = COALESCE(conversations.ip_address, ip_address_param),
    user_agent = COALESCE(conversations.user_agent, user_agent_param);

  -- Insert the message
  INSERT INTO messages (conversation_id, content, role, created_at)
  VALUES (conversation_record_id, content_param, role_param, NOW())
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Create function to store user interaction with geolocation
CREATE OR REPLACE FUNCTION store_user_interaction(
  chatbot_id_param UUID,
  conversation_id_param UUID DEFAULT NULL,
  email_param TEXT DEFAULT NULL,
  name_param TEXT DEFAULT NULL,
  phone_param TEXT DEFAULT NULL,
  sentiment_param TEXT DEFAULT 'neutral',
  reaction_param TEXT DEFAULT 'neutral',
  ip_address_param TEXT DEFAULT NULL,
  ip_geolocation_param JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  interaction_id UUID;
BEGIN
  -- Insert user interaction
  INSERT INTO user_interactions (
    chatbot_id,
    conversation_id,
    email,
    name,
    phone,
    sentiment,
    reaction,
    ip_address,
    ip_geolocation,
    created_at
  )
  VALUES (
    chatbot_id_param,
    conversation_id_param,
    email_param,
    name_param,
    phone_param,
    sentiment_param,
    reaction_param,
    ip_address_param,
    ip_geolocation_param,
    NOW()
  )
  RETURNING id INTO interaction_id;

  RETURN interaction_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION store_user_interaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION store_user_interaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;