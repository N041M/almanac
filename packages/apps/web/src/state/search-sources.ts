import { dateInZone, type ISODate } from '@almanac/core';
import type { SearchDoc } from '@almanac/search';
import type { TaskItem } from '@almanac/tasks';
import type { Recipe } from '@almanac/food';

// The app is where module data becomes searchable (L1: modules never see each
// other; the shell composes their state into one corpus). A source that
// contributes nothing simply isn't searchable — the rest still are (L5).

/** The date to jump to for a task/event, when it has one. */
function dateOf(item: TaskItem): ISODate | undefined {
  if (item.kind === 'task') return item.due?.date;
  if (item.kind === 'event') {
    return 'allDay' in item.when
      ? item.when.allDay
      : (dateInZone(item.when.span.startUtc, item.when.span.zone) ?? undefined);
  }
  return undefined; // habits recur — no single date to jump to
}

function taskDoc(item: TaskItem): SearchDoc {
  const keywords = [...item.categories, ...item.contexts];
  if (item.place !== undefined) keywords.push(item.place);
  if (item.notes !== undefined) keywords.push(item.notes);
  const date = dateOf(item);
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    ...(keywords.length > 0 && { keywords }),
    ...(date !== undefined && { date }),
  };
}

/** Build the search corpus from the given module state (pure — easy to test). */
export function collectSearchDocs(
  tasks: ReadonlyArray<TaskItem>,
  recipes: Readonly<Record<string, Recipe>>,
): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const item of tasks) {
    // Completed one-off tasks drop out of search — they're done (L5-quiet).
    if (item.kind === 'task' && item.doneAt !== null) continue;
    docs.push(taskDoc(item));
  }
  for (const recipe of Object.values(recipes)) {
    docs.push({
      id: recipe.id,
      kind: 'recipe',
      title: recipe.name,
      ...(recipe.tags.length > 0 && { keywords: recipe.tags }),
    });
  }
  return docs;
}
