import { eq } from "drizzle-orm";
import { db } from "@/db";
import { books } from "@/db/schema";
import { parseId, respond, UserError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const deleted = await db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
    if (deleted.length === 0) throw new UserError("Книга не найдена", 404);
    return { ok: true };
  });
}
