
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LIVE_ASSISTANT_PROMPT } from '../constants';

interface LiveAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [insights, setInsights] = useState<{type: string, text: string}[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startSession = async () => {
    if (!process.env.API_KEY) return;
    
    setIsActive(true);
    setInsights([{
      type: 'ТАКТИКА СТАРТА', 
      text: 'Включено принудительное распознавание смыслов. Сразу обозначьте экспертную позицию: "Мы здесь не для того, чтобы просто освоить бюджет, а чтобы построить систему". Жду начала речи.'
    }]);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: LIVE_ASSISTANT_PROMPT,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }
          }
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            // Минимальный размер буфера для снижения лага
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(2048, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              const bytes = new Uint8Array(int16.buffer);
              let binary = '';
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
              const base64 = btoa(binary);
              
              sessionPromise.then(s => {
                s.sendRealtimeInput({ 
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
                });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
            sessionRef.current = { stream, scriptProcessor, source };
          },
          onmessage: async (message: LiveServerMessage) => {
            // Распознавание входящего русского голоса
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text && text.trim().length > 2) {
                setTranscription(prev => [...prev.slice(-2), text]);
              }
            }
            
            // Получение смысловых подсказок
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              parts.forEach(part => {
                if (part.text) {
                  const rawText = part.text;
                  // Детекция типа подсказки по ключевым словам из промпта
                  let type = 'ИНСАЙТ';
                  if (rawText.includes('[ПЕРЕХВАТ]')) type = 'ВОПРОС-УДАР';
                  if (rawText.includes('[СУТЬ]')) type = 'СУТЬ';
                  if (rawText.includes('[РИСК]')) type = 'ВНИМАНИЕ';
                  
                  const cleanText = rawText.replace(/\[.*?\]/g, '').trim();
                  if (cleanText && cleanText.length > 5) {
                    setInsights(prev => [{ type, text: cleanText }, ...prev.slice(0, 4)]);
                  }
                }
              });
            }
          },
          onerror: (e) => console.error("Live System Error:", e),
          onclose: () => stopSession()
        }
      });
    } catch (err) {
      console.error("Mic Access Denied:", err);
      setIsActive(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl rounded-[4rem] shadow-[0_0_150px_rgba(79,70,229,0.3)] overflow-hidden flex flex-col h-[92vh] border border-white/10">
        {/* Top Control Bar */}
        <div className="bg-slate-900 p-8 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className={`relative w-6 h-6 rounded-full ${isActive ? 'bg-red-500' : 'bg-slate-700'}`}>
              {isActive && <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>}
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-[0.4em] text-xs">Shadow Intelligence Unit</h3>
              <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1">Status: {isActive ? 'Intercepting & Analyzing' : 'Standby'}</p>
            </div>
          </div>
          <button onClick={() => { stopSession(); onClose(); }} className="bg-white/10 hover:bg-red-500 hover:text-white text-white p-5 rounded-[2rem] transition-all transform active:scale-90">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Intelligence Grid */}
        <div className="flex-1 overflow-hidden flex bg-slate-50">
          {/* Left: Raw Context */}
          <div className="w-96 bg-slate-100/50 border-r border-slate-200 p-10 flex flex-col">
            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Распознавание речи
            </h5>
            <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-4">
              {transcription.length === 0 && (
                <div className="opacity-30 text-center py-20 italic text-sm text-slate-400">Слушаю...</div>
              )}
              {transcription.map((t, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 text-sm font-medium text-slate-600 animate-in slide-in-from-left-6">
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Center: Tactical Insights */}
          <div className="flex-1 p-12 flex flex-col bg-white relative">
            <div className="flex justify-between items-center mb-12">
              <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.5em]">Оперативные подсказки:</h5>
              {isActive && <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1.5 h-6 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: `${i*200}ms`}}></div>)}
              </div>}
            </div>

            <div className="flex-1 space-y-10 overflow-y-auto custom-scrollbar pr-6">
              {!isActive ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <button 
                    onClick={startSession}
                    className="group relative w-64 h-64 bg-slate-900 rounded-full flex items-center justify-center transition-all hover:bg-indigo-600 hover:scale-105 active:scale-95 shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-10 group-hover:opacity-30"></div>
                    <span className="text-white font-black uppercase tracking-[0.3em] text-sm">Активировать</span>
                  </button>
                  <p className="mt-12 text-slate-400 font-bold uppercase tracking-widest text-xs max-w-xs leading-relaxed">
                    Нажмите для старта перехвата смыслов. Система начнет выдавать тактические рекомендации мгновенно.
                  </p>
                </div>
              ) : (
                <>
                  {insights.map((insight, i) => (
                    <div key={i} className={`p-10 rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom-12 border-2 transition-all ${
                      insight.type === 'ВОПРОС-УДАР' ? 'bg-indigo-600 text-white border-indigo-400' : 
                      insight.type === 'ВНИМАНИЕ' ? 'bg-red-50 text-red-900 border-red-200' :
                      'bg-slate-900 text-white border-slate-700'
                    }`}>
                      <div className="flex items-center gap-4 mb-6">
                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] px-4 py-2 rounded-full ${
                          insight.type === 'ВОПРОС-УДАР' ? 'bg-white/20' : 'bg-indigo-500'
                        }`}>
                          {insight.type}
                        </span>
                      </div>
                      <p className={`font-bold text-2xl md:text-3xl leading-[1.2] tracking-tighter`}>
                        {insight.text}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tactical Footer */}
        {isActive && (
          <div className="p-10 bg-slate-950 flex justify-between items-center border-t border-white/5">
             <div className="flex items-center gap-6">
               <div className="text-green-500 font-black text-xs uppercase tracking-widest flex items-center gap-3">
                 <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                 Поток данных стабилен (RU-ONLY)
               </div>
             </div>
             <button onClick={stopSession} className="bg-red-600 hover:bg-red-700 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all shadow-lg shadow-red-500/20">
               Прекратить перехват
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
