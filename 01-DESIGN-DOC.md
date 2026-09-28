# Market Ops Command Dashboard — Design Doc

Status: draft v1 · Owner: Production Support Engineering · Last updated: 2026-08-18

## 0. How to use this doc

This is written to be read by both engineers and an AI coding assistant that will
modify an **existing** UI codebase. Every section that touches layout ends with a
`### Grafting onto the current UI` note — fill these in once the current UI's
source is shared; until then, treat this as the target spec to diff against.

---

## 1. Purpose

A single always-on screen for the production support desk that removes the mental
overhead of:

- "What time is it, really, and is this screen's clock even right?"
- "What phase of the market are we in right now, and when's the next transition?"
- "Who is on shift right now, and who do I escalate to?"
- "What's outstanding, and who owns it?"

It runs on a wall-mounted display or a pinned browser tab, 24×7, across all three
shifts, on desk hardware nobody reboots often.

## 2. Requirements traceability

| Brief requirement | Module |
|---|---|
| Live index market feed | `market-data-proxy` + `IndexTicker` |
| Wall clocks synced to IST | `time-sync-engine` + `WallClock` |
| Multi-market (IST/US/Korea) clock carousel, auto-surfaces the live one | `time-sync-engine` + `MarketClockCarousel` (§5.4) |
| Live market timeline, pre-open → CAS → post-close, voice notifications | `market-schedule-engine` + `SessionTimeline` + `voice-notification-engine` |
| 3-shift rota, avatar/name/designation | `roster-service` + `ShiftRoster` |
| Live task list, role-based click-to-complete, per-shift, MongoDB audit trail | `task-board-service` + `TaskBoard` (§9.5) |
| Sleek modern tabbed UI | `AppShell` + design system (§4) |
| Background animates with real IST sky colour | `sky-engine` (§5) |

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                     │
│  AppShell (tabs, header, sky background)                         │
│  ├─ Overview   (multi-market clock carousel, index ticker,       │
│  │              session badge, live task snapshot)                │
│  ├─ Timeline    (SessionTimeline, phase-card strip, voice log)   │
│  ├─ Roster      (ShiftRoster, current-shift highlight)            │
│  └─ Tasks       (three shift-scoped TaskBoards, RBAC)             │
│                                                                    │
│  state: Zustand stores — time, schedule, feed, roster, tasks     │
│  transport: React Query (REST) + Socket.IO client (live push)    │
└───────────────┬─────────────────────────────┬────────────────────┘
                │ REST/WS                      │ REST/WS
┌───────────────▼──────────────┐  ┌───────────▼────────────────────┐
│  market-data-proxy (Node)     │  │  ops-api (Node/Express)         │
│  - live feed adapters         │  │  - schedule engine               │
│  - Redis cache (tier 2)       │  │  - roster CRUD                   │
│  - simulator (tier 3)         │  │  - task board + RBAC             │
│  - Socket.IO broadcast        │  │  - event/audit writer            │
└───────────────┬───────────────┘  └───────────┬─────────┬──────────┘
                │                               │         │
        external index feed          Postgres (roster,  MongoDB
        (vendor / exchange API)      tasks, shifts,      (append-only
                                      users, roles —      event log —
                                      current-state,      task completions,
                                      relational)         session transitions,
                                                 │         handovers; see §9.5)
                                              Redis (cache, pub/sub,
                                              session store)
```

Two backend services rather than one monolith, because they have different risk
profiles: `market-data-proxy` talks to an external vendor and must degrade
gracefully; `ops-api` holds people/task data and must be strongly consistent and
auditable. They can start as one Express app with two route namespaces and split
later if load requires it — don't over-engineer the split on day one.

`ops-api` now writes to **two** stores, deliberately: Postgres holds
*current-state, relational* data (who exists, what shift they're on, what a
task's live status is) where joins and strong consistency matter. MongoDB
holds the *append-only event log* (who completed what and when, every
session transition, every handover acknowledgment) — schemaless-by-design
data that varies shape across checklist types, is written far more than it's
queried, and never needs a join. See §9.5 for the concrete collections.

### 3.1 Frontend stack
- React 18 + Vite + TypeScript
- Tailwind CSS (utility layer) + a small `tokens.css` for the design system (§4)
- Zustand for client state, React Query for server cache
- Socket.IO client for live pushes (index ticks, session transitions, task updates)
- Framer Motion for orchestrated transitions (tab switch, timeline sweep, sky fade,
  clock-carousel page turns — see §5.4)
- Hand-rolled SVG for clocks and the sun/moon indicator (no chart-lib overhead for
  something this simple)
- Web Speech API (`speechSynthesis`) for voice notifications, with a pre-recorded
  audio-sprite fallback (see §10)

### 3.2 Backend stack
- Node.js 20 LTS + Express
- Socket.IO server
- Postgres (roster, shifts, tasks/checklists, users, roles) — this is
  current-state, relational data; use a real RDBMS with migrations, not a
  JSON file
- **MongoDB** (append-only event log: task completions, session transitions,
  handover acknowledgments — see §9.5). Chosen over adding more Postgres
  tables specifically for this data because event records vary in shape by
  event type and the access pattern is write-heavy/append-only with
  occasional bulk reads (audit export), not joins — a natural document-store
  fit rather than forcing every event type into one rigid relational schema.
- Redis (feed cache, pub/sub fan-out to multiple app server instances, session
  store)
- `node-cron` (or a small internal scheduler) for session-transition triggers and
  daily roster rollover

### 3.3 Data stores
- **Postgres** (current-state, relational): `personnel`, `shifts`,
  `shift_assignments`, `shift_checklists` (versioned checklist templates per
  shift, §9.5), `tasks` (live status per checklist item), `users`, `roles`
- **MongoDB** (append-only event log, §9.5): `task_completion_events`,
  `session_transition_events`, `handover_events` — or one `ops_events`
  collection with a `type` discriminator if a single collection is
  operationally simpler to start with; either is fine, don't over-design this
  before there's real write volume to see the access pattern against
- **Redis**: `feed:{symbol}:latest`, `feed:{symbol}:cache` (tier 2, TTL'd),
  socket room membership, rate-limit counters

---

## 4. Visual design system

### 4.1 Direction

This is a control-room instrument, not a marketing page — it will sit on a TV in a
NOC for 24 hours a day. Two things follow from that:

1. **Legibility must survive the background changing under it.** The brief asks
   the background to go from dark (night) to light (morning) — but numbers on the
   screen (prices, statuses, names) must stay equally readable at 3 AM and 11 AM.
   Resolution: content lives in **frosted glass panels** (dark, semi-transparent,
   blurred) that float over the sky, so the panels' text colour never has to
   change — only the ambient light behind them does. This is the same trick
   weather apps use to let a background photo change dramatically while the
   forecast text stays legible.
2. **The aesthetic borrows from trading-terminal heritage** (Bloomberg/Reuters
   amber-and-cyan-on-black), because that's the actual vernacular this audience
   already reads fluently under pressure — not a generic SaaS dashboard look.

### 4.2 Colour tokens

| Token | Hex | Use |
|---|---|---|
| `--void` | `#0B0E14` | Panel fill base (before opacity) |
| `--panel` | `rgba(11,14,20,0.62)` | Card/panel background |
| `--panel-border` | `rgba(255,255,255,0.08)` | Card hairline border |
| `--text-hi` | `#E6E8EB` | Primary text |
| `--text-lo` | `#8A94A6` | Secondary/meta text |
| `--signal-amber` | `#FFB020` | Primary accent — live/active state, current session |
| `--signal-cyan` | `#4FD9D0` | Secondary accent — informational, links, sync status |
| `--confirm-green` | `#33D17A` | Completed, on-duty, healthy feed |
| `--alert-red` | `#FF4D5E` | Breach, overdue task, feed down |
| `--warn-orange` | `#FF9F45` | Approaching transition, task due soon |

Sky gradient colours are computed at runtime (§5.3), not hardcoded design tokens —
they're the one part of the palette that's alive.

### 4.3 Typography
- Display/data face: **IBM Plex Mono** — used for all numbers: clocks, prices,
  countdowns. Monospace so digits don't jitter the layout as they tick.
- UI face: **IBM Plex Sans** — labels, names, nav, body copy. Same type family as
  the mono, different optical role — deliberate pairing, not two unrelated fonts.
- Scale: 12 / 14 / 16 / 20 / 28 / 44 / 64px. The 64px size is reserved for the
  primary IST clock only — it should be the single largest thing on screen.

### 4.4 Layout grid
- Fixed-viewport app shell (`100vh`, no page scroll) — this is a wall display,
  not a scrolling page. Individual panels (e.g. task list) scroll internally if
  they overflow.
- 12-column CSS grid, 24px gutter, 24px page margin.
- Header: 88px fixed height. Tab bar: 52px. Content: remaining height.

### 4.5 Signature element: physically-modeled sky

Rather than a hard-coded "if hour < 6, dark" lookup, the background is driven by
the **actual solar elevation angle** at the desk's configured coordinates (default:
Mumbai, 19.076°N 72.877°E — override via config for another city), computed
client-side from the synced clock every render tick, and mapped through twilight
phase boundaries astronomers already use (astronomical/nautical/civil twilight,
golden hour, day). A small sun/moon glyph in the header rises and sets in sync
with that same number, so the "why does the background look like this" question
always has a literal, visible answer. Full algorithm in §5.2.

### 4.6 Motion principles
- Sky colour transitions are **slow and continuous** (CSS transition on the
  gradient stops, ~90–120s ease) — recomputed every 60s, never a hard cut.
- Tab switches: 180ms crossfade + 8px slide, Framer Motion, respects
  `prefers-reduced-motion`.
- Timeline "now" marker moves continuously via `requestAnimationFrame`, not on a
  polling interval — it should never visibly jump.
- No decorative animation beyond the sky, the timeline sweep, and status-change
  micro-feedback (a 400ms flash on a task moving to Completed). Everything else
  is still. A 24-hour ambient display earns restraint, not spectacle.

### Grafting onto the current UI
Once shared, map: does the current UI already use Tailwind? A component library
(shadcn, MUI)? Keep whatever's already there for structure and layer `tokens.css`
+ font imports on top rather than re-architecting CSS wholesale — the fastest,
lowest-risk path is usually "restyle in place," not "rebuild."

---

## 5. IST time & sky engine

### 5.1 Clock sync strategy

Browser system clocks on desk machines drift and are sometimes just wrong. Don't
trust `new Date()` alone for a wall clock whose entire purpose is being provably
correct.

1. On load, and every 5 minutes, the client calls `GET /api/time` on the backend.
2. Backend responds with server time in the response body **and** measures its
   own NTP offset against a public NTP pool (or simply trusts the host if the
   host itself is NTP-synced, which it should be — verify with the infra team).
3. Client computes round-trip time `rtt` and offset `Δ = serverTime - (t0 + rtt/2)`
   (standard NTP-style offset estimation, t0 = request send time).
4. All displayed clocks read `Date.now() + Δ`, recomputed continuously via
   `requestAnimationFrame`, not `setInterval` (avoids visible stutter/drift from
   throttled background tabs).
5. Show a small sync badge (`SYNCED` / `RESYNCING` / `STALE — check network`) so
   support staff never have to wonder if the clock they're staring at is trustworthy.
6. Render every wall clock in `Asia/Kolkata` explicitly via
   `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ... })` — never rely
   on the OS timezone setting of the display machine.

### 5.2 Solar position algorithm

Simplified NOAA solar-position formulas — accurate to a fraction of a degree,
which is more than enough for a background gradient:

```
given: date (with correct time via §5.1), lat, lon (degrees), tzOffsetHours (5.5 for IST)

dayOfYear   = day number in year
γ (gamma)   = 2π/365 × (dayOfYear - 1 + (hour - 12) / 24)          // fractional year, radians

eqTime      = 229.18 × (0.000075 + 0.001868 cos γ − 0.032077 sin γ
              − 0.014615 cos 2γ − 0.040849 sin 2γ)                 // minutes

decl        = 0.006918 − 0.399912 cos γ + 0.070257 sin γ
              − 0.006758 cos 2γ + 0.000907 sin 2γ
              − 0.002697 cos 3γ + 0.00148  sin 3γ                  // radians

timeOffset  = eqTime + 4 × lon − 60 × tzOffsetHours                // minutes
trueSolarTime = hour×60 + minute + second/60 + timeOffset          // minutes
hourAngle   = trueSolarTime / 4 − 180                               // degrees

elevation   = asin( sin(lat) sin(decl) + cos(lat) cos(decl) cos(hourAngle) )  // radians → convert to degrees
```

`elevation` in degrees is the single number that drives everything else.

### 5.3 Gradient keyframe table

| Elevation | Phase | Gradient (top → bottom) |
|---|---|---|
| ≤ −18° | Night | `#02040A → #050810 → #0A0E1A` |
| −18° to −12° | Astronomical twilight | `#050912 → #0D1226 → #161A35` |
| −12° to −6° | Nautical twilight | `#0D1230 → #241B4D → #3A1F52` |
| −6° to −0.83° | Civil twilight / dawn or dusk | `#241B4D → #6B2A5C → #C9526B` |
| −0.83° to 6° | Sunrise / sunset | `#4A2A6B → #E0637A → #FFA76B` |
| 6° to 20° | Golden/morning light | `#3F6FAE → #F3A866 → #FFD39A` |
| > 20° | Full day | `#1E5FA8 → #4A90D9 → #BFE0F5` |

Interpolate linearly (per RGB channel) between the two nearest keyframes by
elevation, not a hard switch — this is what makes it feel alive rather than a
slideshow. Recompute every 60s; let CSS handle the 90–120s crossfade between
values so the transition itself is imperceptibly gradual, matching the brief's
"gradually animates" requirement.

### Grafting onto the current UI
This engine is UI-framework-agnostic — it's pure math producing a CSS gradient
string. Drop it in as a `useSkyGradient()` hook (or equivalent) that returns
`{ background, sunElevation, phaseLabel }`, and apply `background` to the
outermost app-shell element behind the existing layout, wherever that element
currently is.

### 5.4 Multi-market clock carousel

The primary wall clock stays IST, full stop (§5.1.6) — but the desk also
needs to glance at "is any other tracked market live right now" without a
second screen. This is a small, self-contained feature that pulls a slice of
the §17 multi-market roadmap into the current build: not live index data for
US/Korea (that's still future work), just **clocks + session state** for
three markets.

**UI**: a three-page swipeable card in the Overview sidebar — one page per
market (India/NSE, US/NYSE, Korea/KRX) — styled like pages of a book fanning
out (`rotateY` tilt + `translateX` on the adjacent pages, full opacity/no
rotation on the active page). Dots + prev/next controls for manual paging.

**Auto-surface rule**: if the IST market is closed and exactly one other
tracked market is in its trading session, the carousel automatically flips to
that market's page and a live badge appears both on the card and as a
persistent chip in the header (visible regardless of which tab is open) —
e.g. at 00:30 IST, NSE is closed but NYSE is still trading (until ~01:30–02:30
IST depending on US DST), so the carousel surfaces "US Market Live Now."
Priority order when more than one market could apply: IST first (if open,
always show it — it's the desk's home market), then whichever of US/Korea is
open.

**Manual override**: swiping/tapping a page pins it and stops auto-follow: a
small "AUTO" pill returns to following the live market immediately, and
auto-follow also resumes on its own after a short idle period (mirrors the
non-takeover pattern already established for auto tab-switch in §11).

**Session-state simplification for non-home markets**: unlike the NSE state
machine in §6 (full pre-open/CAS/post-close phase model), US and Korea only
need a binary "in session / not in session" signal for this feature — driven
by each market's local time via `Intl.DateTimeFormat` with that market's IANA
timezone, compared against its continuous trading window. This intentionally
does **not** implement each exchange's own holiday calendar yet — see the
open assumption added in §16. If NYSE/KRX pre-market or after-hours sessions
ever need their own labelled phases (not just open/closed), extend this the
same way §6 was built: config-driven session windows per market, not
hardcoded per-market conditionals.

### Grafting onto the current UI
If the current UI's clock component is a single element, this is additive —
wrap it in a 3-page carousel rather than replacing the IST-rendering logic,
so the "always explicit `Asia/Kolkata`" rule in §5.1.6 keeps holding for
whichever page is showing IST.

---

## 6. Market schedule engine

### 6.1 Current NSE cash-segment session structure

Verified against NSE's Closing Auction Session rollout, effective **3 Aug 2026**
(SEBI circular HO/47/11/11(3)2025-MRD-POD2/I/2765/2026). This changes again in a
second phase (pre-open session framework) from **7 Sep 2026**, and is scoped to
F&O-eligible ("Category I") stocks in phase 1 — so treat every timestamp below as
**config, not code**, and revisit this table when NSE issues the next circular.

| Session | Window (IST) | Notes |
|---|---|---|
| Pre-open (order collection) | 09:00 – 09:08 | |
| Pre-open (order matching) | 09:08 – 09:12 | |
| Pre-open buffer | 09:12 – 09:15 | |
| Normal / continuous market | 09:15 – 15:15 (CAS securities) / 09:15 – 15:30 (non-CAS) | Two close times now coexist |
| Closing Auction Session (CAS) | 15:15 – 15:35 | F&O-eligible ("Category I") stocks only, phase 1 |
| Equity derivatives (F&O) trading | 09:15 – 15:40 | Extended 10 min to hedge auction fills |
| Post-close session | 15:50 – 16:00 | Trades at the CAS-determined official close |
| Trade modification cut-off | until 16:15 | |

Non-CAS ("Category II") securities keep the pre-2026 structure: continuous
trading to 15:30, close via 15:00–15:30 VWAP.

### 6.2 State machine

```
HOLIDAY → PRE_OPEN_COLLECT → PRE_OPEN_MATCH → PRE_OPEN_BUFFER → NORMAL
  → CAS_WINDOW → POST_CLOSE → MODIFICATION_WINDOW → CLOSED → (next day) HOLIDAY|PRE_OPEN_COLLECT
```

Each transition is a discrete event the scheduler emits (`session:transition`)
carrying `{ from, to, at, label }` — the voice engine (§10) and the timeline UI
both just subscribe to this stream; neither hardcodes times itself.

### 6.3 Config schema

```json
{
  "market": "NSE_EQUITY",
  "timezone": "Asia/Kolkata",
  "sessions": [
    { "id": "PRE_OPEN_COLLECT", "label": "Pre-Open · Order Collection", "start": "09:00", "end": "09:08" },
    { "id": "PRE_OPEN_MATCH",   "label": "Pre-Open · Matching",         "start": "09:08", "end": "09:12" },
    { "id": "PRE_OPEN_BUFFER",  "label": "Pre-Open · Buffer",           "start": "09:12", "end": "09:15" },
    { "id": "NORMAL",           "label": "Normal Market",               "start": "09:15", "end": "15:15" },
    { "id": "CAS_WINDOW",       "label": "Closing Auction Session",     "start": "15:15", "end": "15:35" },
    { "id": "POST_CLOSE",       "label": "Post-Close Session",          "start": "15:50", "end": "16:00" },
    { "id": "MODIFICATION",     "label": "Trade Modification Window",   "start": "16:00", "end": "16:15" }
  ],
  "voiceAnnouncements": { "PRE_OPEN_COLLECT": true, "NORMAL": true, "CAS_WINDOW": true, "POST_CLOSE": true, "CLOSED": true }
}
```

Store this in Postgres (or even a versioned JSON file to start) behind an admin
edit screen — when NSE issues the next circular, production support should be
able to update session times **without a deploy**.

### 6.4 Holiday handling
- Maintain an `exchange_holidays` table seeded from NSE's published trading
  holiday list per calendar year; re-import annually.
- On a holiday, the state machine short-circuits straight to `HOLIDAY` and the
  timeline renders a distinct "Market Closed — Holiday: {name}" state instead of
  the phase bar.

### Grafting onto the current UI
The v1 prototype mentioned in your brief already has session/schedule logic —
port its holiday list and any session-time constants into this config schema
rather than re-deriving them, and keep the state-machine event names stable so
existing sound-notification wiring can be reused with minimal changes.

---

## 7. Live index data proxy

### 7.1 Three-tier fallback
1. **Live**: fetch from the configured vendor/exchange feed (NIFTY 50, SENSEX,
   BANK NIFTY, INDIA VIX, plus optional ES futures / KOSPI per the future
   multi-market roadmap). Cache every successful tick into Redis with a short
   TTL.
2. **Cached**: if the live call fails or times out (>2s), serve the last good
   Redis value and mark it `stale` in the payload with `asOf` timestamp — the UI
   shows a visible "stale" badge, never silently shows old data as live.
3. **Simulated**: if there's no cached value either (cold start, extended vendor
   outage), serve a deterministic random-walk simulator seeded from the last
   known real close, clearly labeled `SIMULATED` in the payload and in the UI
   (amber diagonal-stripe badge on the ticker card) — this exists so the
   dashboard is still demonstrable/testable outside market hours or feed
   contracts, never to disguise a real outage as real data.

### 7.2 Contract

```
GET  /api/indices                 → snapshot of all tracked symbols
GET  /api/indices/:symbol/history?range=1d
WS   channel "indices"            → { symbol, price, change, changePct, source: "live"|"cached"|"simulated", asOf }
```

### 7.3 Caching & rate limits
- Poll vendor at whatever interval its contract allows (commonly 1–5s for
  indices); never let client tab count multiply upstream calls — the proxy
  fetches once and fans out via Socket.IO/Redis pub-sub to all connected
  clients.
- Backoff + circuit breaker on repeated vendor failures (e.g. open circuit after
  5 consecutive failures, half-open retry every 30s) so a vendor outage doesn't
  turn into a self-inflicted DoS.

---

## 8. Shift roster module

### 8.1 Data model

```
personnel(id, full_name, designation, gender_avatar, employee_code, active)
shifts(id, name, start_time, end_time)              -- "Morning 07:00-16:00" etc.
shift_assignments(id, personnel_id, shift_id, date, role)
```

`gender_avatar` drives which of two simple SVG avatar sets renders (no photos —
avoid real headshots on a shared always-on screen; simple illustrated avatars
sidestep both a photo-management burden and any privacy/consent question).

### 8.2 Shift configuration

| Shift | Window | Overlap |
|---|---|---|
| Morning | 07:00 – 16:00 | 07:00–08:00 with Night (handover) |
| Evening | 14:00 – 23:00 | 14:00–16:00 with Morning (handover) |
| Night | 23:00 – 08:00 | 07:00–08:00 with Morning (handover) |

The two overlap windows aren't a scheduling error — read them as deliberate
handover buffers. Keep them in the model explicitly (`is_handover_window` on the
UI, not silently computed) so the roster view can show "Handover in progress"
rather than looking like two people are double-booked by mistake.

### 8.3 UI spec
- Three columns, one per shift, each headed with the shift name + time range.
- Each person: avatar, name, designation, a live `ON DUTY` / `UPCOMING` /
  `OFF` pill computed from current IST time vs. that shift's window.
- During a handover window, both relevant shifts get a subtle amber
  "Handover" ribbon rather than a hard on/off cut.
- The column matching the single "current shift" (§9.5's tie-broken
  definition, since two shifts can both show `ON DUTY` during a handover
  window) gets a distinct highlight — border glow + a small "Current shift"
  ribbon — so it's unambiguous which shift's tasklist the Tasks tab is
  currently following.

---

## 9. Task board & RBAC

### 9.1 Data model

**Postgres** (current-state, relational — the live board):
```
shift_checklists(id, shift[morning|evening|night], version, effective_from,
      items_json)  -- versioned checklist template per shift, editable without
                    -- a deploy (same pattern as §6.3's session config)

tasks(id, shift_checklist_item_id, shift[morning|evening|night], process,
      scheduled_time, mode[auto|manual|auto_manual|partial_auto], executor,
      priority[low|med|high|critical], assigned_role,
      status[open|in_progress|completed], created_at, due_at)
      -- "completed_by/completed_at" deliberately NOT stored here anymore —
      -- that's now in the MongoDB event log (9.5), so the current-state row
      -- only ever answers "what's the status right now," never "who did it
      -- and when," which prevents the two stores from disagreeing.

users(id, name, role, personnel_id)
roles(id, name)   -- e.g. L1 Support, L2 Support, Shift Lead, Admin
```

**MongoDB** — see §9.5 for the append-only completion/audit event log that
replaces the old single-store `task_events` table.

### 9.2 Permission matrix

| Action | L1 Support | L2 Support | Shift Lead | Admin |
|---|---|---|---|---|
| View tasks | ✅ | ✅ | ✅ | ✅ |
| Complete task assigned to own role | ✅ | ✅ | ✅ | ✅ |
| Complete task assigned to another role | ❌ | ❌ | ✅ | ✅ |
| Create/edit/delete task | ❌ | ❌ | ✅ | ✅ |
| Edit roster / schedule config | ❌ | ❌ | ❌ | ✅ |

Enforce this **server-side** on the PATCH endpoint, not just by hiding the
button client-side — the client-side hide is a UX nicety, the API check is the
actual control.

### 9.3 Status lifecycle & audit
`OPEN → IN_PROGRESS → COMPLETED` (or `OPEN → COMPLETED` directly for quick
items). The `tasks` row's `status` column is updated in Postgres for fast
reads; every transition *also* appends an event to MongoDB (§9.5) carrying
who/what/when — this is a finance production-support system, so "who marked
this done and when" needs to survive an audit request, not just live in the
current-state row.

### 9.4 Click-to-complete flow
1. User clicks the status pill.
2. Client checks role locally for instant UI feedback (optimistic).
3. `PATCH /api/tasks/:id { status: "completed" }` fires; server re-validates
   role server-side.
4. Server writes the new status to the Postgres `tasks` row, then appends a
   completion event to MongoDB (`task_completion_events`, §9.5) — do the
   Postgres write first and treat the Mongo write as best-effort-but-logged
   (retry queue on failure) so a transient Mongo hiccup never blocks someone
   from completing a task; alert if the Mongo write backlog grows, since a
   gap here is an audit gap.
5. On success, Socket.IO broadcasts the update to every connected screen so all
   shift desks see the same state without a refresh.
6. On rejection (role mismatch, task already completed by someone else), roll
   the optimistic update back and toast the reason.

### 9.5 Shift-scoped checklists, dynamic display, and the MongoDB event log

The task board is really **three checklists, one per shift** (Morning,
Evening, Night), not one flat list. Each shift's checklist is its own
versioned template — same pattern as the session config in §6.3, so ops can
update a checklist (add/remove/re-time a step) without a deploy.

**Dynamic display**: the Tasks tab auto-selects whichever shift is currently
on duty, reusing the same shift-window logic already defined for the roster
(§8.2) — no separate "what time is it" check duplicated for tasks vs. roster.
A manual tab click pins a different shift for browsing (e.g. a Shift Lead
checking what the next shift has queued up); an "Auto" control returns to
following the live shift, mirroring the non-takeover pattern in §11. The
Roster tab gets the same treatment: the column matching the current shift is
visually highlighted, so "who's on now" and "what's their checklist" are
never ambiguous even while someone's actively browsing a different shift's
view.

**Checklist item shape** differs a little from the original single-role task
model, since real ops checklists (like the Evening example below) are closer
to a runbook table than a freeform to-do:

```
shift_checklists item shape (stored as items_json in the Postgres table
above, one version per shift):
  { process, scheduled_time, mode[auto|manual|auto_manual|partial_auto],
    executor, assigned_role, priority }
```

`mode` and `executor` are carried through from the source runbook (e.g.
"Auto · ControlM", "Manual · EOD Team") mainly for display/context; RBAC still
gates on `assigned_role` exactly as in §9.2 — an automated ControlM job still
has a human owner responsible for acknowledging it ran.

**MongoDB event model** (this is the "who completed what, saved to Mongo"
piece):

```
task_completion_events {
  _id, task_id, shift, process, completed_by, completed_by_role,
  completed_at, checklist_version
}
```

Written by `ops-api` on every completion (§9.4 step 4), never mutated after
the fact — if a completion needs correcting, that's a new event
(`re-opened` / `corrected`) referencing the original, not an edit to the
original document. This is what makes it hold up as an audit trail rather
than just a status cache.

**What else belongs in MongoDB, following the same reasoning** (append-only,
variable shape, write-heavy, no joins needed):
- `session_transition_events` — every `session:transition` the schedule
  engine (§6.2) emits, currently only shown live in the Timeline tab's
  announcement log (§10) and lost on refresh; persisting it gives "prove the
  CAS transition fired at 15:15:03 on 12 Aug" for an audit request, the same
  way task completions do.
- `handover_events` — an explicit ack when a Shift Lead signs off the
  handover ribbon (§8.2/§8.3) rather than just a UI state that resets; useful
  both for audit and for catching a handover that never got acknowledged.
- Optionally, auth login/logout events, if the eventual SSO/JWT integration
  (§7 Implementation Plan Phase 7) doesn't already log these upstream —
  don't duplicate if the identity provider is already the system of record.

Whether these live in one `ops_events` collection with a `type` field or
separate collections per event type is an implementation choice, not a design
one — start with whichever is less code and revisit if query patterns
diverge.

### Appendix 9.A — Evening shift checklist (source content)

Captured here as the versioned source-of-truth content for the Evening
`shift_checklists` row (§9.5), reconstructed from the ops runbook. A few
rows (marked below) were flattened in the source paste and reconstructed —
worth a quick line-by-line check against the live runbook before this ships
as the actual seed data, in particular row 1's two timestamps.

| # | Process | Time (IST) | Mode | Maker / Executor |
|---|---|---|---|---|
| 1 | Pulse Trade file process for FNO & CM ⚠︎ | 3:31 / 3:35 | Auto | ControlM |
| 2 | TBT-Data Validation & Comparison | 03:30–04:00 | Auto | ControlM |
| 3 | OTA reports | 03:45–04:15 | Auto | ControlM |
| 4 | Latency Report | 03:35–03:40 | Auto | ControlM |
| 5 | TBT File copy process | 04:05–04:30 | Auto | ControlM |
| 6 | Trade file process for CD | 5:15 | Auto | ControlM |
| 7 | Span file download | 5:30 | Auto | File Downloader |
| 8 | Inhouse EOD | 8:15 | Auto | ControlM |
| 9 | NSE Stream ID Mail | 10:00 | Auto/Manual | — |
| 10 | BSE Stream ID Mail | 10:00 | Auto/Manual | — |
| 11 | Exchange file download (evening) | 8:00 | Auto | File Downloader |
| 12 | Sub2 HFT Token activity | 8:10 | Auto | ControlM |
| 13 | Commvault backup for ML | 8:20 | Auto | ControlM |
| 14 | Commvault backup for GP | 8:20 | Auto | ControlM |
| 15 | Commvault backup for FES | 8:20 | Auto | ControlM |
| 16 | Commvault backup for CORMS | 8:20 | Auto | ControlM |
| 17 | Commvault backup for CONREV | 8:20 | Auto | ControlM |
| 18 | Greeksoft EOD Check | 10:10 | Auto | ControlM |
| 19 | Inhouse Token activity | 10:15 | Auto | ControlM |
| 20 | Check Audit mail | 10:30 | Manual | EOD Team |
| 21 | Sub2 EOD check | 10:30 | Auto | Auto |
| 22 | Mail check & reply & forwarding | — | Partial Auto | — |
| 23 | Control-M Dashboard Monitoring | — | Auto | ControlM |
| 24 | Deployment (SUB2, Inhouse, TBT Adaptor, Greeksoft, FM) | — | Manual | — |
| 25 | Start FM Converge EOD | As per mail | Manual | — |
| 26 | SUB2 Password Change | Thursday | Auto | — |
| 27 | INHOUSE Password Change | Wednesday | Auto | — |
| 28 | Greeksoft Password change (EQ/FO/CD) | Wednesday | Manual | — |

`assigned_role` for each row (for the RBAC gate) isn't in the source runbook
— the demo assigns automated/monitoring rows to L1 Support, "Check Audit
mail" to L2 Support, deployment and FM Converge start to Shift Lead, and all
password-rotation rows to Admin (credential rotation is admin-level by
default in the permission matrix's spirit, §9.2). Confirm/correct this
mapping against how the real team actually splits ownership before go-live.

### Grafting onto the current UI
If the current UI already has a task/list component, keep its markup and swap
only the status-pill click handler to call this PATCH endpoint plus the
role-check — this is the least invasive way to add RBAC to something that
already renders a list.

---

## 10. Voice / sound notification engine

Retained and extended from the v1 sound system.

### 10.1 Trigger map
Every `session:transition` event (§6.2) with `voiceAnnouncements: true` in
config fires a spoken line, e.g.:

- "Pre-open session has started."
- "Normal market is now open."
- "Closing auction session has begun."
- "Market is now closed for the day."

Keep the phrase list in config next to the session config (§6.3), not hardcoded
in the component — so a wording change doesn't need a deploy either.

### 10.2 Implementation
- Primary: `window.speechSynthesis` (`SpeechSynthesisUtterance`) — zero asset
  management, works offline once the voice list is cached by the browser.
- Fallback: a small pre-recorded MP3 sprite per phrase, in case the desk browser
  has no usable TTS voice installed (common on locked-down corporate images) —
  detect `speechSynthesis.getVoices().length === 0` and switch automatically.
- Respect a persisted mute toggle in the header at all times; **never** override
  a manual mute for a "critical" announcement — production support staff need to
  be able to silence the room without an engineer's help.
- Browsers block autoplaying audio without a prior user gesture: require a single
  "Enable sound" click on first load per session (store the grant in
  `sessionStorage`) rather than fighting the autoplay policy.

---

## 11. Auto tab-switch logic

Optional, toggleable ("Auto-focus" switch in header, default on):
- If the active session (§6.2) just transitioned, and the user hasn't manually
  changed tabs in the last 60s, switch to the **Timeline** tab briefly (a few
  seconds) then return to whatever tab was active — a glanceable nudge, not a
  takeover.
- Never auto-switch away from the **Tasks** tab if the user is mid-interaction
  (an open task detail, an in-progress click) — check for a "user is actively
  interacting" flag before switching.

---

## 12. API contract summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/time` | Server time for clock sync (§5.1) |
| GET | `/api/markets/state` | Open/closed + next-event for IST/US/Korea (§5.4) |
| GET | `/api/schedule/config` | Current session config |
| GET | `/api/schedule/state` | Current session + next transition |
| WS | `session` channel | `session:transition` events |
| GET | `/api/indices` | Snapshot of tracked symbols |
| WS | `indices` channel | Live tick stream |
| GET | `/api/roster?date=` | Roster for a given date |
| GET | `/api/tasks?shift=` | Checklist for a given shift (defaults to the live shift) |
| PATCH | `/api/tasks/:id` | Update status (role-checked); appends a MongoDB completion event (§9.5) |
| GET | `/api/tasks/:id/history` | Completion/audit history for one item, read from MongoDB (§9.5) |
| WS | `tasks` channel | Task update broadcast |
| POST | `/api/auth/login` | Session auth |

---

## 13. Security, compliance & audit

- Auth via SSO/JWT if the org already has an identity provider — don't build a
  bespoke login for an internal ops tool if one exists.
- Every task-status change and every roster edit is audit-logged with actor,
  timestamp, before/after (§9.3, §9.5) — expect this system to be in scope for
  internal audit given it's finance production support.
- MongoDB holds the audit/event log (§9.5) — apply the same bar as Postgres:
  authenticated access only, no direct client access (writes go through
  `ops-api`, never from the browser), and back it up/retain it on a schedule
  that satisfies whatever internal audit expects for retention, not just
  whatever the default TTL happens to be.
- No secrets (vendor API keys, database credentials) in the frontend bundle —
  all vendor calls go through `market-data-proxy`, never direct from the
  browser.
- Rate-limit and authenticate the `/api/*` endpoints even though it's an
  internal tool — "internal" is not a security boundary.

## 14. Non-functional requirements

- Uptime target: matches the desk it sits on — treat as tier-1 internal
  infrastructure, not a nice-to-have.
- The client must recover from a vendor/backend outage without a manual
  refresh: Socket.IO auto-reconnect, React Query background refetch, visible
  connection-status indicator.
- Target 60fps for the timeline sweep and clock second-hand; everything else can
  be event-driven, not animation-loop-driven, to keep a 24×7 tab's CPU/battery
  footprint low.
- Keyboard-navigable tabs and visible focus states — this may run on a
  touchscreen kiosk in some rooms and a keyboard-driven desk in others.
- Respect `prefers-reduced-motion` (still show state changes, just as instant
  cuts instead of animated transitions).

## 15. Suggested folder structure

```
/client
  /src
    /app            (AppShell, tab routing)
    /features
      /overview
      /timeline
      /roster
      /tasks
    /engines
      sky.ts         (§5.2–5.3)
      timeSync.ts     (§5.1)
    /components       (shared: WallClock, Avatar, StatusPill, Panel)
    /styles
      tokens.css
/server
  /market-data-proxy
    /adapters         (per vendor)
    /cache
  /ops-api
    /routes
    /schedule-engine
    /roster
    /tasks
    /auth
  /db
    /migrations
/docker
  docker-compose.yml
```

## 16. Open assumptions (confirm or correct)

1. Vendor/source for live NIFTY/SENSEX/BANK NIFTY data isn't specified —
   design assumes a pluggable adapter so this can be swapped without touching
   the rest of the proxy.
2. Assumed default location for the sky engine is Mumbai; confirm if the desk
   is elsewhere.
3. Assumed an existing SSO/identity provider for auth; if there isn't one, that
   becomes its own phase (§ Implementation Plan, Phase 7).
4. The brief's "Why/What Changes/Capabilities" section describes a separate,
   related multi-market (India/US/Korea) observer app — the *clocks* piece of
   that (§5.4) is now in the current build; live *index data* for US/Korea
   (ES futures, KOSPI) remains future roadmap (§17) since that needs its own
   vendor contracts. Flag if that split is wrong.
5. Assumed MongoDB is a net-new addition to the stack (no existing instance)
   — confirm whether self-hosted or a managed option (e.g. Atlas) is
   preferred, same as the open Postgres/Redis hosting question implied
   elsewhere in this doc; either works, this doc doesn't assume which.
6. The US/Korea clock carousel (§5.4) uses a fixed continuous trading window
   per market with no holiday calendar yet — confirm whether that's
   acceptable for launch or whether NYSE/KRX holidays need to be modeled too
   (mirroring §6.4's NSE holiday handling) before this ships.
7. The Evening checklist's `assigned_role` mapping (Appendix 9.A) is this
   doc's best guess at who owns each row — needs sign-off from the team that
   actually runs this checklist today.

## 17. Future roadmap
- Extend `market-data-proxy` adapters to US (ES futures) and Korea (KOSPI) so
  the Overview ticker carries live prices for all three markets, not just
  clocks/session-state (§5.4 already covers the clock/session piece) — the
  architecture already supports N markets, this is additive config, not a
  rearchitecture.
- Auto-switch tab logic (§11) extends naturally to "surface whichever tracked
  market is mid-transition right now" across all three, once §5.4's simple
  open/closed signal is upgraded to full session-phase awareness for US/Korea
  the way §6 already models it for NSE.
- Per-market holiday calendars for US/Korea (see open assumption 6 above),
  once the clock carousel needs to be exchange-holiday-aware and not just
  weekday-aware.
