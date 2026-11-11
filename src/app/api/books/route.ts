import { createBook, titleFromFilename } from "@/lib/books";
import { respond, UserError } from "@/lib/errors";
import { MAX_FILE_BYTES, validateAndDecode } from "@/lib/text";

export const dynamic = "force-dynamic";

/** QUIZ-01: загрузка книги (TXT, UTF-8, до 500 КБ) */
export async function POST(req: Request) {
  return respond(async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new UserError("Не удалось прочитать загруженный файл. Повторите загрузку.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new UserError("Файл не выбран. Выберите TXT-файл с книгой.");
    if (file.size > MAX_FILE_BYTES) {
      throw new UserError(
        `Файл слишком большой (${Math.ceil(file.size / 1024)} КБ). Максимальный размер — 500 КБ.`,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const content = validateAndDecode(file.name, file.type, bytes);
    const customTitle = String(form.get("title") ?? "").trim().slice(0, 200);
    const result = await createBook({
      title: customTitle || titleFromFilename(file.name),
      filename: file.name,
      content,
    });
    return result;
  });
}
