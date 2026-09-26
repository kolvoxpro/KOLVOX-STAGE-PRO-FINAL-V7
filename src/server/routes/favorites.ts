import { Router, type Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();

// GET /api/favorites - Get all favorite songs of the user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
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
    console.error('Error fetching favorites:', error);
    return res.status(500).json({ error: 'Erro ao listar favoritas.' });
  }
});

// POST /api/favorites - Add song to favorites
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({ error: 'songId é obrigatório.' });
    }

    const [existing] = await db
      .select()
      .from(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.songId, Number(songId))))
      .limit(1);

    if (existing) {
      return res.json({ message: 'Música já está nos favoritos.', isFavorite: true });
    }

    await db.insert(schema.favorites).values({
      userId,
      songId: Number(songId),
    });

    return res.status(201).json({ message: 'Música adicionada aos favoritos!', isFavorite: true });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return res.status(500).json({ error: 'Erro ao favoritar música.' });
  }
});

// DELETE /api/favorites/:id - Remove song from favorites
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = Number(req.params.id);

    await db
      .delete(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.songId, songId)));

    return res.json({ message: 'Música removida dos favoritos.', isFavorite: false });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return res.status(500).json({ error: 'Erro ao remover dos favoritos.' });
  }
});

export default router;
