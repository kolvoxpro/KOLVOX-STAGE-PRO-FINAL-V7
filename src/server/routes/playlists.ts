import { Router, type Response } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { MusicSearchProvider } from '../providers/MusicSearchProvider.ts';

const router = Router();

async function resolveDbUserId(authUser: { id: number; email?: string; nomeCompleto?: string; nomeArtistico?: string; tipoUsuario?: string }): Promise<number> {
  try {
    const isSafeInt = typeof authUser?.id === 'number' && authUser.id > 0 && authUser.id < 2147483647;

    if (isSafeInt) {
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, authUser.id))
        .limit(1);

      if (existing.length > 0) {
        return existing[0].id;
      }
    }

    if (authUser?.email) {
      const cleanEmail = authUser.email.trim().toLowerCase();
      const byEmail = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, cleanEmail))
        .limit(1);

      if (byEmail.length > 0) {
        return byEmail[0].id;
      }
    }

    // Insert user record if missing to satisfy foreign key
    const [newUser] = await db
      .insert(schema.users)
      .values({
        nomeCompleto: authUser?.nomeCompleto || 'Músico Kolvox',
        nomeArtistico: authUser?.nomeArtistico || 'Banda Palco',
        email: authUser?.email ? authUser.email.trim().toLowerCase() : `musico_${Math.floor(Math.random() * 1000000)}@kolvox.com`,
        senhaHash: 'seeded_authenticated_user',
        tipoUsuario: (authUser?.tipoUsuario as any) || 'USER',
        status: 'ativo',
        emailVerificado: true,
      })
      .returning({ id: schema.users.id });

    return newUser.id;
  } catch (err) {
    console.warn('[Playlists] resolveDbUserId notice:', err);
    if (authUser?.id && authUser.id > 1) return authUser.id;
    if (authUser?.email) {
      let hash = 0;
      const clean = authUser.email.toLowerCase().trim();
      for (let i = 0; i < clean.length; i++) {
        hash = ((hash << 5) - hash) + clean.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) || 102;
    }
    return 1;
  }
}

async function resolveSongDbId(rawSongId: string | number, userId: number): Promise<number | null> {
  if (!rawSongId) return null;
  const isNum = !isNaN(Number(rawSongId));

  if (isNum) {
    const parsedNum = Number(rawSongId);
    if (parsedNum > 0 && parsedNum < 2147483647) {
      const [existingSong] = await db
        .select({ id: schema.songs.id })
        .from(schema.songs)
        .where(eq(schema.songs.id, parsedNum))
        .limit(1);

      if (existingSong) {
        return existingSong.id;
      }
    }
  }

  // Check catalog or external provider
  try {
    const catalogSong = await MusicSearchProvider.getSong(rawSongId);
    if (catalogSong) {
      // Check if song exists by title + artist
      const [existingInDb] = await db
        .select({ id: schema.songs.id })
        .from(schema.songs)
        .where(
          and(
            eq(schema.songs.title, catalogSong.title),
            eq(schema.songs.artist, catalogSong.artist)
          )
        )
        .limit(1);

      if (existingInDb) {
        return existingInDb.id;
      }

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
          sourceProvider: catalogSong.sourceProvider || 'catalog',
          sourceUrl: catalogSong.sourceUrl || '',
          licenseType: catalogSong.licenseType || 'licensed',
          downloadAllowed: catalogSong.downloadAllowed ?? true,
          printAllowed: catalogSong.printAllowed ?? true,
        })
        .returning({ id: schema.songs.id });

      return saved.id;
    }
  } catch (providerErr) {
    console.warn('[Playlists] resolveSongDbId provider notice:', providerErr);
  }

  if (isNum) {
    const parsedNum = Number(rawSongId);
    if (parsedNum > 0 && parsedNum < 2147483647) {
      try {
        const [saved] = await db
          .insert(schema.songs)
          .values({
            userId,
            title: `Música #${rawSongId}`,
            artist: 'Artista Kolvox',
            genre: 'Geral',
            key: 'C',
            lyrics: '',
            chords: '',
            sourceProvider: 'user_created',
            licenseType: 'user_owned',
          })
          .returning({ id: schema.songs.id });
        return saved.id;
      } catch {}
    }
  }

  return null;
}

// GET /api/playlists - List playlists for current user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveDbUserId(req.user!);
    const userPlaylists = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.userId, userId))
      .orderBy(schema.playlists.createdAt);

    // Get song counts
    const enriched = await Promise.all(
      userPlaylists.map(async (p) => {
        const songsInPlaylist = await db
          .select({
            id: schema.playlistSongs.id,
            songId: schema.playlistSongs.songId,
          })
          .from(schema.playlistSongs)
          .where(eq(schema.playlistSongs.playlistId, p.id));

        return {
          ...p,
          songCount: songsInPlaylist.length,
        };
      })
    );

    return res.json(enriched);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return res.status(500).json({ error: 'Erro ao carregar repertórios.' });
  }
});

// GET /api/playlists/:id - Get single playlist with ordered songs
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const userId = await resolveDbUserId(req.user!);

    const [playlist] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, playlistId))
      .limit(1);

    if (!playlist) {
      return res.status(404).json({ error: 'Repertório não encontrado.' });
    }

    if (playlist.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Você não tem permissão para visualizar este repertório.' });
    }

    // Fetch ordered songs
    const playlistSongsRows = await db
      .select({
        playlistSongId: schema.playlistSongs.id,
        position: schema.playlistSongs.position,
        song: schema.songs,
      })
      .from(schema.playlistSongs)
      .innerJoin(schema.songs, eq(schema.playlistSongs.songId, schema.songs.id))
      .where(eq(schema.playlistSongs.playlistId, playlistId))
      .orderBy(asc(schema.playlistSongs.position));

    const songs = playlistSongsRows.map((row) => ({
      ...row.song,
      playlistPosition: row.position,
      playlistSongId: row.playlistSongId,
    }));

    return res.json({
      ...playlist,
      songs,
    });
  } catch (error) {
    console.error('Error fetching playlist detail:', error);
    return res.status(500).json({ error: 'Erro ao carregar detalhes do repertório.' });
  }
});

