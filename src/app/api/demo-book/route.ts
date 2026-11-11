import { DEMO_BOOK_FILENAME, DEMO_BOOK_TEXT } from "@/lib/demo-book";

export const dynamic = "force-static";

/** Скачивание демонстрационного TXT-файла */
export async function GET() {
  return new Response(DEMO_BOOK_TEXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${DEMO_BOOK_FILENAME}"`,
    },
  });
}
