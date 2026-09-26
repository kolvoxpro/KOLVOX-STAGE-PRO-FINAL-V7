import React, { useState, useRef, useEffect, useCallback } from 'react';

export type LyricsPlayerStatus = 'stopped' | 'playing' | 'paused';

export interface UseLyricsPlayerOptions {
  baseSpeedPx?: number; // base pixels per second for 1x speed (default 32)
  initialSpeedMultiplier?: number; // default 1.0
  onEnded?: () => void;
}

export interface LyricsPlayer {
  status: LyricsPlayerStatus;
  speed: number; // multiplier: 0.5, 0.75, 1, 1.25, 1.5, 2, 3
  currentPosition: number;
  scrollProgress: number; // 0 to 1
  play: () => void;
  pause: () => void;
  stop: () => void;
  resume: () => void;
  reset: () => void;
  togglePlayPause: () => void;
  setSpeed: (multiplier: number) => void;
  increaseSpeed: () => void;
  decreaseSpeed: () => void;
  handleManualScroll: () => void;
}

export const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

export function useLyricsPlayer(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseLyricsPlayerOptions = {}
): LyricsPlayer {
  const baseSpeed = options.baseSpeedPx || 32;
  const [status, setStatus] = useState<LyricsPlayerStatus>('stopped');
  const [speed, setSpeedState] = useState<number>(options.initialSpeedMultiplier || 1.0);
  const [currentPosition, setCurrentPosition] = useState<number>(0);

  // Internal mutable tracking refs to prevent re-render glitches & rAF duplicates
  const statusRef = useRef<LyricsPlayerStatus>('stopped');
  const speedRef = useRef<number>(options.initialSpeedMultiplier || 1.0);
  const posRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const onEndedRef = useRef(options.onEnded);

  onEndedRef.current = options.onEnded;

  // Keep refs in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Cancel any active animation frame
  const cancelLoop = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  // Main high-precision animation loop
  const step = useCallback((timestamp: number) => {
    if (statusRef.current !== 'playing') {
      cancelLoop();
      return;
    }

    const container = containerRef.current;
    if (!container) {
      cancelLoop();
      return;
    }

    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
      animFrameIdRef.current = requestAnimationFrame(step);
      return;
    }

    // Delta time in seconds, capped to prevent leaps on tab-switch
    const rawDelta = (timestamp - lastTimestampRef.current) / 1000;
    const delta = Math.min(rawDelta, 0.1);
    lastTimestampRef.current = timestamp;

    const pixelsPerSecond = baseSpeed * speedRef.current;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);

    // Stop if reached the very end of content
    if (posRef.current >= maxScroll - 2) {
      posRef.current = maxScroll;
      container.scrollTop = maxScroll;
      statusRef.current = 'stopped';
      setStatus('stopped');
      setCurrentPosition(maxScroll);
      cancelLoop();
      if (onEndedRef.current) {
        onEndedRef.current();
      }
      return;
    }

    // Increment continuous floating position
    posRef.current = Math.min(posRef.current + pixelsPerSecond * delta, maxScroll);
    
    // Mark as programmatic so manual scroll handler does not accidentally treat it as user gesture
    isProgrammaticScrollRef.current = true;
    container.scrollTop = posRef.current;
    
    // Reset flag on next microtask
    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 0);

    setCurrentPosition(posRef.current);

    // Schedule next frame
    animFrameIdRef.current = requestAnimationFrame(step);
  }, [baseSpeed, cancelLoop, containerRef]);

  // Start or resume playback
  const play = useCallback(() => {
    if (statusRef.current === 'playing') return; // Guard against multiple simultaneous loops

    const container = containerRef.current;
    if (container) {
      // Sync internal position with actual container scroll position
      posRef.current = container.scrollTop;
      setCurrentPosition(container.scrollTop);
    }

    statusRef.current = 'playing';
    setStatus('playing');
    lastTimestampRef.current = null;
    cancelLoop();
    animFrameIdRef.current = requestAnimationFrame(step);
  }, [cancelLoop, containerRef, step]);

  // Pause playback immediately
  const pause = useCallback(() => {
    cancelLoop();
    const container = containerRef.current;
    if (container) {
      posRef.current = container.scrollTop;
      setCurrentPosition(container.scrollTop);
    }
    statusRef.current = 'paused';
    setStatus('paused');
  }, [cancelLoop, containerRef]);

  // Stop playback and scroll back to top (position 0)
  const stop = useCallback(() => {
    cancelLoop();
    statusRef.current = 'stopped';
    setStatus('stopped');
    posRef.current = 0;
    setCurrentPosition(0);

    const container = containerRef.current;
    if (container) {
      isProgrammaticScrollRef.current = true;
      container.scrollTop = 0;
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 50);
    }
  }, [cancelLoop, containerRef]);

  const resume = useCallback(() => {
    play();
  }, [play]);

  const reset = useCallback(() => {
    stop();
  }, [stop]);

  const togglePlayPause = useCallback(() => {
    if (statusRef.current === 'playing') {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  // Set speed multiplier in real time
  const setSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(0.25, Math.min(newSpeed, 5.0));
    setSpeedState(clamped);
    speedRef.current = clamped;
  }, []);

  const increaseSpeed = useCallback(() => {
    const currentIndex = SPEED_PRESETS.findIndex((s) => Math.abs(s - speedRef.current) < 0.05);
    if (currentIndex !== -1 && currentIndex < SPEED_PRESETS.length - 1) {
      setSpeed(SPEED_PRESETS[currentIndex + 1]);
    } else {
      setSpeed(Math.min(5.0, Number((speedRef.current + 0.25).toFixed(2))));
    }
  }, [setSpeed]);

  const decreaseSpeed = useCallback(() => {
    const currentIndex = SPEED_PRESETS.findIndex((s) => Math.abs(s - speedRef.current) < 0.05);
    if (currentIndex !== -1 && currentIndex > 0) {
      setSpeed(SPEED_PRESETS[currentIndex - 1]);
    } else {
      setSpeed(Math.max(0.25, Number((speedRef.current - 0.25).toFixed(2))));
    }
  }, [setSpeed]);

  // Handle manual user interactions (mouse wheel, touch drag, scrollbar dragging)
  const handleManualScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      return; // Ignore updates caused by the auto-scroller itself
    }

    const container = containerRef.current;
    if (!container) return;

    // Immediately pause auto-scrolling
    if (statusRef.current === 'playing') {
      cancelLoop();
      statusRef.current = 'paused';
      setStatus('paused');
    }

    // Record the user's manual position so subsequent PLAY resumes from this exact position
    posRef.current = container.scrollTop;
    setCurrentPosition(container.scrollTop);
  }, [cancelLoop, containerRef]);

  // Attach native non-passive listeners to catch user gestures
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = () => {
      handleManualScroll();
    };

    const onTouchMove = () => {
      handleManualScroll();
    };

    const onPointerDown = () => {
      if (statusRef.current === 'playing') {
        handleManualScroll();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('pointerdown', onPointerDown);
    };
  }, [containerRef, handleManualScroll]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cancelLoop();
    };
  }, [cancelLoop]);

  const container = containerRef.current;
  const maxScroll = container ? Math.max(1, container.scrollHeight - container.clientHeight) : 1;
  const scrollProgress = Math.min(1, Math.max(0, currentPosition / maxScroll));

  return {
    status,
    speed,
    currentPosition,
    scrollProgress,
    play,
    pause,
    stop,
    resume,
    reset,
    togglePlayPause,
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
    handleManualScroll,
  };
}
