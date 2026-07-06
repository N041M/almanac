import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubscriptions } from '../state/subscriptions';
import { Button } from '../ui/Button';

/** Read-only ICS feed subscriptions (P8): add/remove/refresh; offline shows cache. */
export function SubscriptionsSection() {
  const { t } = useTranslation('interop');
  const load = useSubscriptions((s) => s.load);
  const feeds = useSubscriptions((s) => s.feeds);
  const addFeed = useSubscriptions((s) => s.addFeed);
  const removeFeed = useSubscriptions((s) => s.removeFeed);
  const refresh = useSubscriptions((s) => s.refresh);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const inputClass =
    'rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
      <h2 className="font-semibold">{t('subscriptions')}</h2>
      <p className="text-sm text-ink-muted">{t('subscriptionsHint')}</p>

      {feeds.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('noFeeds')}</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {feeds.map((feed) => (
            <li key={feed.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{feed.name}</div>
                <div className="truncate text-xs text-ink-muted">{feed.url}</div>
                {feed.stale && <div className="text-xs text-ink-faint">{t('feedStale')}</div>}
              </div>
              <Button variant="ghost" onClick={() => void refresh(feed.id)}>
                {t('refreshFeed')}
              </Button>
              <Button
                variant="ghost"
                aria-label={t('removeFeed', { name: feed.name })}
                onClick={() => void removeFeed(feed.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addFeed(url, name);
          setUrl('');
          setName('');
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('feedUrl')}
          aria-label={t('feedUrl')}
          className={`min-w-56 flex-1 ${inputClass}`}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('feedName')}
          aria-label={t('feedName')}
          className={`w-40 ${inputClass}`}
        />
        <Button type="submit" variant="outline">
          {t('addFeed')}
        </Button>
      </form>
    </section>
  );
}
