import type { Messages } from '@almanac/core';

/** English — the guaranteed-complete namespace every other locale falls back to (L7). */
export const en: Messages = {
  title: 'Import & export',
  hint: 'Bring in events from another calendar as an .ics file, or export a date range to share.',
  importIcs: 'Import .ics',
  exportIcs: 'Export .ics',
  imported: 'Imported {{imported}}, skipped {{skipped}}.',
  importError: 'That file could not be read. Nothing was changed.',
  exportFrom: 'From',
  exportTo: 'To',
  nothingToExport: 'No events in that range.',
};
