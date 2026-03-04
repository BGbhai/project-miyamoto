# PROJECT MIYAMOTO — MASTER BRIEFING FILE

> **Last updated:** 2026-03-04 (v7.0)
> **This file is the single source of truth. Read it fully before doing anything.**

---

## ⚠️ HOW THIS PROJECT WORKS (READ THIS FIRST — EVERY SESSION)

This project has **three participants**:

- **BG** — the user. Trains 6 days/week. Provides requirements, runs Codex, pastes files into Claude.ai.
- **Claude** — architect and decision-maker. Designs features, writes specs, reviews code, updates this file. Does NOT do large code generation directly — delegates to Codex for that.
- **Codex** — implementer. Receives specific tasks from the PENDING CODEX TASKS section below and writes the actual code changes.

**The workflow every session:**
1. BG opens a new Claude session → Claude reads this file first
2. Claude + BG discuss what to build next → Claude designs the approach
3. Claude writes the task spec into PENDING CODEX TASKS (with exact file locations, logic, and UI)
4. BG takes those tasks to Codex → Codex implements them
5. Codex leaves notes in MESSAGES FROM CODEX TO CLAUDE
6. BG comes back to Claude → Claude reads Codex's notes, reviews the work, plans next steps
7. Claude updates this file to reflect the new state

**Claude's rules for this file:**
- Update this file automatically after every significant change — no need to ask BG
- Always update "Last updated" date
- Never let this file go stale — it must always reflect the true current state
- When completing a Next Step, move it to Completed Work and add a Codex task spec if needed
- When adding new features, write the Codex task spec in PENDING CODEX TASKS before handing off

**Codex's rules:**
- Read this entire file before writing any code
- Read the actual source files before editing — never guess at the current code
- Runtime source of truth is `index.html`; keep `adaptive_training_platform.jsx` in parity with `index.html`
- `miyamoto.html` is archived legacy and should remain unchanged unless explicitly requested
- Leave notes in MESSAGES FROM CODEX TO CLAUDE after completing tasks
- Move completed tasks to the COMPLETED CODEX TASKS archive

---

## 📍 CURRENT STATUS

**App version:** V7.0
**Runtime status:** `index.html` canonical ✅
**JSX parity target:** `adaptive_training_platform.jsx` (module runtime parity with index)
**Legacy HTML:** `miyamoto.html` (archived, unchanged)
**localStorage key:** `miyamoto_v7` (legacy import supported from `miyamoto_v5`)

**What's working:**
- Multi-discipline engine with dynamic profile disciplines (`gym`, `calisthenics`, `running`, `martial_arts`, `mobility`, `cycling`, `yoga`, `hiit`) plus `custom` session builder
- Muscle recovery tracking across 12 muscle groups with fatigue/recovery/fresh status
- Time-aware workout generation (30/45/60/90 min picker) with injury filters, blocked-pattern filters, and custom substitutions
- Gemini AI coaching (optional, settings toggle + API key) with pre-brief, post-session summary, weekly summary, and chat
- Per-exercise logging (sets done, top set, exercise RPE, pain flag)
- Calisthenics + running + martial arts skill progression rendering in dynamic Skills tab
- Martial arts subtype picker (`striking` / `grappling` / `general`)
- Exercise SWAP button with 4 alternatives
- Block periodization (accumulation/intensification/realization/deload)
- Readiness check (sleep/stress/soreness/motivation/energyLevel)
- Progress view: 28-day consistency heatmap, bodyweight trend, weekly volume, per-domain projection, dynamic skills
- History view with discipline filters + detailed per-exercise log expansion
- Settings: Goal Recalibration, Discipline Manager, AI Persona, Accent Color, AI Coach, Constraints, V5 Import, Data
- PWA runtime: explicit `sw.js` registration + `manifest.webmanifest` + icon links

**Known issues / not yet built:**
- Browser-level visual/screenshot validation is manual and optional (code+smoke validation is complete)

