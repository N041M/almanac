import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EN_US, CS_CZ } from '@almanac/core';
import { useCalendar } from './state/store';
import { useSettings } from './state/settings';
import { useUndo } from './state/undo';
import { CalendarView } from './calendar/CalendarView';
import { DayPanel } from './calendar/DayPanel';
import { MealsView } from './meals/MealsView';
import { TasksView } from './tasks/TasksView';
import { SettingsView } from './settings/SettingsView';
import { CommandPalette } from './palette/CommandPalette';
import { Button } from './ui/Button';

type Screen = 'calendar' | 'tasks' | 'meals' | 'settings';

/** The 5.4 undo toast: names the last action, offers Undo, fades on its own. */
function UndoToast() {
  const { t } = useTranslation();
  const toastKey = useUndo((s) => s.toastKey);
  const undo = useUndo((s) => s.undo);
  const dismissToast = useUndo((s) => s.dismissToast);

  if (toastKey === null) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-2 text-sm shadow-lg"
    >
      <span>{t(toastKey)}</span>
      <Button
        variant="solid"
        onClick={() => {
          void undo();
        }}
      >
        {t('undo')}
      </Button>
      <Button variant="ghost" aria-label={t('dismiss')} onClick={dismissToast}>
        ✕
      </Button>
    </div>
  );
}

export function App() {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const setLocale = useCalendar((s) => s.setLocale);
  const view = useCalendar((s) => s.view);
  const loadSettings = useSettings((s) => s.load);
  const rememberLanguage = useSettings((s) => s.rememberLanguage);
  const [screen, setScreen] = useState<Screen>('calendar');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Restore persisted settings (incl. language) once, at startup.
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // ⌘Z undoes the last slice write (not in text fields, where the platform's
  // own undo wins); ⌘K opens the command palette anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setPaletteOpen((was) => !was);
        return;
      }
      if (key !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      void useUndo.getState().undo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const tab = (target: Screen, label: string) => (
    <button
      type="button"
      onClick={() => setScreen(target)}
      aria-current={screen === target ? 'page' : undefined}
      className={[
        // Quiet by design: the calendar is the app; tabs are side rooms.
        'rounded px-2 py-1 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        screen === target
          ? 'font-medium text-accent underline decoration-2 underline-offset-8'
          : 'text-ink-muted hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-line px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <nav aria-label={t('navigation')} className="flex gap-1">
          {tab('calendar', t('navCalendar'))}
          {tab('tasks', t('tasks:title'))}
          {tab('meals', t('meals:title'))}
          {tab('settings', t('navSettings'))}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          {t('language')}
          <select
            aria-label={t('language')}
            value={locale.language}
            onChange={(e) => {
              setLocale(e.target.value === 'cs' ? CS_CZ : EN_US);
              void rememberLanguage(e.target.value);
            }}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
        </label>
      </header>

      {screen === 'tasks' && (
        <main className="mx-auto max-w-3xl p-6">
          <TasksView />
        </main>
      )}
      {screen === 'meals' && (
        <main className="mx-auto max-w-5xl p-6">
          <MealsView />
        </main>
      )}
      {screen === 'settings' && (
        <main className="mx-auto max-w-3xl p-6">
          <SettingsView />
        </main>
      )}
      {screen === 'calendar' && (
        <main
          className={[
            'mx-auto grid max-w-5xl gap-6 p-6',
            // Day view IS the day detail; agenda/timeline are full-width lists.
            view === 'day' || view === 'agenda' || view === 'timeline'
              ? ''
              : 'md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]',
          ].join(' ')}
        >
          <div className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
            <CalendarView />
          </div>
          {view !== 'day' && view !== 'agenda' && view !== 'timeline' && (
            <aside className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
              <DayPanel />
            </aside>
          )}
        </main>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setScreen}
      />
      <UndoToast />
    </div>
  );
}
