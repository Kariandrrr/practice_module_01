export const QUESTION_COUNT = 5;
export const OPTION_COUNT = 4;

export type EditableQuestion = {
  id: number;
  text: string;
  explanation: string;
  approved: boolean;
  options: { id: number; text: string }[];
  correctOptionId: number | null;
};

/** Проверка одного вопроса перед утверждением. Возвращает текст ошибки или null. */
export function validateQuestion(q: EditableQuestion, index: number): string | null {
  const n = index + 1;
  if (!q.text.trim()) return `Вопрос ${n}: пустой текст вопроса.`;
  if (q.options.length !== OPTION_COUNT) return `Вопрос ${n}: должно быть ровно ${OPTION_COUNT} варианта ответа.`;
  if (q.options.some((o) => !o.text.trim())) return `Вопрос ${n}: есть пустой вариант ответа.`;
  const set = new Set(q.options.map((o) => o.text.trim().toLowerCase()));
  if (set.size !== OPTION_COUNT) return `Вопрос ${n}: варианты ответа должны быть разными.`;
  if (!q.options.some((o) => o.id === q.correctOptionId)) return `Вопрос ${n}: не выбран правильный ответ.`;
  if (!q.explanation.trim()) return `Вопрос ${n}: добавьте объяснение.`;
  return null;
}
