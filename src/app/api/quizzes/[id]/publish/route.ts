import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes } from "@/db/schema";
import { parseId, respond, UserError } from "@/lib/errors";
import { checkPublishable, getQuizOr404 } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const quiz = await getQuizOr404(id);
    if (!quiz) throw new UserError("Тест не найден", 404);
    const err = await checkPublishable(id);
    if (err) throw new UserError(`Публикация невозможна. ${err}`, 422);
    await db
      .update(quizzes)
      .set({ status: "published", publishedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(quizzes.id, id));
    return { ok: true };
  });
}
