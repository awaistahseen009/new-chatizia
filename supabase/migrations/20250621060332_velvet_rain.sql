/*
  # Create user interactions table for sentiment tracking

  1. New Tables
    - `user_interactions` - Store user interaction data with sentiment analysis
      - `id` (uuid, primary key)
      - `chatbot_id` (uuid, foreign key to chatbots)
      - `email` (text, nullable)
      - `name` (text, nullable)
      - `phone` (text, nullable)
      - `sentiment` (text, check constraint for positive/neutral/negative)
      - `reaction` (text, check constraint for good/neutral/worse)
      - `conversation_history` (text array)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on user_interactions table
    - Add policies for chatbot owners to read their interactions
    - Allow public insert for embedded chatbots
*/

-- Create user_interactions table
CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  email text,
  name text,
  phone text,
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  reaction text NOT NULL CHECK (reaction IN ('good', 'neutral', 'worse')),
  conversation_history text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Chatbot owners can read their interactions"
  ON user_interactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = user_interactions.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow public insert for embedded chatbots"
  ON user_interactions
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = user_interactions.chatbot_id 
      AND chatbots.status = 'active'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_chatbot_id ON user_interactions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_interactions_sentiment ON user_interactions(sentiment);
CREATE INDEX IF NOT EXISTS idx_user_interactions_reaction ON user_interactions(reaction);

-- Grant necessary permissions
GRANT SELECT, INSERT ON user_interactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_interactions TO authenticated;