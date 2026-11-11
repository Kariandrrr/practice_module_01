import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { options, questions, quizzes } from "@/db/schema";
import { QUESTION_COUNT, validateQuestion } from "./validate";

/** Загружает вопросы теста вместе с вариантами (для автора, с ключами). */
export async function loadQuizQuestions(quizId: number) {
  const qs = await db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(asc(questions.position));
  const ids = qs.map((q) => q.id);
  const opts = ids.length
    ? await db.select().from(options).where(inArray(options.questionId, ids)).orderBy(asc(options.position))
    : [];
  return qs.map((q) => ({
    ...q,
    options: opts.filter((o) => o.questionId === q.id),
  }));
}

/** Все условия публикации. Возвращает текст ошибки или null. */
export async function checkPublishable(quizId: number): Promise<string | null> {
  const qs = await loadQuizQuestions(quizId);
  if (qs.length !== QUESTION_COUNT) {
    return `В тесте должно быть ${QUESTION_COUNT} вопросов, сейчас ${qs.length}. Сгенерируйте тест заново.`;
  }
  for (const [i, q] of qs.entries()) {
    const err = validateQuestion(
      {
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        approved: q.approved,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
      },
      i,
    );
    if (err) return err;
    if (q.options.filter((o) => o.isCorrect).length !== 1) return `Вопрос ${i + 1}: должен быть ровно один правильный ответ.`;
    if (!q.approved) return `Вопрос ${i + 1} не утверждён автором. Утвердите все вопросы перед публикацией.`;
  }
  return null;
}

export async function getQuizOr404(quizId: number) {
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId));
  return quiz;
}