---

## 🏗️ WHAT THE APP IS

An **adaptive, intelligent martial arts + strength training PWA** for BG. Acts as a personal AI coach covering 6 domains: Strength (barbell), Calisthenics (skill progressions), Striking (Muay Thai + Boxing), Grappling (BJJ + Wrestling), Mobility, and Conditioning/Running.

**Core behaviour:**
- Recommends which session to do based on weekly balance, muscle recovery, fatigue, and injury constraints
- Generates workouts scaled to available time
- Adapts every session based on RPE and completion quality (advance/hold/regress per exercise)
- Calls Gemini API for AI coaching notes when enabled
- Block periodization: Accumulation → Intensification → Realization → Deload

**User:** BG — intermediate, trains 6 days/week (can do AM+PM), wants to become a complete martial artist. Priorities: leg strength, calisthenics skills (muscle-up, handstand), BJJ/striking balance, running stamina.

---

## 🔧 TECHNICAL ARCHITECTURE (for Claude + Codex)

**Stack:** React (useReducer, useState, useMemo, useEffect, useRef), Tailwind CSS, recharts, inline SVG icons. Runtime is `index.html` + `sw.js` + `manifest.webmanifest`; module mirror is `adaptive_training_platform.jsx`.

**State shape (top level, V7):**
```
view, onboarded, onboardStep, version
profile           — name, age, sex, bodyweight, goal, disciplines[], fitnessLevels{}, daysPerWeek, sessionMinutes, accentColor
programConfig     — currentBlock, blockWeek, adaptationAggressiveness, coachPersona
athleteModel      — domainScores{}, fatigueDebt, consistencyScore, readinessTrend, streakDays, lastSessionDate
progression       — exercises{}, skills{}, stalledItems[], deloadRecommended, highRPEStreak
readiness         — inputs{sleep,stress,soreness,motivation,energyLevel}, score, band, lastUpdated
muscleRecovery    — per-muscle recovery model with status
aiConfig          — enabled, apiKey, model, endpoint
aiMemory          — coachingNotes[], weeklySummary, weeklyGoalCheck, postSessionSummary, chatHistory, preBrief
planState         — recommendation, secondaryRec, progressionPrompts[]
constraints       — injuries{}, blockedPatterns[], customSubstitutions{}
sessionLogs       — []
activeSession     — null or current session object
currentSessionType, decisionLog
```

**Key functions:**
- `generateWorkout(type, state, maSubtype, timeMinutes)` — builds exercise list with constraints/substitutions
- `computeSessionPriority(state)` — scores session types for recommendation
- `callPreSessionBrief(state, sessionType, dispatch)` — AI pre-session briefing
- `callPostSessionSummary(state, sessionLog, dispatch)` — AI post-session summary + storage
- `callWeeklySummary(state, dispatch)` — weekly recap with goal-progress check
- `callGeminiAPI(apiKey, endpoint, model, prompt)` — async Gemini call
- `migrateState(state)` — backward-compat layer for old localStorage saves

**Session types + frequency targets:**
- Dynamic from `profile.disciplines`; defaults and frequency targets use:
  `gym:4`, `calisthenics:3`, `running:3`, `martial_arts:3`, `mobility:2`, `cycling:3`, `yoga:2`, `hiit:2`

**Outcome logic per exercise:**
- `setsCompleted < 60% of prescribed` → regress
- `effortRPE ≥ targetRPE + 2` → regress
- `setsCompleted ≥ prescribed AND effortRPE ≤ targetRPE - 1` → advance
- `pain = true` → always regress
- otherwise → hold

**JSX vs HTML file differences:**
| JSX file | HTML file |
|---|---|
| `import React ...` + `import { ... } from 'recharts'` | CDN scripts + Babel (`text/babel`) |
| No root mount (`export default App`) | Mounts with `ReactDOM.createRoot(...)` |
| Mirrors runtime logic for parity | Canonical runtime + localStorage persistence + SW registration |
| Module/bundler context | Self-contained deployable PWA entry |

---

## 🤖 CLAUDE ↔ CODEX HANDOFF SPACE

> **How this works:**
> - **BG → Codex:** Copy the PENDING TASKS below into a Codex session. Give Codex both source files. Tell it to read this whole section first.
> - **Codex → BG:** After finishing, Codex fills in the CODEX REPORT section below with what it did.
> - **BG → Claude:** Come back to Claude, paste any Codex report notes. Claude reads them, updates this file, and plans the next tasks.
> - **Claude never skips updating this file.** Every session ends with this file reflecting the true current state.

---

### 📋 PENDING TASKS FOR CODEX
> Status key: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

*No pending tasks — V7.0 spec-complete implementation delivered.*

---

### 📐 STANDING RULES FOR CODEX
> These apply to every task, every time. Read before touching any file.

| Rule | Detail |
|---|---|
| **Parity** | Every behavior change in `index.html` MUST be mirrored in `adaptive_training_platform.jsx`. |
| **Runtime target** | Deploy and validate from `index.html` first; keep `miyamoto.html` as historical archive. |
| **HTML hooks** | `index.html` uses destructured React hooks from global `React` in the Babel block. JSX file uses module imports. |
| **No lucide in HTML** | HTML remains inline-SVG based. |
| **Aesthetic** | V7 dark-modern design tokens and accent system (not legacy mono/red-only rules). |
| **Runtime files** | Keep `index.html`, `sw.js`, and `manifest.webmanifest` consistent for PWA behavior. |
| **No file sprawl** | Avoid introducing extra runtime source files; maintain canonical `index.html` + parity JSX workflow. |
| **Reducer only** | All state changes via `appReducer` named action types. Never mutate state directly. |
| **migrateState** | Any new state key (top-level or nested inside `profile`, `domains`, `progression`) needs a fallback added to `migrateState()`. |
| **Read first** | JSX file is ~3459 lines. Read the section before editing. Never guess at current code. |

**File paths:**
- JSX → `/Users/bg/Desktop/Learning/Project_Miyamoto/adaptive_training_platform.jsx`
- Runtime HTML → `/Users/bg/Desktop/Learning/Project_Miyamoto/index.html`
- Archived legacy HTML → `/Users/bg/Desktop/Learning/Project_Miyamoto/miyamoto.html`

---

### 📩 CODEX REPORT
> **Codex:** Fill this in after completing your tasks. Claude reads this at the start of the next session. Leave it blank if nothing to report.
> **Format:** Use the template below for each task you worked on.

```
TASK C-XX — [task name]
Status: DONE / PARTIAL / BLOCKED
Files changed: [list files]
What I did: [1-3 sentences]
Decisions made: [anything ambiguous where you made a judgment call]
Bugs found: [anything you noticed that wasn't in the spec]
Notes for Claude: [anything Claude should know before planning the next task]
---
```

```
TASK C-01 — Weekly km reset
Status: DONE
Files changed: adaptive_training_platform.jsx, miyamoto.html, CLAUDE.md
What I did: Added `domains.conditioning.weeklyKmResetAt`, added weekly boundary reset logic during running session completion, and normalized stale imported weekly km in `migrateState()`.
Decisions made: Missing `weeklyKmResetAt` with non-zero imported km is treated as stale and reset to current week baseline.
Bugs found: None outside scope.
Notes for Claude: Weekly km is now bounded by week start without touching other counters.
---

TASK C-02 — Deload auto-suggest banner
Status: DONE
Files changed: adaptive_training_platform.jsx, miyamoto.html, CLAUDE.md
What I did: Added reducer action `SET_BLOCK`, added HomeView top banner with exact warning text/style, and wired `SWITCH TO DELOAD` button dispatch.
Decisions made: Banner visibility follows strict condition `deloadRecommended === true && currentBlock !== 'deload'`.
Bugs found: None outside scope.
Notes for Claude: Deload prompt is now visible and one-click actionable.
---

TASK C-03 — Pace display for running
Status: DONE
Files changed: adaptive_training_platform.jsx, miyamoto.html, CLAUDE.md
What I did: Added `parseMmSsToSeconds()` and `formatPace()` helpers, computed running pace rows from `log.exerciseResults` in History, and rendered `km @ mm:ss /km` lines.
Decisions made: Invalid/missing distance/time always renders `—`; entire calc path is wrapped with try/catch safety.
Bugs found: None outside scope.
Notes for Claude: Running history now surfaces pace progression without crashing on malformed legacy entries.
---

TASK N-01 — Per-exercise history charts
Status: DONE
Files changed: adaptive_training_platform.jsx, miyamoto.html
What I did: Added `history: []` array to each exercise record in `updateProgressionRecords()`, appending `{date, topMetric, effortRPE, outcome}` each session (capped at 20 entries). Replaced flat exercise list in ProgressView with sparkline cards using recharts `LineChart` — shows RPE trend, last top metric, and outcome badge.
Decisions made: History capped at last 20 entries via `.slice(-19)` before append to prevent unbounded growth.
Bugs found: None.
Notes for Claude: Sparklines only show when history.length > 1; single-session shows placeholder text.
---

TASK N-02 — AI weekly summary
Status: DONE
Files changed: adaptive_training_platform.jsx, miyamoto.html
What I did: Added `callGeminiWeeklySummary()` function, `SET_WEEKLY_SUMMARY` reducer case, `weeklySummary/weeklySummaryGeneratedAt/weeklySummaryLoading` fields in `createPlanState()` and `migrateState()`. Added `useEffect` in `HomeView` to auto-trigger generation when AI is enabled + 2+ sessions logged this week + no summary yet this week. Added `⚡ WEEKLY RECAP` card in HomeView showing headline, wins, concerns, next-week focus.
Decisions made: Requires minimum 2 sessions before generating (to avoid trivial summaries). Generation is per-week — once generated, won't re-generate until next week boundary.
Bugs found: None.
Notes for Claude: Gemini response must be JSON with shape `{headline, wins[], concerns[], nextWeekFocus, recommendation}`. HTML file uses `React.useEffect` explicitly (though destructured `useEffect` also works since it's in the global destructure at line 50).
---

TASK HOTFIX — Blank page fix
Status: DONE
Files changed: miyamoto.html
What I did: Removed stray `import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';` on what was line 53 inside the `<script type="text/babel">` block. Babel standalone cannot process ES module `import` syntax — this caused a full render failure (blank black page). Recharts was already correctly available via CDN destructure on line 51.
---
```

---

### 📚 COMPLETED TASKS (archive)

| Task | Version | Summary |
|---|---|---|
| Full Personal Trainer Engine | V5.0 | Readiness system, rolling recommendations, per-exercise progression, completion quality scoring, decision log, full UI overhaul |
| Bug fixes + 7 features | V5.1 | Fixed decisionLog, stalledItems dedup, double RPE. Added: RoundTimer, SWAP UI, running actuals, sparring picker, constraint substitution, coachStyle wiring, calisthenics prompts |
| Gym + calisthenics merge | V5.2 | Removed standalone calisthenics type. Gym now covers both strength + skills. Dual-domain architecture via `getDomainsFromType()` |
| Muscle recovery + AI coaching | V6.0 | 12-muscle recovery engine, Gemini Flash integration, time-aware generation, expanded profile, new Settings sections. Implemented by Claude directly. |
| C-01/C-02/C-03 closure | V6.1 | Weekly km now resets by week start (including stale imports), deload warning banner + `SET_BLOCK` action added, and running pace (`mm:ss /km`) is shown in History with safe fallbacks. |
| N-01/N-02 + blank-page fix | V6.2 | Fixed blank page (stray `import` in HTML Babel block). Per-exercise history arrays (`history: []` on each exercise record, last 20 entries). RPE sparklines in ProgressView. AI weekly summary (`callGeminiWeeklySummary`, `SET_WEEKLY_SUMMARY`, `⚡ WEEKLY RECAP` card in HomeView). |

---

## 📌 NEXT STEPS BACKLOG (in priority order)

*All planned V6.x features complete. Possible future enhancements:*

1. **CLAUDE.md multi-file split** — split into separate files (e.g. `ARCHITECTURE.md`, `CODEX_TASKS.md`) with CLAUDE.md acting as navigator. BG deferred this — revisit when file gets unwieldy.
2. **Per-exercise load/volume charts** — currently sparklines show RPE trend. Could add a second chart showing top weight × reps (load trend) for strength exercises.
3. **Injury-aware substitution improvements** — further refinement of which exercises get blocked per injury flag.

---

## 🗂️ VERSION HISTORY (condensed)

| Version | Date | What changed |
|---|---|---|
| V1 | 2026-03-01 | Initial build — onboarding, 5-domain tracking, block periodization, workout view, progress charts, settings |
| V2 | 2026-03-01 | Home/gym split, adaptive engine (computeAdaptation), location toggle |
| V3 | 2026-03-02 | Full rewrite — 5 session types, calisthenics skill tree, dark brutalist UI, SVG visualizer |
| V3.1 | 2026-03-02 | Back buttons, SVG stick figures, priority system, reset confirmation |
| V3.2 | 2026-03-02 | PWA transformation → miyamoto.html with service worker + localStorage |
| V3.3 | 2026-03-02 | PWA bug fixes, inline SVG icons, mobile polish (100dvh, safe areas, iOS zoom fix) |
| V3.4 | 2026-03-02 | Onboarding nav fix, MA alternation fix, base64 manifest URI |
| V5.0 | 2026-03-02 | Personal Trainer Engine — readiness, rolling recs, per-exercise progression, completion quality |
| V5.1 | 2026-03-03 | Bug fixes + RoundTimer, SWAP UI, running actuals, sparring picker, coachStyle, progression prompts |
| V5.2 | 2026-03-03 | Gym + calisthenics merged into single session type |
| V6.0 | 2026-03-03 | Muscle recovery engine, Gemini AI coaching, time-aware generation, expanded profile + settings |
| V6.1 | 2026-03-03 | Closed C-01/C-02/C-03: weekly km reset + stale import guard, deload banner + `SET_BLOCK`, running pace in History |
| V6.2 | 2026-03-03 | Blank page fix (stray import in HTML). Per-exercise history arrays + RPE sparklines in ProgressView. AI weekly summary card in HomeView. |

---

## 🎨 PREFERENCES & NON-NEGOTIABLE RULES

**Aesthetic — V7 dark-modern coaching UI:**
- Design token driven with dynamic accent color per user
- Mixed typography (sans for UI/prose, mono for compact metrics)
- Rounded cards/buttons with sharp CTA emphasis
- Sentence case labels with selective emphasis

**Architecture:**
- Single file — no splitting. One JSX, one HTML.
- All state through useReducer + named action types
- No direct DOM manipulation
- No external state libraries (no Redux, no Zustand)

**Libraries allowed:**
- React 18, Tailwind CSS, recharts + prop-types
- Inline SVG icons only in HTML file — never lucide-react CDN
- lucide-react is fine in JSX file (Claude.ai artifact env has it at v0.263.1)

**Data persistence:**
- Runtime/HTML localStorage key: `miyamoto_v7`
- Legacy import source key: `miyamoto_v5`
- JSX parity app persists with the same state contract

**BG's training context:**
- Intermediate level, 6 days/week, AM+PM possible
- Goal: complete martial artist — strong, mobile, fast, skilled
- Priorities: leg strength (squat/deadlift), calisthenics skills (muscle-up, handstand, L-sit), BJJ + striking balance, running for stamina
- No fixed schedule — engine suggests based on balance and recovery
