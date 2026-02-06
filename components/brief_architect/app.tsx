
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from './services/geminiService';
import { Message, BriefState } from './types';
import { INITIAL_GREETING } from './constants';
import { BriefProgress } from './components/BriefProgress';
import { MessageItem } from './components/MessageItem';
import { FinalBrief } from './components/FinalBrief';
import { LiveAssistant } from './components/LiveAssistant';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: INITIAL_GREETING }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [briefState, setBriefState] = useState<BriefState>({
    progress: 5,
    status: 'Аналитик-исследователь',
    isComplete: false,
    finalData: null
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const geminiRef = useRef<GeminiService | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (process.env.API_KEY) {
      geminiRef.current = new GeminiService(process.env.API_KEY);
    }

    // Initialize Web Speech API for chat input
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + ' ' + transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  };

  const parseMetadata = (content: string) => {
    const progressMatch = content.match(/\[Прогресс заполнения брифа: (\d+)%\]/);
    const statusMatch = content.match(/\[Статус: (.*?)\]/);
    const jsonMatch = content.match(/<json_brief>([\s\S]*?)<\/json_brief>/);

    setBriefState(prev => {
      let newState = { ...prev };
      if (progressMatch) newState.progress = parseInt(progressMatch[1], 10);
      if (statusMatch) newState.status = statusMatch[1].trim();
      if (jsonMatch) {
        try {
          newState.finalData = JSON.parse(jsonMatch[1]);
          newState.isComplete = true;
        } catch (e) {
          console.error("Critical: JSON parsing failed", e);
        }
      }
      return newState;
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping || !geminiRef.current) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await geminiRef.current.sendMessage(userMessage);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
      parseMetadata(response);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "Ошибка сетевого соединения. Система анализа временно недоступна. Пожалуйста, попробуйте еще раз." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 print:bg-white print:h-auto print:overflow-visible">
      <header className="bg-slate-900 text-white p-5 shadow-xl shrink-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-inner shadow-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none uppercase">Architect</h1>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.3em] mt-1">Digital Strategic Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsLiveOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95"
            >
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Live Call Mode
            </button>
            <div className="text-right hidden sm:block">
               <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status: Active</div>
               <div className="flex items-center gap-2 justify-end">
                 <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                 <span className="text-[10px] text-indigo-500 font-black uppercase tracking-tighter">AI Strategist Online</span>
               </div>
            </div>
          </div>
        </div>
      </header>

      <LiveAssistant isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />

      <div className="print:hidden">
        <BriefProgress progress={briefState.progress} status={briefState.status} />
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 print:p-0 print:overflow-visible">
        <div className="max-w-6xl mx-auto">
          {briefState.isComplete && briefState.finalData && (
            <FinalBrief 
              data={briefState.finalData} 
              rawText={messages.filter(m => m.role === 'model' && m.content.includes('<json_brief>')).slice(-1)[0]?.content || ""} 
            />
          )}
          
          <div className="max-w-4xl mx-auto print:hidden">
            {messages.map((msg, i) => (
              <MessageItem key={i} message={msg} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-8 animate-pulse">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-6 text-slate-400 text-sm font-medium flex items-center space-x-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <span className="font-black uppercase tracking-[0.2em] text-[10px] text-indigo-600">Синтез стратегии...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-6 shrink-0 shadow-2xl z-20 print:hidden">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button
            onClick={toggleRecording}
            className={`p-5 rounded-2xl transition-all shadow-lg active:scale-90 flex items-center justify-center ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title="Голосовой ввод"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={briefState.isComplete ? "Уточните детали манифеста..." : "Введите ответ или нажмите на микрофон..."}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[60px] max-h-60 resize-none text-[16px] font-medium placeholder:text-slate-400"
              rows={1}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className={`p-5 rounded-2xl transition-all shadow-xl active:scale-90 flex items-center justify-center ${
              !inputValue.trim() || isTyping 
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-white'
            }`}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
          Architect System &copy; 2025 | AI Consulting Group
        </p>
      </footer>
    </div>
  );
};

export default App;
