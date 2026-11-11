import { createBook } from "@/lib/books";
import { DEMO_BOOK_FILENAME, DEMO_BOOK_TEXT, DEMO_BOOK_TITLE } from "@/lib/demo-book";
import { respond } from "@/lib/errors";
import { normalizeText } from "@/lib/text";

export const dynamic = "force-dynamic";

/** Загрузка встроенной учебной книги (тестовые данные) */
export async function POST() {
  return respond(() =>
    createBook({
      title: DEMO_BOOK_TITLE,
      filename: DEMO_BOOK_FILENAME,
      content: normalizeText(DEMO_BOOK_TEXT),
    }),
  );
}
