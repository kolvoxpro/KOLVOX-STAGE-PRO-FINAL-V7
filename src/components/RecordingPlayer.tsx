import React, { useState, useRef, useEffect } from 'react';
import { Recording } from '../types/kolvox';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  Calendar,
  Clock,
  Music2,
  FastForward,
  Rewind,
} from 'lucide-react';

interface RecordingPlayerProps {
  recording: Recording;
  onDelete: (id: string) => void;
}

export const RecordingPlayer: React.FC<RecordingPlayerProps> = ({ recording, onDelete }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(recording.duration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.error('Play error:', e));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recording.file_url;
    a.download = `kolvox_gravacao_${recording.song_title.replace(/\s+/g, '_')}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (timeInSec: number) => {
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl transition-all duration-200">
      <audio ref={audioRef} src={recording.file_url} preload="metadata" />

      {/* Header info */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Music2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-white truncate">{recording.song_title}</h4>
            {recording.song_artist && (
              <span className="text-xs text-zinc-400 block truncate">{recording.song_artist}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-900 transition-colors"
            title="Baixar áudio"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(recording.id)}
            className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-900 transition-colors"
            title="Excluir gravação"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Waveform Slider */}
      <div className="my-2 space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-zinc-400 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Audio Playback Controls */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => handleSkip(-5)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
            title="Voltar 5 segundos"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-zinc-200 text-zinc-950 hover:bg-white shadow-lg'
                : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20'
            }`}
            title={isPlaying ? 'Pausar áudio' : 'Ouvir gravação'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => handleSkip(5)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
            title="Avançar 5 segundos"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Speed Toggle */}
          <button
            onClick={handleSpeedChange}
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-amber-400 rounded-md hover:bg-zinc-850"
            title="Velocidade de reprodução"
          >
            {playbackRate}x
          </button>

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Timestamp metadata */}
          <span className="text-[10px] text-zinc-500 hidden md:inline-block">
            {new Date(recording.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  );
};
