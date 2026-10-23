import type { ChangeEvent } from "react";

/**
 * Trim list names, or lowercase subreddit text, as the user types while keeping the caret in
 * place; React would otherwise move it to the end whenever the value changes.
 */
export function normalisedChange(kind: "name" | "subreddits", set: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const original = input.value;
    const value = kind === "name" ? original.trim() : original.toLowerCase();
    set(value);
    if (value === original) return;
    const removed = kind === "name" ? original.length - original.trimStart().length : 0;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === null || end === null) return;
    requestAnimationFrame(() =>
      input.setSelectionRange(Math.max(0, start - removed), Math.max(0, end - removed)),
    );
  };
}
