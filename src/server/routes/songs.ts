import { Router, type Response } from 'express';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.ts';
import { MusicSearchProvider } from '../providers/MusicSearchProvider.ts';
import { findVerifiedFullLyrics } from '../../data/fullLyricsCatalog.ts';

const router = Router();

// GET /api/songs - Get user's songs (strictly songs added by the current user)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { q, genre, key } = req.query;

    // Strictly show only songs that the authenticated user added
    let conditions: any[] = [eq(schema.songs.userId, userId)];

    if (q && typeof q === 'string') {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(schema.songs.title, term),
          ilike(schema.songs.artist, term),
          ilike(schema.songs.genre, term),
          ilike(schema.songs.key, term),
          ilike(schema.songs.lyrics, term)
        )
      );
    }

    if (genre && typeof genre === 'string') {
      conditions.push(eq(schema.songs.genre, genre));
    }

    if (key && typeof key === 'string') {
      conditions.push(eq(schema.songs.key, key));
    }

    const songsList = await db
      .select()
      .from(schema.songs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.songs.createdAt));

    // Also get favorites for this user
    const userFavorites = await db
      .select({ songId: schema.favorites.songId })
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, userId));

    const favSet = new Set(userFavorites.map((f) => f.songId));

    const enriched = songsList.map((s) => ({
      ...s,
      isFavorite: favSet.has(s.id),
      hasChords: Boolean(s.chords && s.chords.length > 5),
      hasLyrics: Boolean(s.lyrics && s.lyrics.length > 5),
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error fetching songs:', error);
    return res.status(500).json({ error: 'Erro ao listar músicas do acervo.' });
  }
});

// GET /api/songs/search - Unified search across DB + external providers
router.get('/search', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const genre = typeof req.query.genre === 'string' ? req.query.genre.trim() : undefined;
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : undefined;

    // 1. Log search in search_history if user is logged in
    if (userId && query.length > 0) {
      try {
        await db.insert(schema.searchHistory).values({
          userId,
          searchTerm: query,
          provider: 'kolvox_unified',
        });
      } catch (err) {
        // Non-blocking log error
      }
    }

    // 2. Fetch local matching songs
    let dbSongs: any[] = [];
    try {
      if (query) {
        const term = `%${query}%`;
        const queryConds: any[] = [
          or(
            ilike(schema.songs.title, term),
            ilike(schema.songs.artist, term),
            ilike(schema.songs.genre, term),
            ilike(schema.songs.key, term),
            ilike(schema.songs.lyrics, term)
          ),
        ];
        if (genre) queryConds.push(ilike(schema.songs.genre, `%${genre}%`));
        dbSongs = await db
          .select()
          .from(schema.songs)
          .where(and(...queryConds))
          .limit(30);
      } else {
        // When query is empty (as soon as the page opens on the server), list top available songs
        const conditions: any[] = [];
        if (genre) conditions.push(ilike(schema.songs.genre, `%${genre}%`));
        dbSongs = await db
          .select()
          .from(schema.songs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(schema.songs.createdAt))
          .limit(30);
      }
    } catch (dbErr) {
      console.warn('Database query unavailable or offline, proceeding with MusicSearchProvider:', dbErr);
    }

    // 3. Search via MusicSearchProvider (external / catalog)
    const providerResults = await MusicSearchProvider.search(query, { genre, key });

    // Combine and deduplicate with user favorites if available
    let favSet = new Set<number>();
    if (userId) {
      try {
        const favorites = await db
          .select({ songId: schema.favorites.songId })
          .from(schema.favorites)
          .where(eq(schema.favorites.userId, userId));
        favSet = new Set(favorites.map((f) => f.songId));
      } catch {
        // Ignore fav lookup error
      }
    }

    const results = [
      ...dbSongs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        genre: s.genre,
        key: s.key,
        capo: s.capo,
        bpm: s.bpm,
        lyrics: s.lyrics,
        chords: s.chords,
        hasChords: Boolean(s.chords && s.chords.length > 5),
        hasLyrics: Boolean(s.lyrics && s.lyrics.length > 5),
        hasTabs: Boolean(s.tabs && s.tabs.length > 5),
        hasSheetMusic: Boolean(s.sheetMusic),
        sourceProvider: s.sourceProvider,
        sourceUrl: s.sourceUrl,
        licenseType: s.licenseType,
        downloadAllowed: s.downloadAllowed,
        printAllowed: s.printAllowed,
        isFavorite: favSet.has(s.id),
      })),
      ...providerResults
        .filter((pr) => !dbSongs.some((dbS) => dbS.title.toLowerCase() === pr.title.toLowerCase() && dbS.artist.toLowerCase() === pr.artist.toLowerCase()))
        .map((pr) => ({
          ...pr,
          isFavorite: false,
        })),
    ];

    return res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    return res.status(500).json({ error: 'Erro ao realizar busca de músicas.' });
  }
});

