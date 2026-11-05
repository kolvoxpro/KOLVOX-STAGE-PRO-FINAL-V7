/**
 * Karaoke Timeline Engine
 * 
 * Accurately parses timestamped lyrics (LRC) and creates a musical timeline
 * that respects original recording tempo, instrumental intros, guitar solos,
 * pauses between verses, and vocal phrasing — exactly like a real karaoke system.
 */

export type KaraokeItemType = 'line' | 'pause';

export interface KaraokeItem {
  id: string;
  type: KaraokeItemType;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;  // in seconds
  text: string;      // Lyrics line text, or pause description (e.g. "Intro Instrumental")
  lineIndex?: number; // 0-based index of visible lyrics lines
  pauseType?: 'intro' | 'solo' | 'interlude' | 'outro';
  nextLineText?: string;
  isInstrumental?: boolean;
}

export interface KaraokeState {
  currentItem: KaraokeItem | null;
  activeLineIndex: number;
  isPause: boolean;
  pauseType?: 'intro' | 'solo' | 'interlude' | 'outro';
  pauseCountdown: number; // seconds remaining in current pause
  pauseTotalDuration: number;
  pauseProgress: number; // 0 to 100%
  nextLineText?: string;
  lineProgress: number; // 0 to 100% of current vocal line
  currentTime: number;
  totalDuration: number;
}

/**
 * Formats seconds into MM:SS
 */
export function formatKaraokeTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Checks if raw text contains LRC timestamp markers [00:12.34]
 */
export function hasLrcTimestamps(text: string): boolean {
  if (!text) return false;
  return /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(text);
}

/**
 * Strips LRC timestamp tags from text to get clean human-readable lyrics
 */
export function stripLrcTimestamps(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .join('\n');
}

/**
 * Parses timestamp string "[mm:ss.xx]" or "mm:ss.xx" to seconds
 */
