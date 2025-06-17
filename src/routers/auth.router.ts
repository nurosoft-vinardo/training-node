import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../server';

const router = express.Router();

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const isAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user) {
        next();
        return;
    }
    res.status(401).json({ message: 'Unauthorized: No active session or token invalid.' });
    return
};

router.post('/login', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);

        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        if (!req.redis) {
            res.status(500).json({ message: 'Redis client not available' });
            return;
        }

        const sessionId = uuidv4();
        const sessionData = JSON.stringify({ userId: user.id, email: user.email });
        await req.redis.set(`session:${sessionId}`, sessionData, { EX: 3600 }); 

        const { passwordHash, ...userWithoutPassword } = user;
        res.json({ token: sessionId, user: userWithoutPassword });

    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: 'Validation error1', errors: error.flatten() });
            return;
        }
        next(error);
    }
});

router.post('/logout', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers.authorization?.split(' ')[1];
        if (sessionId && req.redis) {
            await req.redis.del(`session:${sessionId}`);
        }
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

router.get('/me', isAuthenticated, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            res.status(404).json({ message: 'User not found in session' });
            return;
        }
        const userFromDb = await db.query.users.findFirst({
            where: eq(users.id, req.user.userId),
            columns: { passwordHash: false }
        });

        if (!userFromDb) {
            res.status(404).json({ message: 'User not found in database' });
            return;
        }
        res.json(userFromDb);
    } catch (error) {
        next(error);
    }
});

export default router;
