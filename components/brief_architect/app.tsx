import React, { useState, useEffect, useRef } from 'react';
import { BriefMessage, BriefState, BriefSession } from './types';
import { INITIAL_GREETING } from './constants';
import { BriefProgress } from './briefprogress';
import { MessageItem } from './messageitem';
import { FinalBrief } from './finalbrief';
import { LiveAssistant } from './liveassistant';
import { sendBriefMessage, saveBriefSession, loadBriefSessions, deleteBriefSession } from '../../services/briefArchitectService';
import { Client } from '../../types';

interface BriefArchitectModuleProps {
  clients?: Client[];
  currentUserId?: string;
}

const BriefArchitectModule: React.FC<BriefArchitectModuleProps> = ({ clients = [], currentUserId }) => {
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [sessions, setSessions] = useState<BriefSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);

  const [messages, setMessages] = useState<BriefMessage[]>([
    { role: 'model', content: INITIAL_GREETING }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [briefState, setBriefState] = useState<BriefState>({
    progress: 5,
    status: 'Начало интервью',
    isComplete: false,
    finalData: null
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoSaveTimerRef = useRef<any>(null);

  useEffect(() => {
    loadSessions();
    initSpeechRecognition();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (view === 'chat' && (messages.length > 1 || briefState.progress > 5)) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveCurrentSession();
      }, 3000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [messages, briefState, view]);

  const loadSessions = async () => {
    try {
      const loadedSessions = await loadBriefSessions();
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const saveCurrentSession = async () => {
    if (!currentUserId) return;

    try {
      const sessionData: Partial<BriefSession> = {
        id: currentSessionId || undefined,
        userId: currentUserId,
        clientId: selectedClientId,
        title: extractTitle(messages),
        messages,
        briefData: briefState.finalData,
        progress: briefState.progress,
        status: briefState.status,
        isComplete: briefState.isComplete,
      };

      const sessionId = await saveBriefSession(sessionData);
      if (!currentSessionId) {
        setCurrentSessionId(sessionId);
      }
      await loadSessions();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const extractTitle = (msgs: BriefMessage[]): string => {
    const userMessages = msgs.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      return userMessages[0].content.substring(0, 50) + (userMessages[0].content.length > 50 ? '...' : '');
    }
    return 'Новый бриф';
  };

  const initSpeechRecognition = () => {
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
  };

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
          console.error("JSON parsing failed", e);
        }
      }
      return newState;
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await sendBriefMessage(messages, userMessage);
      const updatedMessages = [...newMessages, { role: 'model' as const, content: response }];
      setMessages(updatedMessages);
      parseMetadata(response);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'model', content: "Ошибка сетевого соединения. Система анализа временно недоступна. Пожалуйста, попробуйте еще раз." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startNewBrief = (clientId?: string) => {
    setSelectedClientId(clientId || null);
    setCurrentSessionId(null);
    setMessages([{ role: 'model', content: INITIAL_GREETING }]);
    setBriefState({
      progress: 5,
      status: 'Начало интервью',
      isComplete: false,
      finalData: null
    });
    setShowClientSelector(false);
    setView('chat');
  };

  const openSession = (session: BriefSession) => {
    setCurrentSessionId(session.id);
    setSelectedClientId(session.clientId);
    setMessages(session.messages);
    setBriefState({
      progress: session.progress,
      status: session.status,
      isComplete: session.isComplete,
      finalData: session.briefData
    });
    setView('chat');
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Удалить этот бриф?')) {
      try {
        await deleteBriefSession(sessionId);
        await loadSessions();
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
  };

  const backToList = () => {
    saveCurrentSession();
    setView('list');
  };

  if (view === 'list') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Архитектор брифов</h1>
            <p className="text-gray-600 mt-1">AI-стратег для создания рекламных кампаний</p>
          </div>
          <button
            onClick={() => setShowClientSelector(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать бриф
          </button>
        </div>

        {showClientSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Выберите клиента или пропустите</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <button
                  onClick={() => startNewBrief()}
                  className="w-full mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600 font-medium"
                >
                  Без привязки к клиенту
                </button>
                <div className="grid gap-3">
                  {clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => startNewBrief(client.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="font-semibold text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-600">{client.company}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowClientSelector(false)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map(session => {
            const client = clients.find(c => c.id === session.clientId);
            return (
              <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 line-clamp-2">{session.title}</h3>
                    {client && (
                      <p className="text-sm text-gray-600 mt-1">{client.name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Прогресс</span>
                    <span className="font-semibold">{session.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => openSession(session)}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {session.isComplete ? 'Просмотреть' : 'Продолжить'}
                </button>
              </div>
            );
          })}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 text-lg">Нет созданных брифов</p>
            <p className="text-gray-500 mt-2">Создайте первый бриф для работы с AI-стратегом</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={backToList}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Архитектор брифов</h1>
              <p className="text-sm text-gray-600">{briefState.status}</p>
            </div>
          </div>
          <button
            onClick={() => setIsLiveOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg transition-all"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Live Assistant
          </button>
        </div>
      </header>

      <LiveAssistant isOpen={isLiveOpen} onClose={() => setIsLiveOpen(false)} />

      <BriefProgress progress={briefState.progress} status={briefState.status} />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {briefState.isComplete && briefState.finalData && (
            <FinalBrief
              data={briefState.finalData}
              rawText={messages.filter(m => m.role === 'model' && m.content.includes('<json_brief>')).slice(-1)[0]?.content || ""}
            />
          )}

          <div className="max-w-4xl mx-auto">
            {messages.map((msg, i) => (
              <MessageItem key={i} message={msg} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-8 animate-pulse">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-6 text-slate-400 text-sm font-medium flex items-center space-x-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <span className="font-bold uppercase tracking-wide text-xs text-blue-600">Синтез стратегии...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button
            onClick={toggleRecording}
            className={`p-4 rounded-xl transition-all shadow-md active:scale-90 flex items-center justify-center ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title="Голосовой ввод"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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
              placeholder={briefState.isComplete ? "Уточните детали брифа..." : "Введите ответ или нажмите на микрофон..."}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[56px] max-h-60 resize-none text-base placeholder:text-slate-400"
              rows={1}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className={`p-4 rounded-xl transition-all shadow-lg active:scale-90 flex items-center justify-center ${
              !inputValue.trim() || isTyping
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default BriefArchitectModule;