// GET /api/songs/favorites/list - Get all favorite songs of current user
router.get('/favorites/list', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userFavorites = await db
      .select({
        song: schema.songs,
      })
      .from(schema.favorites)
      .innerJoin(schema.songs, eq(schema.favorites.songId, schema.songs.id))
      .where(eq(schema.favorites.userId, userId))
      .orderBy(desc(schema.favorites.createdAt));

    const enriched = userFavorites.map((f) => ({
      ...f.song,
      isFavorite: true,
      hasChords: Boolean(f.song.chords && f.song.chords.length > 5),
      hasLyrics: Boolean(f.song.lyrics && f.song.lyrics.length > 5),
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error fetching favorites list:', error);
    return res.status(500).json({ error: 'Erro ao listar músicas favoritas.' });
  }
});

// GET /api/songs/:id - Get song details
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = decodeURIComponent(rawId).trim();
    const userId = req.user?.id;

    let song: any = null;

    if (!isNaN(Number(id))) {
      try {
        const [found] = await db.select().from(schema.songs).where(eq(schema.songs.id, Number(id))).limit(1);
        song = found;
      } catch (err) {
        console.warn('DB lookup error for song id:', id, err);
      }
    }

    // If not found in DB or string id (catalog seed or provider)
    if (!song) {
      song = await MusicSearchProvider.getSong(id);
    }

    // Fallback: if id is numeric and wasn't found, try catalog seed with cat- prefix
    if (!song && !isNaN(Number(id))) {
      song = await MusicSearchProvider.getSong(`cat-${id}`);
    }

    if (!song) {
      return res.status(404).json({ error: 'Música não encontrada.' });
    }

    // Ensure authentic chords and lyrics are present if DB or seed was empty
    const hasEnoughChords = Boolean(song.chords && song.chords.trim().length >= 15);
    const hasEnoughLyrics = Boolean(song.lyrics && song.lyrics.trim().length >= 15);

    if (!hasEnoughChords || !hasEnoughLyrics) {
      try {
        // 1. Check verified full catalog first
        if (song.title && (!song.lyrics || song.lyrics.trim().length < 30)) {
          const verified = findVerifiedFullLyrics(song.title, song.artist || '');
          if (verified?.lyrics && verified.lyrics.length > 30) {
            song.lyrics = verified.lyrics;
            hasEnoughLyrics = true;
          }
        }

        // 2. Check Vagalume API for authentic artist lyrics
        if (song.title && song.artist && (!song.lyrics || song.lyrics.trim().length < 30)) {
          const vgLyrics = await MusicSearchProvider.fetchVagalumeApi(song.artist, song.title);
          if (vgLyrics) {
            song.lyrics = vgLyrics;
            hasEnoughLyrics = true;
          }
        }

        // 3. Check LRCLIB for genuine lyrics
        if (song.title && song.artist && (!song.lyrics || song.lyrics.trim().length < 30)) {
          const lrcLyrics = await MusicSearchProvider.fetchLrclibLyrics(song.artist, song.title);
          if (lrcLyrics) {
            song.lyrics = lrcLyrics;
            hasEnoughLyrics = true;
          }
        }

        // 4. Source URL or Cifra Club search
        let fullSong: any = null;
        if (song.sourceUrl) {
          fullSong = song.sourceProvider === 'vagalume'
            ? await MusicSearchProvider.fetchVagalumeSong(song.sourceUrl)
            : await MusicSearchProvider.fetchCifraClubSong(song.sourceUrl);
        }

        if (!fullSong && song.title && (!hasEnoughChords || !hasEnoughLyrics)) {
          const searchKey = `${song.title} ${song.artist || ''}`.trim();
          const results = await MusicSearchProvider.search(searchKey);
          if (results.length > 0) {
            fullSong = await MusicSearchProvider.getSong(results[0].id);
          }
        }

        if (fullSong && (fullSong.chords || fullSong.lyrics)) {
          song.chords = fullSong.chords || song.chords;
          if (!song.lyrics || song.lyrics.length < 30) {
            song.lyrics = fullSong.lyrics || song.lyrics;
          }
          song.tabs = fullSong.tabs || song.tabs;
          song.key = song.key || fullSong.key || 'C';

          // Update database if this was a saved user song
          if (song.id && !isNaN(Number(song.id))) {
            await db
              .update(schema.songs)
              .set({
                chords: song.chords,
                lyrics: song.lyrics,
                tabs: song.tabs,
                key: song.key,
                updatedAt: new Date(),
              })
              .where(eq(schema.songs.id, Number(song.id)))
              .catch((e) => console.warn('Could not persist updated chords to DB:', e));
          }
        }
      } catch (hydrateErr) {
        console.warn('Notice hydrating chords/lyrics for song:', id, hydrateErr);
      }
    }

    // Check favorite status
    let isFavorite = false;
    if (userId && song.id && !isNaN(Number(song.id))) {
      try {
        const [fav] = await db
          .select()
          .from(schema.favorites)
          .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.songId, Number(song.id))))
          .limit(1);
        isFavorite = Boolean(fav);
      } catch {
        // ignore
      }
    }

    // Source info
    const sourceInfo = await MusicSearchProvider.getSource(song.id);

    return res.json({
      ...song,
      isFavorite,
      sourceInfo,
    });
  } catch (error) {
    console.error('Error getting song:', error);
    return res.status(500).json({ error: 'Erro ao buscar dados da música.' });
  }
});

