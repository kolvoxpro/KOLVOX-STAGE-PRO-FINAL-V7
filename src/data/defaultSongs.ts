import { Song } from '../types/kolvox';
import { VERIFIED_FULL_LYRICS } from './fullLyricsCatalog';

export const DEFAULT_STAGE_SONGS: Song[] = VERIFIED_FULL_LYRICS.slice(0, 8).map((v) => ({
  id: `default-${v.id}`,
  user_id: 'system',
  title: v.title,
  artist: v.artist,
  lyrics: v.lyrics,
  source: 'Catálogo Oficial KOLVOX',
  cover_url: v.coverUrl,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  key_signature: v.keySignature || 'G',
  bpm: v.bpm || 100,
}));
