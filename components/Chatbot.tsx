import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, StoreData, LatLng } from '../types';
import { GoogleGenAI, GenerateContentResponse, Chat, Tool, RetrievalConfig } from '@google/genai';
import { GEMINI_MODEL_FLASH } from '../constants';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // For GitHub Flavored Markdown

interface ChatbotProps {
  stores: StoreData[];
  selectedStore: StoreData | null;
  userLocation: LatLng | null;
}

// Helper to extract grounding URIs from GenerateContentResponse
const extractGroundingUris = (response: GenerateContentResponse): string[] => {
  const uris: string[] = [];
  if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
    for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        uris.push(chunk.web.uri);
      }
      if (chunk.maps?.uri) {
        uris.push(chunk.maps.uri);
      }
      // Ensure placeAnswerSources is an array before iterating
      if (Array.isArray(chunk.maps?.placeAnswerSources)) {
        for (const source of chunk.maps.placeAnswerSources) {
          if (source.reviewSnippets) {
            for (const snippet of source.reviewSnippets) {
              if (snippet.uri) {
                uris.push(snippet.uri);
              }
            }
          }
        }
      }
    }
  }
  return uris;
};

const Chatbot: React.FC<ChatbotProps> = ({ stores, selectedStore, userLocation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gemini chat instance
  const chatRef = useRef<Chat | null>(null);

  // Initialize Gemini chat only once on component mount
  useEffect(() => {
    try {
      if (!process.env.API_KEY) {
        console.error("API_KEY is not defined. Please ensure it's set in the environment.");
        // Fallback message to user if API key is missing
        setMessages(prev => [...prev, { role: 'model', parts: 'Error: API Key missing. AI assistant cannot function.', timestamp: new Date() }]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Enable both Google Search and Google Maps tools for the chat
      const tools: Tool[] = [{ googleSearch: {} }, { googleMaps: {} }];

      chatRef.current = ai.chats.create({
        model: GEMINI_MODEL_FLASH,
        config: {
          tools: tools,
        },
      });
    } catch (error) {
      console.error("Failed to initialize Gemini chat:", error);
      setMessages(prev => [...prev, { role: 'model', parts: 'Error: Could not initialize AI assistant. Check console for details.', timestamp: new Date() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom whenever messages change
  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || loading || !chatRef.current) return;

    const userQuery = inputMessage;
    setInputMessage('');
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: 'user', parts: userQuery, timestamp: new Date() },
      { role: 'model', parts: '...', timestamp: new Date() } // Placeholder for loading
    ]);
    setLoading(true);

    try {
      let retrievalConfig: RetrievalConfig | undefined;

      // Prioritize selected store location, then user location for maps grounding
      if (selectedStore) {
        retrievalConfig = {
          latLng: { latitude: selectedStore.latitude, longitude: selectedStore.longitude },
        };
      } else if (userLocation) {
        retrievalConfig = { latLng: userLocation };
      }

      // Configure tools and retrieval based on context for the current message
      const sendMessageConfig: any = {};
      if (retrievalConfig) {
        sendMessageConfig.toolConfig = { retrievalConfig };
      }

      const responseStream = await chatRef.current.sendMessageStream({
        message: userQuery,
        config: sendMessageConfig,
      });

      let fullResponseText = '';
      let allGroundingUris: string[] = [];

      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullResponseText += chunk.text;
        }
        // Accumulate grounding URIs from all chunks (if streaming provides them incrementally)
        const chunkUris = extractGroundingUris(chunk);
        if (chunkUris.length > 0) {
            // Filter out duplicates in case same URIs appear in multiple chunks
            allGroundingUris = [...new Set([...allGroundingUris, ...chunkUris])];
        }

        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          // Update the last message (placeholder) with current accumulated text and URIs
          const lastMsgIndex = updatedMessages.length - 1;
          if (lastMsgIndex >= 0 && updatedMessages[lastMsgIndex].role === 'model') {
            updatedMessages[lastMsgIndex] = {
              ...updatedMessages[lastMsgIndex],
              parts: fullResponseText,
              groundingUris: allGroundingUris,
            };
          }
          return updatedMessages;
        });
      }
      // No explicit final update needed here, as the loop ensures the last state is correctly set.
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = {
          role: 'model',
          parts: 'I apologize, but I encountered an error while processing your request. Please try again.',
          timestamp: new Date(),
        };
        return updatedMessages;
      });
    } finally {
      setLoading(false);
    }
  }, [inputMessage, loading, selectedStore, userLocation]); // Dependencies for useCallback

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">AI Chat Assistant</h2>
      <div className="flex-grow overflow-y-auto pr-2 mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>Hello! Ask me anything about store performance, competitors, or general info.</p>
            <p className="text-sm mt-2">I can use Google Search and Maps to find information!</p>
            {userLocation ? (
              <p className="text-sm text-green-600 mt-1">Geolocation is active, for better local results!</p>
            ) : (
              <p className="text-sm text-yellow-600 mt-1">Geolocation not available, local results might be less accurate.</p>
            )}
            {selectedStore && (
                <p className="text-sm text-indigo-600 mt-1">Chat context set to: {selectedStore.city}</p>
            )}
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-lg break-words
                ${msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
                }`}
            >
              {typeof msg.parts === 'string' ? (
                <Markdown remarkPlugins={[remarkGfm]}>{msg.parts}</Markdown>
              ) : (
                // This case should not be hit with current streaming implementation, but kept for robustness.
                <Markdown remarkPlugins={[remarkGfm]}>
                  {(msg.parts as { text: string }[])[0]?.text || ''}
                </Markdown>
              )}
              {msg.groundingUris && msg.groundingUris.length > 0 && (
                <div className="mt-2 text-xs text-blue-800">
                  <p className="font-semibold mb-1">Sources:</p>
                  <ul className="list-disc pl-4">
                    {msg.groundingUris.map((uri, uriIndex) => (
                      <li key={uriIndex} className="truncate">
                        <a href={uri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {new URL(uri).hostname}
                          {new URL(uri).pathname.length > 1 && `/${new URL(uri).pathname.split('/')[1]}${new URL(uri).pathname.split('/')[2] ? '...' : ''}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
            <div className="flex justify-start">
                <div className="max-w-[75%] px-4 py-2 rounded-lg bg-gray-200 text-gray-800 animate-pulse">
                    Thinking...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center space-x-2 sticky bottom-0 bg-white pt-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about stores or competitors..."
          className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading || !chatRef.current}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || loading || !chatRef.current}
          className={`px-6 py-3 rounded-lg font-bold transition duration-200 ease-in-out
            ${(!inputMessage.trim() || loading || !chatRef.current)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;