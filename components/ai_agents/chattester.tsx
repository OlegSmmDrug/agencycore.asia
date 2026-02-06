
import React, { useState, useRef, useEffect } from 'react';
import { AIAgent, Message } from '../../types';
import { processAgentResponse } from '../../services/geminiService';

interface ChatTesterProps {
  agent: AIAgent;
  onAIResponse?: (response: any) => void;
}

const ChatTester: React.FC<ChatTesterProps> = ({ agent, onAIResponse }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await processAgentResponse(agent, messages, input);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
        metadata: result.metadata
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      if (onAIResponse) {
        onAIResponse(result);
      }
    } catch (e: any) {
      console.error('[ChatTester] Error:', e);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Ошибка: ${e.message || 'Неизвестная ошибка соединения с ИИ'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          Live Debug Mode
        </h3>
        <button onClick={() => setMessages([])} className="text-[10px] font-bold text-gray-400 hover:text-blue-600 transition-colors">CLEAR</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/20">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-2">Начните диалог</p>
            <p className="text-[10px]">Все действия ИИ будут отображаться в панели проверки (⚖️)</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 ${
              msg.role === 'user' ? 'bg-[#1e1e2d] text-white rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none'
            }`}>
              {msg.content}
              
              {msg.metadata && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                   {msg.metadata.leadScore !== undefined && (
                     <div className="flex items-center justify-between bg-blue-50/50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-blue-400 font-bold uppercase">Lead Score:</span>
                        <span className={`text-xs font-black ${msg.metadata.leadScore > 7 ? 'text-green-500' : 'text-amber-500'}`}>{msg.metadata.leadScore}/10</span>
                     </div>
                   )}
                   {msg.metadata.extractedInfo && Object.keys(msg.metadata.extractedInfo).length > 0 && (
                     <div className="flex flex-wrap gap-1">
                        {Object.entries(msg.metadata.extractedInfo).map(([k, v]) => v ? (
                          <span key={k} className="bg-gray-100 text-[9px] px-2 py-0.5 rounded-full text-gray-600 font-bold border">
                            {k}: {String(v)}
                          </span>
                        ) : null)}
                     </div>
                   )}
                   {msg.metadata.triggers && msg.metadata.triggers.length > 0 && (
                     <div className="flex flex-wrap gap-1 mt-2">
                        {msg.metadata.triggers.map((t: string) => (
                          <div key={t} className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1">
                            <span className="animate-pulse">⚡</span> {t}
                          </div>
                        ))}
                     </div>
                   )}
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold px-1 tracking-tighter">
              {msg.role === 'user' ? 'Client' : agent.name} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-blue-500 px-2">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Thinking</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="relative">
          <input 
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50 transition-all"
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()} 
            className="absolute right-2 top-2 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 disabled:bg-gray-200 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTester;
