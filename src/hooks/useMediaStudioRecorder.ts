import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingMode = 'audio' | 'video';

export interface StartRecordingOptions {
  mode?: RecordingMode;
  facingMode?: 'user' | 'environment';
  forceFallbackStream?: boolean;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  base64: string;
  duration: number;
  mode: RecordingMode;
}

export interface UseMediaStudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  mode: RecordingMode;
  recordingTime: number;
  volumeLevel: number; // 0 - 100
  isLimiterActive: boolean;
  liveStream: MediaStream | null;
  error: string | null;
  hasPermission: boolean;
  setMode: (mode: RecordingMode) => void;
  startRecording: (options?: StartRecordingOptions) => Promise<{ success: boolean; error?: string }>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<RecordingResult | null>;
  cancelRecording: () => void;
  switchCamera: () => Promise<void>;
  currentFacingMode: 'user' | 'environment';
}

export function useMediaStudioRecorder(): UseMediaStudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<RecordingMode>('audio');
  const [recordingTime, setRecordingTime] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isLimiterActive, setIsLimiterActive] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const meterAnimRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedTimeAccumRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);

  // Audio Context & Nodes for Limiting / Anti-Clipping
  const audioContextRef = useRef<AudioContext | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Stop all active tracks and close AudioContext
  const cleanupStreams = useCallback(() => {
    if (meterAnimRef.current) {
      cancelAnimationFrame(meterAnimRef.current);
      meterAnimRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setLiveStream(null);
    setVolumeLevel(0);
    setIsLimiterActive(false);
  }, []);

  // Update volume level and peak limiter detection
  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(dataArray);

      // Compute peak amplitude
      let maxPeak = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = Math.abs((dataArray[i] - 128) / 128);
        if (val > maxPeak) maxPeak = val;
      }

      // Convert to percentage (0 - 100)
      const percent = Math.min(100, Math.round(maxPeak * 115));
      setVolumeLevel(percent);

      // If peak is above 88%, limiter kicks in to clamp sound and prevent clipping
      setIsLimiterActive(percent >= 85);

      meterAnimRef.current = requestAnimationFrame(checkLevel);
    };

    meterAnimRef.current = requestAnimationFrame(checkLevel);
  }, []);

  const startRecording = useCallback(
    async (options?: StartRecordingOptions): Promise<{ success: boolean; error?: string }> => {
      setError(null);
      cleanupStreams();

      const targetMode = options?.mode || mode;
      const targetFacing = options?.facingMode || currentFacingMode;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Seu navegador não suporta captura de áudio ou vídeo.');
        }

        // 1. Get raw MediaStream with studio-grade constraints
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Prevents aggressive pumping & clipping
          sampleRate: 48000,
          channelCount: 2,
        };

        const mediaConstraints: MediaStreamConstraints =
          targetMode === 'video'
            ? {
                audio: audioConstraints,
                video: {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: targetFacing,
                },
              }
            : {
                audio: audioConstraints,
                video: false,
              };

        let rawStream: MediaStream;
        try {
          rawStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (err: any) {
          // If video requested but camera fails or denied, fallback to audio only
          if (targetMode === 'video') {
            console.warn('Video stream failed, trying audio only fallback:', err);
            rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            setMode('audio');
          } else {
            throw err;
          }
        }

        rawStreamRef.current = rawStream;
        setLiveStream(rawStream);
        setHasPermission(true);

        // 2. Audio Processing Graph with Anti-Clipping Dynamics Limiter
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx({ sampleRate: 48000 });
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        // Source node from microphone
        const micSource = audioCtx.createMediaStreamSource(rawStream);

        // Gain Stage with headroom (0.90) to prevent initial clipping
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.92, audioCtx.currentTime);

        // Brickwall Dynamics Limiter: Prevents sound from ever distorting or "estourar"
        const limiterNode = audioCtx.createDynamicsCompressor();
        limiterNode.threshold.setValueAtTime(-2.0, audioCtx.currentTime); // Clamp at -2dBFS
        limiterNode.knee.setValueAtTime(4.0, audioCtx.currentTime);
        limiterNode.ratio.setValueAtTime(20.0, audioCtx.currentTime); // Hard limiting ratio
        limiterNode.attack.setValueAtTime(0.002, audioCtx.currentTime); // Fast 2ms attack
        limiterNode.release.setValueAtTime(0.08, audioCtx.currentTime);

        // Visual Analyser
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        // Destination for MediaRecorder
        const studioDest = audioCtx.createMediaStreamDestination();

        // Connect graph: Mic -> Gain -> Limiter -> Analyser -> Output Destination
        micSource.connect(gainNode);
        gainNode.connect(limiterNode);
        limiterNode.connect(analyser);
        limiterNode.connect(studioDest);

        // Start VU meter visual loop
        monitorAudioLevels();

        // 3. Assemble Final Stream for MediaRecorder
        const finalTracks: MediaStreamTrack[] = [studioDest.stream.getAudioTracks()[0]];
        if (targetMode === 'video' && rawStream.getVideoTracks().length > 0) {
          finalTracks.unshift(rawStream.getVideoTracks()[0]);
        }
        const recorderStream = new MediaStream(finalTracks);

        // Determine best supported mimeType
        let mimeType = '';
        if (targetMode === 'video') {
          const videoTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
          ];
          mimeType = videoTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
        } else {
          const audioTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
          ];
          mimeType = audioTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
        }

        const recorderOptions: MediaRecorderOptions = {
          audioBitsPerSecond: 192000, // 192 kbps high-definition studio audio
        };
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }
        if (targetMode === 'video') {
          recorderOptions.videoBitsPerSecond = 2500000; // 2.5 Mbps crisp video
        }

        const recorder = new MediaRecorder(recorderStream, recorderOptions);
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.start(250); // Collect in 250ms chunks

        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);
        startTimeRef.current = Date.now();
        pausedTimeAccumRef.current = 0;

        // Timer interval
        timerRef.current = window.setInterval(() => {
          if (!isPaused) {
            const elapsed = Math.floor(
              (Date.now() - startTimeRef.current - pausedTimeAccumRef.current) / 1000
            );
            setRecordingTime(Math.max(0, elapsed));
          }
        }, 1000);

        return { success: true };
      } catch (err: any) {
        console.error('Error starting media studio recorder:', err);
        cleanupStreams();
        const msg =
          err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
            ? 'Permissão de acesso à câmera ou ao microfone foi negada.'
            : err?.message || 'Falha ao acessar os dispositivos de gravação.';
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [mode, currentFacingMode, cleanupStreams, monitorAudioLevels, isPaused]
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      pauseStartRef.current = Date.now();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      if (pauseStartRef.current > 0) {
        pausedTimeAccumRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = 0;
      }
      setIsPaused(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupStreams();
      setIsRecording(false);
      return null;
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const currentMode = mode;
        const durationSec = recordingTime;
        const mimeType = recorder.mimeType || (currentMode === 'video' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Convert to base64 data URI for offline persistence
        let base64 = '';
        try {
          base64 = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res((reader.result as string) || url);
            reader.onerror = () => res(url);
            reader.readAsDataURL(blob);
          });
        } catch {
          base64 = url;
        }

        cleanupStreams();
        setIsRecording(false);
        setIsPaused(false);

        resolve({
          blob,
          url,
          base64,
          duration: durationSec,
          mode: currentMode,
        });
      };

      try {
        recorder.stop();
      } catch (err) {
        console.warn('Error calling recorder.stop():', err);
        cleanupStreams();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [mode, recordingTime, cleanupStreams]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupStreams();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
  }, [cleanupStreams]);

  const switchCamera = useCallback(async () => {
    const nextFacing = currentFacingMode === 'user' ? 'environment' : 'user';
    setCurrentFacingMode(nextFacing);
    if (isRecording) {
      // Restart with the other camera
      await stopRecording();
      await startRecording({ mode: 'video', facingMode: nextFacing });
    }
  }, [currentFacingMode, isRecording, stopRecording, startRecording]);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  return {
    isRecording,
    isPaused,
    mode,
    recordingTime,
    volumeLevel,
    isLimiterActive,
    liveStream,
    error,
    hasPermission,
    setMode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    switchCamera,
    currentFacingMode,
  };
}
