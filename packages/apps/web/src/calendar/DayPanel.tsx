import { useTranslation } from 'react-i18next';
import { useCalendar } from '../state/store';
import { DayDetail } from './DayDetail';

/** Sidebar panel: the selected day's detail, or a hint when nothing is selected. */
export function DayPanel() {
  const { t } = useTranslation();
  const selected = useCalendar((s) => s.selected);

  if (selected === null) {
    return <p className="text-sm text-ink-muted">{t('selectDay')}</p>;
  }
  return <DayDetail date={selected} />;
}
