/**
 * A stable, theme-friendly color per tag name so tags differentiate at a
 * glance: same tag ⇒ same hue, everywhere, both themes. Text gets the full
 * color; the background a low-alpha wash of it.
 */
export function tagHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return ((hash % 360) + 360) % 360;
}

export function tagStyle(name: string): { color: string; backgroundColor: string } {
  const hue = tagHue(name);
  return {
    color: `hsl(${hue} 65% 45%)`,
    backgroundColor: `hsl(${hue} 65% 45% / 0.14)`,
  };
}
