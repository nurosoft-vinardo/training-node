import express, { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { books } from '../db/schema';
import { eq, ilike, sql } from 'drizzle-orm';
import { isAuthenticated } from './auth.router';
import { AuthenticatedRequest } from '../server';

const router = express.Router();

const BookSchema = z.object({
    title: z.string().min(1),
    author: z.string().min(1),
    isbn: z.string().optional(),
    publishedDate: z.string().datetime({ message: "Invalid datetime string! Must be UTC." }).optional().nullable(),
});

const UpdateBookSchema = BookSchema.partial();

router.post('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const bookData = BookSchema.parse(req.body);
        const newBook = await db.insert(books).values({
            ...bookData,
            publishedDate: bookData.publishedDate ? new Date(bookData.publishedDate) : null,
        }).returning();
        res.status(201).json(newBook[0]);
    } catch (error: any) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error2', errors: error.flatten() });
            return;
        }
        if (error.code === '23505' && error.constraint_name === 'books_isbn_key') {
            res.status(409).json({ message: 'Book with this ISBN already exists.' });
            return;
        }
        next(error);
    }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        if (isNaN(bookId)) {
            res.status(400).json({ message: 'Invalid book ID format' });
            return;
        }
        const book = await db.query.books.findFirst({
            where: eq(books.id, bookId),
        });
        if (!book) {
            res.status(404).json({ message: 'Book not found' });
            return;
        }
        res.json(book);
    } catch (error) {
        next(error);
    }
});

router.put('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        if (isNaN(bookId)) {
            res.status(400).json({ message: 'Invalid book ID format' });
            return;
        }
        const bookData = UpdateBookSchema.parse(req.body);
        const updatedBook = await db.update(books)
            .set({
                ...bookData,
                ...(bookData.publishedDate && { publishedDate: new Date(bookData.publishedDate) }),
                ...(bookData.publishedDate === null && { publishedDate: null }),
                updatedAt: new Date(),
            } as unknown as typeof books)
            .where(eq(books.id, bookId))
            .returning();
        if (updatedBook.length === 0) {
            res.status(404).json({ message: 'Book not found' });
            return;
        }
        res.json(updatedBook[0]);
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error3', errors: error.flatten() });
            return;
        }
        next(error);
    }
});

router.delete('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        if (isNaN(bookId)) {
            res.status(400).json({ message: 'Invalid book ID format' });
            return;
        }
        const deletedBook = await db.delete(books)
            .where(eq(books.id, bookId))
            .returning({ id: books.id });
        if (deletedBook.length === 0) {
            res.status(404).json({ message: 'Book not found' });
            return;
        }
        res.json({ success: true, message: 'Book deleted', id: deletedBook[0].id });
    } catch (error) {
        next(error);
    }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { limit = '10', offset = '0', query } = req.query;
        const numLimit = parseInt(limit as string, 10);
        const numOffset = parseInt(offset as string, 10);

        const conditions = [];
        if (query && typeof query === 'string') {
            conditions.push(ilike(books.title, `%${query}%`));
        }

        const results = await db.query.books.findMany({
            limit: numLimit,
            offset: numOffset,
            where: conditions.length > 0 ? sql.join(conditions, sql` or `) : undefined,
            orderBy: (books, { desc }) => [desc(books.createdAt)],
        });
        res.json(results);

    } catch (error) {
        next(error);
    }
});

export default router;
