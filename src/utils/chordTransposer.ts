const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map note names to index
const NOTE_TO_INDEX: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

/**
 * Transpose a single musical note by semitones
 */
export function transposeNote(note: string, semitones: number, preferFlats = false): string {
  const index = NOTE_TO_INDEX[note];
  if (index === undefined) return note;

  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;

  const scale = preferFlats ? FLAT_SCALE : SHARP_SCALE;
  return scale[newIndex];
}

/**
 * Transpose an entire chord (e.g., "C#m7/G#" -> "Dm7/A" with +1)
 */
export function transposeChord(chord: string, semitones: number, preferFlats = false): string {
  if (semitones === 0) return chord;

  // Check for slash chords like G/B, D/F#
  if (chord.includes('/')) {
    const parts = chord.split('/');
    const main = transposeChord(parts[0], semitones, preferFlats);
    const bass = transposeNote(parts[1], semitones, preferFlats);
    return `${main}/${bass}`;
  }

  // Regex to match root note
  const match = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chord;

  const [, root, extension] = match;
  const newRoot = transposeNote(root, semitones, preferFlats);
  return `${newRoot}${extension}`;
}

/**
 * Regex to identify valid musical chords in text lines
 */
export const CHORD_REGEX = /\b([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|\d|M|\+|-)*(?:\/[A-G][b#]?)?)\b/g;

/**
 * Check if a text line consists mostly of chords
 */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    // section tag like [Intro], [Refrão]
    return false;
  }

  const chords = trimmed.match(CHORD_REGEX);
  if (!chords) return false;

  const chordsLength = chords.reduce((acc, c) => acc + c.length, 0);
  const nonSpaceLength = trimmed.replace(/\s+/g, '').length;

  return chordsLength / nonSpaceLength > 0.45;
}

/**
 * Transposes all chords in a text block containing lyrics & chords
 */
export function transposeChordSheet(text: string, semitones: number, preferFlats = false): string {
  if (semitones === 0) return text;

  const lines = text.split('\n');
  const transposed = lines.map((line) => {
    // If it's a section tag like [Intro] G D/F# Em C
    if (line.includes('[') && line.includes(']')) {
      return line.replace(CHORD_REGEX, (chord) => transposeChord(chord, semitones, preferFlats));
    }

    if (isChordLine(line)) {
      return line.replace(CHORD_REGEX, (chord) => transposeChord(chord, semitones, preferFlats));
    }

    // In case chords are surrounded by brackets like [C] or [G] in lyrics
    return line.replace(/\[([A-G][b#]?[^\]]*)\]/g, (_, chord) => {
      return `[${transposeChord(chord, semitones, preferFlats)}]`;
    });
  });

  return transposed.join('\n');
}

/**
 * Return formatted semitone label, e.g. "+2 semitons (D)"
 */
export function formatTranspositionLabel(originalKey: string, semitones: number): string {
  if (semitones === 0) return `${originalKey} (Original)`;
  const sign = semitones > 0 ? `+${semitones}` : `${semitones}`;
  const transposed = transposeChord(originalKey, semitones);
  return `${transposed} (${sign})`;
}
