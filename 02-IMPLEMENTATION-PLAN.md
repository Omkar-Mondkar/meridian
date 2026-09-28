# Implementation Plan — Market Ops Command Dashboard

Companion to `01-DESIGN-DOC.md`. Each phase lists goal, tasks, files, and an
acceptance check — hand one phase at a time to an AI coding assistant or a dev,
in order; each phase should be shippable/demoable on its own.

---

## Phase 0 — Audit & baseline (0.5–1 day)

**Goal**: know exactly what exists before touching it.

- [ ] Share the current UI source (or the repo) so component/style patterns can
      be reused, not replaced.
- [ ] Inventory: what framework, what CSS approach, what state management, any
      existing session-schedule or sound-notification logic from v1 already in
      the codebase.
- [ ] Confirm the open assumptions in Design Doc §16 (data vendor, location,
      auth provider, MongoDB hosting — self-hosted vs. managed).
- [ ] Stand up an empty Vite + TS project if starting fresh, or a feature branch
      if modifying in place.

**Acceptance**: a short written note of "here's what's reusable, here's what's
new" before any feature code is written.

---

## Phase 1 — Design system & app shell (1–2 days)

**Goal**: the tabbed shell exists, styled, with the sky background live —
before any real data flows.

- [ ] `tokens.css`: colour variables, type scale, panel styles (Design Doc §4.2–4.4)
- [ ] Import IBM Plex Mono + IBM Plex Sans
- [ ] `AppShell` component: fixed-viewport layout, header (88px), tab bar (52px),
      content region
- [ ] Tab routing for Overview / Timeline / Roster / Tasks (client-side, no
      page reload)
- [ ] `useSkyGradient()` hook implementing Design Doc §5.2–5.3, applied to the
      shell's background layer
- [ ] Sun/moon glyph in header tracking `sunElevation` from the hook
- [ ] Empty-state panels for each tab (glass-panel styling, no data yet)

**Files**: `/client/src/app/AppShell.tsx`, `/client/src/engines/sky.ts`,
`/client/src/styles/tokens.css`

**Acceptance**: open the app at any time of day and the background visibly
matches real IST sky conditions; tabs switch with the crossfade; nothing is
wired to real data yet and that's fine.

---

## Phase 2 — Time sync + wall clock + multi-market carousel (1–1.5 days)

**Goal**: a wall clock that's provably, verifiably correct, plus a swipeable
IST/US/Korea clock card that surfaces whichever market is actually live.

- [ ] `GET /api/time` endpoint (server-side, just returns server time —
      trust the host's NTP sync, confirm with infra)
- [ ] `timeSync.ts`: offset calculation per Design Doc §5.1, re-synced every 5 min
- [ ] `WallClock` component: large IST digital clock (IBM Plex Mono, 64px),
      date line, sync-status badge — this is the header's primary clock and
      stays IST-only per §5.1.6, unaffected by the carousel below
- [ ] Drive the clock's tick via `requestAnimationFrame`, not `setInterval`
- [ ] `MarketClockCarousel` component (Design Doc §5.4): 3-page swipeable
      card (IST/US/Korea), book-page tilt transition, dot + prev/next nav
- [ ] `marketState()` helper: open/closed + time-to-next-event per market,
      computed from that market's own IANA timezone (`Intl.DateTimeFormat`),
      weekday-only (no holiday calendar yet — Design Doc §16 open assumption)
- [ ] Auto-surface logic: if IST is closed and exactly one other tracked
      market is open, auto-flip the carousel to that page and show a live
      badge — both on the card and as a persistent header chip visible
      across all tabs
- [ ] Manual-override handling: swipe/tap pins a page and stops auto-follow;
      an "Auto" control resumes it immediately, and it also resumes on its
      own after a short idle period (same non-takeover pattern as §11)

**Acceptance**: clock never visibly stutters or jumps; sync badge correctly
flips to `STALE` if `/api/time` fails for >2 sync cycles; killing network
doesn't freeze the displayed time (it keeps ticking from the last known
offset). Separately: forcing the clock to ~00:30 IST (via a test time
override) auto-flips the carousel to the US page with a "US Market Live Now"
label in both the card and the header, and manually swiping to another page
correctly suppresses auto-follow until the idle timer or the "Auto" control
brings it back.

---

## Phase 3 — Schedule engine + timeline + voice (2–3 days)

**Goal**: the core "what phase are we in, and what's next" experience.

- [ ] Session config as JSON per Design Doc §6.3 (start with the Aug 2026 NSE
      timings; store as versioned config, not hardcoded constants)
- [ ] Backend state machine (§6.2): computes current session server-side,
      emits `session:transition` over Socket.IO at each boundary
- [ ] `GET /api/schedule/state` for initial load, WS `session` channel for live
      updates
- [ ] `SessionTimeline` component: gradient sweep bar with a glowing/pulsing
      current-phase segment (rAF-driven "now" marker), countdown to next
      transition, plus a scrollable phase-card strip below it (icon + label +
      time range + done/current/upcoming state per phase) — the sweep bar
      stays glanceable at a distance, the card strip carries the detail
- [ ] Holiday table + short-circuit to `HOLIDAY` state (§6.4)
- [ ] Voice engine: `speechSynthesis` primary, audio-sprite fallback, mute
      toggle in header, "Enable sound" first-click gate (§10)
- [ ] Announcement log panel on the Timeline tab (last N spoken events, with
      timestamp)

**Acceptance**: manually adjust system/test time (or run a fast-forward test
mode) and confirm every session boundary in the config table fires a voice
announcement and a timeline update within one second of the configured time.

---

## Phase 4 — Market data proxy (2–3 days)

**Goal**: live indices on screen, resilient to the vendor being down.

- [ ] Vendor adapter interface + one concrete implementation for whatever
      feed/API is available (confirm vendor from Phase 0)
- [ ] Redis cache layer (tier 2) with TTL
- [ ] Simulator (tier 3): seeded random walk from last known close, clearly
      flagged `source: "simulated"`
- [ ] Circuit breaker around the vendor call (§7.3)
- [ ] `GET /api/indices`, WS `indices` channel, fan-out via Redis pub-sub so
      multiple app instances share one upstream poll
- [ ] `IndexTicker` component on Overview tab: price, change, changePct,
      sparkline, source badge (live/cached/simulated styled distinctly)

**Acceptance**: unplugging the vendor mid-session degrades the UI to a visibly
labeled cached/simulated state within one poll cycle — never silently.

---

## Phase 5 — Shift roster (1–2 days)

**Goal**: who's on duty, at a glance.

- [ ] Postgres migrations: `personnel`, `shifts`, `shift_assignments` (§8.1)
- [ ] Seed the three shift definitions (§8.2)
- [ ] `GET /api/roster?date=` endpoint
- [ ] Two simple SVG avatar sets (male/female), no photos
- [ ] `ShiftRoster` component: three columns, on-duty/upcoming/off pill computed
      client-side against synced IST time, handover ribbon during overlap windows,
      distinct highlight (border glow + "Current shift" ribbon) on whichever
      column matches the single tie-broken "current shift" also used to
      auto-select the Tasks tab's checklist (§9.5)

**Acceptance**: at any moment, exactly the right people show `ON DUTY`, matching
the shift table, including correct handover-ribbon behavior during the two
overlap windows.

---

## Phase 6 — Task board + RBAC + shift-scoped checklists (3–4 days)

**Goal**: live tasks, click-to-complete, correctly gated by role, fully
audited — as three separate shift checklists (Morning/Evening/Night) that
the UI auto-follows based on the live shift, with completions persisted to
MongoDB.

- [ ] Postgres migrations: `shift_checklists` (versioned template per shift),
      `tasks` (current-state row per checklist item), `users`, `roles` (§9.1)
- [ ] **MongoDB collection(s)**: `task_completion_events` at minimum (§9.5);
      decide during this phase whether session-transition and handover events
      also move into Mongo now or in a later pass — either is fine per §9.5,
      don't over-design before there's real write volume to look at
