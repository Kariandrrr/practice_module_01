import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Книга (загруженный TXT). Нормализованный текст хранится целиком — координаты фрагментов указывают в него. */
export const books = pgTable("books", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  filename: text().notNull(),
  content: text().notNull(),
  contentHash: text("content_hash").notNull(),
  charCount: integer("char_count").notNull(),
  /** processing | ready | error */
  status: text().notNull().default("processing"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Фрагмент книги: порядок и диапазон символов [startChar, endChar) в books.content */
export const chunks = pgTable(
  "chunks",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    startChar: integer("start_char").notNull(),
    endChar: integer("end_char").notNull(),
    text: text().notNull(),
  },
  (t) => [
    index("chunks_book_idx").on(t.bookId),
    unique("chunks_book_position_uq").on(t.bookId, t.position),
  ],
);

/** Тест по книге (один тест на книгу). status: draft | published */
export const quizzes = pgTable("quizzes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer("book_id")
    .notNull()
    .unique()
    .references(() => books.id, { onDelete: "cascade" }),
  status: text().notNull().default("draft"),
  /** heuristic | llm */
  generator: text().notNull().default("heuristic"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

/** Вопрос теста со ссылкой на исходный фрагмент */
export const questions = pgTable(
  "questions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    chunkId: integer("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    text: text().notNull(),
    explanation: text().notNull(),
    sourceQuote: text("source_quote").notNull(),
    /** Утверждён автором */
    approved: boolean().notNull().default(false),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId)],
);

/** Вариант ответа (4 на вопрос, один isCorrect) */
export const options = pgTable(
  "options",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    text: text().notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (t) => [index("options_question_idx").on(t.questionId)],
);

/** Попытка прохождения */
export const attempts = pgTable(
  "attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    score: integer().notNull(),
    total: integer().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attempts_quiz_idx").on(t.quizId)],
);

/** Выбранный вариант в попытке */
export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionId: integer("option_id").references(() => options.id, {
      onDelete: "set null",
    }),
    isCorrect: boolean("is_correct").notNull(),
  },
  (t) => [index("attempt_answers_attempt_idx").on(t.attemptId)],
);

export type Book = typeof books.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Option = typeof options.$inferSelect;