// POST /api/songs - Manual song addition
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      artist,
      album,
      genre,
      key,
      capo,
      lyrics,
      chords,
      tabs,
      sheetMusic,
      bpm,
      duration,
      licenseType,
      sourceUrl,
    } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ error: 'Título e Artista são obrigatórios.' });
    }

    const [newSong] = await db.insert(schema.songs).values({
      userId,
      title: title.trim(),
      artist: artist.trim(),
      album: album?.trim() || null,
      genre: genre?.trim() || 'Geral',
      key: key?.trim() || 'C',
      capo: Number(capo) || 0,
      lyrics: lyrics?.trim() || '',
      chords: chords?.trim() || '',
      tabs: tabs?.trim() || '',
      sheetMusic: sheetMusic?.trim() || '',
      bpm: Number(bpm) || 120,
      duration: duration?.trim() || '',
      sourceProvider: 'user_created',
      sourceUrl: sourceUrl?.trim() || null,
      licenseType: licenseType || 'user_owned',
      downloadAllowed: true,
      printAllowed: true,
    }).returning();

    // Log activity
    await db.insert(schema.activityLogs).values({
      userId,
      action: 'MUSICA_CADASTRADA_MANUAL',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ songId: newSong.id, title: newSong.title, artist: newSong.artist }),
    });

    return res.status(201).json({
      message: 'Música cadastrada com sucesso no seu acervo!',
      song: newSong,
    });
  } catch (error) {
    console.error('Error creating song:', error);
    return res.status(500).json({ error: 'Erro ao salvar nova música.' });
  }
});

// PUT /api/songs/:id - Update song
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const songId = Number(req.params.id);
    const userId = req.user!.id;

    const [existing] = await db.select().from(schema.songs).where(eq(schema.songs.id, songId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Música não encontrada.' });
    }

    if (existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta música.' });
    }

    const {
      title,
      artist,
      album,
      genre,
      key,
      capo,
      lyrics,
      chords,
      tabs,
      bpm,
      duration,
    } = req.body;

    const [updated] = await db
      .update(schema.songs)
      .set({
        title: title !== undefined ? title.trim() : existing.title,
        artist: artist !== undefined ? artist.trim() : existing.artist,
        album: album !== undefined ? album?.trim() : existing.album,
        genre: genre !== undefined ? genre?.trim() : existing.genre,
        key: key !== undefined ? key?.trim() : existing.key,
        capo: capo !== undefined ? Number(capo) : existing.capo,
        lyrics: lyrics !== undefined ? lyrics?.trim() : existing.lyrics,
        chords: chords !== undefined ? chords?.trim() : existing.chords,
        tabs: tabs !== undefined ? tabs?.trim() : existing.tabs,
        bpm: bpm !== undefined ? Number(bpm) : existing.bpm,
        duration: duration !== undefined ? duration?.trim() : existing.duration,
        updatedAt: new Date(),
      })
      .where(eq(schema.songs.id, songId))
      .returning();

    return res.json({ message: 'Música atualizada com sucesso!', song: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar música.' });
  }
});

