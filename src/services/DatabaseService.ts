import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Song, Playlist, PlaylistSongItem, Recording, SearchHistory, ActivityLog } from '../types/kolvox';

// Activity Logger
export async function logUserActivity(userId: string, action: string, metadata: string = '') {
  try {
    const colRef = collection(db, 'users', userId, 'activity_logs');
    await addDoc(colRef, {
      id: '',
      user_id: userId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Activity log error:', err);
  }
}

// Search History
export async function saveSearchHistory(userId: string, queryText: string) {
  try {
    const colRef = collection(db, 'users', userId, 'search_history');
    await addDoc(colRef, {
      user_id: userId,
      query: queryText,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Search history save error:', err);
  }
}

export async function getSearchHistory(userId: string): Promise<SearchHistory[]> {
  try {
    const colRef = collection(db, 'users', userId, 'search_history');
    const q = query(colRef, orderBy('created_at', 'desc'), limit(15));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<SearchHistory, 'id'>),
    }));
  } catch (err) {
    console.warn('Get search history error:', err);
    return [];
  }
}

// Songs CRUD
export async function saveSongToLibrary(userId: string, songData: Omit<Song, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Song> {
  const colRef = collection(db, 'users', userId, 'songs');
  const now = new Date().toISOString();
  
  const newDoc = await addDoc(colRef, {
    user_id: userId,
    title: songData.title.trim(),
    artist: songData.artist.trim(),
    lyrics: songData.lyrics.trim(),
    source: songData.source || 'Manual/Authorized',
    source_song_id: songData.source_song_id || '',
    cover_url: songData.cover_url || '',
    key_signature: songData.key_signature || '',
    bpm: songData.bpm || 0,
    created_at: now,
    updated_at: now,
  });

  await logUserActivity(userId, 'SAVE_SONG', `Música: ${songData.title} - ${songData.artist}`);

  return {
    id: newDoc.id,
    user_id: userId,
    ...songData,
    created_at: now,
    updated_at: now,
  };
}

export async function getUserSongs(userId: string): Promise<Song[]> {
  try {
    const colRef = collection(db, 'users', userId, 'songs');
    const q = query(colRef, orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Song, 'id'>),
    }));
  } catch (err) {
    console.error('Error getting songs:', err);
    return [];
  }
}

export async function updateSongInLibrary(userId: string, songId: string, updates: Partial<Song>): Promise<void> {
  const docRef = doc(db, 'users', userId, 'songs', songId);
  await updateDoc(docRef, {
    ...updates,
    updated_at: new Date().toISOString(),
  });
  await logUserActivity(userId, 'UPDATE_SONG', `Música ID: ${songId}`);
}

export async function deleteSongFromLibrary(userId: string, songId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'songs', songId);
  await deleteDoc(docRef);
  await logUserActivity(userId, 'DELETE_SONG', `Música ID: ${songId}`);
}

// Playlists (Setlists)
export async function createPlaylist(userId: string, name: string, userEmail?: string): Promise<Playlist> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const colRef = collection(db, 'users', userId, 'playlists');
  const now = new Date().toISOString();
  const docRef = await addDoc(colRef, {
    user_id: userId,
    user_email: cleanEmail,
    name: name.trim(),
    created_at: now,
    updated_at: now,
  });

  await logUserActivity(userId, 'CREATE_PLAYLIST', `Setlist: ${name}`);

  return {
    id: docRef.id,
    user_id: userId,
    user_email: cleanEmail,
    name: name.trim(),
    created_at: now,
    updated_at: now,
    song_count: 0,
    songs: [],
  };
}

export async function getUserPlaylists(userId: string, userEmail?: string): Promise<Playlist[]> {
  if (!userId || userId === 'guest') return [];
  try {
    const colRef = collection(db, 'users', userId, 'playlists');
    const q = query(colRef, orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    
    const playlists: Playlist[] = [];
    for (const docSnap of snap.docs) {
      const pData = docSnap.data() as Omit<Playlist, 'id'>;
      // Guarantee isolation: ignore playlists belonging to another email
      if (cleanEmail && pData.user_email && pData.user_email.toLowerCase().trim() !== cleanEmail) {
        continue;
      }
      // Get count and items of songs
      let songs: Song[] = [];
      try {
        const songsSnap = await getDocs(collection(db, 'users', userId, 'playlists', docSnap.id, 'songs'));
        songs = songsSnap.docs.map((sDoc) => {
          const sData = sDoc.data();
          return {
            id: sData.song_id || sDoc.id,
            user_id: userId,
            title: sData.title || '',
            artist: sData.artist || '',
            lyrics: sData.lyrics || '',
            key_signature: sData.key || sData.key_signature || '',
            source: 'Setlist',
            created_at: sData.created_at || '',
            updated_at: sData.created_at || '',
          };
        });
      } catch {}

      playlists.push({
        id: docSnap.id,
        ...pData,
        user_email: pData.user_email || cleanEmail,
        song_count: songs.length,
        songs,
      });
    }
    return playlists;
  } catch (err) {
    console.error('Error getting playlists:', err);
    return [];
  }
}

export async function addSongToPlaylist(userId: string, playlistId: string, songId: string, song: Song): Promise<void> {
  const songsColRef = collection(db, 'users', userId, 'playlists', playlistId, 'songs');
  const snap = await getDocs(songsColRef);
  const position = snap.size + 1;

  await addDoc(songsColRef, {
    playlist_id: playlistId,
    song_id: songId,
    position,
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics,
    created_at: new Date().toISOString(),
  });

  await logUserActivity(userId, 'ADD_TO_SETLIST', `Música: ${song.title} na Setlist ID: ${playlistId}`);
}

export async function getPlaylistSongs(userId: string, playlistId: string): Promise<PlaylistSongItem[]> {
  try {
    const songsColRef = collection(db, 'users', userId, 'playlists', playlistId, 'songs');
    const snap = await getDocs(songsColRef);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        playlist_id: playlistId,
        song_id: data.song_id,
        position: data.position || 0,
        song: {
          id: data.song_id,
          user_id: userId,
          title: data.title || '',
          artist: data.artist || '',
          lyrics: data.lyrics || '',
          source: 'Setlist',
          created_at: data.created_at || '',
          updated_at: data.created_at || '',
        },
      };
    }).sort((a, b) => a.position - b.position);
  } catch (err) {
    console.error('Error getting playlist songs:', err);
    return [];
  }
}

