import { SearchResultItem } from '../types/kolvox';
import { VERIFIED_FULL_LYRICS, findVerifiedFullLyrics } from '../data/fullLyricsCatalog';

/**
 * MusicSearchProvider Interface
 * Architecture for authorized lyrics/music catalog integrations.
 * Supports Verified Full Catalog, LRCLIB, Vagalume, and Apple/iTunes metadata.
 */
export interface IMusicSearchProvider {
  search(query: string, searchType?: 'Todas' | 'Músicas' | 'Artistas' | 'Álbuns'): Promise<SearchResultItem[]>;
  getSong(id: string): Promise<SearchResultItem | null>;
  getLyrics(title: string, artist: string): Promise<string | null>;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchesArtist(candidateArtist: string, targetArtist: string): boolean {
  const c = normalize(candidateArtist);
  const t = normalize(targetArtist);
  if (!c || !t) return false;
  return c.includes(t) || t.includes(c);
}

export class AuthorizedMusicProvider implements IMusicSearchProvider {
  private userAgent = 'KOLVOX-StageApp/1.0 (contact: support@kolvox.app)';

  async search(
    query: string,
    searchType: 'Todas' | 'Músicas' | 'Artistas' | 'Álbuns' = 'Todas'
  ): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normQuery = normalize(trimmed);
    const isArtistSearch = searchType === 'Artistas';
    const results: SearchResultItem[] = [];
    const seenKeys = new Set<string>();

    // 1. Check local verified high-fidelity full lyrics catalog
    const verifiedMatches = VERIFIED_FULL_LYRICS.filter((s) => {
      const normArtist = normalize(s.artist);
      const normTitle = normalize(s.title);
      const normAlbum = s.album ? normalize(s.album) : '';

      if (isArtistSearch) {
        return matchesArtist(s.artist, trimmed);
      }

      return (
        normTitle.includes(normQuery) ||
        normArtist.includes(normQuery) ||
        normQuery.includes(normArtist) ||
        normAlbum.includes(normQuery)
      );
    });

