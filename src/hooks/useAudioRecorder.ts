import { useState, useRef, useCallback } from 'react';

export interface StartRecordingResult {
  success: boolean;
  error?: string;
  isPermissionDenied?: boolean;
  isFallback?: boolean;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: (options?: { forceFallbackStream?: boolean }) => Promise<StartRecordingResult>;
  stopRecording: () => Promise<{ blob: Blob; url: string; base64: string; duration: number } | null>;
  resetRecording: () => void;
  hasPermission: boolean;
  error: string | null;
  isUsingFallback: boolean;
}

function createSyntheticAudioStream(): { stream: MediaStream; context: AudioContext } {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const dest = ctx.createMediaStreamDestination();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  gain.gain.setValueAtTime(0.04, ctx.currentTime);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(1.5, ctx.currentTime);
  lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  osc.connect(gain);
  gain.connect(dest);

  osc.start();
  lfo.start();

  return { stream: dest.stream, context: ctx };
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecording = useCallback(
    async (options?: { forceFallbackStream?: boolean }): Promise<StartRecordingResult> => {
      setError(null);
      try {
        let stream: MediaStream;
        let isFallback = false;

        if (options?.forceFallbackStream) {
          try {
            const synth = createSyntheticAudioStream();
            stream = synth.stream;
            audioContextRef.current = synth.context;
            isFallback = true;
            setIsUsingFallback(true);
            setHasPermission(true);
          } catch (synthErr) {
            console.warn('Fallback synth notice:', synthErr);
            throw new Error('Não foi possível iniciar áudio sintetizado.');
          }
        } else {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('A gravação de áudio não é suportada neste navegador.');
          }

          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            setHasPermission(true);
            setIsUsingFallback(false);
          } catch (micErr: any) {
            console.warn('Microphone permission notice:', micErr?.message || micErr);
            const isDenied =
              micErr?.name === 'NotAllowedError' ||
              micErr?.name === 'PermissionDeniedError' ||
              (typeof micErr?.message === 'string' &&
                micErr.message.toLowerCase().includes('denied'));
            const message = isDenied
              ? 'Permissão do microfone negada ou restrita pelo navegador.'
              : 'Não foi possível acessar o microfone do dispositivo.';
            setError(message);
            setIsRecording(false);
            return {
              success: false,
              error: message,
              isPermissionDenied: isDenied,
            };
          }
        }

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(250);
        setIsRecording(true);
        startTimeRef.current = Date.now();
        setRecordingTime(0);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        return { success: true, isFallback };
      } catch (err: any) {
        console.warn('Audio recording notice:', err?.message || err);
        const message = err?.message || 'Permissão do microfone negada ou indisponível.';
        setError(message);
        setIsRecording(false);
        return {
          success: false,
          error: message,
          isPermissionDenied: false,
        };
      }
    },
    []
  );

  const stopRecording = useCallback((): Promise<{ blob: Blob; url: string; base64: string; duration: number } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        resolve(null);
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      const totalDuration = Math.max(1, (Date.now() - startTimeRef.current) / 1000);

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);

        // Convert to Base64 data URL for storage
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          // Stop all stream tracks to release device microphone indicator
          recorder.stream.getTracks().forEach((t) => t.stop());
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
          }
          resolve({
            blob,
            url,
            base64: base64Data,
            duration: totalDuration,
          });
        };
      };

      recorder.stop();
    });
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setError(null);
    setIsUsingFallback(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [audioUrl]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    hasPermission,
    error,
    isUsingFallback,
  };
}
