import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes } from "@/db/schema";
import { parseId, respond, UserError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const res = await db
      .update(quizzes)
      .set({ status: "draft", publishedAt: null, updatedAt: new Date() })
      .where(eq(quizzes.id, id))
      .returning({ id: quizzes.id });
    if (res.length === 0) throw new UserError("Тест не найден", 404);
    return { ok: true };
  });
}
