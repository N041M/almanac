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
  subscriptions: 'Odběry',
  subscriptionsHint: 'Sledujte kalendářový kanál jen pro čtení (svátky, sdílená .ics adresa). Obnovuje se při otevření; offline zobrazí poslední kopii.',
  feedUrl: 'Adresa kanálu (.ics)',
  feedName: 'Název',
  addFeed: 'Odebírat',
  removeFeed: 'Odebrat {{name}}',
  refreshFeed: 'Obnovit',
  feedStale: 'Zobrazuje se poslední uložená kopie.',
  noFeeds: 'Zatím žádné odběry.',
};
