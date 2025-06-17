import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { redisClient } from './redis';
import authRouter from './routers/auth.router';
import userRouter from './routers/user.router';
import bookRouter from './routers/book.router';
import favoriteRouter from './routers/favorite.router';

export interface AuthenticatedRequest extends Request {
    user?: { userId: number; email: string; [key: string]: any };
    redis?: typeof redisClient;
}

async function main() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis successfully!');
    } catch (err) {
        console.error('Could not connect to Redis:', err);
        process.exit(1);
    }

    const app = express();

    app.use(cors({ origin: '*' }));
    app.use(express.json());

    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        req.redis = redisClient;
        next();
    });

    app.use(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        const sessionId = req.headers.authorization?.split(' ')[1];

        if (sessionId && req.redis) {
            try {
                const sessionData = await req.redis.get(`session:${sessionId}`);
                if (sessionData) {
                    req.user = JSON.parse(sessionData); 
                }
            } catch (error) {
                console.error('Error fetching session from Redis:', error);
            }
        }

        next();
    });

    app.use('/api/auth', authRouter);
    app.use('/api/users', userRouter);
    app.use('/api/books', bookRouter);
    app.use('/api/favorites', favoriteRouter);

    app.get('/', (_req, res) => {
        res.send('Endpoints available under /api.');
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error("Global error handler:", err);
        const statusCode = err.statusCode || 500;
        const message = err.message || 'Internal Server Error';
        res.status(statusCode).json({ message, ...(err.errors && { errors: err.errors }) });
    });

    app.listen(config.port, () => {
        console.log(`Server listening on http://localhost:${config.port}`);
    });
}

main().catch(err => {
    console.error('Failed to start server:', err);

    if (redisClient.isOpen) {
        redisClient.quit();
    }

    process.exit(1);
});
