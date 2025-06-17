import express, { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isAuthenticated } from './auth.router';
import { AuthenticatedRequest } from '../server';

const router = express.Router();

const hashPassword = async (password: string) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const UserBaseSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
});

const CreateUserSchema = UserBaseSchema.extend({
    password: z.string().min(6),
});

const UpdateUserSchema = UserBaseSchema.extend({
    password: z.string().min(6).optional(),
}).partial();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log(req.body);
        const userData = CreateUserSchema.parse(req.body);
        const hashedPassword = await hashPassword(userData.password);

        const newUser = await db.insert(users).values({
            username: userData.username,
            email: userData.email,
            passwordHash: hashedPassword,
        }).returning({ id: users.id, username: users.username, email: users.email, createdAt: users.createdAt });

        res.status(201).json(newUser[0]);
    } catch (error: any) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error5', errors: error.flatten() });
            return;
        }
        if (error.code === '23505') {
            res.status(409).json({ message: 'Username or email already exists.' });
            return;
        }

        next(error);
    }
});

router.get('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid user ID format' });
            return;
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { passwordHash: false }, 
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json(user);
    } catch (error) {
        next(error);
    }
});

router.get('/', isAuthenticated, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const allUsers = await db.query.users.findMany({
            columns: { passwordHash: false },
            orderBy: (users, { desc }) => [desc(users.createdAt)],
        });

        res.json(allUsers);
    } catch (error) {
        next(error);
    }
});

router.put('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid user ID format' });
            return;
        }

        if (req.user?.userId !== userId) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const dataToUpdate = UpdateUserSchema.parse(req.body);
        let hashedPassword = undefined;

        if (dataToUpdate.password) {
            hashedPassword = await hashPassword(dataToUpdate.password);
        }

        const updatedUser = await db.update(users)
            .set({
                username: dataToUpdate.username,
                email: dataToUpdate.email,
                ...(hashedPassword && { passwordHash: hashedPassword }),
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning({ id: users.id, username: users.username, email: users.email, updatedAt: users.updatedAt });

        if (updatedUser.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json(updatedUser[0]);
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error6', errors: error.flatten() });
            return;
        }

        next(error);
    }
});

router.delete('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = parseInt(req.params.id, 10);

        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid user ID format' });
            return;
        }

        if (req.user?.userId !== userId) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const deletedUser = await db.delete(users)
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        if (deletedUser.length === 0) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.status(200).json({ success: true, message: 'User deleted', id: deletedUser[0].id });
    } catch (error) {
        next(error);
    }
});

export default router;
