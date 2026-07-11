import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, MS_PER_DAY, type Weekday } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useSettings } from '../state/settings';
import { TOGGLEABLE_MODULES } from '../state/module-visibility';
import { syncReminders, useTasks } from '../state/tasks';
import { Button } from '../ui/Button';
import { CalendarsManager } from './CalendarsManager';
import { InteropSection } from './InteropSection';
import { SubscriptionsSection } from './SubscriptionsSection';

const WEEK_STARTS: Weekday[] = [1, 6, 0]; // Monday, Saturday, Sunday

/** Localized weekday name (2023-01-01 was a Sunday). */
function weekdayName(tag: string, weekday: Weekday): string {
  return new Intl.DateTimeFormat(tag, { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(2023, 0, 1) + weekday * MS_PER_DAY,
  );
}

/** Settings (5.5): week start, time format, and the vault backup. */
export function SettingsView() {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const timeFormat = useSettings((s) => s.timeFormat);
  const setWeekStartsOn = useSettings((s) => s.setWeekStartsOn);
  const setTimeFormat = useSettings((s) => s.setTimeFormat);
  const remindersEnabled = useSettings((s) => s.remindersEnabled);
  const reminderOffsetMin = useSettings((s) => s.reminderOffsetMin);
  const setRemindersEnabled = useSettings((s) => s.setRemindersEnabled);
  const setReminderOffsetMin = useSettings((s) => s.setReminderOffsetMin);
  const exportVault = useSettings((s) => s.exportVault);
  const importVault = useSettings((s) => s.importVault);
  const hiddenModules = useSettings((s) => s.hiddenModules);
  const setModuleHidden = useSettings((s) => s.setModuleHidden);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const tag = bcp47(locale);

  const selectClass =
    'rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent';

  async function onExport(): Promise<void> {
    const json = await exportVault();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac-vault.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File): Promise<void> {
    const result = await importVault(await file.text());
    setImportStatus(
      result === null
        ? t('vaultError')
        : t('vaultImported', { imported: result.imported, skipped: result.skipped }),
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <h2 className="font-semibold">{t('navSettings')}</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t('weekStart')}
          <select
            aria-label={t('weekStart')}
            value={weekStartsOn ?? 'locale'}
            onChange={(e) =>
              void setWeekStartsOn(
                e.target.value === 'locale' ? null : (Number(e.target.value) as Weekday),
              )
            }
            className={selectClass}
          >
            <option value="locale">{t('followLocale')}</option>
            {WEEK_STARTS.map((weekday) => (
              <option key={weekday} value={weekday} className="capitalize">
                {weekdayName(tag, weekday)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t('timeFormat')}
          <select
            aria-label={t('timeFormat')}
            value={timeFormat ?? 'auto'}
            onChange={(e) =>
              void setTimeFormat(e.target.value === 'auto' ? null : (e.target.value as '12h' | '24h'))
            }
            className={selectClass}
          >
            <option value="auto">{t('followLocale')}</option>
            <option value="12h">{t('time12')}</option>
            <option value="24h">{t('time24')}</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t('reminders')}
          <input
            type="checkbox"
            aria-label={t('reminders')}
            checked={remindersEnabled}
            onChange={(e) =>
              void setRemindersEnabled(e.target.checked).then(() =>
                syncReminders(useTasks.getState().items),
              )
            }
            className="accent-accent"
          />
        </label>
        {remindersEnabled && (
          <label className="flex items-center justify-between gap-3 text-sm">
            {t('reminderOffset')}
            <select
              aria-label={t('reminderOffset')}
              value={reminderOffsetMin}
              onChange={(e) =>
                void setReminderOffsetMin(Number(e.target.value)).then(() =>
                  syncReminders(useTasks.getState().items),
                )
              }
              className={selectClass}
            >
              <option value={0}>{t('atDueTime')}</option>
              {[5, 10, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t('minutesBefore', { count: minutes })}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <h2 className="font-semibold">{t('modules')}</h2>
        <p className="text-sm text-ink-muted">{t('modulesHint')}</p>
        {TOGGLEABLE_MODULES.map((id) => {
          const name = t(`${id}:title`);
          return (
            <label key={id} className="flex items-center justify-between gap-3 text-sm">
              {name}
              <input
                type="checkbox"
                aria-label={t('moduleVisible', { name })}
                checked={!hiddenModules.includes(id)}
                onChange={(e) => void setModuleHidden(id, !e.target.checked)}
                className="accent-accent"
              />
            </label>
          );
        })}
      </section>

      <CalendarsManager />

      <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <h2 className="font-semibold">{t('vault')}</h2>
        <p className="text-sm text-ink-muted">{t('vaultHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onExport()}>{t('vaultExport')}</Button>
          <Button onClick={() => fileInput.current?.click()}>{t('vaultImport')}</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            aria-label={t('vaultImport')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file !== undefined) void onImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
        {importStatus !== null && <p className="text-sm text-ink-muted">{importStatus}</p>}
      </section>

      <InteropSection />
      <SubscriptionsSection />
    </div>
  );
}
