import { db } from "@/db";
import { attemptAnswers, attempts } from "@/db/schema";
import { parseId, respond, UserError } from "@/lib/errors";
import { getQuizOr404, loadQuizQuestions } from "@/lib/quiz";

export const dynamic = "force-dynamic";

/**
 * QUIZ-04: приём ответов. Ключи сверяются только на сервере;
 * в ответе — лишь идентификатор попытки (результат показывает страница /attempts/[id]).
 * Работает без модели — всё берётся из БД.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const quiz = await getQuizOr404(id);
    if (!quiz) throw new UserError("Тест не найден", 404);
    if (quiz.status !== "published") throw new UserError("Тест не опубликован", 403);

    const body = (await req.json().catch(() => null)) as { answers?: Record<string, number> } | null;
    const answers = body?.answers;
    if (!answers || typeof answers !== "object") throw new UserError("Ответы не получены");

    const qs = await loadQuizQuestions(id);
    const rows = qs.map((q) => {
      const chosen = q.options.find((o) => o.id === Number(answers[String(q.id)]));
      return { questionId: q.id, optionId: chosen?.id ?? null, isCorrect: Boolean(chosen?.isCorrect) };
    });
    if (rows.some((r) => r.optionId === null)) {
      throw new UserError("Ответьте на все вопросы перед отправкой.");
    }
    const score = rows.filter((r) => r.isCorrect).length;

    const attemptId = await db.transaction(async (tx) => {
      const [a] = await tx
        .insert(attempts)
        .values({ quizId: id, score, total: rows.length })
        .returning({ id: attempts.id });
      await tx.insert(attemptAnswers).values(rows.map((r) => ({ ...r, attemptId: a.id })));
      return a.id;
    });
    return { attemptId };
  });
}