    for (const v of verifiedMatches) {
      const key = `${v.title.toLowerCase()}-${v.artist.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          id: `verified_${v.id}`,
          title: v.title,
          artist: v.artist,
          album: v.album || 'Catálogo Oficial KOLVOX',
          coverUrl: v.coverUrl,
          lyricsSnippet: v.lyrics ? v.lyrics.slice(0, 150) + '...' : undefined,
          source: 'Catálogo Oficial (Letra Completa)',
          lyrics: v.lyrics,
          hasLicensedLyrics: true,
        });
      }
    }

    // 2. Query LRCLIB (Authorized open lyrics provider)
    try {
      const lrclibUrl = isArtistSearch
        ? `https://lrclib.net/api/search?artist_name=${encodeURIComponent(trimmed)}`
        : `https://lrclib.net/api/search?q=${encodeURIComponent(trimmed)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const lrclibRes = await fetch(lrclibUrl, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (lrclibRes.ok) {
        const lrcData = await lrclibRes.json();
        if (Array.isArray(lrcData)) {
          for (const item of lrcData) {
            const trackName = item.trackName || item.name || '';
            const artistName = item.artistName || '';

            // STRICT FILTERING: When searching by artist, reject songs not by this artist
            if (isArtistSearch && !matchesArtist(artistName, trimmed)) {
              continue;
            }

            const key = `${trackName.toLowerCase()}-${artistName.toLowerCase()}`;
            if (trackName && !seenKeys.has(key)) {
              seenKeys.add(key);

              // Check if we have verified complete lyrics for this track
              const verified = findVerifiedFullLyrics(trackName, artistName);
              let lyrics = verified ? verified.lyrics : '';

              if (!lyrics) {
                lyrics =
                  item.plainLyrics ||
                  (item.syncedLyrics
                    ? item.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim()
                    : '');
              }

              // Do not add artificial lyrics
              results.push({
                id: `lrc_${item.id}`,
                title: trackName,
                artist: artistName,
                album: item.albumName || 'Álbum Oficial',
                coverUrl: verified?.coverUrl,
                lyricsSnippet: lyrics ? lyrics.slice(0, 150) + '...' : undefined,
                source: verified ? 'Catálogo Oficial (Letra Completa)' : 'LRCLIB (Letra Original)',
                lyrics: lyrics || undefined,
                hasLicensedLyrics: Boolean(lyrics),
              });
            }

            if (results.length >= 25) break;
          }
        }
      }
    } catch (err) {
      console.warn('LRCLIB provider lookup error:', err);
    }

    // 3. Query iTunes/Apple catalog search for verified track metadata & artwork
    try {
      const itunesUrl = isArtistSearch
        ? `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&attribute=artistTerm&limit=25`
        : `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=15`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const itunesRes = await fetch(itunesUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && Array.isArray(itunesData.results)) {
          for (const track of itunesData.results) {
            const trackName = track.trackName || '';
            const artistName = track.artistName || '';

            // STRICT FILTERING: When searching by artist, reject songs not by this artist
            if (isArtistSearch && !matchesArtist(artistName, trimmed)) {
              continue;
            }

            const key = `${trackName.toLowerCase()}-${artistName.toLowerCase()}`;
            const hiResCover = track.artworkUrl100
              ? track.artworkUrl100.replace('100x100bb.jpg', '400x400bb.jpg')
              : undefined;

            // Enrich existing result with artwork
            const existing = results.find(
              (r) =>
                r.title.toLowerCase() === trackName.toLowerCase() &&
                matchesArtist(r.artist, artistName)
            );

            if (existing) {
              if (!existing.coverUrl && hiResCover) {
                existing.coverUrl = hiResCover;
              }
            } else if (!seenKeys.has(key)) {
              seenKeys.add(key);

              // Check if verified lyrics exist for this track
              const verified = findVerifiedFullLyrics(trackName, artistName);
              const lyrics = verified?.lyrics;

              results.push({
                id: `itunes_${track.trackId}`,
                title: trackName,
                artist: artistName,
                album: track.collectionName || 'Single / Álbum',
                coverUrl: hiResCover,
                lyricsSnippet: lyrics ? lyrics.slice(0, 150) + '...' : undefined,
                source: verified ? 'Catálogo Oficial (Letra Completa)' : 'Apple Music / iTunes',
                lyrics: lyrics || undefined,
                hasLicensedLyrics: Boolean(lyrics),
              });
            }

            if (results.length >= 30) break;
          }
        }
      }
    } catch (err) {
      console.warn('iTunes catalog search error:', err);
    }

    // 4. Query Vagalume if search returned few results
    if (results.length < 5) {
      try {
        const vagalumeUrl = `https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(trimmed)}&limit=10`;
        const vRes = await fetch(vagalumeUrl);
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData?.response?.docs) {
            for (const doc of vData.response.docs) {
              const title = doc.title || '';
              const artist = doc.band || '';

              if (isArtistSearch && !matchesArtist(artist, trimmed)) {
                continue;
              }

              const key = `${title.toLowerCase()}-${artist.toLowerCase()}`;
              if (title && !seenKeys.has(key)) {
                seenKeys.add(key);
                const verified = findVerifiedFullLyrics(title, artist);
                results.push({
                  id: `vag_${doc.id || Math.random().toString(36).substr(2, 9)}`,
                  title,
                  artist,
                  album: 'Catálogo Vagalume',
                  coverUrl: verified?.coverUrl,
                  source: verified ? 'Catálogo Oficial (Letra Completa)' : 'Vagalume / Letras',
                  lyrics: verified?.lyrics,
                  hasLicensedLyrics: Boolean(verified?.lyrics),
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Vagalume fallback error:', err);
      }
    }

    return results;
  }

  async getSong(id: string): Promise<SearchResultItem | null> {
    if (id.startsWith('verified_')) {
      const cleanId = id.replace('verified_', '');
      const found = VERIFIED_FULL_LYRICS.find((v) => v.id === cleanId);
      if (found) {
        return {
          id,
          title: found.title,
          artist: found.artist,
          album: found.album,
          coverUrl: found.coverUrl,
          lyrics: found.lyrics,
          hasLicensedLyrics: true,
          source: 'Catálogo Oficial KOLVOX',
        };
      }
    }

    if (id.startsWith('lrc_')) {
      const realId = id.replace('lrc_', '');
      try {
        const res = await fetch(`https://lrclib.net/api/get/${realId}`, {
          headers: { 'User-Agent': this.userAgent },
        });
        if (res.ok) {
          const item = await res.json();
          const lyrics =
            item.plainLyrics ||
            (item.syncedLyrics ? item.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim() : '');
          return {
            id,
            title: item.trackName,
            artist: item.artistName,
            album: item.albumName,
            source: 'LRCLIB (Letra Completa)',
            lyrics: lyrics || undefined,
            hasLicensedLyrics: Boolean(lyrics),
          };
        }
      } catch (e) {
        console.error('Failed to get single song from LRCLIB', e);
      }
    }
    return null;
  }

  /**
   * Retrieves complete, full original lyrics for a title & artist.
   * Checks verified catalog, Vagalume API, and LRCLIB in sequence.
   * STRICT: NEVER returns artificial, placeholder, or synthesized lyrics.
   */
  async getLyrics(title: string, artist: string): Promise<string | null> {
    // 1. Check local verified catalog first (100% full, accurate and instant)
    const verified = findVerifiedFullLyrics(title, artist);
    if (verified && verified.lyrics) {
      return verified.lyrics;
    }

    // 2. Query Vagalume API
    try {
      const cleanArtist = artist.replace(/feat\..*/i, '').trim();
      const vagalumeUrl = `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(cleanArtist)}&mus=${encodeURIComponent(title)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const vRes = await fetch(vagalumeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData?.mus?.[0]?.text) {
          const fullText = vData.mus[0].text.trim();
          if (fullText.length > 50) {
            return fullText;
          }
        }
      }
    } catch (e) {
      console.warn('Vagalume API query failed:', e);
    }

    // 3. Query LRCLIB API direct get
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const lyrics =
          data.plainLyrics ||
          (data.syncedLyrics ? data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim() : null);
        if (lyrics && lyrics.trim().length > 50) {
          return lyrics.trim();
        }
      }
    } catch (e) {
      console.warn('LRCLIB get failed:', e);
    }

    // 4. Query LRCLIB search fallback
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          for (const item of list) {
            if (matchesArtist(item.artistName || '', artist)) {
              const l =
                item.plainLyrics ||
                (item.syncedLyrics ? item.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim() : null);
              if (l && l.trim().length > 50) {
                return l.trim();
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('LRCLIB search fallback failed:', e);
    }

    return null;
  }
}

export const musicSearchProvider = new AuthorizedMusicProvider();
