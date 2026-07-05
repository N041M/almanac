import { useTranslation } from 'react-i18next';
import { WEIGHT_PRESETS } from '@almanac/meals';
import { useMeals } from '../state/meals';

/** A labelled 0..1 bar — the breakdown's visual unit. */
function FactorBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span>{detail ?? clamped.toFixed(2)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-accent-soft/50">
        <div className="h-full rounded-full bg-accent" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * "Why this pick" (§6.6, the signature element): the chosen meal's factor
 * values, its selection probability, and bars versus the top alternatives.
 */
export function MealBreakdown() {
  const { t } = useTranslation('meals');
  const plan = useMeals((s) => s.plan);
  const recipes = useMeals((s) => s.recipes);
  const index = useMeals((s) => s.breakdownIndex);

  const entry = index === null ? undefined : plan[index];
  if (entry?.breakdown == null || entry.recipeId === null) {
    return <p className="text-sm text-ink-muted">{t('pickBreakdownHint')}</p>;
  }
  const b = entry.breakdown;
  const name = recipes[entry.recipeId]?.name ?? t('removedMeal');
  const percent = (p: number) => `${(p * 100).toFixed(0)} %`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-ink-muted">
          {t('probability')}: {percent(b.prob)} · {t('candidates', { count: b.candidateCount })}
        </p>
        <p className="text-sm text-ink-muted">
          {b.daysSince === null ? t('neverServed') : t('daysSince', { count: b.daysSince })}
        </p>
      </div>

      <div className="space-y-2">
        <FactorBar
          label={t('factorFrequency')}
          value={b.fFreq / WEIGHT_PRESETS.favourite}
          detail={`×${b.fFreq}`}
        />
        <FactorBar label={t('factorRecency')} value={b.fRec} detail={`×${b.fRec.toFixed(2)}`} />
        <FactorBar label={t('factorTag')} value={b.fTag} detail={`×${b.fTag.toFixed(2)}`} />
      </div>

      {b.alternatives.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t('alternatives')}</h4>
          <FactorBar label={name} value={b.prob} detail={percent(b.prob)} />
          {b.alternatives.map((alt) => (
            <FactorBar key={alt.id} label={alt.name} value={alt.p} detail={percent(alt.p)} />
          ))}
        </div>
      )}
    </div>
  );
}
