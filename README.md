# Miyamoto — Adaptive Martial Arts Training Platform (V3)

An intelligent, adaptive training system for complete martial arts development covering strength, calisthenics, striking, grappling, mobility, and conditioning.

## Quick Start

1. **Deploy** `adaptive_training_platform.jsx` to a React environment
2. **Install dependencies:**
   ```bash
   npm install react tailwindcss lucide-react recharts
   ```
3. **Run** development server
4. **Complete** 2-step onboarding (name → age/bodyweight)
5. **Start training** and track progress

## Run HTML Runtime (V7 Canonical)

`index.html` is the canonical runtime entry for V7.

### 1) Double-click mode (`file://`)
- Open `/Users/bg/Desktop/Learning/Project_Miyamoto/index.html` directly.
- Runtime libraries are vendored in `./vendor/`, so app boot does not require internet.
- Service worker / installability is disabled automatically in `file://` mode.

### 2) Localhost mode (recommended for development)

```bash
cd /Users/bg/Desktop/Learning/Project_Miyamoto
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html`.

### 3) GitHub Pages mode
- Repository: `https://github.com/BGbhai/project-miyamoto`
- Source: `main` branch, root folder (`/`)
- Expected URL: `https://bgbhai.github.io/project-miyamoto/`

Notes:
- Runtime script paths are relative (`./vendor/...`), so they resolve correctly in `file://`, localhost, and GitHub Pages subpath hosting.
- If required globals fail to load, boot guard renders a diagnostic card via `window.__MIYAMOTO_BOOT_ISSUES__`.

## Architecture

### Single File: `adaptive_training_platform.jsx` (914 lines)

**Imports:**
- React hooks (useState, useReducer, useMemo, useCallback, useRef)
- Tailwind CSS utilities
- lucide-react icons (9 types)
- recharts (LineChart, Line, ResponsiveContainer, Tooltip)

### State Management

**useReducer with appReducer handling:**
- Navigation (SET_VIEW)
- Onboarding (NEXT_ONBOARD_STEP, COMPLETE_ONBOARDING)
- Profile (SET_PROFILE_FIELD)
- Sessions (START_SESSION, COMPLETE_SESSION)
- Skills (SET_CALI_SKILL_LEVEL)
- Records (SET_PR)
- Data (IMPORT_STATE)

### Key Constants

**FREQUENCY_TARGETS:** 5 session types
```
gym (3x/week), martialArts (3x/week), calisthenics (3x/week), 
running (3x/week), mobility (2x/week)
```

**EXERCISE_DB:** 48+ exercises across 8 categories
- Strength: barbell legs (11) + upper (10) + full body (5)
- Calisthenics: 5 skills × 5-9 levels each
- Running: 8 workout types
- Striking: 8 drills
- Grappling: 8 drills
- Mobility: 7 flows

## Features

### Home View
- Dashboard with profile summary
- Session balance widget (5 rows, weekly targets)
- Recent session logs (last 3)
- "START TRAINING" button

### Train View
- 5-button session type picker
- Adaptive workout generation
- Exercise cards with cues/distance/duration
- RPE/recovery/notes logging modal
- Session completion

### Progress View
**Domains Tab:**
- 6 domain cards (sessions, level, recharts trend)
- PR board (squat, deadlift, bench, OHP, row)

**Calisthenics Skills Tab:**
- 5 skill cards (Pull-up, Push-up, Pistol Squat, Core, Handstand)
- Level progression bars (1-7 max per skill)
- Level up/down buttons
- Coaching cues per level

### History View
- Reverse chronological session logs
- Type, date, RPE, recovery, notes for each

### Settings View
- Profile editor (name, age, bodyweight)
- Block phase picker (4 options)
- Export JSON (with timestamp)
- Import JSON (file upload)
- Reset all data (with confirmation)

## Aesthetics

- **Dark Brutalist:** `bg-neutral-950`, `text-neutral-100`
- **Accent Colors:** `text-red-500`, `text-red-600`
- **Typography:** `font-mono`, UPPERCASE headers, `tracking-widest`
- **Borders:** Sharp `border border-neutral-800` (no rounded-xl)
- **Layout:** Max-width 2xl, mobile-responsive

