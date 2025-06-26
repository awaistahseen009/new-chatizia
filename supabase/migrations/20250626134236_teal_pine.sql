/*
  # Admin System Setup

  1. Updates
    - Add admin role support to users table
    - Create admin-specific policies
    - Add blocked user functionality
    - Create admin access functions

  2. Security
    - Ensure only admins can access admin functions
    - Maintain data security while allowing admin oversight
*/

-- Add admin role check function
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id 
    AND (email = 'admin@chatizia.com' OR subscription_status = 'admin')
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;

-- Create admin policies for users table
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for chatbots table
CREATE POLICY "Admins can read all chatbots"
  ON chatbots
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all chatbots"
  ON chatbots
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all chatbots"
  ON chatbots
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for messages table
CREATE POLICY "Admins can read all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for documents table
CREATE POLICY "Admins can read all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete all documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for conversations table
CREATE POLICY "Admins can read all conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for user_interactions table
CREATE POLICY "Admins can read all user interactions"
  ON user_interactions
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for knowledge_bases table
CREATE POLICY "Admins can read all knowledge bases"
  ON knowledge_bases
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for document_chunks table
CREATE POLICY "Admins can read all document chunks"
  ON document_chunks
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Create admin policies for chatbot_domains table
CREATE POLICY "Admins can read all chatbot domains"
  ON chatbot_domains
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Function to get admin statistics
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_users INTEGER;
  total_chatbots INTEGER;
  total_messages INTEGER;
  total_documents INTEGER;
  active_users INTEGER;
  blocked_users INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get counts
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO total_chatbots FROM chatbots;
  SELECT COUNT(*) INTO total_messages FROM messages;
  SELECT COUNT(*) INTO total_documents FROM documents;
  SELECT COUNT(*) INTO active_users FROM users WHERE subscription_status != 'blocked';
  SELECT COUNT(*) INTO blocked_users FROM users WHERE subscription_status = 'blocked';

  -- Build result
  result := json_build_object(
    'totalUsers', total_users,
    'totalChatbots', total_chatbots,
    'totalMessages', total_messages,
    'totalDocuments', total_documents,
    'activeUsers', active_users,
    'blockedUsers', blocked_users
  );

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;

-- Function to block/unblock users
CREATE OR REPLACE FUNCTION admin_update_user_status(
  target_user_id UUID,
  new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Prevent admin from blocking themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify your own account status';
  END IF;

  -- Update user status
  UPDATE users 
  SET subscription_status = new_status
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_update_user_status(UUID, TEXT) TO authenticated;

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_email_admin ON users(email) WHERE email = 'admin@chatizia.com';

-- Update the subscription status check constraint to include 'admin' and 'blocked'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_status_check 
  CHECK (subscription_status = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'enterprise'::text, 'admin'::text, 'blocked'::text]));