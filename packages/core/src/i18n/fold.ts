/**
 * Lowercase + diacritic-folded text — the shared normalization under food-name
 * matching and quick-entry parsing (Czech matches with or without háčky).
 * Lives in core because two packages need it and shared needs move *down* (L1).
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
