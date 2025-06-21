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
  context?: string,
  personality?: string
): Promise<ChatResponse> => {
  if (!openai) {
    // Return a demo response when OpenAI is not configured
    return {
      message: "I'm currently in demo mode. To enable full AI capabilities, please configure your OpenAI API key.",
      sources: context ? ['Knowledge Base'] : undefined
    };
  }

  try {
    // Enhanced system message with better context handling
    let systemContent = `You are a helpful AI assistant`;
    
    if (personality) {
      const personalityMap: Record<string, string> = {
        'professional': 'You are professional, formal, and business-oriented in your responses.',
        'friendly': 'You are warm, approachable, and conversational in your responses.',
        'helpful': 'You are supportive, patient, and focused on solving problems.',
        'casual': 'You are relaxed, informal, and easy-going in your responses.',
        'formal': 'You are polite, structured, and maintain professional boundaries.'
      };
      systemContent += `. ${personalityMap[personality] || personalityMap['helpful']}`;
    }

    if (context && context.trim().length > 0) {
      systemContent += `

IMPORTANT: You have access to relevant information from the knowledge base. Use this information to provide accurate, specific answers when relevant to the user's question.

KNOWLEDGE BASE CONTEXT:
${context}

INSTRUCTIONS:
1. If the user's question can be answered using the knowledge base context, prioritize that information
2. Provide specific, detailed answers based on the context when available
3. If the context doesn't fully answer the question, combine it with your general knowledge
4. Always be helpful and informative
5. If you use information from the knowledge base, you can mention that you found relevant information in the knowledge base
6. Don't mention "context" or "knowledge base" unless it's natural to do so`;
    } else {
      systemContent += '. Answer questions using your general knowledge and be as helpful as possible.';
    }

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemContent
    };

    console.log('🤖 Sending to OpenAI with system message length:', systemContent.length);
    console.log('🤖 Context being used:', !!context && context.length > 0);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemMessage, ...messages],
      max_tokens: 800,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log('✅ OpenAI response generated, length:', message.length);

    return {
      message,
      sources: context && context.trim().length > 0 ? ['Knowledge Base'] : undefined
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      message: "I'm experiencing some technical difficulties. Please try again later.",
      sources: undefined
    };
  }
};