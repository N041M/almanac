import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidISODate, normalizePriority, type ISODate, type Priority } from '@almanac/core';
import { parseQuickEntry } from '@almanac/tasks';
import { useTasks } from '../state/tasks';
import { DEFAULT_CALENDAR_ID, useCalendars } from '../state/calendars';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { tagStyle } from './tag-color';
import { today } from '../clock';

const PRIORITIES: Priority[] = [1, 2, 3];

function minutesLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * The friendly face of quick entry: plain-language typing still works (the
 * parser preview shows what it understood), but every field also has an
 * explicit control — date, time, priority pills, tags, an optional
 * description. Pickers win over parsed text; everything is optional and the
 * add never blocks (L5).
 */
export function TaskComposer({ listId }: { listId?: string }) {
  const { t } = useTranslation('tasks');
  const quickAdd = useTasks((s) => s.quickAdd);
  const items = useTasks((s) => s.items);

  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority | undefined>();
  const [tags, setTags] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<'task' | 'event'>('task');
  const calendars = useCalendars((s) => s.calendars);
  const defaultCalendarId = useSettings((s) => s.defaultCalendarId);
  const [calendarId, setCalendarId] = useState(defaultCalendarId);

  // Live preview of what the text alone would set — the shorthand teaches
  // itself, and a wrong guess is visible before it lands.
  const parsed = useMemo(() => parseQuickEntry(text, today()), [text]);

  // Tag suggestions from everything already used.
  const knownTags = useMemo(
    () => [...new Set(items.flatMap((i) => [...i.categories, ...i.contexts.map((c) => `@${c}`)]))],
    [items],
  );

  const inputClass =
    'border border-line bg-surface-raised px-2 py-1 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  function submit(): void {
    if (text.trim() === '') return;
    const [h, m] = time.split(':');
    void quickAdd(text, {
      kind,
      ...(listId !== undefined && listId !== 'inbox' && { listId }),
      ...(isValidISODate(date) && { date: date as ISODate }),
      ...(time !== '' && { minutes: Number(h) * 60 + Number(m ?? 0) }),
      ...(priority !== undefined && { priority }),
      tags: tags.split(',').map((tag) => tag.trim()),
      ...(notes.trim() !== '' && { notes }),
      ...(calendarId !== DEFAULT_CALENDAR_ID && { calendarId }),
    });
    setText('');
    setDate('');
    setTime('');
    setPriority(undefined);
    setTags('');
    setNotes('');
    setShowNotes(false);
    setKind('task');
    setCalendarId(defaultCalendarId);
  }

  const previewChips: string[] = [
    ...(date === '' && parsed.date !== undefined ? [parsed.date] : []),
    ...(time === '' && parsed.minutes !== undefined ? [minutesLabel(parsed.minutes)] : []),
    ...(priority === undefined && parsed.priority !== undefined ? [`P${parsed.priority}`] : []),
    ...parsed.categories.map((c) => `#${c}`),
    ...parsed.contexts.map((c) => `@${c}`),
  ];

  return (
    <form
      className="space-y-2 border border-line bg-surface-raised p-3 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        aria-label={t('quickAdd')}
        placeholder={t('quickAdd')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        className="w-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
      />
      {previewChips.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <span>{t('understood')}</span>
          {previewChips.map((chip) => (
            <span key={chip} className="bg-accent-soft/60 px-1.5 py-0.5">
              {chip}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div role="radiogroup" aria-label={t('kind')} className="flex items-center gap-1">
          {(['task', 'event'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={[
                'border px-2 py-0.5 text-xs transition-colors',
                'focus-visible:outline-2 focus-visible:outline-accent',
                kind === k
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-ink-muted hover:bg-accent-soft/60',
              ].join(' ')}
            >
              {t(k)}
            </button>
          ))}
        </div>
        {calendars.length > 1 && (
          <select
            aria-label={t('calendar')}
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className={inputClass}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === DEFAULT_CALENDAR_ID ? t('defaultCalendar') : c.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          {t('due')}
          <input
            type="date"
            aria-label={t('dueDate')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
          <input
            type="time"
            aria-label={t('dueTime')}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
          />
        </label>

        <div role="radiogroup" aria-label={t('priority')} className="flex items-center gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(priority === p ? undefined : p)}
              className={[
                'border px-2 py-0.5 text-xs transition-colors',
                'focus-visible:outline-2 focus-visible:outline-accent',
                priority === p
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-ink-muted hover:bg-accent-soft/60',
              ].join(' ')}
            >
              {t(`priority${p}`)}
            </button>
          ))}
          {/* The pills are presets; any positive integer works (D9). */}
          <input
            type="number"
            min={1}
            aria-label={t('priorityNumber')}
            value={priority ?? ''}
            onChange={(e) => setPriority(normalizePriority(Number(e.target.value)))}
            className={`w-14 ${inputClass}`}
          />
        </div>

        <input
          aria-label={t('tags')}
          placeholder={t('tagsPlaceholder')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          list="task-tag-suggestions"
          className={`min-w-36 flex-1 ${inputClass}`}
        />
        <datalist id="task-tag-suggestions">
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        {tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag !== '')
          .map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-xs" style={tagStyle(tag)}>
              {tag}
            </span>
          ))}

        <Button
          variant="ghost"
          type="button"
          aria-expanded={showNotes}
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs"
        >
          {t('addDescription')}
        </Button>
        <Button type="submit" variant="solid">
          {t('add')}
        </Button>
      </div>

      {showNotes && (
        <textarea
          aria-label={t('description')}
          placeholder={t('descriptionHint')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      )}
    </form>
  );
}
