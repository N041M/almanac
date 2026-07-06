import type { Messages } from '@almanac/core';

/** Czech. Any missing key falls back to the English namespace (L7). */
export const cs: Messages = {
  title: 'Import a export',
  hint: 'Načtěte události z jiného kalendáře jako soubor .ics, nebo exportujte časové období ke sdílení.',
  importIcs: 'Importovat .ics',
  exportIcs: 'Exportovat .ics',
  imported: 'Importováno {{imported}}, přeskočeno {{skipped}}.',
  importError: 'Soubor se nepodařilo přečíst. Nic nebylo změněno.',
  exportFrom: 'Od',
  exportTo: 'Do',
  nothingToExport: 'V tomto období nejsou žádné události.',
};