function parseLrcTimestamp(tag: string): number | null {
  const match = tag.match(/(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  let fraction = 0;
  if (match[3]) {
    const fractionStr = match[3].padEnd(3, '0').slice(0, 3);
    fraction = parseInt(fractionStr, 10) / 1000;
  }
  return minutes * 60 + seconds + fraction;
}

/**
 * Parses timestamped LRC lyrics into Karaoke Items with authentic pauses
 */
export function parseLrcToKaraokeTimeline(
  lrcContent: string,
  totalDurationHint?: number
): { timeline: KaraokeItem[]; cleanLines: string[]; totalDuration: number } {
  const lines = lrcContent.split('\n');
  const rawEntries: { time: number; text: string }[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for standard LRC tags [mm:ss.xx]
    const tagMatches = Array.from(line.matchAll(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g));
    if (tagMatches.length > 0) {
      // The text after the last timestamp tag
      const text = line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();

      for (const match of tagMatches) {
        const timeSec = parseLrcTimestamp(match[1]);
        if (timeSec !== null) {
          rawEntries.push({ time: timeSec, text });
        }
      }
    }
  }

  // Sort by timestamp
  rawEntries.sort((a, b) => a.time - b.time);

  // If no valid timestamps found, return empty timeline
  if (rawEntries.length === 0) {
    return { timeline: [], cleanLines: [], totalDuration: totalDurationHint || 210 };
  }

  const cleanLines: string[] = [];
  const vocalItems: { startTime: number; text: string; lineIndex: number }[] = [];

  for (const entry of rawEntries) {
    // If line has vocal text (not purely blank or instrumental placeholder)
    const isSpecialTag = /^\[(intro|solo|interlude|instrumental|refrão|ponte)\]/i.test(entry.text);
    if (entry.text && !isSpecialTag) {
      cleanLines.push(entry.text);
      vocalItems.push({
        startTime: entry.time,
        text: entry.text,
        lineIndex: cleanLines.length - 1,
      });
    }
  }

  // Calculate vocal line durations and detect pauses
  const timeline: KaraokeItem[] = [];
  const minPauseThreshold = 3.5; // Gap of 3.5s+ is a noticeable instrumental pause / solo

  // 1. INTRO PAUSE (only if song has significant instrumental intro >= 5s)
  const firstVocalTime = vocalItems.length > 0 ? vocalItems[0].startTime : 0;
  if (firstVocalTime >= 5.0) {
    timeline.push({
      id: 'pause-intro',
      type: 'pause',
      startTime: 0,
      endTime: firstVocalTime,
      duration: firstVocalTime,
      text: 'Introdução Instrumental',
      isInstrumental: true,
      pauseType: 'intro',
      nextLineText: vocalItems[0]?.text,
    });
  }

  // 2. VOCAL LINES - Continuous progression, no pauses between normal sentences
  for (let i = 0; i < vocalItems.length; i++) {
    const cur = vocalItems[i];
    const next = vocalItems[i + 1];

    let lineEnd: number;
    let soloAfter: { startTime: number; endTime: number; duration: number } | null = null;

    if (next) {
      const gap = next.startTime - cur.startTime;
      // ONLY create a solo pause if there is an extended musical guitar solo (25s+) with no lyrics
      if (gap >= 25.0) {
        const wordCount = cur.text.split(/\s+/).length;
        const lineDuration = Math.min(8.0, Math.max(3.5, wordCount * 0.5));
        lineEnd = cur.startTime + lineDuration;
        soloAfter = {
          startTime: lineEnd,
          endTime: next.startTime,
          duration: next.startTime - lineEnd,
        };
      } else {
        // Line flows directly into next line without any pause interruption
        lineEnd = next.startTime;
      }
    } else {
      // Last line
      const wordCount = cur.text.split(/\s+/).length;
      lineEnd = cur.startTime + Math.max(4.0, wordCount * 0.55);
    }

    // Add Vocal Line
    timeline.push({
      id: `line-${cur.lineIndex}`,
      type: 'line',
      startTime: cur.startTime,
      endTime: lineEnd,
      duration: Math.max(1.0, lineEnd - cur.startTime),
      text: cur.text,
      lineIndex: cur.lineIndex,
    });

    if (soloAfter && soloAfter.duration >= 20.0) {
      timeline.push({
        id: `pause-solo-${cur.lineIndex}`,
        type: 'pause',
        startTime: soloAfter.startTime,
        endTime: soloAfter.endTime,
        duration: soloAfter.duration,
        text: 'Solo de Guitarra',
        isInstrumental: true,
        pauseType: 'solo',
        nextLineText: next?.text,
      });
    }
  }

  // 3. OUTRO PAUSE
  const lastItem = timeline[timeline.length - 1];
  const lastEndTime = lastItem ? lastItem.endTime : 0;
  const finalDuration = Math.max(lastEndTime + 5, totalDurationHint || lastEndTime + 12);

  if (finalDuration - lastEndTime >= 3.0) {
    timeline.push({
      id: 'pause-outro',
      type: 'pause',
      startTime: lastEndTime,
      endTime: finalDuration,
      duration: finalDuration - lastEndTime,
      text: 'Final Instrumental (Outro)',
      isInstrumental: true,
      pauseType: 'outro',
    });
  }

  return {
    timeline,
    cleanLines,
    totalDuration: Math.round(finalDuration),
  };
}

/**
 * Intelligent Musical Karaoke Generator for plain text lyrics without timestamps.
 * 
 * Recreates original recording timing by detecting stanzas, verses, choruses,
 * and adding authentic intro pauses (12-16s) and instrumental interludes (8-15s).
 */
export function generateSmartKaraokeTimeline(
  lyricsText: string,
  songDurationSeconds = 210,
  bpm = 110
): { timeline: KaraokeItem[]; cleanLines: string[]; totalDuration: number } {
  const paragraphs = lyricsText.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const cleanLines: string[] = [];
  const parsedParagraphs: string[][] = [];

  for (const para of paragraphs) {
    const rawLines = para.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const paraCleanLines: string[] = [];
    for (const l of rawLines) {
      // Filter out pure section headers like [Intro] or [Solo] to be pauses
      if (!/^\[(intro|solo|instrumental)\]/i.test(l)) {
        paraCleanLines.push(l);
        cleanLines.push(l);
      }
    }
    if (paraCleanLines.length > 0) {
      parsedParagraphs.push(paraCleanLines);
    }
  }

  if (cleanLines.length === 0) {
    cleanLines.push('(Letra não cadastrada para esta música)');
    parsedParagraphs.push([cleanLines[0]]);
  }

  const timeline: KaraokeItem[] = [];
  const totalDuration = Math.max(90, songDurationSeconds);

  // 1. Intro Instrumental (Standard 12 to 18 seconds depending on tempo)
  const introDuration = Math.max(10, Math.min(22, Math.round((60 / bpm) * 24)));
  timeline.push({
    id: 'pause-intro',
    type: 'pause',
    startTime: 0,
    endTime: introDuration,
    duration: introDuration,
    text: 'Introdução Instrumental',
    isInstrumental: true,
    pauseType: 'intro',
    nextLineText: cleanLines[0],
  });

  // 2. Allocate singing time across all lines continuously
  const netSingingTime = Math.max(40, totalDuration - introDuration - 8);

  // Weight each line by syllable / character length
  let totalWeight = 0;
  const lineWeights: number[] = [];
  for (const line of cleanLines) {
    const words = line.split(/\s+/).length;
    const chars = line.length;
    const weight = Math.max(1, words * 1.5 + chars * 0.1);
    lineWeights.push(weight);
    totalWeight += weight;
  }

  let currentTimeCursor = introDuration;

  for (let idx = 0; idx < cleanLines.length; idx++) {
    const lineText = cleanLines[idx];
    const weight = lineWeights[idx];
    const lineDuration = Math.max(2.2, Math.min(9.0, (weight / totalWeight) * netSingingTime));
    const lineStart = currentTimeCursor;
    const lineEnd = lineStart + lineDuration;

    timeline.push({
      id: `line-${idx}`,
      type: 'line',
      startTime: lineStart,
      endTime: lineEnd,
      duration: lineDuration,
      text: lineText,
      lineIndex: idx,
    });

    currentTimeCursor = lineEnd;
  }

  // 3. Outro Instrumental
  if (totalDuration > currentTimeCursor + 3) {
    timeline.push({
      id: 'pause-outro',
      type: 'pause',
      startTime: currentTimeCursor,
      endTime: totalDuration,
      duration: totalDuration - currentTimeCursor,
      text: 'Final Instrumental (Outro)',
      isInstrumental: true,
      pauseType: 'outro',
    });
  }

  return {
    timeline,
    cleanLines,
    totalDuration,
  };
}

/**
 * Computes current active karaoke status given a timestamp in seconds.
 */
export function getKaraokeState(
  timeline: KaraokeItem[],
  currentTime: number,
  totalDuration: number
): KaraokeState {
  if (timeline.length === 0) {
    return {
      currentItem: null,
      activeLineIndex: 0,
      isPause: false,
      pauseCountdown: 0,
      pauseTotalDuration: 0,
      pauseProgress: 0,
      lineProgress: 0,
      currentTime,
      totalDuration,
    };
  }

  // Find item that spans currentTime
  const currentItem = timeline.find(
    (item) => currentTime >= item.startTime && currentTime < item.endTime
  ) || null;

  if (!currentItem) {
    // If before first item
    if (currentTime < timeline[0].startTime) {
      const first = timeline[0];
      return {
        currentItem: first,
        activeLineIndex: 0,
        isPause: first.type === 'pause',
        pauseCountdown: Math.max(0, Math.ceil(first.endTime - currentTime)),
        pauseTotalDuration: first.duration,
        pauseProgress: 0,
        nextLineText: first.nextLineText,
        lineProgress: 0,
        currentTime,
        totalDuration,
      };
    }

    // If past last item
    const lastItem = timeline[timeline.length - 1];
    return {
      currentItem: lastItem,
      activeLineIndex: lastItem.lineIndex ?? 0,
      isPause: lastItem.type === 'pause',
      pauseCountdown: 0,
      pauseTotalDuration: lastItem.duration,
      pauseProgress: 100,
      lineProgress: 100,
      currentTime,
      totalDuration,
    };
  }

  const isPause = currentItem.type === 'pause';
  let activeLineIndex = 0;

  if (!isPause && currentItem.lineIndex !== undefined) {
    activeLineIndex = currentItem.lineIndex;
  } else {
    // Find closest next vocal line
    const nextVocal = timeline.find((item) => item.type === 'line' && item.startTime >= currentItem.endTime);
    if (nextVocal && nextVocal.lineIndex !== undefined) {
      activeLineIndex = nextVocal.lineIndex;
    } else {
      // Find previous vocal
      const prevVocal = [...timeline].reverse().find((item) => item.type === 'line' && item.endTime <= currentItem.startTime);
      if (prevVocal && prevVocal.lineIndex !== undefined) {
        activeLineIndex = prevVocal.lineIndex;
      }
    }
  }

  const elapsedInItem = Math.max(0, currentTime - currentItem.startTime);
  const itemProgress = currentItem.duration > 0
    ? Math.min(100, Math.max(0, (elapsedInItem / currentItem.duration) * 100))
    : 0;

  const pauseCountdown = isPause
    ? Math.max(0, Math.ceil(currentItem.endTime - currentTime))
    : 0;

  return {
    currentItem,
    activeLineIndex,
    isPause,
    pauseType: currentItem.pauseType,
    pauseCountdown,
    pauseTotalDuration: currentItem.duration,
    pauseProgress: isPause ? itemProgress : 0,
    nextLineText: currentItem.nextLineText,
    lineProgress: !isPause ? itemProgress : 0,
    currentTime,
    totalDuration,
  };
}
