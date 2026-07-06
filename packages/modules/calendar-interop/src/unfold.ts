/**
 * One parsed RFC 5545 content line: `NAME;PARAM=value:VALUE`. Names and param
 * keys are upper-cased (the spec is case-insensitive for them); the value is
 * returned raw (TEXT unescaping happens where a TEXT value is expected).
 */
export interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Unfold per RFC 5545 §3.1: a CRLF (or LF) followed by a space or tab is a line
 * continuation — the break and the one whitespace char are removed. Long
 * property values are split this way, so unfolding must precede any parsing.
 */
function unfold(text: string): string[] {
  const raw = text.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Split a content line into name + params + value; malformed lines → null. */
function parseLine(line: string): ContentLine | null {
  if (line.trim() === '') return null;
  // The value begins at the first colon that isn't inside a quoted param.
  let colon = -1;
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  const parts = head.split(';');
  const name = (parts[0] ?? '').trim().toUpperCase();
  if (name === '') return null;
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toUpperCase();
    // A quoted param value (e.g. a TZID with a slash) drops its surrounding quotes.
    const rawVal = part.slice(eq + 1).trim();
    params[key] = rawVal.startsWith('"') && rawVal.endsWith('"') ? rawVal.slice(1, -1) : rawVal;
  }
  return { name, params, value };
}

/** Unfold and parse a whole ICS document into content lines (malformed lines dropped). */
export function parseContentLines(text: string): ContentLine[] {
  const out: ContentLine[] = [];
  for (const line of unfold(text)) {
    const parsed = parseLine(line);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/** Unescape an RFC 5545 TEXT value (`\n` `\,` `\;` `\\`). */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_m, ch: string) =>
    ch === 'n' || ch === 'N' ? '\n' : ch,
  );
}

/** Escape a string as an RFC 5545 TEXT value. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