## Navigation

**Bottom Tab Bar (5 tabs):**
1. HOME (Home icon) → Dashboard
2. TRAIN (Dumbbell icon) → Workout selector
3. PROGRESS (TrendingUp icon) → Analytics & skills
4. HISTORY (List icon) → Session logs
5. SETTINGS (Settings icon) → Config & data

Active tab: `text-red-500 border-t-2 border-red-500`

## Data Flow

```
START_SESSION
  ↓
generateWorkout(type, state)
  ↓
activeSession = { type, exercises, rpe, recovery, notes, timestamp }
  ↓
COMPLETE_SESSION
  ↓
sessionLogs += newLog
lastSessionTypes.push(type)
domains[domainKey].sessions++
domains[domainKey].trend += { rpe }
```

## Calisthenics Skills

| Skill | Levels | Max Level |
|-------|--------|-----------|
| Pull-up | Dead Hang → Muscle-up | 9 |
| Push-up | Incline → Pseudo-Planche | 7 |
| Pistol Squat | Assisted → Weighted | 5 |
| Core | Plank → Dragon Flag | 6 |
| Handstand | Wall Kick-up → HSPU | 7 |

Each level includes:
- Exercise name
- Recommended sets/reps
- Coaching cue for form

## Session Types

| Type | Domain | What it generates |
|------|--------|-------------------|
| gym | strength | 2 leg + 2 upper + 1 full body (random) |
| martialArts | striking/grappling | 4 drills (alternates between types) |
| calisthenics | calisthenics | Current level from each 5 skills |
| running | conditioning | 1 of 8 run types (random) |
| mobility | mobility | 2 random mobility flows |

## Block Periodization

**4 Phases with Target RPE:**
- Accumulation: RPE 7
- Intensification: RPE 8
- Realization: RPE 9
- Deload: RPE 5

Configurable in Settings.

## Data Persistence

**Export JSON:**
- Downloads full state as `training_backup_YYYY-MM-DD.json`
- Includes all sessions, PRs, skills, profile

**Import JSON:**
- File upload to restore full state
- Overwrites current data

**Reset:**
- Confirmation dialog
- Clears all data and restarts onboarding

## File Structure

```
/sessions/festive-upbeat-bohr/mnt/Project_Miyamoto/
├── adaptive_training_platform.jsx (main file, 914 lines)
├── CLAUDE.md (project instructions & history)
├── V3_IMPLEMENTATION_SUMMARY.md (detailed deliverables)
├── README.md (this file)
└── Google Gemini.pdf (original spec reference)
```

## Technical Details

**Hooks Used:**
- `useState` — view, onboarding step, modal states
- `useReducer` — global app state
- `useMemo` — cached calculations (balance, recent logs)
- `useCallback` — not currently used but ready for expansion
- `useRef` — file input for JSON import

**Styling:**
- Tailwind CSS utilities only
- Responsive breakpoints (mobile-first)
- No custom CSS classes

**Charts:**
- recharts LineChart (domain trend visualization)
- Simple line plots (RPE over session count)

## Next Steps (Future Enhancements)

1. Per-exercise weight logging in-session
2. Calisthenics auto-level-up trigger (3 sessions @RPE<7)
3. Timer/round clock (countdown for rounds)
4. Running distance/time logger
5. Progressive overload history per exercise
6. Sparring/live session tracking
7. Injury flag system (auto-substitute exercises)

## Testing Checklist

- [ ] Onboarding completes (2 steps)
- [ ] Dashboard shows profile and balance
- [ ] Session type picker loads all 5 buttons
- [ ] Workouts generate correctly per type
- [ ] RPE/recovery modal functions
- [ ] Session logging updates history
- [ ] Progress view shows trends
- [ ] Calisthenics level up/down works
- [ ] Settings edit profile fields
- [ ] Export JSON downloads file
- [ ] Import JSON restores state
- [ ] Bottom nav switches views
- [ ] All aesthetic (dark, red, mono) applied

## Support

Refer to CLAUDE.md for project context and decision history.
Refer to V3_IMPLEMENTATION_SUMMARY.md for feature checklist.

---

**Version:** V3
**Status:** Complete & Ready
**Last Updated:** 2026-03-02
