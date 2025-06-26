import { useState, useEffect } from 'react';
import { useDocuments } from './useDocuments';
import { generateChatResponse, ChatMessage } from '../lib/openai';
import { analyzeSentiment, SentimentResult } from '../lib/sentimentAnalysis';
import { Chatbot } from '../lib/supabase';
import { supabase } from '../lib/supabase';

export interface ChatbotMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: string[];
}

export const useChatbot = (chatbot: Chatbot | null) => {
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentResult[]>([]);
  const [isEscalated, setIsEscalated] = useState(false);
  const { fetchSimilarChunks } = useDocuments();

  // Helper function to get user's IP address and user agent
  const getUserInfo = () => {
    const userAgent = navigator.userAgent;
    // Note: Getting real IP requires a service call, for now we'll use a placeholder
    return {
      userAgent,
      ipAddress: null // Will be populated by server-side logic if needed
    };
  };

  const sendMessage = async (userMessage: string): Promise<void> => {
    if (!chatbot) return;

    // Add user message to UI immediately
    const userChatMessage: ChatbotMessage = {
      id: `user-${Date.now()}`,
      text: userMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userChatMessage]);
    setIsTyping(true);

    try {
      // Create session ID if it doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setCurrentSessionId(sessionId);
        console.log('🔄 Created new session:', sessionId);
      }

      // Get user info for tracking
      const userInfo = getUserInfo();

      // Store user message using session-based approach with user info
      console.log('💾 Storing user message with session ID...');
      const { data: userMessageData, error: userMessageError } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: chatbot.id,
          session_id_param: sessionId,
          content_param: userMessage,
          role_param: 'user',
          ip_address_param: userInfo.ipAddress,
          user_agent_param: userInfo.userAgent
        });

      if (userMessageError) {
        console.error('❌ Failed to store user message:', userMessageError);
        throw new Error('Failed to store user message');
      }

      console.log('✅ User message stored successfully');

      // Analyze sentiment of the last 5 messages (including current one) - only if not escalated
      const recentMessages = [...messages.slice(-4), userChatMessage]
        .filter(msg => msg.sender === 'user')
        .map(msg => msg.text);

      if (recentMessages.length > 0 && !isEscalated) {
        console.log('🔍 Analyzing sentiment...');
        const sentimentResult = await analyzeSentiment(recentMessages);
        setSentimentHistory(prev => [...prev.slice(-4), sentimentResult]);

        console.log('📊 Sentiment analysis result:', sentimentResult);

        // Check if escalation is needed
        if (sentimentResult.shouldEscalate) {
          console.log('🚨 User seems frustrated, but continuing with AI assistance...');
          setIsEscalated(true);
          
          // Add empathy message
          const empathyMessage: ChatbotMessage = {
            id: `empathy-${Date.now()}`,
            text: "I understand this might be frustrating. Let me do my best to help you with this issue.",
            sender: 'bot',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, empathyMessage]);
        }
      }

      let context = '';
      let sources: string[] = [];

      // If chatbot has a knowledge base, search for relevant chunks
      if (chatbot.knowledge_base_id) {
        console.log('🔍 Searching knowledge base for relevant content...');
        // Pass chatbot ID for public access in embedded mode
        const similarChunks = await fetchSimilarChunks(userMessage, 5, chatbot.id);
        
        if (similarChunks.length > 0) {
          // Create comprehensive context from chunks
          context = similarChunks
            .map((chunk, index) => `[Source ${index + 1}]: ${chunk.chunk_text}`)
            .join('\n\n');
          
          sources = similarChunks.map((chunk, index) => `Knowledge Base - Chunk ${index + 1}`);
          console.log(`✅ Found ${similarChunks.length} relevant chunks, context length: ${context.length} characters`);
          console.log('📄 Context preview:', context.substring(0, 200) + '...');
        } else {
          console.log('ℹ️ No relevant chunks found in knowledge base');
        }
      }

      // Prepare chat history for context
      const chatHistory: ChatMessage[] = messages
        .slice(-5) // Last 5 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Add current user message
      chatHistory.push({
        role: 'user',
        content: userMessage
      });

      // Generate response using OpenAI with enhanced context handling
      console.log('🤖 Generating AI response with context...');
      console.log('📊 Context available:', !!context);
      console.log('📊 Context length:', context.length);
      
      const response = await generateChatResponse(chatHistory, context, chatbot.configuration?.personality);

      // Add bot response to UI
      const botMessage: ChatbotMessage = {
        id: `bot-${Date.now()}`,
        text: response.message,
        sender: 'bot',
        timestamp: new Date(),
        sources: response.sources || (sources.length > 0 ? sources : undefined),
      };

      setMessages(prev => [...prev, botMessage]);

      // Store bot message using session-based approach
      console.log('💾 Storing bot message with session ID...');
      const { data: botMessageData, error: botMessageError } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: chatbot.id,
          session_id_param: sessionId,
          content_param: response.message,
          role_param: 'assistant',
          ip_address_param: userInfo.ipAddress,
          user_agent_param: userInfo.userAgent
        });

      if (botMessageError) {
        console.error('❌ Failed to store bot message:', botMessageError);
        // Don't throw error here as the user already sees the response
      } else {
        console.log('✅ Bot response stored successfully');
      }

    } catch (error) {
      console.error('❌ Error generating bot response:', error);
      
      // Add error message
      const errorMessage: ChatbotMessage = {
        id: `bot-error-${Date.now()}`,
        text: "I apologize, but I'm experiencing some technical difficulties. Please try again later.",
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const initializeChat = () => {
    if (!chatbot) return;

    const welcomeMessage: ChatbotMessage = {
      id: 'welcome',
      text: chatbot.configuration?.welcomeMessage || "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);
    setCurrentSessionId(null); // Reset session
    setSentimentHistory([]);
    setIsEscalated(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSentimentHistory([]);
    setIsEscalated(false);
  };

  return {
    messages,
    isTyping,
    sentimentHistory,
    isEscalated,
    sendMessage,
    initializeChat,
    clearChat,
  };
};import { useState, useEffect } from 'react';
import { useDocuments } from './useDocuments';
import { generateChatResponse, ChatMessage } from '../lib/openai';
import { analyzeSentiment, SentimentResult } from '../lib/sentimentAnalysis';
import { Chatbot } from '../lib/supabase';
import { supabase } from '../lib/supabase';

export interface ChatbotMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: string[];
}

export const useChatbot = (chatbot: Chatbot | null) => {
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentResult[]>([]);
  const [isEscalated, setIsEscalated] = useState(false);
  const { fetchSimilarChunks } = useDocuments();

  // Helper function to get user's IP address and user agent
  const getUserInfo = () => {
    const userAgent = navigator.userAgent;
    // Note: Getting real IP requires a service call, for now we'll use a placeholder
    return {
      userAgent,
      ipAddress: null // Will be populated by server-side logic if needed
    };
  };

  const sendMessage = async (userMessage: string): Promise<void> => {
    if (!chatbot) return;

    // Add user message to UI immediately
    const userChatMessage: ChatbotMessage = {
      id: `user-${Date.now()}`,
      text: userMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userChatMessage]);
    setIsTyping(true);

    try {
      // Create session ID if it doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setCurrentSessionId(sessionId);
        console.log('🔄 Created new session:', sessionId);
      }

      // Get user info for tracking
      const userInfo = getUserInfo();

      // Store user message using session-based approach with user info
      console.log('💾 Storing user message with session ID...');
      const { data: userMessageData, error: userMessageError } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: chatbot.id,
          session_id_param: sessionId,
          content_param: userMessage,
          role_param: 'user',
          ip_address_param: userInfo.ipAddress,
          user_agent_param: userInfo.userAgent
        });

      if (userMessageError) {
        console.error('❌ Failed to store user message:', userMessageError);
        throw new Error('Failed to store user message');
      }

      console.log('✅ User message stored successfully');

      // Analyze sentiment of the last 5 messages (including current one) - only if not escalated
      const recentMessages = [...messages.slice(-4), userChatMessage]
        .filter(msg => msg.sender === 'user')
        .map(msg => msg.text);

      if (recentMessages.length > 0 && !isEscalated) {
        console.log('🔍 Analyzing sentiment...');
        const sentimentResult = await analyzeSentiment(recentMessages);
        setSentimentHistory(prev => [...prev.slice(-4), sentimentResult]);

        console.log('📊 Sentiment analysis result:', sentimentResult);

        // Check if escalation is needed
        if (sentimentResult.shouldEscalate) {
          console.log('🚨 User seems frustrated, but continuing with AI assistance...');
          setIsEscalated(true);
          
          // Add empathy message
          const empathyMessage: ChatbotMessage = {
            id: `empathy-${Date.now()}`,
            text: "I understand this might be frustrating. Let me do my best to help you with this issue.",
            sender: 'bot',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, empathyMessage]);
        }
      }

      let context = '';
      let sources: string[] = [];

      // If chatbot has a knowledge base, search for relevant chunks
      if (chatbot.knowledge_base_id) {
        console.log('🔍 Searching knowledge base for relevant content...');
        // Pass chatbot ID for public access in embedded mode
        const similarChunks = await fetchSimilarChunks(userMessage, 5, chatbot.id);
        
        if (similarChunks.length > 0) {
          // Create comprehensive context from chunks
          context = similarChunks
            .map((chunk, index) => `[Source ${index + 1}]: ${chunk.chunk_text}`)
            .join('\n\n');
          
          sources = similarChunks.map((chunk, index) => `Knowledge Base - Chunk ${index + 1}`);
          console.log(`✅ Found ${similarChunks.length} relevant chunks, context length: ${context.length} characters`);
          console.log('📄 Context preview:', context.substring(0, 200) + '...');
        } else {
          console.log('ℹ️ No relevant chunks found in knowledge base');
        }
      }

      // Prepare chat history for context
      const chatHistory: ChatMessage[] = messages
        .slice(-5) // Last 5 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Add current user message
      chatHistory.push({
        role: 'user',
        content: userMessage
      });

      // Generate response using OpenAI with enhanced context handling
      console.log('🤖 Generating AI response with context...');
      console.log('📊 Context available:', !!context);
      console.log('📊 Context length:', context.length);
      
      const response = await generateChatResponse(chatHistory, context, chatbot.configuration?.personality);

      // Add bot response to UI
      const botMessage: ChatbotMessage = {
        id: `bot-${Date.now()}`,
        text: response.message,
        sender: 'bot',
        timestamp: new Date(),
        sources: response.sources || (sources.length > 0 ? sources : undefined),
      };

      setMessages(prev => [...prev, botMessage]);

      // Store bot message using session-based approach
      console.log('💾 Storing bot message with session ID...');
      const { data: botMessageData, error: botMessageError } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: chatbot.id,
          session_id_param: sessionId,
          content_param: response.message,
          role_param: 'assistant',
          ip_address_param: userInfo.ipAddress,
          user_agent_param: userInfo.userAgent
        });

      if (botMessageError) {
        console.error('❌ Failed to store bot message:', botMessageError);
        // Don't throw error here as the user already sees the response
      } else {
        console.log('✅ Bot response stored successfully');
      }

    } catch (error) {
      console.error('❌ Error generating bot response:', error);
      
      // Add error message
      const errorMessage: ChatbotMessage = {
        id: `bot-error-${Date.now()}`,
        text: "I apologize, but I'm experiencing some technical difficulties. Please try again later.",
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const initializeChat = () => {
    if (!chatbot) return;

    const welcomeMessage: ChatbotMessage = {
      id: 'welcome',
      text: chatbot.configuration?.welcomeMessage || "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);
    setCurrentSessionId(null); // Reset session
    setSentimentHistory([]);
    setIsEscalated(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSentimentHistory([]);
    setIsEscalated(false);
  };

  return {
    messages,
    isTyping,
    sentimentHistory,
    isEscalated,
    sendMessage,
    initializeChat,
    clearChat,
  };
};