- [ ] Seed the Evening shift's `shift_checklists` row from Design Doc
      Appendix 9.A — confirm the flagged rows (esp. row 1's two timestamps)
      and the assumed `assigned_role` mapping against the real runbook/team
      before this becomes the actual seed data, not just demo content
- [ ] Seed Morning/Night with whatever their real runbooks are (or carry over
      the placeholder items from the v1 prototype/demo if nothing more
      concrete exists yet — flag this as a follow-up if so)
- [ ] Permission matrix enforced server-side on `PATCH /api/tasks/:id` (§9.2)
- [ ] `GET /api/tasks?shift=`, WS `tasks` channel for cross-screen live sync
- [ ] `TaskBoard` component: process/time/mode/executor columns, priority
      tag, assigned-role badge, status pill (§9.5's checklist-table shape,
      distinct from a generic freeform to-do card)
- [ ] Shift-tab selector above the checklist: auto-selects the live shift by
      reusing the roster module's shift-window logic (no duplicated "what
      time is it" check); manual tab click pins a shift for browsing; an
      "Auto" control resumes following the live shift
- [ ] Click-to-complete flow: optimistic update → server validate → Postgres
      status write → MongoDB completion-event append → broadcast →
      rollback-on-reject (§9.4); treat the Mongo write as best-effort-but-
      logged so a transient Mongo hiccup never blocks a completion — alert on
      a growing write-retry backlog instead
- [ ] `GET /api/tasks/:id/history` reading completion history back out of
      MongoDB, for an eventual "who completed this and when" detail view

**Acceptance**: a user without the right role sees a disabled/explained status
pill (not a silently-failing click); two screens open side by side both update
within ~1s of a completion on either; `task_completion_events` in MongoDB has
a correct document for every completion made during a manual QA pass, and
`/api/tasks/:id/history` returns it. Separately: forcing the system clock
across a shift boundary (e.g. 15:55 → 16:05 IST) auto-switches the Tasks
tab's visible checklist from Evening to Night without a manual refresh, and
the Roster tab's highlighted column moves with it.

---

## Phase 7 — Auth & backend hardening (1–2 days)

**Goal**: this is a finance-adjacent internal tool — treat it like one.

- [ ] Wire auth to existing SSO/JWT provider (or stand up a minimal one if
      truly none exists — flag this as scope creep if so, it's a project of
      its own)
- [ ] Rate limiting on all `/api/*` routes
- [ ] No secrets in the client bundle; confirm vendor keys live only in
      `market-data-proxy`'s server environment
- [ ] Structured logging + basic alerting on: schedule-engine crash, vendor
      circuit breaker open >5 min, WS disconnect storm

**Acceptance**: a security-minded read-through finds no vendor key reachable
from browser devtools, no unauthenticated write endpoint.

---

## Phase 8 — Docker & deployment (0.5–1 day)

**Goal**: reproducible single-command run, matching the brief's Docker ask.

- [ ] `docker-compose.yml`: client (built static, served via nginx or Vite
      preview), `ops-api`, `market-data-proxy`, Postgres, Redis, **MongoDB**
- [ ] `.env.example` documenting every required var (vendor keys, DB URL,
      Redis URL, **Mongo URI**, default sky-engine coordinates)
- [ ] Healthcheck endpoints on both backend services for compose/orchestrator
      liveness checks; include Mongo connectivity in `ops-api`'s healthcheck
      since a silently-unreachable Mongo would otherwise fail audit writes
      without anyone noticing

**Acceptance**: `docker compose up` on a clean machine produces a working
dashboard with no manual steps beyond filling in `.env`.

---

## Phase 9 — QA, accessibility, performance pass (1–2 days)

- [ ] Keyboard navigation across tabs, task actions, and the clock-carousel
      prev/next controls; visible focus rings
- [ ] `prefers-reduced-motion` respected (instant state cuts, no crossfade,
      no book-page tilt on the clock carousel)
- [ ] Soak test: leave the tab open 24h+, confirm no memory growth from the
      rAF loops, WS reconnect handling, or the once-a-second market-state
      recomputation for the clock carousel
- [ ] Simulate: vendor down, backend down, network flap, Mongo unreachable —
      confirm every failure mode is visibly labeled, never silently stale;
      for Mongo specifically, confirm task completion still succeeds (status
      updates in Postgres) even if the audit-event write is failing, per the
      best-effort-but-logged handling in Phase 6
- [ ] Cross-check the CAS-related session config against the latest NSE
      circular before go-live (this genuinely changes again 7 Sep 2026 per
      the phase-2 pre-open rollout — don't ship stale market-structure config)
- [ ] Walk a full 24h clock cycle (via time override) and confirm: the
      IST/US/Korea carousel auto-follows correctly at every transition (esp.
      around 00:00–02:30 IST where NYSE is the only open market), the Tasks
      tab's checklist switches shifts at each shift boundary, and the Roster
      tab's current-shift highlight moves in step
- [ ] Confirm MongoDB retention/backup policy is actually configured, not
      just documented — an audit trail nobody backs up isn't one

---

## Suggested sequencing

Phases 1–3 can be built and demoed with zero backend beyond `/api/time` and a
mocked schedule state — that's the fastest path to something visibly
impressive for stakeholders. Phases 4–6 are where real data, RBAC, and the
MongoDB audit trail land. Phase 7–9 are what make it safe to actually run
unattended for months.
