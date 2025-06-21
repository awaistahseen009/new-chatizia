import OpenAI from 'openai';

// Initialize OpenAI client
export const openai = import.meta.env.VITE_OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    })
  : null;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  sources?: string[];
}

export const generateChatResponse = async (
  messages: ChatMessage[],
  context?: string
): Promise<ChatResponse> => {
  if (!openai) {
    // Return a demo response when OpenAI is not configured
    return {
      message: "I'm currently in demo mode. To enable full AI capabilities, please configure your OpenAI API key.",
      sources: context ? ['Knowledge Base'] : undefined
    };
  }

  try {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are a helpful AI assistant. ${
        context 
          ? `Use the following context to answer questions when relevant:\n\n${context}\n\nIf the context doesn't contain relevant information, use your general knowledge.`
          : 'Answer questions using your general knowledge.'
      }`
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemMessage, ...messages],
      max_tokens: 500,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    return {
      message,
      sources: context ? ['Knowledge Base'] : undefined
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      message: "I'm experiencing some technical difficulties. Please try again later.",
      sources: undefined
    };
  }
};