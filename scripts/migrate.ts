import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../src/config'; // Adjust path as necessary

async function runMigrations() {
    console.log('Connecting to database for migrations...');
    const migrationClient = postgres(config.databaseUrl, { max: 1 });
    const db = drizzle(migrationClient);

    console.log('Running migrations...');
    try {
        await migrate(db, { migrationsFolder: './src/db/migrations' });
        console.log('Migrations applied successfully!');
    } catch (error) {
        console.error('Error applying migrations:', error);
        process.exit(1);
    } finally {
        await migrationClient.end();
        console.log('Migration client disconnected.');
    }
}

runMigrations().catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
});