// POST /api/playlists - Create new playlist
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = await resolveDbUserId(req.user!);
    const { name, description, initialSongIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do repertório é obrigatório.' });
    }

    const [newPlaylist] = await db
      .insert(schema.playlists)
      .values({
        userId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .returning();

    let attachedCount = 0;
    // If songs were attached during creation
    if (Array.isArray(initialSongIds) && initialSongIds.length > 0) {
      for (let i = 0; i < initialSongIds.length; i++) {
        try {
          const songDbId = await resolveSongDbId(initialSongIds[i], userId);
          if (songDbId) {
            await db.insert(schema.playlistSongs).values({
              playlistId: newPlaylist.id,
              songId: songDbId,
              position: i + 1,
            });
            attachedCount++;
          }
        } catch (songInsertErr) {
          console.warn('[Playlists] Song attach notice:', songInsertErr);
        }
      }
    }

    try {
      await db.insert(schema.activityLogs).values({
        userId,
        action: 'REPERTORIO_CRIADO',
        ip: req.ip || '127.0.0.1',
        metadata: JSON.stringify({ playlistId: newPlaylist.id, name: newPlaylist.name }),
      });
    } catch (logErr) {
      console.warn('[Playlists] Activity log notice:', logErr);
    }

    return res.status(201).json({
      message: 'Repertório criado com sucesso!',
      playlist: {
        ...newPlaylist,
        songCount: attachedCount,
        songs: [],
      },
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return res.status(500).json({ error: 'Erro ao criar repertório.' });
  }
});

// PUT /api/playlists/:id - Update name / description
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const userId = await resolveDbUserId(req.user!);
    const { name, description } = req.body;

    const [existing] = await db.select().from(schema.playlists).where(eq(schema.playlists.id, playlistId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Repertório não encontrado.' });
    }

    if (existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    const [updated] = await db
      .update(schema.playlists)
      .set({
        name: name ? name.trim() : existing.name,
        description: description !== undefined ? description?.trim() : existing.description,
        updatedAt: new Date(),
      })
      .where(eq(schema.playlists.id, playlistId))
      .returning();

    return res.json({ message: 'Repertório atualizado!', playlist: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar repertório.' });
  }
});

// DELETE /api/playlists/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const userId = await resolveDbUserId(req.user!);

    const [existing] = await db.select().from(schema.playlists).where(eq(schema.playlists.id, playlistId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Repertório não encontrado.' });
    }

    if (existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    await db.delete(schema.playlists).where(eq(schema.playlists.id, playlistId));
    return res.json({ message: 'Repertório excluído com sucesso.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao excluir repertório.' });
  }
});

// POST /api/playlists/:id/songs - Add song to playlist
router.post('/:id/songs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const userId = await resolveDbUserId(req.user!);
    const { songId: rawSongId } = req.body;

    if (!rawSongId) {
      return res.status(400).json({ error: 'Informe a música a ser adicionada.' });
    }

    const targetSongId = await resolveSongDbId(rawSongId, userId);

    if (!targetSongId) {
      return res.status(404).json({ error: 'Música não encontrada no catálogo.' });
    }

    // Get current max position
    const currentSongs = await db
      .select()
      .from(schema.playlistSongs)
      .where(eq(schema.playlistSongs.playlistId, playlistId));

    const nextPos = currentSongs.length + 1;

    // Check if song already exists in playlist
    const alreadyIn = currentSongs.find((item) => item.songId === targetSongId);
    if (alreadyIn) {
      return res.status(400).json({ error: 'Esta música já faz parte deste repertório.' });
    }

    await db.insert(schema.playlistSongs).values({
      playlistId,
      songId: targetSongId,
      position: nextPos,
    });

    return res.json({ message: 'Música adicionada ao repertório!', songId: targetSongId });
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    return res.status(500).json({ error: 'Erro ao adicionar música ao repertório.' });
  }
});

// DELETE /api/playlists/:id/songs/:songId - Remove song from playlist
router.delete('/:id/songs/:songId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const songId = Number(req.params.songId);

    await db
      .delete(schema.playlistSongs)
      .where(and(eq(schema.playlistSongs.playlistId, playlistId), eq(schema.playlistSongs.songId, songId)));

    return res.json({ message: 'Música removida do repertório.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao remover música do repertório.' });
  }
});

// PUT /api/playlists/:id/reorder - Reorder songs in playlist
router.put('/:id/reorder', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlistId = Number(req.params.id);
    const { orderedSongIds } = req.body; // array of song IDs in order

    if (!Array.isArray(orderedSongIds)) {
      return res.status(400).json({ error: 'Formato de ordenação inválido.' });
    }

    for (let i = 0; i < orderedSongIds.length; i++) {
      await db
        .update(schema.playlistSongs)
        .set({ position: i + 1 })
        .where(
          and(
            eq(schema.playlistSongs.playlistId, playlistId),
            eq(schema.playlistSongs.songId, Number(orderedSongIds[i]))
          )
        );
    }

    return res.json({ message: 'Ordem do repertório atualizada com sucesso!' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao reorganizar repertório.' });
  }
});

export default router;
