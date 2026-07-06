import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidISODate, type ISODate } from '@almanac/core';
import { useInterop } from '../state/interop';
import { Button } from '../ui/Button';

/** ICS import/export (P8): pull a range out to share, or bring a .ics file in. */
export function InteropSection() {
  const { t } = useTranslation('interop');
  const from = useInterop((s) => s.from);
  const to = useInterop((s) => s.to);
  const setRange = useInterop((s) => s.setRange);
  const importText = useInterop((s) => s.importText);
  const exportText = useInterop((s) => s.exportText);
  const lastImport = useInterop((s) => s.lastImport);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);

  const dateClass =
    'rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent';

  function onExport(): void {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File): Promise<void> {
    try {
      await importText(await file.text());
      setError(false);
    } catch {
      // parseIcs never throws; only a failed file read lands here (L5).
      setError(true);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="text-sm text-ink-muted">{t('hint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t('exportFrom')}
          <input
            type="date"
            aria-label={t('exportFrom')}
            value={from}
            onChange={(e) => {
              if (isValidISODate(e.target.value)) setRange({ from: e.target.value as ISODate });
            }}
            className={dateClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t('exportTo')}
          <input
            type="date"
            aria-label={t('exportTo')}
            value={to}
            onChange={(e) => {
              if (isValidISODate(e.target.value)) setRange({ to: e.target.value as ISODate });
            }}
            className={dateClass}
          />
        </label>
        <Button onClick={onExport}>{t('exportIcs')}</Button>
        <Button onClick={() => fileInput.current?.click()}>{t('importIcs')}</Button>
        <input
          ref={fileInput}
          type="file"
          accept=".ics,text/calendar"
          aria-label={t('importIcs')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void onImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="text-sm text-ink-muted">{t('importError')}</p>}
      {!error && lastImport !== null && (
        <p className="text-sm text-ink-muted">{t('imported', lastImport)}</p>
      )}
    </section>
  );
}
