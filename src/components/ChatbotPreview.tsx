import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Mic, Volume2, Minimize2, Maximize2, Brain, ExternalLink, Play, Pause, MicOff, FileText, Expand, MessageSquare, Upload, Image as ImageIcon, File } from 'lucide-react';
import { useChatbot as useChatbotContext } from '../contexts/ChatbotContext';
import { useChatbot } from '../hooks/useChatbot';
import { useGeolocation } from '../hooks/useGeolocation';
import { openai } from '../lib/openai';
import { supabase } from '../lib/supabase';

interface ChatbotPreviewProps {
  visible: boolean;
  onClose: () => void;
  chatbot?: any;
  embedded?: boolean;
}

interface VoiceMessage {
  audioUrl: string;
  duration?: number;
  isPlaying?: boolean;
}

interface FileAttachment {
  id: string;
  type: 'image' | 'pdf';
  name: string;
  url: string;
  extractedText?: string;
}

interface ExtendedMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: string[];
  voice?: VoiceMessage;
  attachments?: FileAttachment[];
}

const ChatbotPreview: React.FC<ChatbotPreviewProps> = ({ visible, onClose, chatbot: propChatbot, embedded = false }) => {
  // Safely use context - it might not be available in embedded mode
  let selectedBot = null;
  try {
    const context = useChatbotContext();
    selectedBot = context?.selectedBot;
  } catch (error) {
    // Context not available, which is fine for embedded mode
    console.log('ChatbotProvider context not available - using prop chatbot');
  }

  const bot = propChatbot || selectedBot;
  const { messages: hookMessages, isTyping, sendMessage, initializeChat } = useChatbot(bot);
  const { location, storeUserLocation } = useGeolocation();
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replyMode, setReplyMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState<Record<string, boolean>>({});
  const [microphoneSupported, setMicrophoneSupported] = useState(true);
  const [isWidgetMode, setIsWidgetMode] = useState(embedded);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [userInfo, setUserInfo] = useState<{name?: string, email?: string, phone?: string}>({});
  const [showUserInfoForm, setShowUserInfoForm] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [sessionStarted, setSessionStarted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ElevenLabs configuration
  const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const VOICE_ID = '56AoDkrOh6qfVPDXZ7Pt';

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Store user location when session starts
  useEffect(() => {
    if (bot && visible && !sessionStarted && location) {
      setSessionStarted(true);
      storeUserLocation(bot.id, {
        sentiment: 'neutral',
        reaction: 'neutral'
      });
    }
  }, [bot, visible, location, sessionStarted, storeUserLocation]);

  // Check microphone permissions and support
  useEffect(() => {
    const checkMicrophoneSupport = async () => {
      try {
        if (!window.isSecureContext) {
          console.log('⚠️ Microphone requires secure context (HTTPS)');
          setMicrophoneSupported(false);
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log('⚠️ getUserMedia not supported');
          setMicrophoneSupported(false);
          return;
        }

        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permission.state === 'denied') {
            console.log('⚠️ Microphone permission denied');
            setMicrophoneSupported(false);
            return;
          }
        }

        setMicrophoneSupported(true);
      } catch (error) {
        console.log('⚠️ Error checking microphone support:', error);
        setMicrophoneSupported(false);
      }
    };

    checkMicrophoneSupport();
  }, []);

  useEffect(() => {
    if (bot && visible) {
      initializeChat();
    }
  }, [bot, visible]);

  // Convert hook messages to extended messages
  useEffect(() => {
    const extendedMessages: ExtendedMessage[] = hookMessages.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp,
      sources: msg.sources,
    }));
    setMessages(extendedMessages);
  }, [hookMessages]);

  // Auto-generate voice for bot responses in voice mode (but don't auto-play)
  useEffect(() => {
    if (replyMode === 'voice' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'bot' && !lastMessage.voice && !isTyping) {
        generateBotVoiceResponse(lastMessage);
      }
    }
  }, [messages, replyMode, isTyping]);

  // Sentiment analysis after every 3 messages
  useEffect(() => {
    if (messageCount > 0 && messageCount % 3 === 0) {
      analyzeSentiment();
    }
  }, [messageCount]);

  const analyzeSentiment = async () => {
    if (!OPENAI_API_KEY || conversationHistory.length < 2) return;

    try {
      const recentMessages = conversationHistory.slice(-6).join('\n');
      
      const response = await openai?.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Analyze the sentiment of this conversation. Respond with only: "positive", "neutral", or "negative"`
          },
          {
            role: 'user',
            content: recentMessages
          }
        ],
        max_tokens: 10,
        temperature: 0.1,
      });

      const sentiment = response?.choices[0]?.message?.content?.toLowerCase().trim() as 'positive' | 'neutral' | 'negative';
      
      if (sentiment === 'negative') {
        setShowUserInfoForm(true);
        // Add empathetic response
        const empathyMessage: ExtendedMessage = {
          id: `empathy-${Date.now()}`,
          text: "I understand this might be frustrating. I'd like to help you better. Could you please share your name and email so I can provide more personalized assistance?",
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, empathyMessage]);
        
        // Store interaction in database
        await storeUserInteraction(sentiment, 'worse');
      } else {
        // Store positive/neutral interactions periodically
        if (messageCount % 5 === 0) {
          await storeUserInteraction(sentiment, sentiment === 'positive' ? 'good' : 'neutral');
        }
      }
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
    }
  };

  const storeUserInteraction = async (sentiment: 'positive' | 'neutral' | 'negative', reaction: 'good' | 'neutral' | 'worse') => {
    if (!bot) return;

    try {
      const { error } = await supabase
        .from('user_interactions')
        .insert([
          {
            chatbot_id: bot.id,
            email: userInfo.email,
            name: userInfo.name,
            phone: userInfo.phone,
            sentiment,
            reaction,
            conversation_history: conversationHistory,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('Failed to store user interaction:', error);
      }
    } catch (error) {
      console.error('Error storing user interaction:', error);
    }
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const response = await openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text content from this image. Return only the text, no additional commentary.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      return response?.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Image text extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const arrayBuffer = await file.arrayBuffer();
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      if (pdf.numPages > 5) {
        throw new Error('PDF must not exceed 5 pages');
      }

      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item: any) => item.str && item.str.trim())
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      return fullText.trim();
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isPDF) {
      setErrorMessage('Please upload only images or PDF files');
      return;
    }

    // Validate file size for images (5MB limit)
    if (isImage && file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    setUploadingFile(true);
    setErrorMessage(null);

    try {
      let extractedText = '';
      
      if (isImage) {
        extractedText = await extractTextFromImage(file);
      } else if (isPDF) {
        extractedText = await extractTextFromPDF(file);
      }

      // Create file URL for display
      const fileUrl = URL.createObjectURL(file);

      const attachment: FileAttachment = {
        id: `file-${Date.now()}`,
        type: isImage ? 'image' : 'pdf',
        name: file.name,
        url: fileUrl,
        extractedText
      };

      // Store extracted text for use in conversation
      setExtractedText(prev => prev + '\n\n' + extractedText);

      // Add user message with attachment
      const userMessage: ExtendedMessage = {
        id: `user-file-${Date.now()}`,
        text: extractedText ? `I've uploaded a ${isImage ? 'image' : 'PDF'}: ${file.name}. ${extractedText.substring(0, 100)}...` : `I've uploaded a ${isImage ? 'image' : 'PDF'}: ${file.name}`,
        sender: 'user',
        timestamp: new Date(),
        attachments: [attachment]
      };

      setMessages(prev => [...prev, userMessage]);
      setConversationHistory(prev => [...prev, userMessage.text]);
      setMessageCount(prev => prev + 1);

      // Send message with extracted text context
      if (extractedText) {
        await sendMessage(`I've uploaded a ${isImage ? 'image' : 'PDF'} file. Here's the content: ${extractedText}`);
      }

      setShowFileUpload(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setUploadingFile(false);
    }
  };

  const generateBotVoiceResponse = async (message: ExtendedMessage) => {
    if (!ELEVENLABS_API_KEY) {
      console.warn('ElevenLabs API key not configured');
      setErrorMessage('Voice features unavailable: API key missing');
      return;
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Text-to-speech failed: ${response.status} ${errorText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, voice: { audioUrl, duration: 0 } }
          : msg
      ));

    } catch (error) {
      console.error('Failed to generate voice response:', error);
      setErrorMessage('Failed to generate bot voice response');
    }
  };

  const startRecording = async () => {
    if (!OPENAI_API_KEY) {
      setErrorMessage('Voice features require OpenAI API key in VITE_OPENAI_API_KEY');
      return;
    }

    if (!microphoneSupported) {
      setErrorMessage('Microphone not supported or permission denied. Voice features require HTTPS and microphone permissions.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size > 0) {
          console.log(`Audio Blob Size: ${audioBlob.size} bytes, Duration: ${recordingTime}s, Type: ${audioBlob.type}`);
          await processVoiceMessage(audioBlob, recordingTime);
        } else {
          setErrorMessage('No audio data captured. Please try again.');
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setErrorMessage(null);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Microphone permission denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError') {
          setErrorMessage('No microphone found. Please connect a microphone and try again.');
        } else {
          setErrorMessage('Failed to access microphone. Please check permissions and try again.');
        }
      } else {
        setErrorMessage('Failed to access microphone. Please check permissions and try again.');
      }
      setMicrophoneSupported(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const processVoiceMessage = async (audioBlob: Blob, durationSeconds: number) => {
    setIsProcessingVoice(true);
    
    try {
      console.log(`Sending audio: Size=${audioBlob.size} bytes, Type=${audioBlob.type}, Duration=${durationSeconds}s`);

      if (!openai) {
        throw new Error('OpenAI client not initialized. Please check your API key configuration.');
      }

      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      console.log('Transcription response:', transcription);
      
      const transcribedText = typeof transcription === 'string' ? transcription : transcription.text;

      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('No speech detected in the recording. Please speak clearly and try again.');
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      const userVoiceMessage: ExtendedMessage = {
        id: `voice-${Date.now()}`,
        text: transcribedText,
        sender: 'user',
        timestamp: new Date(),
        voice: { audioUrl }
      };

      setMessages(prev => [...prev, userVoiceMessage]);
      setConversationHistory(prev => [...prev, transcribedText]);
      setMessageCount(prev => prev + 1);
      await sendMessage(transcribedText);

    } catch (error) {
      console.error('Voice processing failed:', error);
      const message = error instanceof Error 
        ? error.message.includes('API key') 
          ? 'Voice transcription failed: Please check your OpenAI API key configuration.'
          : error.message
        : 'Voice processing failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsProcessingVoice(false);
      setRecordingTime(0);
    }
  };

  const playVoiceMessage = (messageId: string, audioUrl: string) => {
    audioRefs.current.forEach((audio, id) => {
      if (id !== messageId) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    let audio = audioRefs.current.get(messageId);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRefs.current.set(messageId, audio);
      
      audio.onended = () => {
        setPlayingMessageId(null);
      };
      
      audio.onerror = () => {
        console.error('Audio playback error');
        setPlayingMessageId(null);
        setErrorMessage('Failed to play audio message');
      };
    }

    if (playingMessageId === messageId) {
      audio.pause();
      setPlayingMessageId(null);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => {
        setPlayingMessageId(messageId);
      }).catch(error => {
        console.error('Audio play error:', error);
        setErrorMessage('Failed to play audio message');
      });
    }
  };

  const toggleTranscript = (messageId: string) => {
    setShowTranscript(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const messageText = inputText.trim();
    setInputText('');
    setConversationHistory(prev => [...prev, messageText]);
    setMessageCount(prev => prev + 1);

    // Include extracted text context if available
    const contextualMessage = extractedText ? `${messageText}\n\nContext from uploaded files: ${extractedText}` : messageText;
    await sendMessage(contextualMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUserInfoSubmit = (info: {name: string, email: string, phone: string}) => {
    setUserInfo(info);
    setShowUserInfoForm(false);
    
    // Store the user info in the database
    storeUserInteraction('neutral', 'neutral');
    
    const thankYouMessage: ExtendedMessage = {
      id: `thanks-${Date.now()}`,
      text: `Thank you, ${info.name}! I have your contact information. How can I better assist you now?`,
      sender: 'bot',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, thankYouMessage]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleWidget = () => {
    if (embedded) {
      setIsWidgetOpen(!isWidgetOpen);
    }
  };

  if (!visible) return null;

  // Ensure we have a valid bot configuration with safe defaults
  const botConfig = bot || {
    id: 'preview-bot',
    name: 'AI Assistant',
    description: '',
    configuration: {
      primaryColor: '#2563eb',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?',
      useCustomImage: false,
      botImage: ''
    }
  };

  // Ensure configuration exists with safe defaults
  const safeConfig = {
    primaryColor: '#2563eb',
    position: 'bottom-right',
    welcomeMessage: 'Hello! How can I help you today?',
    useCustomImage: false,
    botImage: '',
    ...botConfig.configuration
  };

  // Ensure name is always a string
  const safeName = botConfig.name || 'AI Assistant';
  const primaryColor = safeConfig.primaryColor || '#2563eb';
  const botImage = safeConfig.botImage;
  const useCustomImage = safeConfig.useCustomImage && botImage;

  // Widget mode for embedded chatbot - show widget button when closed
  if (embedded && !isWidgetOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleWidget}
          className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:scale-110 hover:shadow-xl"
          style={{ backgroundColor: primaryColor }}
        >
          {useCustomImage ? (
            <img 
              src={botImage} 
              alt={safeName}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
              }}
            />
          ) : (
            <MessageSquare className="w-8 h-8" />
          )}
        </button>
      </div>
    );
  }

  // Determine container classes based on fullscreen state and embedded mode
  const containerClasses = embedded 
    ? "fixed bottom-6 right-6 w-96 h-[600px] z-50" 
    : isFullscreen 
      ? "fixed inset-0 z-50" 
      : "fixed right-6 top-20 bottom-6 w-80 z-50";

  return (
    <>
      <div className={containerClasses}>
        <div className="bg-white rounded-lg shadow-2xl border border-slate-200 h-full flex flex-col overflow-hidden">
          <div 
            className="p-4 border-b border-slate-200 flex items-center justify-between"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden"
                style={{ backgroundColor: useCustomImage ? 'transparent' : primaryColor }}
              >
                {useCustomImage ? (
                  <img 
                    src={botImage} 
                    alt={safeName}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.style.backgroundColor = primaryColor;
                      target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                    }}
                  />
                ) : (
                  safeName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h3 className="font-medium text-slate-800">{safeName}</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-xs text-slate-500">
                    Online
                    {embedded ? '' : ' • Preview Mode'}
                  </p>
                  {bot?.knowledge_base_id && (
                    <div className="flex items-center space-x-1 ml-2">
                      <Brain className="w-3 h-3 text-purple-500" />
                      <span className="text-xs text-purple-600">KB</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {embedded && (
                <button
                  onClick={toggleWidget}
                  className="p-1 rounded hover:bg-slate-100 transition-colors"
                  title="Close chat"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
              {!embedded && (
                <>
                  {!isFullscreen && (
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="p-1 rounded hover:bg-slate-100 transition-colors"
                      title="Expand to fullscreen"
                    >
                      <Expand className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  {isFullscreen && (
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="p-1 rounded hover:bg-slate-100 transition-colors"
                      title="Exit fullscreen"
                    >
                      <Minimize2 className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </>
              )}
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-center space-x-1 bg-white rounded-lg p-1">
                  <button
                    onClick={() => setReplyMode('text')}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      replyMode === 'text' 
                        ? 'bg-blue-100 text-blue-700 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>Text</span>
                  </button>
                  <button
                    onClick={() => setReplyMode('voice')}
                    disabled={!microphoneSupported}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      replyMode === 'voice' 
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    } ${!microphoneSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Voice</span>
                  </button>
                </div>
                {!microphoneSupported && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Voice features require HTTPS and microphone permissions
                  </p>
                )}
                {!OPENAI_API_KEY && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Voice features require OpenAI API key
                  </p>
                )}
                {errorMessage && (
                  <div className="mt-2 p-2 bg-red-100 text-red-600 text-xs text-center rounded">
                    {errorMessage}
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="ml-2 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex items-start space-x-2 max-w-[85%]">
                      {message.sender === 'bot' && (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1 overflow-hidden"
                          style={{ backgroundColor: useCustomImage ? 'transparent' : primaryColor }}
                        >
                          {useCustomImage ? (
                            <img 
                              src={botImage} 
                              alt={safeName}
                              className="w-full h-full object-cover rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.style.backgroundColor = primaryColor;
                                target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                              }}
                            />
                          ) : (
                            safeName.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      <div
                        className={`px-3 py-2 rounded-lg ${
                          message.sender === 'user'
                            ? 'text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                        style={
                          message.sender === 'user' 
                            ? { backgroundColor: primaryColor }
                            : {}
                        }
                      >
                        {/* File attachments */}
                        {message.attachments && message.attachments.map((attachment) => (
                          <div key={attachment.id} className="mb-2">
                            {attachment.type === 'image' ? (
                              <img 
                                src={attachment.url} 
                                alt={attachment.name}
                                className="max-w-full h-auto rounded-lg mb-2"
                                style={{ maxHeight: '200px' }}
                              />
                            ) : (
                              <div className="flex items-center space-x-2 bg-black/10 rounded-lg p-2 mb-2">
                                <File className="w-4 h-4" />
                                <span className="text-sm">{attachment.name}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Voice message display - only show in voice mode */}
                        {message.voice && replyMode === 'voice' && (
                          <div className="mb-2">
                            <div className="flex items-center space-x-2 bg-black/10 rounded-lg p-2">
                              <button
                                onClick={() => playVoiceMessage(message.id, message.voice!.audioUrl)}
                                className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                              >
                                {playingMessageId === message.id ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </button>
                              <div className="flex-1 h-1 bg-white/20 rounded-full">
                                <div className="h-full bg-white/40 rounded-full" style={{ width: '0%' }}></div>
                              </div>
                              <Volume2 className="w-3 h-3 opacity-60" />
                              {message.sender === 'user' && (
                                <button
                                  onClick={() => toggleTranscript(message.id)}
                                  className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                  title="Toggle transcript"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Text content - show transcript only if toggled on for user voice messages, or always for text/bot messages */}
                        {(replyMode === 'text' || 
                          !message.voice || 
                          message.sender === 'bot' ||
                          (message.sender === 'user' && showTranscript[message.id])) && (
                          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        )}
                        
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="flex items-center space-x-1 text-xs text-slate-500">
                              <Brain className="w-3 h-3" />
                              <span>Sources: Knowledge Base</span>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2 max-w-[85%]">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1 overflow-hidden"
                        style={{ backgroundColor: useCustomImage ? 'transparent' : primaryColor }}
                      >
                        {useCustomImage ? (
                          <img 
                            src={botImage} 
                            alt={safeName}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.style.backgroundColor = primaryColor;
                              target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                            }}
                          />
                        ) : (
                          safeName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="bg-slate-100 px-3 py-2 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-slate-200">
                {replyMode === 'text' ? (
                  <div className="flex items-end space-x-2">
                    <div className="flex-1 relative">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:border-transparent outline-none text-sm resize-none"
                        style={{ focusRingColor: primaryColor }}
                        rows={1}
                        disabled={isTyping}
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => setShowFileUpload(!showFileUpload)}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Attach file"
                        disabled={isTyping}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSendMessage}
                        className="p-2 text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: primaryColor }}
                        disabled={!inputText.trim() || isTyping}
                        title="Send message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={!OPENAI_API_KEY || !microphoneSupported}
                          className={`p-4 rounded-full transition-all duration-200 ${
                            isRecording 
                              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110' 
                              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={
                            !microphoneSupported 
                              ? 'Microphone not supported or permission denied'
                              : !OPENAI_API_KEY
                              ? 'OpenAI API key required for voice features'
                              : isRecording 
                              ? 'Stop recording' 
                              : 'Start voice recording'
                          }
                        >
                          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        
                        {isRecording && (
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-slate-700">
                              {formatTime(recordingTime)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-slate-500">
                        {!microphoneSupported
                          ? 'Voice features require HTTPS and microphone permissions'
                          : isRecording 
                          ? 'Recording... Tap the microphone to stop'
                          : 'Tap the microphone to start recording'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center space-x-2">
                    {bot?.knowledge_base_id && (
                      <div className="flex items-center space-x-1">
                        <Brain className="w-3 h-3 text-purple-500" />
                        <span className="text-purple-600">Knowledge base connected</span>
                      </div>
                    )}
                    {replyMode === 'voice' && ELEVENLABS_API_KEY && (
                      <div className="flex items-center space-x-1">
                        <Volume2 className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600">Voice AI enabled</span>
                      </div>
                    )}
                  </div>
                  
                  {OPENAI_API_KEY ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>AI powered</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>Demo mode</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Upload File</h3>
              <button
                onClick={() => setShowFileUpload(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-2">
                  Upload an image or PDF file
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Images: Max 5MB • PDFs: Max 5 pages
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploadingFile ? 'Processing...' : 'Choose File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info Form Modal */}
      {showUserInfoForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Contact Information</h3>
              <button
                onClick={() => setShowUserInfoForm(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleUserInfoSubmit({
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotPreview;