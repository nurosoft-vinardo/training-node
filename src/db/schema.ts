import { pgTable, serial, text, varchar, timestamp, integer, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const books = pgTable('books', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    author: varchar('author', { length: 255 }).notNull(),
    isbn: varchar('isbn', { length: 20 }).unique(),
    publishedDate: timestamp('published_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const favorites = pgTable('favorites', {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
},
(table) => {
    return {
        pk: primaryKey({ columns: [table.userId, table.bookId] }),
    };
});

export const usersRelations = relations(users, ({ many }) => ({
    favorites: many(favorites),
}));

export const booksRelations = relations(books, ({ many }) => ({
    favoritedBy: many(favorites),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
    user: one(users, {
        fields: [favorites.userId],
        references: [users.id],
    }),
    book: one(books, {
        fields: [favorites.bookId],
        references: [books.id],
    }),
}));
