import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LIVE_ASSISTANT_PROMPT } from './constants';
import { getGoogleApiKey } from '../../services/briefArchitectService';

interface LiveAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [insights, setInsights] = useState<{type: string, text: string}[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = await getGoogleApiKey();
      if (!apiKey) {
        setError('Google Gemini API не настроен. Добавьте ключ в разделе Интеграции.');
        setIsLoading(false);
        return;
      }

      setIsActive(true);
      setIsLoading(false);
      setInsights([{
        type: 'ТАКТИКА СТАРТА',
        text: 'Включено принудительное распознавание смыслов. Сразу обозначьте экспертную позицию: "Мы здесь не для того, чтобы просто освоить бюджет, а чтобы построить систему". Жду начала речи.'
      }]);

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({
        model: 'gemini-pro',
        systemInstruction: LIVE_ASSISTANT_PROMPT
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      scriptProcessor.onaudioprocess = async (e: any) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const avgVolume = inputData.reduce((sum: number, val: number) => sum + Math.abs(val), 0) / inputData.length;

        if (avgVolume > 0.01) {
          try {
            const result = await model.generateContent('Analyze this audio input and provide a brief insight');
            const response = await result.response;
            const text = response.text();

            if (text && text.length > 5) {
              const cleanText = text.trim();
              let type = 'ИНСАЙТ';
              if (cleanText.includes('ВОПРОС')) type = 'ВОПРОС';
              if (cleanText.includes('РЕКОМЕНДАЦИЯ')) type = 'РЕКОМЕНДАЦИЯ';
              if (cleanText.includes('СУТЬ')) type = 'СУТЬ';

              setInsights(prev => [{ type, text: cleanText }, ...prev.slice(0, 4)]);
            }
          } catch (err) {
            console.error('Error processing audio:', err);
          }
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);
      sessionRef.current = { stream, scriptProcessor, source };
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : 'Ошибка доступа к микрофону');
      setIsActive(false);
      setIsLoading(false);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      if (sessionRef.current.stream) sessionRef.current.stream.getTracks().forEach((t: any) => t.stop());
      if (sessionRef.current.scriptProcessor) sessionRef.current.scriptProcessor.disconnect();
      if (sessionRef.current.source) sessionRef.current.source.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsActive(false);
    setTranscription([]);
    setInsights([]);
    sessionRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) {
      stopSession();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className={`relative w-6 h-6 rounded-full ${isActive ? 'bg-white' : 'bg-white/30'}`}>
              {isActive && <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75"></div>}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Live Assistant</h3>
              <p className="text-red-100 text-sm">
                {isActive ? 'Анализирует разговор в реальном времени' : 'Ожидает активации'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { stopSession(); onClose(); }}
            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-xl transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex bg-gray-50">
          <div className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col">
            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              Распознавание речи
            </h5>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {transcription.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400">Слушаю...</div>
              )}
              {transcription.map((t, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Оперативные подсказки</h5>
              {isActive && (
                <div className="flex gap-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-1 h-4 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: `${i*150}ms`}}></div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
                  <p className="font-semibold mb-2">Ошибка</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {!isActive && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <button
                    onClick={startSession}
                    disabled={isLoading}
                    className="w-48 h-48 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-50"
                  >
                    {isLoading ? (
                      <svg className="animate-spin w-12 h-12 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <span className="text-white font-bold uppercase tracking-wider">Активировать</span>
                    )}
                  </button>
                  <p className="mt-8 text-gray-500 text-sm max-w-xs">
                    Нажмите для старта анализа разговора. Система будет выдавать тактические рекомендации в реальном времени.
                  </p>
                </div>
              )}

              {isActive && insights.map((insight, i) => (
                <div key={i} className={`p-6 rounded-xl shadow-lg border-2 ${
                  insight.type === 'ВОПРОС' ? 'bg-blue-600 text-white border-blue-400' :
                  insight.type === 'РЕКОМЕНДАЦИЯ' ? 'bg-yellow-50 text-yellow-900 border-yellow-200' :
                  insight.type === 'СУТЬ' ? 'bg-green-50 text-green-900 border-green-200' :
                  'bg-gray-900 text-white border-gray-700'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      insight.type === 'ВОПРОС' ? 'bg-white/20' :
                      insight.type === 'РЕКОМЕНДАЦИЯ' ? 'bg-yellow-200' :
                      insight.type === 'СУТЬ' ? 'bg-green-200' :
                      'bg-blue-500'
                    }`}>
                      {insight.type}
                    </span>
                  </div>
                  <p className="font-semibold text-lg leading-snug">
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isActive && (
          <div className="p-6 bg-gray-900 flex justify-between items-center border-t border-gray-700">
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">
                Поток данных активен
              </span>
            </div>
            <button
              onClick={stopSession}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold text-sm uppercase tracking-wide transition-all shadow-lg"
            >
              Остановить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
