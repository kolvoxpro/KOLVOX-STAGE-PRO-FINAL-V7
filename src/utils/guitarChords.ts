import { ChordDiagramData } from '../types/index.ts';

// Comprehensive Guitar Chord Database (frets: [E, A, D, G, B, e], -1=muted, 0=open)
export const GUITAR_CHORD_LIBRARY: Record<string, ChordDiagramData> = {
  // C family
  'C': { chord: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  'Cm': { chord: 'Cm', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], baseFret: 3, barres: [{ fromString: 5, toString: 1, fret: 3 }] },
  'C7': { chord: 'C7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'Cmaj7': { chord: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], baseFret: 1 },
  'C9': { chord: 'C9', frets: [-1, 3, 2, 3, 3, 3], fingers: [0, 2, 1, 3, 3, 3], baseFret: 1 },
  'Cadd9': { chord: 'Cadd9', frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0], baseFret: 1 },

  // C# / Db
  'C#': { chord: 'C#', frets: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 2, 3, 4, 1], baseFret: 4 },
  'C#m': { chord: 'C#m', frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], baseFret: 4 },
  'C#m7': { chord: 'C#m7', frets: [-1, 4, 6, 4, 5, 4], fingers: [0, 1, 3, 1, 2, 1], baseFret: 4 },

  // D family
  'D': { chord: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  'Dm': { chord: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  'D7': { chord: 'D7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  'Dmaj7': { chord: 'Dmaj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], baseFret: 1 },
  'Dsus4': { chord: 'Dsus4', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], baseFret: 1 },
  'D/F#': { chord: 'D/F#', frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3], baseFret: 1 },

  // D# / Eb
  'Eb': { chord: 'Eb', frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1], baseFret: 6 },
  'D#m': { chord: 'D#m', frets: [-1, 6, 8, 8, 7, 6], fingers: [0, 1, 3, 4, 2, 1], baseFret: 6 },

  // E family
  'E': { chord: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  'Em': { chord: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  'E7': { chord: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'Em7': { chord: 'Em7', frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0], baseFret: 1 },
  'Esus4': { chord: 'Esus4', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], baseFret: 1 },

  // F family
  'F': { chord: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'Fm': { chord: 'Fm', frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], baseFret: 1, barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'F7': { chord: 'F7', frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], baseFret: 1 },
  'Fmaj7': { chord: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], baseFret: 1 },

  // F# / Gb
  'F#': { chord: 'F#', frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], baseFret: 2 },
  'F#m': { chord: 'F#m', frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 2 },
  'F#7': { chord: 'F#7', frets: [2, 4, 2, 3, 2, 2], fingers: [1, 3, 1, 2, 1, 1], baseFret: 2 },
  'F#m7': { chord: 'F#m7', frets: [2, 4, 2, 2, 2, 2], fingers: [1, 3, 1, 1, 1, 1], baseFret: 2 },

  // G family
  'G': { chord: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  'Gm': { chord: 'Gm', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], baseFret: 3 },
  'G7': { chord: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'G/B': { chord: 'G/B', frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4], baseFret: 1 },
  'Gsus4': { chord: 'Gsus4', frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4], baseFret: 1 },

  // G# / Ab
  'G#': { chord: 'G#', frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], baseFret: 4 },
  'G#m': { chord: 'G#m', frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], baseFret: 4 },

  // A family
  'A': { chord: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  'Am': { chord: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  'A7': { chord: 'A7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
  'Am7': { chord: 'Am7', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1 },
  'A/C#': { chord: 'A/C#', frets: [-1, 4, 2, 2, 2, 0], fingers: [0, 4, 1, 2, 3, 0], baseFret: 1 },

  // Bb / A#
  'Bb': { chord: 'Bb', frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1 },
  'Bbm': { chord: 'Bbm', frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1 },

  // B family
  'B': { chord: 'B', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 2 },
  'Bm': { chord: 'Bm', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 2, barres: [{ fromString: 5, toString: 1, fret: 2 }] },
  'B7': { chord: 'B7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },
  'Bm7': { chord: 'Bm7', frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], baseFret: 2 },
};

/**
 * Look up chord diagram, falling back to base chord if minor or 7th variation
 */
export function getChordDiagram(chordName: string): ChordDiagramData | null {
  const cleanName = chordName.replace(/[\[\]]/g, '').trim();

  if (GUITAR_CHORD_LIBRARY[cleanName]) {
    return GUITAR_CHORD_LIBRARY[cleanName];
  }

  // Fallback match: if it has slash like G/B, check G
  if (cleanName.includes('/')) {
    const root = cleanName.split('/')[0];
    if (GUITAR_CHORD_LIBRARY[root]) {
      return { ...GUITAR_CHORD_LIBRARY[root], chord: cleanName };
    }
  }

  // Fallback match: if complex like Am9 -> Am
  const match = cleanName.match(/^([A-G][b#]?)(m|7)?/);
  if (match) {
    const simplified = `${match[1]}${match[2] || ''}`;
    if (GUITAR_CHORD_LIBRARY[simplified]) {
      return { ...GUITAR_CHORD_LIBRARY[simplified], chord: cleanName };
    }
  }

  return null;
}
