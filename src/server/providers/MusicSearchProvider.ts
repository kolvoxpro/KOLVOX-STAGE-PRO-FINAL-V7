import { CATALOG_SEED } from '../../data/catalogSeed.ts';
import { findVerifiedFullLyrics } from '../../data/fullLyricsCatalog.ts';

export interface SongSearchResult {
  id: number | string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  hasChords: boolean;
  hasLyrics: boolean;
  hasTabs: boolean;
  hasSheetMusic: boolean;
  sourceProvider: 'user_created' | 'kolvox_catalog' | 'vagalume_api' | 'cifraclub_ref' | 'public_domain' | 'licensed' | 'cifraclub' | 'vagalume';
  sourceUrl?: string;
  licenseType: 'user_owned' | 'public_domain' | 'licensed' | 'official_link_only' | 'attribution_required';
  downloadAllowed: boolean;
  printAllowed: boolean;
  isExternalOnly?: boolean;
}

export interface DetailedSongItem extends SongSearchResult {
  lyrics?: string;
  chords?: string;
  tabs?: string;
  sheetMusic?: string;
  duration?: string;
  officialNotice?: string;
}

export function normalizeSearchText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class MusicSearchProvider {
  private static dynamicCache = new Map<string, DetailedSongItem>();

  /**
   * Search songs across catalog, user database, and legal authorized partner APIs
   */
  static async search(query: string, filter?: { genre?: string; key?: string; provider?: string }): Promise<SongSearchResult[]> {
    const q = query.trim();
    const qNorm = normalizeSearchText(q);
    const qTokens = qNorm.split(' ').filter((t) => t.length >= 2);
    
    const catalog = MusicSearchProvider.getCatalogSeed();
    const dynamicItems = Array.from(MusicSearchProvider.dynamicCache.values());
    const allCatalog = [...catalog, ...dynamicItems];

    let results = allCatalog.filter((item) => {
      const titleNorm = normalizeSearchText(item.title);
      const artistNorm = normalizeSearchText(item.artist);
      const albumNorm = normalizeSearchText(item.album || '');
      const genreNorm = normalizeSearchText(item.genre || '');
      const keyNorm = normalizeSearchText(item.key || '');
      const lyricsNorm = normalizeSearchText(item.lyrics || '');
      const fullSongText = `${titleNorm} ${artistNorm} ${albumNorm} ${genreNorm} ${keyNorm} ${lyricsNorm}`;

      const matchQuery = !qNorm || 
        titleNorm.includes(qNorm) || 
        artistNorm.includes(qNorm) || 
        albumNorm.includes(qNorm) ||
        genreNorm.includes(qNorm) ||
        keyNorm === qNorm ||
        lyricsNorm.includes(qNorm) ||
        (qTokens.length > 0 && qTokens.every((tok) => fullSongText.includes(tok)));

      const matchGenre = !filter?.genre || (item.genre && normalizeSearchText(item.genre).includes(normalizeSearchText(filter.genre)));
      const matchKey = !filter?.key || (item.key && item.key.toLowerCase() === filter.key.toLowerCase());
      const matchProvider = !filter?.provider || item.sourceProvider === filter.provider;

      return matchQuery && matchGenre && matchKey && matchProvider;
    });

    // If query has at least 2 characters, search online sources (Cifra Club live Solr index)
    if (q.length >= 2 && results.length < 15) {
      try {
        const onlineItems = await MusicSearchProvider.searchOnlineSources(query);
        for (const item of onlineItems) {
          const itemTitleNorm = normalizeSearchText(item.title);
          const itemArtistNorm = normalizeSearchText(item.artist);
          if (!results.some(r => normalizeSearchText(r.title) === itemTitleNorm && normalizeSearchText(r.artist) === itemArtistNorm)) {
            MusicSearchProvider.dynamicCache.set(String(item.id), item);
            results.push(item);
          }
        }
      } catch (err) {
        console.warn('Online source search warning:', err);
      }
    }

    return results;
  }

  static async getSong(id: number | string): Promise<DetailedSongItem | null> {
    const idStr = String(id).trim();
    let found: DetailedSongItem | null = null;

    if (MusicSearchProvider.dynamicCache.has(idStr)) {
      found = MusicSearchProvider.dynamicCache.get(idStr)!;
    } else {
      const catalog = MusicSearchProvider.getCatalogSeed();
      const cleanNum = idStr.replace(/^cat-/, '');
      found =
        catalog.find((s) => {
          const sId = String(s.id);
          return (
            sId === idStr ||
            sId === `cat-${idStr}` ||
            sId.replace(/^cat-/, '') === cleanNum ||
            (cleanNum !== '' && sId === cleanNum)
          );
        }) || null;
    }

    // If not in cache or catalog seed, check database if numeric ID
    if (!found && !isNaN(Number(idStr))) {
      try {
        const { db } = await import('../../db/index.ts');
        const schema = await import('../../db/schema.ts');
        const { eq } = await import('drizzle-orm');
        const [dbSong] = await db
          .select()
          .from(schema.songs)
          .where(eq(schema.songs.id, Number(idStr)))
          .limit(1);

        if (dbSong) {
          found = {
            id: dbSong.id,
            title: dbSong.title,
            artist: dbSong.artist,
            album: dbSong.album || undefined,
            genre: dbSong.genre || 'Geral',
            key: dbSong.key || 'C',
            capo: dbSong.capo || 0,
            bpm: dbSong.bpm || 120,
            duration: dbSong.duration || '3:30',
            hasChords: !!(dbSong.chords && dbSong.chords.length > 5),
            hasLyrics: !!(dbSong.lyrics && dbSong.lyrics.length > 5),
            hasTabs: !!(dbSong.tabs && dbSong.tabs.length > 5),
            hasSheetMusic: false,
            sourceProvider: (dbSong.sourceProvider as any) || 'cifraclub',
            sourceUrl: dbSong.sourceUrl || undefined,
            licenseType: (dbSong.licenseType as any) || 'licensed',
            downloadAllowed: dbSong.downloadAllowed ?? true,
            printAllowed: dbSong.printAllowed ?? true,
            chords: dbSong.chords || '',
            lyrics: dbSong.lyrics || '',
            tabs: dbSong.tabs || '',
          };
        }
      } catch (dbErr) {
        console.warn('DB lookup error in MusicSearchProvider:', dbErr);
      }
    }

    // If still not found, try reconstructing from deterministic source ID format
    if (!found) {
      if (idStr.startsWith('cifra__')) {
        const parts = idStr.split('__');
        if (parts.length >= 3) {
          const aSlug = parts[1];
          const sSlug = parts[2];
          found = await MusicSearchProvider.fetchCifraClubSong(`https://www.cifraclub.com.br/${aSlug}/${sSlug}/`);
        }
      } else if (idStr.startsWith('vagalume__')) {
        const parts = idStr.split('__');
        if (parts.length >= 3) {
          const aSlug = parts[1];
          const sSlug = parts[2];
          found = await MusicSearchProvider.fetchVagalumeSong(`https://www.vagalume.com.br/${aSlug}/${sSlug}.html`);
        }
      }
    }

    // If song was found but lacks authentic chords or lyrics, load from source URL or slug
    if (found && (!found.chords || found.chords.length < 20 || !found.lyrics || found.lyrics.length < 20)) {
      try {
        // 1. Check local verified catalog for 100% genuine lyrics
        if (found.title && found.artist) {
          const verified = findVerifiedFullLyrics(found.title, found.artist);
          if (verified?.lyrics && verified.lyrics.length > 30) {
            found.lyrics = verified.lyrics;
            found.hasLyrics = true;
          }
        }

        // 2. Try official Vagalume search API
        if ((!found.lyrics || found.lyrics.length < 30) && found.title && found.artist) {
          const vgLyrics = await MusicSearchProvider.fetchVagalumeApi(found.artist, found.title);
          if (vgLyrics) {
            found.lyrics = vgLyrics;
            found.hasLyrics = true;
            found.sourceProvider = 'vagalume';
          }
        }

        // 3. Try LRCLIB for genuine original lyrics
        if ((!found.lyrics || found.lyrics.length < 30) && found.title && found.artist) {
          const lrcLyrics = await MusicSearchProvider.fetchLrclibLyrics(found.artist, found.title);
          if (lrcLyrics) {
            found.lyrics = lrcLyrics;
            found.hasLyrics = true;
          }
        }

        // 4. Source URL fetch (Cifra Club or Vagalume page)
        if (found.sourceUrl && (!found.chords || found.chords.length < 20 || !found.lyrics || found.lyrics.length < 20)) {
          const full = found.sourceProvider === 'vagalume'
            ? await MusicSearchProvider.fetchVagalumeSong(found.sourceUrl)
            : await MusicSearchProvider.fetchCifraClubSong(found.sourceUrl);
          if (full) {
            if (full.chords && (!found.chords || found.chords.length < 20)) {
              found.chords = full.chords;
              found.hasChords = true;
            }
            if (full.lyrics && (!found.lyrics || found.lyrics.length < 20)) {
              found.lyrics = full.lyrics;
              found.hasLyrics = true;
            }
          }
        } else if (found.title && found.artist && (!found.chords || found.chords.length < 20)) {
          // Generate standard Cifra Club URL for artist + song
          const cleanSlug = (s: string) =>
            s
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
          const autoUrl = `https://www.cifraclub.com.br/${cleanSlug(found.artist)}/${cleanSlug(found.title)}/`;
          const full = await MusicSearchProvider.fetchCifraClubSong(autoUrl);
          if (full) {
            if (full.chords && (!found.chords || found.chords.length < 20)) {
              found.chords = full.chords;
              found.hasChords = true;
            }
            if (full.lyrics && (!found.lyrics || found.lyrics.length < 20)) {
              found.lyrics = full.lyrics;
              found.hasLyrics = true;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load full chords/lyrics for song', idStr, err);
      }
    }

    if (found) {
      MusicSearchProvider.dynamicCache.set(idStr, found);
      if (typeof found.id === 'string' && found.id.startsWith('cat-')) {
        MusicSearchProvider.dynamicCache.set(found.id.replace('cat-', ''), found);
      }
    }

    return found;
  }

  static async getLyrics(id: number | string): Promise<string | null> {
    const song = await MusicSearchProvider.getSong(id);
    if (!song) return null;
    return song.lyrics || null;
  }

  static async getChords(id: number | string): Promise<string | null> {
    const song = await MusicSearchProvider.getSong(id);
    if (!song) return null;
    return song.chords || null;
  }

  static async getSource(id: number | string): Promise<{ provider: string; url?: string; copyrightNotice: string }> {
    const song = await MusicSearchProvider.getSong(id);
    if (!song) {
      return { provider: 'Desconhecido', copyrightNotice: 'Sem informações de direitos.' };
    }
    return {
      provider: song.sourceProvider === 'cifraclub' ? 'Cifra Club (Oficial)' : song.sourceProvider === 'vagalume' ? 'Vagalume (Oficial)' : song.sourceProvider,
      url: song.sourceUrl,
      copyrightNotice: 'Conteúdo autêntico do artista obtido diretamente do site fonte para estudo e performance individual.',
    };
  }

  static async getLicense(id: number | string): Promise<string> {
    const song = await MusicSearchProvider.getSong(id);
    return song?.licenseType || 'licensed';
  }

  static async isDownloadAllowed(id: number | string): Promise<boolean> {
    const song = await MusicSearchProvider.getSong(id);
    return Boolean(song?.downloadAllowed);
  }

  /**
   * Helper: slugify string for URLs
   */
  private static toSlug(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private static formatSlugToName(slug: string): string {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Fetch authentic lyrics from Vagalume official search API
   * STRICT: Returns only exact lyrics published by the original artist.
   */
  static async fetchVagalumeApi(artist: string, song: string): Promise<string | null> {
    try {
      const cleanArt = artist.replace(/\s+e\s+/gi, ' & ').replace(/feat\..*/gi, '').trim();
      const url = `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(cleanArt)}&mus=${encodeURIComponent(song)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.mus?.[0]?.text) {
          const txt = data.mus[0].text.trim();
          if (txt.length > 30) return txt;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Fetch authentic original lyrics from LRCLIB
   * STRICT: Returns only genuine lyrics from the provider, never synthesized.
   */
  static async fetchLrclibLyrics(artist: string, song: string): Promise<string | null> {
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'KOLVOX-StageApp/1.0 (contact: support@kolvox.app)' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.plainLyrics && data.plainLyrics.trim().length > 30) {
          return data.plainLyrics.trim();
        }
        if (data?.syncedLyrics) {
          const clean = data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
          if (clean.length > 30) return clean;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Fetch authentic chords and lyrics directly from Cifra Club
   */
  static async fetchCifraClubSong(url: string): Promise<DetailedSongItem | null> {
    try {
      const isBrowser = typeof window !== 'undefined';
      const headers: Record<string, string> = isBrowser
        ? {}
        : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          };
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const html = await res.text();

      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      let title = '';
      let artist = '';
      if (titleTag) {
        const raw = titleTag[1].replace(/ - Cifra Club$/i, '').trim();
        const parts = raw.split(' - ');
        if (parts.length >= 2) {
          title = parts[0].trim();
          artist = parts.slice(1).join(' - ').trim();
        } else {
          title = raw;
        }
      }

      const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (!preMatch) return null;

      let preContent = preMatch[1]
        .replace(/<div class="kvMV">/gi, '\n')
        .replace(/<\/div>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n');
      const chords = preContent.replace(/<[^>]+>/g, '').trim();

      // Key (tom)
      const keyMatch =
        html.match(/class="_QG2y\s+Hkrrv"[^>]*><p[^>]*>([A-G][#b]?[m]?)</i) ||
        html.match(/data-anchor="--chord-tone"[^>]*>([A-G][#b]?[m]?)</i) ||
        html.match(/Tom:\s*<a[^>]*>([^<]+)<\/a>/i) ||
        html.match(/data-key="([^"]+)"/i);
      const key = keyMatch ? keyMatch[1].trim() : 'G';

      // Capo
      const capoMatch = html.match(/capotraste:\s*([0-9]+)/i);
      const capo = capoMatch ? parseInt(capoMatch[1]) : 0;

      // Extract authentic lyrics from chords pre
      const lines = chords.split('\n');
      const lyricsLines = lines.filter((l) => {
        const t = l.trim();
        if (!t) return true;
        if (t.startsWith('|') || t.startsWith('[Tab') || t.startsWith('E|') || t.startsWith('B|') || t.startsWith('G|') || t.startsWith('D|') || t.startsWith('A|')) return false;
        const words = t.split(/\s+/);
        const isAllChords = words.every((w) => /^[A-G][b#]?(m|maj|min|dim|aug|sus|[0-9]|[\(\)\/])*/.test(w) || w === '-' || w === '/');
        return !isAllChords;
      });
      const lyrics = lyricsLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

      const urlMatch = url.match(/cifraclub\.com\.br\/([^\/]+)\/([^\/]+)/);
      const id = urlMatch ? `cifra__${urlMatch[1]}__${urlMatch[2]}` : `cifra__${MusicSearchProvider.toSlug(artist)}__${MusicSearchProvider.toSlug(title)}`;

      return {
        id,
        title: title || 'Música Sem Título',
        artist: artist || 'Artista',
        genre: 'Repertório Cifra Club',
        key,
        capo,
        bpm: 100,
        hasChords: true,
        hasLyrics: Boolean(lyrics && lyrics.length > 10),
        hasTabs: chords.includes('E|') || chords.includes('[Tab'),
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: url,
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        chords,
        lyrics: lyrics || chords,
        officialNotice: 'Letra e cifra autênticas obtidas diretamente do site oficial Cifra Club.',
      };
    } catch (e) {
      console.error('Error in fetchCifraClubSong:', e);
      return null;
    }
  }

  /**
   * Fetch authentic lyrics directly from Vagalume
   */
  static async fetchVagalumeSong(url: string): Promise<DetailedSongItem | null> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      };
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const html = await res.text();

      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      let title = '';
      let artist = '';
      if (titleTag) {
        const raw = titleTag[1].replace(/ - VAGALUME$/i, '').trim();
        const parts = raw.split(' - ');
        if (parts.length >= 2) {
          title = parts[0].trim();
          artist = parts.slice(1).join(' - ').trim();
        } else {
          title = raw;
        }
      }

      const lyricMatch = html.match(/<div id=lyrics[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<div id=\"lyrics\"[^>]*>([\s\S]*?)<\/div>/i);
      if (!lyricMatch) return null;

      const lyrics = lyricMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

      const urlMatch = url.match(/vagalume\.com\.br\/([^\/]+)\/([^\/\.]+)/);
      const id = urlMatch ? `vagalume__${urlMatch[1]}__${urlMatch[2]}` : `vagalume__${MusicSearchProvider.toSlug(artist)}__${MusicSearchProvider.toSlug(title)}`;

      return {
        id,
        title: title || 'Música Sem Título',
        artist: artist || 'Artista',
        genre: 'Letras Vagalume',
        key: 'C',
        capo: 0,
        bpm: 100,
        hasChords: false,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'vagalume',
        sourceUrl: url,
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        lyrics,
        chords: lyrics,
        officialNotice: 'Letra autêntica do artista obtida diretamente do site oficial Vagalume.',
      };
    } catch (e) {
      console.error('Error in fetchVagalumeSong:', e);
      return null;
    }
  }

  /**
   * Search Cifra Club and Vagalume directly for real artist songs matching the query
   */
  private static async searchOnlineSources(query: string): Promise<DetailedSongItem[]> {
    const trimmed = query.trim();
    const results: DetailedSongItem[] = [];

    // 1. Direct URL paste check (e.g. user pasted a cifraclub or vagalume link)
    if (trimmed.includes('cifraclub.com.br/')) {
      const parsed = await MusicSearchProvider.fetchCifraClubSong(trimmed);
      if (parsed) results.push(parsed);
      return results;
    }
    if (trimmed.includes('vagalume.com.br/')) {
      const parsed = await MusicSearchProvider.fetchVagalumeSong(trimmed);
      if (parsed) results.push(parsed);
      return results;
    }

    const isBrowser = typeof window !== 'undefined';
    const headers: Record<string, string> = isBrowser
      ? {}
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        };

    const normalizeStr = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    // 2. Query Studio Sol (Cifra Club) live Solr Search index (Open CORS, high accuracy, real-time index)
    try {
      const solrUrl = `https://solr.sscdn.co/cifraclub/select?q=${encodeURIComponent(trimmed)}&wt=json`;
      const sRes = await fetch(solrUrl, { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        const docs = sData?.response?.docs || [];
        for (const doc of docs) {
          if (doc.dns && doc.url) {
            const songUrl = `https://www.cifraclub.com.br/${doc.dns}/${doc.url}/`;
            const docId = `cifra__${doc.dns}__${doc.url}`;
            const title = doc.txt || MusicSearchProvider.formatSlugToName(doc.url);
            const artist = doc.art || MusicSearchProvider.formatSlugToName(doc.dns);

            if (!results.some((r) => normalizeStr(r.title) === normalizeStr(title) && normalizeStr(r.artist) === normalizeStr(artist))) {
              results.push({
                id: docId,
                title,
                artist,
                genre: 'Cifra Club',
                hasChords: true,
                hasLyrics: true,
                hasTabs: true,
                hasSheetMusic: false,
                sourceProvider: 'cifraclub',
                sourceUrl: songUrl,
                licenseType: 'licensed',
                downloadAllowed: true,
                printAllowed: true,
                officialNotice: 'Cifra e letra autênticas sincronizadas diretamente do Cifra Club.',
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Solr live query notice:', err);
    }

    // 3. If multi-word search (e.g. lyrics fragment like "segundo sol chegar" or "virou notificacao preferida"), query sub-phrases
    const words = trimmed.split(/\s+/);
    if (results.length < 4 && words.length >= 3) {
      const candidatePhrases = [
        words.slice(0, 2).join(' '),
        words.slice(-2).join(' '),
        words.slice(1, 3).join(' '),
      ];
      for (const phrase of candidatePhrases) {
        if (phrase.length >= 3) {
          try {
            const solrUrl = `https://solr.sscdn.co/cifraclub/select?q=${encodeURIComponent(phrase)}&wt=json`;
            const sRes = await fetch(solrUrl, { headers });
            if (sRes.ok) {
              const sData = await sRes.json();
              const docs = sData?.response?.docs || [];
              for (const doc of docs.slice(0, 4)) {
                if (doc.dns && doc.url) {
                  const songUrl = `https://www.cifraclub.com.br/${doc.dns}/${doc.url}/`;
                  const docId = `cifra__${doc.dns}__${doc.url}`;
                  const title = doc.txt || MusicSearchProvider.formatSlugToName(doc.url);
                  const artist = doc.art || MusicSearchProvider.formatSlugToName(doc.dns);
                  if (!results.some((r) => normalizeStr(r.title) === normalizeStr(title) && normalizeStr(r.artist) === normalizeStr(artist))) {
                    results.push({
                      id: docId,
                      title,
                      artist,
                      genre: 'Cifra Club',
                      hasChords: true,
                      hasLyrics: true,
                      hasTabs: true,
                      hasSheetMusic: false,
                      sourceProvider: 'cifraclub',
                      sourceUrl: songUrl,
                      licenseType: 'licensed',
                      downloadAllowed: true,
                      printAllowed: true,
                      officialNotice: 'Cifra e letra autênticas sincronizadas diretamente do Cifra Club.',
                    });
                  }
                }
              }
            }
          } catch {}
          if (results.length >= 6) break;
        }
      }
    }
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      const partA = parts[0].trim();
      const partB = parts[1].trim();
      const pairs = [
        [MusicSearchProvider.toSlug(partA), MusicSearchProvider.toSlug(partB)],
        [MusicSearchProvider.toSlug(partB), MusicSearchProvider.toSlug(partA)],
      ];
      for (const [aSlug, sSlug] of pairs) {
        if (!aSlug || !sSlug) continue;
        const ccSong = await MusicSearchProvider.fetchCifraClubSong(`https://www.cifraclub.com.br/${aSlug}/${sSlug}/`);
        if (ccSong) {
          results.push(ccSong);
          break;
        }
        const vgSong = await MusicSearchProvider.fetchVagalumeSong(`https://www.vagalume.com.br/${aSlug}/${sSlug}.html`);
        if (vgSong) {
          results.push(vgSong);
          break;
        }
      }
    } else if (words.length >= 2) {
      // Test all possible partition boundaries: e.g. "charlie brown jr" + "ceu azul"
      for (let i = 1; i < words.length; i++) {
        const partA = words.slice(0, i).join(' ');
        const partB = words.slice(i).join(' ');
        const aSlug = MusicSearchProvider.toSlug(partA);
        const bSlug = MusicSearchProvider.toSlug(partB);
        if (!aSlug || !bSlug) continue;

        // Try (Artist, Song)
        const ccSong = await MusicSearchProvider.fetchCifraClubSong(`https://www.cifraclub.com.br/${aSlug}/${bSlug}/`);
        if (ccSong) {
          results.push(ccSong);
          break;
        }
        // Try (Song, Artist)
        const ccSongRev = await MusicSearchProvider.fetchCifraClubSong(`https://www.cifraclub.com.br/${bSlug}/${aSlug}/`);
        if (ccSongRev) {
          results.push(ccSongRev);
          break;
        }
        // Try Vagalume
        const vgSong = await MusicSearchProvider.fetchVagalumeSong(`https://www.vagalume.com.br/${aSlug}/${bSlug}.html`);
        if (vgSong) {
          results.push(vgSong);
          break;
        }
      }
    }

    // 3. Query could be an artist name (e.g. "Charlie Brown Jr", "Djavan", "Legião Urbana", "Raul Seixas")
    const artistSlug = MusicSearchProvider.toSlug(trimmed);
    if (artistSlug.length >= 3 && results.length < 5) {
      try {
        const artistUrl = `https://www.cifraclub.com.br/${artistSlug}/musicas.html`;
        const res = await fetch(artistUrl, { headers });
        if (res.ok) {
          const html = await res.text();
          const regex = new RegExp(`href=\"\\/${artistSlug}\\/([a-z0-9\\-]+)\\/\"`, 'g');
          const matches = html.match(regex) || [];
          const uniqueSongSlugs = Array.from(new Set(matches.map((m) => m.split('/')[2]))).slice(0, 8);

          for (const sSlug of uniqueSongSlugs) {
            const songUrl = `https://www.cifraclub.com.br/${artistSlug}/${sSlug}/`;
            const songTitle = MusicSearchProvider.formatSlugToName(sSlug);
            const artistName = MusicSearchProvider.formatSlugToName(artistSlug);
            results.push({
              id: `cifra__${artistSlug}__${sSlug}`,
              title: songTitle,
              artist: artistName,
              genre: 'Cifra Club',
              hasChords: true,
              hasLyrics: true,
              hasTabs: true,
              hasSheetMusic: false,
              sourceProvider: 'cifraclub',
              sourceUrl: songUrl,
              licenseType: 'licensed',
              downloadAllowed: true,
              printAllowed: true,
              officialNotice: 'Letra e cifra autênticas obtidas diretamente do site oficial Cifra Club.',
            });
          }
        }
      } catch (err) {
        // Continue
      }
    }

    // 4. Also check known Brazilian artist hits mapping for popular single-name song queries
    const popularSongsMap: Array<{ song: string; artist: string; ccUrl: string; vgUrl?: string }> = [
      { song: 'Ainda Gosto Dela', artist: 'Skank', ccUrl: 'https://www.cifraclub.com.br/skank/ainda-gosto-dela/', vgUrl: 'https://www.vagalume.com.br/skank/ainda-gosto-dela.html' },
      { song: 'Oceano', artist: 'Djavan', ccUrl: 'https://www.cifraclub.com.br/djavan/oceano/', vgUrl: 'https://www.vagalume.com.br/djavan/oceano.html' },
      { song: 'Metamorfose Ambulante', artist: 'Raul Seixas', ccUrl: 'https://www.cifraclub.com.br/raul-seixas/metamorfose-ambulante/', vgUrl: 'https://www.vagalume.com.br/raul-seixas/metamorfose-ambulante.html' },
      { song: 'Céu Azul', artist: 'Charlie Brown Jr', ccUrl: 'https://www.cifraclub.com.br/charlie-brown-jr/ceu-azul/', vgUrl: 'https://www.vagalume.com.br/charlie-brown-jr/ceu-azul.html' },
      { song: 'Só Os Loucos Sabem', artist: 'Charlie Brown Jr', ccUrl: 'https://www.cifraclub.com.br/charlie-brown-jr/so-os-loucos-sabem/', vgUrl: 'https://www.vagalume.com.br/charlie-brown-jr/so-os-loucos-sabem.html' },
      { song: 'Tempo Perdido', artist: 'Legião Urbana', ccUrl: 'https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/', vgUrl: 'https://www.vagalume.com.br/legiao-urbana/tempo-perdido.html' },
      { song: 'Evidências', artist: 'Chitãozinho & Xororó', ccUrl: 'https://www.cifraclub.com.br/chitaozinho-e-xororo/evidencias/', vgUrl: 'https://www.vagalume.com.br/chitaozinho-e-xororo/evidencias.html' },
      { song: 'Como Nossos Pais', artist: 'Elis Regina', ccUrl: 'https://www.cifraclub.com.br/elis-regina/como-nossos-pais/', vgUrl: 'https://www.vagalume.com.br/elis-regina/como-nossos-pais.html' },
      { song: 'Anunciação', artist: 'Alceu Valença', ccUrl: 'https://www.cifraclub.com.br/alceu-valenca/anunciacao/', vgUrl: 'https://www.vagalume.com.br/alceu-valenca/anunciacao.html' },
      { song: 'Boate Azul', artist: 'Bruno & Marrone', ccUrl: 'https://www.cifraclub.com.br/bruno-e-marrone/boate-azul/', vgUrl: 'https://www.vagalume.com.br/bruno-e-marrone/boate-azul.html' },
      { song: 'Lugar Secreto', artist: 'Gabriela Rocha', ccUrl: 'https://www.cifraclub.com.br/gabriela-rocha/lugar-secreto/', vgUrl: 'https://www.vagalume.com.br/gabriela-rocha/lugar-secreto.html' },
      { song: 'Sozinho', artist: 'Caetano Veloso', ccUrl: 'https://www.cifraclub.com.br/caetano-veloso/sozinho/', vgUrl: 'https://www.vagalume.com.br/caetano-veloso/sozinho.html' },
      { song: 'Garota de Ipanema', artist: 'Tom Jobim', ccUrl: 'https://www.cifraclub.com.br/tom-jobim/garota-de-ipanema/', vgUrl: 'https://www.vagalume.com.br/tom-jobim/garota-de-ipanema.html' },
      { song: 'Chalana', artist: 'Almir Sater', ccUrl: 'https://www.cifraclub.com.br/almir-sater/chalana/', vgUrl: 'https://www.vagalume.com.br/almir-sater/chalana.html' },
      { song: 'Pais e Filhos', artist: 'Legião Urbana', ccUrl: 'https://www.cifraclub.com.br/legiao-urbana/pais-filhos/', vgUrl: 'https://www.vagalume.com.br/legiao-urbana/pais-filhos.html' },
      { song: 'Wonderwall', artist: 'Oasis', ccUrl: 'https://www.cifraclub.com.br/oasis/wonderwall/', vgUrl: 'https://www.vagalume.com.br/oasis/wonderwall.html' },
      { song: 'Perfect', artist: 'Ed Sheeran', ccUrl: 'https://www.cifraclub.com.br/ed-sheeran/perfect/', vgUrl: 'https://www.vagalume.com.br/ed-sheeran/perfect.html' },
      { song: 'Mulher de Fases', artist: 'Raimundos', ccUrl: 'https://www.cifraclub.com.br/raimundos/mulher-de-fases/', vgUrl: 'https://www.vagalume.com.br/raimundos/mulher-de-fases.html' },
      { song: 'Anna Júlia', artist: 'Los Hermanos', ccUrl: 'https://www.cifraclub.com.br/los-hermanos/anna-julia/', vgUrl: 'https://www.vagalume.com.br/los-hermanos/anna-julia.html' },
      { song: 'Vou Deixar', artist: 'Skank', ccUrl: 'https://www.cifraclub.com.br/skank/vou-deixar/', vgUrl: 'https://www.vagalume.com.br/skank/vou-deixar.html' },
      { song: 'Sutilmente', artist: 'Skank', ccUrl: 'https://www.cifraclub.com.br/skank/sutilmente/', vgUrl: 'https://www.vagalume.com.br/skank/sutilmente.html' },
      { song: 'Primeiros Erros', artist: 'Capital Inicial', ccUrl: 'https://www.cifraclub.com.br/capital-inicial/primeiros-erros/', vgUrl: 'https://www.vagalume.com.br/capital-inicial/primeiros-erros.html' },
      { song: 'Exagerado', artist: 'Cazuza', ccUrl: 'https://www.cifraclub.com.br/cazuza/exagerado/', vgUrl: 'https://www.vagalume.com.br/cazuza/exagerado.html' },
      { song: 'Malandragem', artist: 'Cássia Eller', ccUrl: 'https://www.cifraclub.com.br/cassia-eller/malandragem/', vgUrl: 'https://www.vagalume.com.br/cassia-eller/malandragem.html' },
      { song: 'Palpite', artist: 'Vanessa Rangel', ccUrl: 'https://www.cifraclub.com.br/vanessa-rangel/palpite/', vgUrl: 'https://www.vagalume.com.br/vanessa-rangel/palpite.html' },
      { song: 'Santo Pra Sempre', artist: 'Gabriel Guedes', ccUrl: 'https://www.cifraclub.com.br/gabriel-guedes/santo-pra-sempre/', vgUrl: 'https://www.vagalume.com.br/gabriel-guedes/santo-pra-sempre.html' },
      { song: 'Bondade de Deus', artist: 'Isaías Saad', ccUrl: 'https://www.cifraclub.com.br/isaias-saad/bondade-de-deus/', vgUrl: 'https://www.vagalume.com.br/isaias-saad/bondade-de-deus.html' },
      { song: 'Porque Ele Vive', artist: 'Harpa Cristã', ccUrl: 'https://www.cifraclub.com.br/harpa-crista/porque-ele-vive/', vgUrl: 'https://www.vagalume.com.br/harpa-crista/porque-ele-vive.html' },
      { song: 'Dormi na Praça', artist: 'Bruno & Marrone', ccUrl: 'https://www.cifraclub.com.br/bruno-e-marrone/dormi-na-praca/', vgUrl: 'https://www.vagalume.com.br/bruno-e-marrone/dormi-na-praca.html' },
      { song: 'Telefone Mudo', artist: 'Trio Parada Dura', ccUrl: 'https://www.cifraclub.com.br/trio-parada-dura/telefone-mudo/', vgUrl: 'https://www.vagalume.com.br/trio-parada-dura/telefone-mudo.html' },
    ];

    const qNorm = normalizeStr(trimmed);
    for (const p of popularSongsMap) {
      const songNorm = normalizeStr(p.song);
      const artistNorm = normalizeStr(p.artist);
      if (songNorm.includes(qNorm) || artistNorm.includes(qNorm) || qNorm.includes(songNorm)) {
        if (!results.some((r) => normalizeStr(r.title) === songNorm && normalizeStr(r.artist) === artistNorm)) {
          // Fetch authentic song from Cifra Club
          const fetched = await MusicSearchProvider.fetchCifraClubSong(p.ccUrl);
          if (fetched) {
            results.push(fetched);
          }
        }
      }
    }

    return results;
  }

  static getCatalogSeed(): DetailedSongItem[] {
    return CATALOG_SEED as any[];
  }
}