export async function removeSongFromPlaylist(userId: string, playlistId: string, itemSongId: string): Promise<void> {
  if (!userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId, 'playlists', playlistId, 'songs', itemSongId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Error removing song from playlist in Firestore:', err);
  }
}

export async function deletePlaylist(userId: string, playlistId: string): Promise<void> {
  if (!userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId, 'playlists', playlistId);
    await deleteDoc(docRef);
    await logUserActivity(userId, 'DELETE_SETLIST', `Setlist ID: ${playlistId}`);
  } catch (err) {
    console.warn('Error deleting playlist from Firestore:', err);
  }
}

// Recordings CRUD (Stores Audio/Video in IndexedDB/Storage with Firestore Metadata)
export async function saveRecording(
  userId: string,
  recording: {
    song_id?: string;
    song_title: string;
    song_artist?: string;
    file_url: string;
    duration: number;
    media_type?: 'audio' | 'video';
  }
): Promise<Recording> {
  const now = new Date().toISOString();
  let id = 'rec_' + Date.now();
  const media_type = recording.media_type || (recording.file_url.startsWith('data:video') ? 'video' : 'audio');
  
  if (userId && userId !== 'guest') {
    try {
      const colRef = collection(db, 'users', userId, 'recordings');
      const docRef = await addDoc(colRef, {
        user_id: userId,
        song_id: recording.song_id || '',
        song_title: recording.song_title,
        song_artist: recording.song_artist || '',
        file_url: recording.file_url,
        duration: recording.duration,
        media_type,
        created_at: now,
      });
      id = docRef.id;
      const typeLabel = media_type === 'video' ? 'Vídeo/Filmagem' : 'Áudio';
      await logUserActivity(userId, 'SAVE_RECORDING', `${typeLabel} de: ${recording.song_title} (${Math.round(recording.duration)}s)`);
    } catch (e) {
      console.warn('Firestore saveRecording fallback to local storage:', e);
    }
  }

  const recObj: Recording = {
    id,
    user_id: userId,
    ...recording,
    media_type,
    created_at: now,
  };

  try {
    const local = localStorage.getItem('kolvox_local_recordings');
    const list: Recording[] = local ? JSON.parse(local) : [];
    localStorage.setItem('kolvox_local_recordings', JSON.stringify([recObj, ...list]));
  } catch (e) {
    console.warn('LocalStorage save recording error:', e);
  }

  return recObj;
}

export async function getUserRecordings(userId: string): Promise<Recording[]> {
  const recordingsMap = new Map<string, Recording>();

  // Read local recordings first
  try {
    const local = localStorage.getItem('kolvox_local_recordings');
    if (local) {
      const list: Recording[] = JSON.parse(local);
      list.forEach((r) => recordingsMap.set(r.id, r));
    }
  } catch {}

  if (userId && userId !== 'guest') {
    try {
      const colRef = collection(db, 'users', userId, 'recordings');
      const q = query(colRef, orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        recordingsMap.set(d.id, {
          id: d.id,
          ...(d.data() as Omit<Recording, 'id'>),
        });
      });
    } catch (err) {
      console.error('Error fetching recordings from firestore:', err);
    }
  }

  return Array.from(recordingsMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function deleteRecording(userId: string, recordingId: string): Promise<void> {
  try {
    const local = localStorage.getItem('kolvox_local_recordings');
    if (local) {
      const list: Recording[] = JSON.parse(local);
      const filtered = list.filter((r) => r.id !== recordingId);
      localStorage.setItem('kolvox_local_recordings', JSON.stringify(filtered));
    }
  } catch {}

  if (userId && userId !== 'guest') {
    try {
      const docRef = doc(db, 'users', userId, 'recordings', recordingId);
      await deleteDoc(docRef);
      await logUserActivity(userId, 'DELETE_RECORDING', `Gravação ID: ${recordingId}`);
    } catch (e) {
      console.warn('Firestore delete recording error:', e);
    }
  }
}