// DELETE /api/songs/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const songId = Number(req.params.id);
    const userId = req.user!.id;

    const [existing] = await db.select().from(schema.songs).where(eq(schema.songs.id, songId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Música não encontrada.' });
    }

    if (existing.userId && existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Você não tem permissão para excluir esta música.' });
    }

    // Cascade delete any relations to avoid any foreign key constraint issues
    await db.delete(schema.playlistSongs).where(eq(schema.playlistSongs.songId, songId));
    await db.delete(schema.favorites).where(eq(schema.favorites.songId, songId));
    await db.delete(schema.songSources).where(eq(schema.songSources.songId, songId));
    await db.delete(schema.songs).where(eq(schema.songs.id, songId));

    return res.json({ message: 'Música removida com sucesso.', deletedId: songId });
  } catch (error) {
    console.error('Error deleting song:', error);
    return res.status(500).json({ error: 'Erro ao excluir música.' });
  }
});

// POST /api/songs/:id/favorite - Toggle favorite
router.post('/:id/favorite', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const userId = req.user!.id;
    let songId = Number(rawId);

    if (isNaN(songId)) {
      // Find or auto-insert external/catalog song into DB
      const catalogSong = await MusicSearchProvider.getSong(rawId);
      if (!catalogSong) {
        return res.status(404).json({ error: 'Música não encontrada.' });
      }

      // Check if already in DB
      const [existingInDb] = await db
        .select()
        .from(schema.songs)
        .where(
          and(
            eq(schema.songs.title, catalogSong.title),
            eq(schema.songs.artist, catalogSong.artist)
          )
        )
        .limit(1);

      if (existingInDb) {
        songId = existingInDb.id;
      } else {
        const [saved] = await db
          .insert(schema.songs)
          .values({
            userId,
            title: catalogSong.title,
            artist: catalogSong.artist,
            album: catalogSong.album || null,
            genre: catalogSong.genre || 'Geral',
            key: catalogSong.key || 'C',
            capo: catalogSong.capo || 0,
            bpm: catalogSong.bpm || 120,
            duration: catalogSong.duration || '3:30',
            lyrics: catalogSong.lyrics || '',
            chords: catalogSong.chords || '',
            tabs: catalogSong.tabs || '',
            sourceProvider: catalogSong.sourceProvider,
            sourceUrl: catalogSong.sourceUrl || '',
            licenseType: catalogSong.licenseType,
            downloadAllowed: catalogSong.downloadAllowed,
            printAllowed: catalogSong.printAllowed,
          })
          .returning();
        songId = saved.id;
      }
    }

    const [existing] = await db
      .select()
      .from(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.songId, songId)))
      .limit(1);

    if (existing) {
      await db
        .delete(schema.favorites)
        .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.songId, songId)));
      return res.json({ isFavorite: false, songId, message: 'Removida dos favoritos.' });
    } else {
      await db.insert(schema.favorites).values({ userId, songId });
      return res.json({ isFavorite: true, songId, message: 'Adicionada aos favoritos!' });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return res.status(500).json({ error: 'Erro ao atualizar favoritos.' });
  }
});

