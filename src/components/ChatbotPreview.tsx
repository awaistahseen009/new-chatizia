import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Mic, Volume2, Minimize2, Maximize2, Brain, ExternalLink, Play, Pause, MicOff, FileText, Expand, MessageSquare, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useChatbot as useChatbotContext } from '../contexts/ChatbotContext';
import { useChatbot } from '../hooks/useChatbot';
import { openai } from '../lib/openai';

interface ChatbotPreviewProps {
  visible: boolean;
  onClose: () => void;
  chatbot?: any;
  embedded?: boolean;
  positionClass?: string;
  sizeClass?: string;
}

interface VoiceMessage {
  audioUrl: string;
  duration?: number;
  isPlaying?: boolean;
}

interface ExtendedMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: string[];
  voice?: VoiceMessage;
  image?: string;
  imageText?: string;
}

const ChatbotPreview: React.FC<ChatbotPreviewProps> = ({ visible, onClose, chatbot: propChatbot, embedded = false, positionClass = 'bottom-6 right-6', sizeClass = 'w-80' }) => {
  let selectedBot = null;
  try {
    const context = useChatbotContext();
    selectedBot = context?.selectedBot;
  } catch (error) {
    console.log('ChatbotProvider context not available - using prop chatbot');
  }

  const bot = propChatbot || selectedBot;
  const { messages: hookMessages, isTyping, sendMessage, initializeChat } = useChatbot(bot);
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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showImageError, setShowImageError] = useState(false);
  const [imageErrorMessage, setImageErrorMessage] = useState('');
  const [messageHistory, setMessageHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const VOICE_ID = '56AoDkrOh6qfVPDXZ7Pt';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkMicrophoneSupport = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setMicrophoneSupported(false);
        return;
      }
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permission.state === 'denied') {
          setMicrophoneSupported(false);
          return;
        }
      }
      setMicrophoneSupported(true);
    };
    checkMicrophoneSupport();
  }, []);

  useEffect(() => {
    if (bot && visible) {
      initializeChat();
    }
  }, [bot, visible]);

  useEffect(() => {
    const extendedMessages: ExtendedMessage[] = hookMessages.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp,
      sources: msg.sources,
    }));
    setMessages(extendedMessages);
    
    // Update message history for API calls (last 5 messages)
    const history = extendedMessages.slice(-5).map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.text
    }));
    setMessageHistory(history);
  }, [hookMessages]);

  useEffect(() => {
    if (replyMode === 'voice' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'bot' && !lastMessage.voice && !isTyping) {
        generateBotVoiceResponse(lastMessage);
      }
    }
  }, [messages, replyMode, isTyping]);

  const generateBotVoiceResponse = async (message: ExtendedMessage) => {
    if (!ELEVENLABS_API_KEY) {
      setErrorMessage('Voice features unavailable: API key missing');
      return;
    }
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true }
        }),
      });
      if (!response.ok) throw new Error(`Text-to-speech failed: ${await response.text()}`);
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setMessages(prev => prev.map(msg => msg.id === message.id ? { ...msg, voice: { audioUrl, duration: 0 } } : msg));
    } catch (error) {
      setErrorMessage('Failed to generate bot voice response');
    }
  };

  const handleImageUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageErrorMessage('Please upload an image file (PNG, JPG, JPEG, GIF, WebP)');
      setShowImageError(true);
      return;
    }

    // Validate file size (3MB limit)
    if (file.size > 3 * 1024 * 1024) {
      setImageErrorMessage('Image size must be less than 3MB. Please choose a smaller image.');
      setShowImageError(true);
      return;
    }

    if (!OPENAI_API_KEY) {
      setImageErrorMessage('OpenAI API key is required for image processing');
      setShowImageError(true);
      return;
    }

    setIsProcessingImage(true);
    setErrorMessage(null);

    try {
      // Convert image to base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log('🖼️ Processing image with OpenAI Vision API...');

      // Extract text from image using OpenAI Vision API
      const visionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract and transcribe all text visible in this image. If there is no text, describe what you see in the image. Be detailed and accurate.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const extractedText = visionResponse.choices[0]?.message?.content || 'No text could be extracted from this image.';
      
      console.log('✅ Text extracted from image:', extractedText);

      // Create user message with image and extracted text
      const userImageMessage: ExtendedMessage = {
        id: `image-${Date.now()}`,
        text: `[Image uploaded] ${extractedText}`,
        sender: 'user',
        timestamp: new Date(),
        image: base64Image,
        imageText: extractedText
      };

      setMessages(prev => [...prev, userImageMessage]);

      // Update message history with the extracted text
      const newHistory = [...messageHistory, { role: 'user' as const, content: extractedText }].slice(-5);
      setMessageHistory(newHistory);

      // Send the extracted text to the chatbot for processing
      await sendMessage(extractedText);

    } catch (error) {
      console.error('❌ Image processing failed:', error);
      setErrorMessage('Failed to process image. Please try again.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    if (!OPENAI_API_KEY || !microphoneSupported) {
      setErrorMessage(!OPENAI_API_KEY ? 'Voice features require OpenAI API key' : 'Microphone not supported or permission denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        if (audioBlob.size > 0) await processVoiceMessage(audioBlob, recordingTime);
        else setErrorMessage('No audio data captured');
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setErrorMessage(null);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (error) {
      setErrorMessage((error as Error).name === 'NotAllowedError' ? 'Microphone permission denied' : 'Failed to access microphone');
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
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });
      const transcribedText = typeof transcription === 'string' ? transcription : transcription.text;
      if (!transcribedText?.trim()) throw new Error('No speech detected');
      const audioUrl = URL.createObjectURL(audioBlob);
      const userVoiceMessage: ExtendedMessage = { id: `voice-${Date.now()}`, text: transcribedText, sender: 'user', timestamp: new Date(), voice: { audioUrl } };
      setMessages(prev => [...prev, userVoiceMessage]);
      
      // Update message history
      const newHistory = [...messageHistory, { role: 'user' as const, content: transcribedText }].slice(-5);
      setMessageHistory(newHistory);
      
      await sendMessage(transcribedText);
    } catch (error) {
      setErrorMessage((error as Error).message.includes('API key') ? 'Voice transcription failed: Check OpenAI API key' : 'Voice processing failed');
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
      audio.onended = () => setPlayingMessageId(null);
      audio.onerror = () => {
        setPlayingMessageId(null);
        setErrorMessage('Failed to play audio message');
      };
    }
    if (playingMessageId === messageId) {
      audio.pause();
      setPlayingMessageId(null);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => setPlayingMessageId(messageId)).catch(() => setErrorMessage('Failed to play audio message'));
    }
  };

  const toggleTranscript = (messageId: string) => {
    setShowTranscript(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;
    
    // Update message history
    const newHistory = [...messageHistory, { role: 'user' as const, content: inputText.trim() }].slice(-5);
    setMessageHistory(newHistory);
    
    await sendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleWidget = () => {
    setIsWidgetOpen(!isWidgetOpen);
  };

  const closeImageError = () => {
    setShowImageError(false);
    setImageErrorMessage('');
  };

  if (!visible) return null;

  const botConfig = bot || {
    id: 'preview-bot',
    name: 'AI Assistant',
    description: '',
    configuration: {
      primaryColor: '#2563eb',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?',
      useCustomImage: false,
      botImage: '',
      size: 'normal',
    }
  };

  const safeConfig = {
    primaryColor: '#2563eb',
    position: 'bottom-right',
    welcomeMessage: 'Hello! How can I help you today?',
    useCustomImage: false,
    botImage: '',
    size: 'normal',
    ...botConfig.configuration
  };

  const safeName = botConfig.name || 'AI Assistant';
  const primaryColor = safeConfig.primaryColor || '#2563eb';
  const botImage = safeConfig.botImage;
  const useCustomImage = safeConfig.useCustomImage && botImage;
  const position = safeConfig.position || 'bottom-right';
  const size = safeConfig.size || 'normal';

  const sizeClasses = {
    compact: 'w-64',
    normal: 'w-80',
    large: 'w-96',
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    center: 'bottom-6 left-1/2 transform -translate-x-1/2',
  };

  if (embedded && !isWidgetOpen) {
    return (
      <div className={`fixed z-60 ${positionClasses[position]}`}>
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

  let containerClasses = '';
if (embedded) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-0 right-0 w-full max-w-[400px] h-[600px] z-50',
    'bottom-left': 'fixed bottom-0 left-0 w-full max-w-[400px] h-[600px] z-50',
    'center': 'fixed top-0 left-0 w-full h-full z-50'
  };
  containerClasses = positionClasses[position as keyof typeof positionClasses] || positionClasses['bottom-right'];
} else {
  containerClasses = isFullscreen 
    ? "fixed inset-0 z-50" 
    : "fixed right-6 top-20 bottom-6 w-80 z-50";
}

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
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
                  >
                    <Expand className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                    title={isMinimized ? 'Maximize' : 'Minimize'}
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4 text-slate-400" /> : <Minimize2 className="w-4 h-4 text-slate-400" />}
                  </button>
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
                    <button onClick={() => setErrorMessage(null)} className="ml-2 underline">
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
                          message.sender === 'user' ? 'text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                        style={message.sender === 'user' ? { backgroundColor: primaryColor } : {}}
                      >
                        {message.image && (
                          <div className="mb-2">
                            <img 
                              src={message.image} 
                              alt="Uploaded image" 
                              className="max-w-full h-auto rounded-lg border border-white/20"
                              style={{ maxHeight: '200px' }}
                            />
                            {message.imageText && (
                              <div className="mt-2 p-2 bg-black/10 rounded text-xs">
                                <strong>Extracted text:</strong> {message.imageText}
                              </div>
                            )}
                          </div>
                        )}
                        {message.voice && replyMode === 'voice' && (
                          <div className="mb-2">
                            <div className="flex items-center space-x-2 bg-black/10 rounded-lg p-2">
                              <button
                                onClick={() => playVoiceMessage(message.id, message.voice!.audioUrl)}
                                className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                              >
                                {playingMessageId === message.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
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
                {isProcessingImage && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2 max-w-[85%]">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <ImageIcon className="w-3 h-3" />
                      </div>
                      <div className="bg-blue-100 px-3 py-2 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-blue-700">Processing image...</span>
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
                        disabled={isTyping || isProcessingImage}
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Upload image"
                        disabled={isTyping || isProcessingImage}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    
                      <button
                        onClick={handleSendMessage}
                        className="p-2 text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: primaryColor }}
                        disabled={!inputText.trim() || isTyping || isProcessingImage}
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

      {/* Image Error Modal */}
      {showImageError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Image Upload Error</h3>
              </div>
            </div>
            
            <p className="text-slate-700 mb-6">{imageErrorMessage}</p>
            
            <div className="flex justify-end">
              <button
                onClick={closeImageError}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotPreview;