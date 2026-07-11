# Roadmap

The authoritative build sequence. Extends the design doc's §13 with the
calendar-completeness features a mainstream calendar app is expected to have
(gap analysis, 2026-07-03) — each placed as **core primitive, module, or view**
per the laws (L1–L8). §2 (laws) and §6 (meal engine) remain exact contracts.

Status: ✅ done · 🔨 in progress · — planned.

---

## Phase summary

| # | Phase | Contents | Status |
|---|---|---|---|
| 0 | Scaffold | workspaces, boundary lint, strict TS, CI, i18n rig | ✅ |
| 1 | Core | day record/store, calendar model, recurrence v1, units, registry, i18n, ports | ✅ |
| 2 | Calendar shell | tokens/dark UI, month/week/day views, keyboard grid, EN+CS, localStorage + SQLite `StoragePort` (Tauri) | ✅ |
| 3 | Food kernel | Ingredient/Recipe/NutritionFacts; OFF adapter + caching + degradation | ✅ |
| 4 | Meals module | §6 engine exactly, TDD + statistical suite; **module-manifest seam defined first**; meals UI (week grid, lock/re-roll, variety, breakdown, ingredients) | ✅ |
| 5 | Calendar core v2 | recurrence v2 · timed/multi-day/timezone events · `NotificationPort` · hour-grid + agenda views · drag & drop · undo · copy/paste · settings surface · vault export/import · `StoragePort` contract suite (secondary TZ/working hours + notification adapters land with P6, alongside their first consumers) | ✅ |
| 6 | Tasks module | tasks/events/habits on v2 primitives; multiple calendars (colors/visibility); NL quick entry + picker composer; command palette; series split; notifications wired (snooze deferred: no platform support yet — plain notifications per the L5 row; habit-editing UI rides a later pass) | ✅ |
| 7 | Macros + Shopping | both modules + UI; two-trigger aggregation (§8.1) | ✅ |
| 8 | Interop & findability | ICS import/export · calendar subscriptions · search · year view · printing | ✅ |
| 9 | Life modules | check-in ✅ · cycle ✅ · body ✅ · workouts ✅ (log; plan-gen later) · weather · insights (health + time allocation) · birthdays · planner (timeboxing) · secondary-TZ leftover | 🔨 |
| 10 | Sync | D1/D4: accounts, per-slice LWW revision sync, server-durable | — |
| 11 | Mobile + surfaces | Expo client · widgets · tray mini-calendar · polish | — |
| 12 | Multi-user | shared calendars · attendees/invites/RSVP · free-busy + find-a-time · booking pages · conferencing links | — |

Rationale for the order: meals-first stays (D0) — the engine is self-contained
pure logic. Calendar v2 + tasks (5–6) come before macros + shopping (7) so the
app is **livable-in daily** as early as possible; real usage feeds everything
downstream. Phase 5 must precede Phase 6 — the tasks module stores
recurring/timed events, so their **shape must be final before the first event
is persisted** (migrations are the tax for deciding late).

---

## Phase 5 — Calendar core v2 (the two early contracts + notifications + views)

### 5.1 Recurrence v2 (core `schedule/`)
Extends `Recurrence` **additively** (v1 rules keep working):
- `freq: 'yearly'` (birthdays, anniversaries).
- `byWeekdayPos` — nth weekday of month ("2nd Tuesday"), incl. `-1` for last.
- `exDates: ISODate[]` — "delete just this occurrence".
- **Per-instance overrides**, the series-vs-instance contract: an override is a
  small record `{ seriesId, occurrenceDate, changes | 'cancelled' }` stored in
  the owning module's slice; `occurrencesInRange` output is post-processed by
  an `applyOverrides` helper. The series stays one rule; instances stay cheap.
- Same L5 posture: malformed input → `[]`, never throws.

### 5.2 Timed, multi-day, timezone-aware events (core `time/` + conventions)
- **All-day events** stay pure `ISODate` (timezone-free — the current model).
- **Timed events** store `{ startUtc: number, endUtc: number, zone: string }` —
  the instant is absolute (UTC ms), `zone` is the *display intent* (IANA id).
  Rendering resolves via `Intl` in the viewer's or the event's zone; travel
  doesn't corrupt anything because the instant never changes.
- **Multi-day spans** derive per-day presence: a span contributes to every day
  record it touches (the calendar asks "what touches this date range?" —
  one query helper in core, `daysCovered(span)`); month/week views render
  banners from contiguous runs.
- Degrade (L5): missing/unknown `zone` → render in the viewer's local zone.

### 5.3 `NotificationPort` (core `ports/`)
`schedule(id, atUtc, payload)` / `cancel(id)` / `requestPermission()`.
Adapters: Tauri notification plugin (desktop), Expo notifications (mobile),
Web Notifications (web port, best-effort). Reminder *rules* (offset before
event, task due, habit nudge) live in the owning modules; the core only fires.
Degrade: permission denied/unsupported → quiet in-app badges; never nags (L5).

### 5.4 Views & interactions (apps/web renderer)
- **Hour-grid day/week view**: time-axis columns (all-day lane on top), the
  view switcher grows Month · Week · **Timeline** · Day; drag to create,
  drag/resize to move timed events (pointer events; keyboard equivalents).
- **Agenda view**: flat upcoming list across modules (reads day records).
- **Drag & drop** in month/week: move an entry to another date = rewrite of
  that entry's date field via its module's slice.
- **Undo**: an app-level command stack (last N slice writes with inverse
  writes); `⌘Z` + a toast with "Undo". Trash/soft-delete is per-module state
  where destructive (tasks), not a core mechanism.
- **Secondary time zone + working hours** (gap analysis 2026-07-05): an
  optional second zone column on the hour grid; shaded non-working hours.
  Both additive settings — unset ⇒ today's rendering, invalid zone ⇒ the
  column quietly absent (L5). **Still open (audit 2026-07-11):** shipped in
  neither P5 nor P6 — land it during the Phase 9 wrap-up.
- *(Landed early, with meals:)* **day-entry copy/paste** — clipboard over day
  slices, `⌘C`/`⌘V` on the grid + day-panel buttons; tasks/timed events join
  the same seam here.

### 5.5 Settings & vault (apps/web renderer + core)
- **Settings surface**: week-start day, locale, time format, default reminder
  offsets — the L7 region formatting made visible; stored as its own slice.
- **Vault export/import**: full-store JSON backup (dump/restore every
  `StoragePort` key) — the pre-sync durability story; import is per-slice and
  skips corrupt entries (L5).
- **`StoragePort` contract suite**: one reusable test suite every adapter
  must pass (round-trips, `keys()` enumeration, `readMany` alignment,
  corrupt-value isolation), run against memory, localStorage, and SQLite.
  Rule from here on: **a port gets its contract suite before it gains its
  next implementation** — Expo's adapter (P11) then just inherits it.

## Phase 6 — Tasks module additions (beyond the design doc §8)
- **NL quick entry** on top of the sigil parser: "lunch with Anna tomorrow
  13:00", EN + CS, pure logic + tests (dates/times/durations; locale-aware).
- Reminders per task/event (uses 5.3), default offsets in settings.
  **Snooze/actions** on fired reminders where the platform allows — a small
  additive `NotificationPort` extension; unsupported ⇒ plain notifications.
  A **`NotificationPort` contract suite** lands with the first adapters
  (Tauri + Web Notifications) — idempotent ids, no-op cancel, denied
  permission as a normal state — so Expo's adapter (P11) inherits it.
- Recurring events use 5.1 overrides for "edit this occurrence only";
  **"this and following"** = a series *split* (core `schedule/` helper: cap
  the old rule with `until`, spawn the successor) — the third standard edit
  scope alongside "this one" and "all".
- **Multiple calendars** (gap analysis 2026-07-05): user-defined calendars
  ("Work", "Family") with a color and a visibility toggle each — the event
  shape carries `calendarId` from day one; hiding a calendar is a view
  filter, never deletion. (P12 sharing shares these same namespaces.)
- **Jump-to-date** in the command palette.

## Phase 7 — Macros + Shopping (design doc §8.1, unchanged in content) ✅
Moved after tasks (was Phase 5) so the calendar is livable-in first; both
modules ride the food kernel + meals plans: two-trigger shopping aggregation,
unit-normalized lists, macro totals from planned meals + manual logging.

Built as two independent modules (`@almanac/shopping`, `@almanac/macros`),
each importing **core + food only** — neither imports meals. They read the
planned recipe off the **shared `meals` Day field by name** (L1's shared-data
seam), never by import; the app shell composes the cross-module read. Notes:
- **Shopping** is one pure `aggregateWindow` engine behind both triggers
  (`shoppingNowWindow` ad-hoc, `scheduledWindows` recurring via core's
  recurrence). Quantities normalize to base units before folding — compatible
  merge, incompatible stay separate. The list is derived on demand, never
  stored; only the schedule persists. Session-only check-off + manual add
  (persisting per-trip state is a later pass).
- **Macros** derives intake on read: the planned meal auto-fills one serving
  (scalable/excludable) via the food kernel's `deriveRecipeNutrition`, plus a
  manual per-day log slice; targets are always editable. Sparse throughout —
  a macro shows only where something contributed it (never a hard 0).
- **§8.1 servings reconciliation:** the roadmap said "multiply ingredients by
  servings", but this repo's kernel stores recipe ingredient quantities as
  **whole-recipe** amounts (`deriveRecipeNutrition` uses them directly). So
  shopping aggregates **one recipe instance per planned occurrence** — the
  correct reading against the actual kernel; multiplying would double-count.

## Phase 8 — Interop & findability ✅
- **ICS import/export** (module `calendar-interop`): RFC 5545 parse/serialize.
  **P8-entry decision: own minimal parser** (no external dep) — the subset we
  need (VEVENT: DTSTART/DTEND/SUMMARY/RRULE/EXDATE, all-day + UTC + TZID) maps
  directly onto core's `Recurrence` + `TimedSpan`, so a dep like ical.js added
  weight and ESM friction for no gain (L3). The module is a **pure transform**
  between ICS and a neutral `CalendarEvent` DTO; it imports no other module —
  the **app** maps the DTO onto the tasks event shape and back (L1). Import
  lands events in the tasks store; export serializes any range keeping series
  intact. Degrade: a bad VEVENT is skipped + counted, garbage never throws.
- **Subscriptions**: read-only ICS feeds behind a core **`FeedPort`** (fetch;
  the app adapter uses `fetch`). The subscriptions store caches the raw ICS so
  it works offline; a failed refresh keeps the cached copy and flags it stale
  (L5). Feed events surface as read-only chips through the grid's `use-day-chips`
  seam; removing a feed drops only its entries. CalDAV two-way still deferred
  to after sync (P10).
- **Search** (module `search`): pure on-demand ranked query (title-prefix >
  title > keyword, AND across terms). The **app** assembles the corpus from
  every module's state (tasks + meals now) — a source that contributes nothing
  simply isn't searchable (L5). Folded into the ⌘K command palette below command
  matches; a dated hit jumps the calendar.
- **Year view** (12-month density grid, four-level intensity from meals + stars
  + task/event occurrences; click a day to zoom to its month) and a **print
  stylesheet** (`@media print`: light ink, chrome hidden via `data-no-print`).

## Phase 9 — Life modules (design doc §8) + productivity additions (2026-07-11)
check-in · cycle · body · workouts · weather (signal provider) · insights ·
**birthdays** (new small module: manual entries + yearly recurrence from 5.1;
platform-contacts import later behind a capability port).

Additions from the calendar-features gap analysis (2026-07-11):
- **Insights grows time allocation** alongside the health correlations: hours
  by category/calendar, meetings (busy events) vs. solo work, per week/month.
  Same seam as everything insights does — it reads the shared records across
  a range and **imports no module** (L1); no categorized/timed entries simply
  means that panel is absent (L5).
- **Planner (timeboxing) module** — deterministic auto-scheduling, no "AI":
  scores open calendar slots for unscheduled tasks by deadline pressure,
  numbered priority (D9), working hours, and existing busy blocks — the meal
  engine's exact pattern (pure logic, injected `Clock`/`Rng`, exported tuning
  constants, a per-suggestion "why this slot" breakdown like the meal panel).
  **Suggestions the user confirms — never silent moves**; when the day shifts,
  it re-suggests, it does not rearrange. Focus blocks are ordinary busy events
  the planner treats as immovable, and Almanac's own reminders are suppressed
  inside them. Chat/DND integrations (Slack etc.) are explicitly **not** part
  of this: much later, a separate **opt-in integrations module** behind ports
  (see §15 scope edges) — never core, never default.
- **Secondary-TZ leftover** from 5.4 lands during this phase's wrap-up (it
  shipped in neither P5 nor P6 — see the audit note there).

## Phase 11 — Mobile + surfaces
Expo client reusing everything; **home-screen widgets** (month glance, today
list) and **desktop tray/menu-bar mini calendar** (Tauri tray API). Native
barcode scanner (per §3).

## Phase 12 — Multi-user (decision D5; supersedes the design doc's §15 exclusion)
Builds strictly **on top of** the sync server (P10: accounts, per-slice
revisions) — every feature here is server-mediated and additive: a signed-out
or offline client keeps its full single-user behaviour (L5).

- **Shared calendars.** A calendar (a namespaced set of entries) gets a
  server-side ACL: owner / writer / reader. Sharing = the server replicating
  that namespace's slices to other accounts' pull streams; the client model is
  unchanged — shared entries arrive as ordinary slices tagged with their
  calendar id. Conflict rule stays per-slice LWW.
