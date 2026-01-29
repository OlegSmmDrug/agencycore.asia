import React, { useState, useRef, useEffect } from 'react';
import { Mic, X, Send } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">
            {isRecording ? 'Запись голосового сообщения' : 'Прослушайте запись'}
          </h3>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          {isRecording ? (
            <>
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping" />
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-slate-800 mb-1">{formatTime(recordingTime)}</p>
                <p className="text-sm text-slate-500">Идет запись...</p>
              </div>

              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                Остановить запись
              </button>
            </>
          ) : (
            <>
              <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">Голосовое сообщение</p>
                    <p className="text-xs text-slate-500">{formatTime(recordingTime)}</p>
                  </div>
                </div>

                {audioUrl && (
                  <audio controls className="w-full" src={audioUrl}>
                    Ваш браузер не поддерживает воспроизведение аудио
                  </audio>
                )}
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Отменить
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Отправить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
