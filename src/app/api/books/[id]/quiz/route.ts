import { parseId, respond } from "@/lib/errors";
import { generateQuizForBook, isLlmConfigured, type GeneratorMode } from "@/lib/generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** QUIZ-03: генерация черновика теста */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = parseId((await ctx.params).id);
    const body = (await req.json().catch(() => ({}))) as { mode?: string };
    const mode: GeneratorMode = body.mode === "llm" && isLlmConfigured() ? "llm" : "heuristic";
    return generateQuizForBook(id, mode);
  });
}
