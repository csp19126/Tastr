/**
 * Folds Vietnamese (and any accented) text to plain lowercase ASCII-ish letters,
 * so "banh mi" finds "Bánh Mì" and "bun cha" finds "bún chả".
 * The API stores this folded form next to every searchable name and folds queries the same way.
 */
export function foldForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
