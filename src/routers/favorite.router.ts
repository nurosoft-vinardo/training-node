import { eq, and } from 'drizzle-orm';
import express, { Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { AuthenticatedRequest } from '../server';
import { favorites, books } from '../db/schema';
import { isAuthenticated } from './auth.router';

const router = express.Router();

const FavoriteSchema = z.object({ bookId: z.number() });

router.post('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const { bookId } = FavoriteSchema.parse(req.body);

        const bookExists = await db.query.books.findFirst({ where: eq(books.id, bookId) });
        if (!bookExists) {
            res.status(404).json({ message: 'Book not found.' });
            return;
        }

        const newFavorite = await db.insert(favorites).values({
            userId: req.user.userId,
            bookId: bookId,
        }).returning();
        res.status(201).json(newFavorite[0]);
    } catch (error: any) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error4', errors: error.flatten() });
            return;
        }
        if (error.code === '23505') {
            res.status(409).json({ message: 'Book already in favorites.' });
            return;
        }
        if (error.code === '23503') {
            res.status(404).json({ message: 'Book not found or user invalid.' });
            return;
        }
        next(error);
    }
});

router.delete('/:bookId', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const bookId = parseInt(req.params.bookId, 10);
        if (isNaN(bookId)) {
            res.status(400).json({ message: 'Invalid book ID format' });
            return;
        }

        const deletedFavorite = await db.delete(favorites)
            .where(and(eq(favorites.userId, req.user.userId), eq(favorites.bookId, bookId)))
            .returning();
        if (deletedFavorite.length === 0) {
            res.status(404).json({ message: 'Favorite not found.' });
            return;
        }
        res.json({ success: true, message: 'Favorite removed', bookId: bookId });
    } catch (error) {
        next(error);
    }
});

router.get('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const userFavorites = await db.query.favorites.findMany({
            where: eq(favorites.userId, req.user.userId),
            with: {
                book: { columns: { id: true, title: true, author: true } }
            },
            orderBy: (favs, { desc }) => [desc(favs.createdAt)],
        });
        res.json(userFavorites.map(fav => ({
            bookId: fav.bookId,
            title: fav.book?.title,
            author: fav.book?.author,
            favoritedAt: fav.createdAt
        })));
    } catch (error) {
        next(error);
    }
});

router.get('/is-favorite/:bookId', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const bookId = parseInt(req.params.bookId, 10);
        if (isNaN(bookId)) {
            res.status(400).json({ message: 'Invalid book ID format' });
            return;
        }

        const favorite = await db.query.favorites.findFirst({
            where: and(eq(favorites.userId, req.user.userId), eq(favorites.bookId, bookId)),
        });
        res.json({ isFavorite: !!favorite });
    } catch (error) {
        next(error);
    }
});

export default router;