// POST /api/songs/import - Smart import parser (Cifra Club URL, Vagalume URL, or TXT / pasted text)
router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { url, rawText, defaultTitle, defaultArtist, genre: inputGenre } = req.body;

    if (!url && (!rawText || typeof rawText !== 'string')) {
      return res.status(400).json({ error: 'Forneça um link do Cifra Club / Vagalume ou cole o texto da cifra.' });
    }

    let title = defaultTitle || '';
    let artist = defaultArtist || '';
    let key = 'C';
    let capo = 0;
    let chords = '';
    let lyrics = '';
    let sourceProvider = 'user_created';
    let sourceUrl = url || '';
    let genre = inputGenre || 'Acústico';

    // 1. If URL is provided from Cifra Club or Vagalume
    if (url && typeof url === 'string') {
      const cleanUrl = url.trim();
      const isCifraClub = cleanUrl.includes('cifraclub.com.br');
      const isVagalume = cleanUrl.includes('vagalume.com.br');

      if (!isCifraClub && !isVagalume && !rawText) {
        return res.status(400).json({ error: 'URL não reconhecida. Utilize links de https://www.cifraclub.com.br/ ou https://www.vagalume.com.br/' });
      }

      try {
        const response = await fetch(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });

        if (response.ok) {
          const html = await response.text();

          if (isCifraClub) {
            sourceProvider = 'cifraclub';
            // Extract title from <title> or <h1>
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch) {
              const fullTitle = titleMatch[1].replace(/\|\s*Cifra Club.*$/i, '').trim();
              if (fullTitle.includes('-')) {
                const parts = fullTitle.split('-');
                title = parts[0].trim();
                artist = parts.slice(1).join('-').trim();
              } else {
                title = fullTitle;
              }
            }

            // Extract key/tom from HTML
            const tomMatch = html.match(/data-anchor="--chord-tone"[^>]*>([^<]+)<\/button>/i) ||
                             html.match(/id="cifra_tom"[^>]*>([^<]+)<\/a>/i) ||
                             html.match(/Tom:\s*<[^>]+>([^<]+)<\//i);
            if (tomMatch) {
              key = tomMatch[1].trim();
            }

            // Extract capo
            const capoMatch = html.match(/capotraste:\s*(\d+)ª/i) || html.match(/capo:\s*(\d+)/i);
            if (capoMatch) {
              capo = parseInt(capoMatch[1], 10);
            }

            // Extract chords and text from <pre>
            const preMatch = html.match(/<pre[^>]*data-chord-content="true"[^>]*>([\s\S]*?)<\/pre>/i) ||
                             html.match(/<pre[^>]*class="[^"]*_crVx[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) ||
                             html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);

            if (preMatch) {
              // Strip HTML tags like <b data-chord-name="G">G</b> but keep text
              const rawChordContent = preMatch[1]
                .replace(/<div class="tabs">[\s\S]*?<\/div>/gi, '') // remove tabs block for clean chords
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');

              chords = rawChordContent.trim();
              lyrics = chords
                .split('\n')
                .filter((l) => !l.match(/^\s*([A-G][b#]?(m|maj|min|dim|aug|sus|7|9|add\d|\/)*\s*)+$/))
                .join('\n');
            }
          } else if (isVagalume) {
            sourceProvider = 'vagalume';
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch) {
              const fullTitle = titleMatch[1].replace(/-\s*Vagalume.*$/i, '').trim();
              if (fullTitle.includes('-')) {
                const parts = fullTitle.split('-');
                title = parts[0].trim();
                artist = parts.slice(1).join('-').trim();
              } else {
                title = fullTitle;
              }
            }

            // Extract lyrics from Vagalume
            const lyricsMatch = html.match(/<div[^>]*id="lyrics"[^>]*>([\s\S]*?)<\/div>/i) ||
                                html.match(/<div[^>]*class="lyrics"[^>]*>([\s\S]*?)<\/div>/i);
            if (lyricsMatch) {
              const cleanLyrics = lyricsMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<p>/gi, '')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .trim();
              lyrics = cleanLyrics;
              chords = cleanLyrics;
            }
          }
        }
      } catch (fetchErr) {
        console.warn('Could not fetch external URL, falling back to text parsing:', fetchErr);
      }
    }

    // 2. Fallback to rawText if provided or if extraction was partial
    if (rawText && typeof rawText === 'string') {
      const lines = rawText.split('\n');
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim();
        const tomMatch = line.match(/^tom:\s*([A-G][b#]?[m]?)/i);
        if (tomMatch && (!key || key === 'C')) {
          key = tomMatch[1];
        }

        const capoMatch = line.match(/^capo(traste)?:\s*(\d+)/i);
        if (capoMatch && capo === 0) {
          capo = parseInt(capoMatch[2], 10);
        }

        if (!title && line.includes('-') && !line.startsWith('[')) {
          const parts = line.split('-');
          if (parts.length === 2) {
            title = parts[0].trim();
            artist = parts[1].trim();
          }
        }
      }

      if (!chords) {
        chords = rawText;
        lyrics = lines
          .filter((l) => !l.match(/^\s*([A-G][b#]?(m|maj|min|dim|aug|sus|7|9|add\d)*\s*)+$/))
          .join('\n');
      }
    }

    // Ensure we have a valid song object
    const finalTitle = title || defaultTitle || 'Música do Cifra Club / Vagalume';
    const finalArtist = artist || defaultArtist || req.user!.nomeArtistico || 'Artista';

    const [saved] = await db.insert(schema.songs).values({
      userId,
      title: finalTitle,
      artist: finalArtist,
      key: key || 'G',
      capo: capo || 0,
      lyrics: lyrics || chords || 'Letra da música',
      chords: chords || lyrics || 'Cifra da música',
      genre,
      bpm: 120,
      duration: '3:30',
      sourceProvider,
      sourceUrl,
      licenseType: 'licensed',
      downloadAllowed: true,
      printAllowed: true,
    }).returning();

    await db.insert(schema.activityLogs).values({
      userId,
      action: 'IMPORTACAO_CONTEUDO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        songId: saved.id,
        title: saved.title,
        source: sourceProvider,
        sourceUrl,
      }),
    });

    return res.status(201).json({
      message: `Música "${saved.title}" importada e salva com sucesso no repertório!`,
      song: saved,
    });
  } catch (error) {
    console.error('Error importing:', error);
    return res.status(500).json({ error: 'Erro ao importar cifra/letra.' });
  }
});

export default router;
