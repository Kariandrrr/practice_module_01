import { eq } from "drizzle-orm";
import { db } from "@/db";
import { options, questions, quizzes } from "@/db/schema";
import { parseId, respond, UserError } from "@/lib/errors";
import { getQuizOr404, loadQuizQuestions } from "@/lib/quiz";
import { validateQuestion, type EditableQuestion } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Сохранение правок черновика автором */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const quiz = await getQuizOr404(id);
    if (!quiz) throw new UserError("Тест не найден", 404);
    if (quiz.status === "published") {
      throw new UserError("Опубликованный тест нельзя редактировать. Сначала снимите его с публикации.", 409);
    }
    const body = (await req.json().catch(() => null)) as { questions?: EditableQuestion[] } | null;
    if (!body || !Array.isArray(body.questions)) throw new UserError("Некорректные данные формы");

    const current = await loadQuizQuestions(id);
    const byId = new Map(current.map((q) => [q.id, q]));

    for (const [i, q] of body.questions.entries()) {
      const cur = byId.get(q.id);
      if (!cur) throw new UserError(`Вопрос ${i + 1} не принадлежит этому тесту`);
      const ownIds = new Set(cur.options.map((o) => o.id));
      if (q.options.length !== cur.options.length || q.options.some((o) => !ownIds.has(o.id))) {
        throw new UserError(`Вопрос ${i + 1}: некорректные варианты ответа`);
      }
      if (q.approved) {
        const err = validateQuestion(q, i);
        if (err) throw new UserError(`Нельзя утвердить. ${err}`);
      }
    }

    await db.transaction(async (tx) => {
      for (const q of body.questions!) {
        await tx
          .update(questions)
          .set({
            text: String(q.text).trim(),
            explanation: String(q.explanation).trim(),
            approved: Boolean(q.approved),
          })
          .where(eq(questions.id, q.id));
        for (const o of q.options) {
          await tx
            .update(options)
            .set({ text: String(o.text).trim(), isCorrect: o.id === q.correctOptionId })
            .where(eq(options.id, o.id));
        }
      }
      await tx.update(quizzes).set({ updatedAt: new Date() }).where(eq(quizzes.id, id));
    });
    return { ok: true };
  });
}