- **Attendees, invitations, RSVP.** Events gain an `attendees` list. In-app
  invites ride sync (an invite record → the invitee's stream); external
  invitees get **iMIP email invites** (the RFC 5546 flow), reusing P8's ICS
  serializer. RSVP state lands back on the event. Degrade: no email adapter
  configured → invites are copy-link/manual export.
- **Invite whitelist (auto-accept).** A per-account list of trusted senders.
  An incoming invite from a whitelisted person skips the pending state: it is
  **auto-accepted onto the calendar** (RSVP yes sent), marked with a quiet
  "added automatically" indicator so it's visible it wasn't hand-confirmed.
  Off by default; per-person entries, revocable any time (revoking stops
  future auto-accepts, never retro-deletes events). Conflicts don't block it —
  an auto-accepted event that collides with an existing one is still added,
  with the standard overlap rendering flagging it.
- **Free-busy & find-a-time.** Accounts can expose availability (busy blocks
  only — no titles/details) per share-grant; the picker overlays attendees'
  busy blocks to suggest slots. Privacy default: nothing exposed until a grant
  is made explicitly.
- **Booking pages.** A public server endpoint per user: choose from published
  availability windows → creates a pending event + invite. Rate-limited,
  revocable link. Availability respects **buffer periods** between bookings
  and a **per-day booking limit** (both per-page settings, 2026-07-11); a
  slot that violates either simply isn't offered.
- **Focus-time auto-decline.** A focus block is an ordinary `busy` event; a
  per-account rule auto-declines incoming invites that collide with one — the
  same pipeline as the invite whitelist, inverted, with the standard quiet
  declined status on the sender's side. Off by default; whitelist wins over
  auto-decline when both match (an explicitly trusted person outranks a
  blanket rule).
- **Conferencing links.** A `conferenceUrl` field on events (rendered as a
  join button) from day one of P12; provider integrations (auto-create
  Meet/Zoom) later behind a port, if ever.

Boundary note: all client logic lands as modules/UI over core seams (L1–L3
hold); the substantial new surface here is **server-side** (ACLs, invite
routing, availability, booking) — spec that service at P12 entry.

---

## Degradation matrix (L5) — acceptance criteria, not prose

Per design §9/§12: every feature below ships **with tests proving its degraded
state** — defined, working, and quiet (no nags, no blank screens, no cascading
failures). A feature is not done until its row here is demonstrably true.

### Phase 5 — calendar core v2

| Feature | Failure / absence | Degraded state |
|---|---|---|
| Recurrence v2 | malformed rule or dates | `[]`, never throws (as v1) |
| Instance overrides | corrupt/unknown-version override record | that override is ignored; the base series renders intact — an override can *never* take down its series |
| Instance overrides | override referencing a non-occurrence | inert, skipped |
| Timed events | unknown/missing IANA zone | render in the viewer's local zone |
| Timed events | end before start / invalid span | treated as an all-day entry on the start date; flagged in the editor, never dropped |
| Multi-day spans | span crosses a corrupted day slice | the span renders (it derives from the event, not the day slice); only that day's other content defaults |
| `NotificationPort` | permission denied / platform unsupported | quiet in-app badges + agenda emphasis; asks once, never nags |
| `NotificationPort` | app closed at fire time (web port) | missed reminders listed quietly on next open, then cleared |
| Hour-grid view | entry with no time | all-day lane at the top |
| Hour-grid view | overlapping events | side-by-side packing; nothing is ever hidden behind something else |
| Drag & drop | slice write fails on drop | optimistic move stands for the session (same contract as every write); pointer unavailable → keyboard move (cut/paste style) always exists |
| Undo | inverse write fails / stack lost on reload | that undo entry is dropped quietly; undo is best-effort session state, never a data authority |
| Settings | settings slice corrupt/absent | locale + formatting defaults (EN, Intl-derived region); the app never blocks on settings |
| Vault import | corrupt entries / unknown-version slices in the file | valid slices import, bad ones are skipped and counted; never aborts the file |
| Copy/paste | empty clipboard / copying an empty day | quiet no-op; paste write failure degrades to session-only (as every write) |
| Secondary TZ column | zone unset or invalid | the column is simply absent; the primary grid is untouched |

### Phases 6–9 — tasks, macros + shopping, interop, life modules

| Feature | Failure / absence | Degraded state |
|---|---|---|
| NL quick entry | unparseable/ambiguous text | item is created with the raw text as title, no date — entry is **never blocked** by the parser; sigils still apply |
| Reminders | no notification adapter | in-app due indicators only |
| Reminder snooze/actions | platform doesn't support actions | plain notifications; snooze absent, never broken |
| Multiple calendars | entry carries an unknown `calendarId` | rendered on the default calendar, never dropped |
| Multiple calendars | calendar hidden | a view filter — entries stay stored, reminders still fire unless the calendar is muted explicitly |
| Series split ("this and following") | split write fails midway | the original series stands untouched; the split is atomic-or-nothing |
| ICS import | unparseable components | skipped and counted ("imported 34, skipped 2"), never aborts the file |
| ICS import | oversized file | chunked with partial-import progress; cancel keeps what's in |
| Subscriptions | offline / feed 404 / parse error | last cached copy, with a quiet staleness hint; feed removal deletes only that feed's entries |
| Search | module registered no text extractor | that module's data simply isn't searchable |
| Search | index build failure | empty results + silent rebuild on next query; search never blocks the app |
| Year view / printing | no data / print of empty range | renders the grid/pages anyway (empty state is the most common state) |
| Birthdays | contacts permission denied | manual entries only — the module's full core behaviour |
| Planner | no open slot fits a task | the task stays on the list, unscheduled and unnagged — a full day is a normal day |
| Planner | the day shifts under confirmed blocks | re-suggests only; confirmed placements are never silently moved |
| Insights (time allocation) | no categorized/timed entries in range | that panel is simply absent |

### Phase 12 — multi-user (every feature additive on top of a working single-user app)

| Feature | Failure / absence | Degraded state |
|---|---|---|
| All of P12 | signed out / no account / offline | full single-user behaviour; multi-user affordances simply absent |
| Shared calendars | server unreachable | last-synced shared entries stay visible; local edits queue and reconcile LWW on reconnect |
| Shared calendars | grant revoked / calendar deleted by owner | that calendar's entries vanish cleanly on next pull; nothing else is touched (slice isolation) |
| Invites | recipient not on the platform, no email adapter | copy-link / manual `.ics` export |
| Invites | email delivery failure | quiet "not delivered" status on the attendee row — never a modal |
| RSVP | conflicting updates | per-attendee-record LWW, silent |
| Invite whitelist | whitelist slice unavailable / corrupt | invites fall back to the normal pending flow (fail-closed: never auto-accept on uncertainty) |
| Invite whitelist | sender ambiguous / spoof-suspect (email mismatch) | treated as not whitelisted → pending flow |
| Invite whitelist | auto-accepted event collides with existing plans | still added + standard overlap flag; auto-accept never silently drops or double-books invisibly |
| Focus auto-decline | rule slice unavailable / corrupt / sender also whitelisted | falls back to the normal pending flow (fail-open to human review — never a silent decline on uncertainty; whitelist outranks the blanket rule) |
| Free-busy | attendee granted nothing | shown as "unknown"; find-a-time suggests from what it has; zero grants → the picker is a plain manual picker |
| Booking page | slot taken concurrently | server validates at confirm; second booker gets an immediate re-suggest, owner sees one booking |
| Booking page | link revoked | tombstone page; owner's app unaffected |
| Conference links | malformed URL | rendered as plain text, no join button |

Cross-cutting (unchanged from §9): any module absent → the calendar renders
without it; any storage slice corrupt → that slice defaults in isolation; every
external call sits behind a port; every empty state is actionable.

## Decide-at-phase-entry markers
- **P5 entry:** confirm 5.1/5.2 contracts (they're proposals until then).
- **P6 entry (before the first event is persisted):** decide sync **delete
  semantics** — per-slice LWW needs deletion modeled (tombstones or a
  deleted-at field that participates in LWW), or a stale device resurrects
  deleted entries at P10. Cheap to decide now, a migration tax later.
- **P6 entry, event shape (gap analysis 2026-07-05 — reserve now, UI later):**
  `calendarId` (+ per-calendar color), **busy/free transparency** and
  **visibility** flags (P12 free-busy depends on them), an optional
  **location** field. Attachments are deliberately deferred — their storage
  story arrives with sync (P10+).
- **P8 entry:** ~~pick the ICS strategy~~ **decided: own minimal parser** — the
  needed subset maps straight onto core's `Recurrence`/`TimedSpan`, so a dep
  added weight + ESM friction for no gain (module stays core-only, L3).
- **P10 entry:** spec the sync envelope + service before client wiring —
  revision semantics, clock-skew stance on modified-at, tombstone GC, key
  enumeration; the P6 delete decision becomes acceptance criteria here.
- **P11 entry:** decide **React-Native-Web component sharing** explicitly
  (the design doc allows it, never at the cost of L1) — if shared UI is
  adopted, add the boundary-lint rule for that package *then*; shared logic
  is already fork-proof (L1/L3 lint keeps `Platform.OS` unreachable).
  Write the **capability-port contract suites** (barcode/camera) here,
  before their first implementation. Mobile test stack: shared logic stays
  Node-tested; jest-expo component tests per view; Maestro E2E on
  emulators (nightly) incl. the L5 permission/offline rows; TestFlight +
  Play internal track for device beta.
- **P12 entry:** spec the server service (ACL model, invite routing,
  availability, booking endpoint) before client work — including the failure
  rows above as server acceptance criteria.
