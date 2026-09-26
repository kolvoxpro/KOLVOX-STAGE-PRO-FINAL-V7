export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'blocked' | 'inativo';
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  lyrics: string;
  source: string;
  source_song_id?: string;
  cover_url?: string;
  cover_image?: string;
  key_signature?: string; // e.g. "Am", "G"
  bpm?: number;
  duration?: string | number;
  created_at: string;
  updated_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  user_email?: string;
  name: string;
  created_at: string;
  updated_at: string;
  song_count?: number;
  songs?: Song[];
}

export interface PlaylistSongItem {
  id: string;
  playlist_id: string;
  song_id: string;
  position: number;
  song?: Song;
}

export interface Recording {
  id: string;
  user_id: string;
  song_id?: string;
  song_title: string;
  song_artist?: string;
  file_url: string; // Base64 audio/video URI or object storage key
  duration: number; // in seconds
  media_type?: 'audio' | 'video';
  created_at: string;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  metadata?: string;
  created_at: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  lyricsSnippet?: string;
  source: string;
  lyrics?: string;
  hasLicensedLyrics: boolean;
}
