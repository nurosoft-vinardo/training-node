import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || '3000',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    sessionSecret: process.env.SESSION_SECRET || 'your-super-secret-key',
    nodeEnv: process.env.NODE_ENV || 'development',
};

if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set in .env file');
}

if (!config.redisUrl) {
    throw new Error('REDIS_URL is not set in .env file');
}

if (!config.sessionSecret) {
    throw new Error('SESSION_SECRET is not set in .env file');
}