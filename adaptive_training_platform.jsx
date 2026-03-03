import React, { useState, useReducer, useMemo, useEffect, useRef } from 'react';
import { Home, Dumbbell, TrendingUp, List, Settings, ArrowLeft, Download, Upload, Zap, AlertTriangle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FREQUENCY_TARGETS = {
  gym:        { perWeek: 4, label: 'STRENGTH & SKILLS', color: 'text-yellow-400', icon: '🏋️' },
  martialArts:{ perWeek: 3, label: 'MARTIAL ARTS',      color: 'text-red-500',    icon: '🥊' },
  running:    { perWeek: 3, label: 'RUNNING',            color: 'text-blue-400',   icon: '🏃' },
  mobility:   { perWeek: 2, label: 'MOBILITY',           color: 'text-purple-400', icon: '🧘' },
};

const SESSION_TYPES = Object.keys(FREQUENCY_TARGETS);
const DOMAIN_KEYS = ['strength', 'calisthenics', 'striking', 'grappling', 'conditioning', 'mobility'];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseMmSsToSeconds(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
}

function formatPace(secondsPerKm) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function slugify(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createProgramConfig() {
  return {
    mode: 'rolling',
    coachStyle: 'adaptive-flexible',
    defaultSessionMinutes: 60,
    adaptationAggressiveness: 'moderate',
    priorityProfile: 'balanced_complete_athlete',
    useWearable: false,
    featureFlags: {
      adaptiveEngine: true,
      legacyRandom: false,
    },
  };
}

function createReadiness() {
  return {
    inputs: {
      sleep: 7,
      stress: 4,
      soreness: 3,
      motivation: 7,
      hrvDelta: '',
      restingHrDelta: '',
    },
    score: 72,
    band: 'moderate',
    updatedAt: null,
  };
}

function createAthleteModel() {
  return {
    domainScores: {
      strength: 50,
      calisthenics: 50,
      striking: 50,
      grappling: 50,
      conditioning: 50,
      mobility: 50,
    },
    controlScore: 50,
    fatigueDebt: 0,
    consistencyScore: 0,
    adaptationConfidence: 0.1,
    readinessTrend: [],
    performanceTrend: [],
  };
}

function createProgression() {
  return {
    exercises: {},
    skills: {},
    stalledItems: [],
    highRPEStreak: 0,
    deloadRecommended: false,
    lastAdaptationSummary: 'No adaptation yet',
  };
}

function createConstraints() {
  return {
    injuries: {
      shoulder: false,
      back: false,
      knee: false,
    },
    unavailableEquipment: [],
    blockedPatterns: [],
    timeOverrideMinutes: null,
  };
}

function createMuscleRecovery() {
  const MUSCLE_RECOVERY_HOURS = {
    quads: 72, hamstrings: 72, glutes: 72, chest: 48, back: 72,
    shoulders: 48, arms: 48, core: 24, lowerBack: 72, hipFlexors: 48,
    calves: 48, fullBody: 72,
  };
  return Object.fromEntries(
    Object.entries(MUSCLE_RECOVERY_HOURS).map(([muscle, hours]) => [
      muscle,
      { lastTrained: null, recoveryHours: hours, status: 'fresh' }
    ])
  );
}

function getMuscleStatus(muscleEntry) {
  if (!muscleEntry.lastTrained) return 'fresh';
  const hoursSince = (Date.now() - new Date(muscleEntry.lastTrained).getTime()) / 3600000;
  const pct = hoursSince / muscleEntry.recoveryHours;
  if (pct >= 1) return 'fresh';
  if (pct >= 0.5) return 'recovering';
  return 'fatigued';
}

function updateMuscleRecovery(muscleRecovery, exercises) {
  const updated = { ...muscleRecovery };
  const now = new Date().toISOString();
  for (const ex of exercises || []) {
    for (const muscle of ex.muscles || []) {
      if (muscle === 'fullBody') {
        // update all muscles
        for (const key of Object.keys(updated)) {
          updated[key] = { ...updated[key], lastTrained: now };
        }
      } else if (updated[muscle]) {
        updated[muscle] = { ...updated[muscle], lastTrained: now };
      }
    }
  }
  // recompute status
  return Object.fromEntries(
    Object.entries(updated).map(([k, v]) => [k, { ...v, status: getMuscleStatus(v) }])
  );
}

function getMuscleRecoveryAdvice(muscleRecovery) {
  const entries = Object.entries(muscleRecovery || {});
  const fatigued = entries.filter(([, v]) => v.status === 'fatigued').map(([k]) => k);
  const recovering = entries.filter(([, v]) => v.status === 'recovering').map(([k]) => k);
  const total = entries.length || 1;
  const score = Math.round(((total - fatigued.length - recovering.length * 0.5) / total) * 100);
  return { fatiguedMuscles: fatigued, recoveringMuscles: recovering, recoveryScore: clamp(score, 0, 100) };
}

function createAIConfig() {
  return {
    enabled: false,
    apiKey: '',
    model: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    coachingNotes: null,
    coachingLoading: false,
    coachingError: null,
  };
}

function createPlanState() {
  return {
    generatedAt: null,
    primaryRecommendation: null,
    secondaryRecommendation: null,
    reasonText: 'Complete readiness check to get today\'s recommendation.',
    weeklyFocus: 'Build balanced exposure across all domains.',
    watchout: 'No current watchout',
    upcoming: [],
    acknowledgedPrompts: {},
    progressionPrompts: [],
    weeklySummary: null,
    weeklySummaryGeneratedAt: null,
    weeklySummaryLoading: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE DATABASE
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_DB = {
  strength: {
    legs: [
      { name: 'Back Squat',            sets: 5, reps: '5',       rpe: 8, visual: 'squat',     muscles: ['quads','glutes','lowerBack','core'] },
      { name: 'Deadlift',              sets: 4, reps: '5',       rpe: 8, visual: 'deadlift',  muscles: ['hamstrings','glutes','lowerBack','back'] },
      { name: 'Front Squat',           sets: 4, reps: '4',       rpe: 8, visual: 'squat',     muscles: ['quads','glutes','core'] },
      { name: 'Romanian Deadlift',     sets: 4, reps: '8',       rpe: 7, visual: 'deadlift',  muscles: ['hamstrings','glutes','lowerBack'] },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8/side',  rpe: 8, visual: 'squat',     muscles: ['quads','glutes','hipFlexors'] },
      { name: 'Nordic Curl',           sets: 3, reps: '5',       rpe: 8, visual: 'plank',     muscles: ['hamstrings'] },
      { name: 'Hip Thrust (BB)',        sets: 4, reps: '10',      rpe: 7, visual: 'athletic', muscles: ['glutes','hamstrings'] },
      { name: 'Walking Lunges (BB)',    sets: 3, reps: '12/side', rpe: 7, visual: 'squat',     muscles: ['quads','glutes','hamstrings'] },
      { name: 'Box Jumps',             sets: 4, reps: '5',       rpe: 7, visual: 'athletic', muscles: ['quads','glutes','calves'] },
      { name: 'Leg Press',             sets: 4, reps: '10',      rpe: 7, visual: 'squat',     muscles: ['quads','glutes'] },
      { name: 'Sled Push',             sets: 6, reps: '20m',     rpe: 8, visual: 'run',       muscles: ['quads','glutes','calves'] },
    ],
    upper: [
      { name: 'Bench Press',           sets: 4, reps: '6',       rpe: 8, visual: 'bench',     muscles: ['chest','shoulders','arms'] },
      { name: 'Overhead Press',        sets: 4, reps: '6',       rpe: 8, visual: 'ohp',       muscles: ['shoulders','arms','core'] },
      { name: 'Barbell Row',           sets: 4, reps: '8',       rpe: 7, visual: 'deadlift',  muscles: ['back','arms','core'] },
      { name: 'Weighted Pull-ups',     sets: 4, reps: '6',       rpe: 8, visual: 'pullup',    muscles: ['back','arms'] },
      { name: 'Power Clean',           sets: 5, reps: '3',       rpe: 8, visual: 'athletic',  muscles: ['fullBody'] },
      { name: 'Weighted Dips',         sets: 4, reps: '8',       rpe: 7, visual: 'pushup',    muscles: ['chest','arms','shoulders'] },
      { name: 'Landmine Press',        sets: 3, reps: '10/side', rpe: 7, visual: 'ohp',       muscles: ['shoulders','chest','core'] },
      { name: 'Pendlay Row',           sets: 4, reps: '6',       rpe: 8, visual: 'deadlift',  muscles: ['back','arms'] },
      { name: 'Farmer Carries',        sets: 4, reps: '40m',     rpe: 7, visual: 'athletic',  muscles: ['fullBody','core'] },
      { name: 'Turkish Get-up',        sets: 3, reps: '3/side',  rpe: 7, visual: 'ohp',       muscles: ['fullBody','shoulders','core'] },
    ],
    full: [
      { name: 'Power Clean + Jerk',    sets: 5, reps: '3',  rpe: 9, visual: 'ohp',       muscles: ['fullBody'] },
      { name: 'Trap Bar Deadlift',     sets: 4, reps: '5',  rpe: 8, visual: 'deadlift',  muscles: ['quads','hamstrings','glutes','back'] },
      { name: 'KB Swings',             sets: 5, reps: '15', rpe: 7, visual: 'athletic',  muscles: ['glutes','hamstrings','back','core'] },
      { name: 'Medball Slams',         sets: 4, reps: '10', rpe: 7, visual: 'athletic',  muscles: ['fullBody','core'] },
      { name: 'Battle Ropes',          sets: 5, reps: '30s',rpe: 8, visual: 'athletic',  muscles: ['arms','shoulders','core'] },
    ],
  },

  calisthenics: {
    pullUp: [
      { level:1, name:'Dead Hang',              sets:3, reps:'30s',       cue:'Passive hang, scapula packed',           visual:'pullup',   muscles: ['back','arms'] },
      { level:2, name:'Scapular Pulls',          sets:3, reps:'10',        cue:'Depress and retract scapula only',       visual:'pullup',   muscles: ['back','arms'] },
      { level:3, name:'Band-Assisted Pull-ups',  sets:3, reps:'8',         cue:'Full ROM, control the descent',          visual:'pullup',   muscles: ['back','arms'] },
      { level:4, name:'Negative Pull-ups',       sets:4, reps:'5',         cue:'5-second slow descent',                  visual:'pullup',   muscles: ['back','arms'] },
      { level:5, name:'Pull-ups',                sets:4, reps:'8',         cue:'Chest to bar, elbows down',              visual:'pullup',   muscles: ['back','arms'] },
      { level:6, name:'Archer Pull-ups',         sets:3, reps:'5/side',    cue:'Lateral lean, far arm nearly straight',  visual:'pullup',   muscles: ['back','arms'] },
      { level:7, name:'Weighted Pull-ups',       sets:4, reps:'5',         cue:'Add 10kg+, control tempo',               visual:'pullup',   muscles: ['back','arms'] },
      { level:8, name:'L-Pull-ups',              sets:3, reps:'5',         cue:'Legs parallel to floor throughout',      visual:'plank',    muscles: ['back','arms'] },
      { level:9, name:'Muscle-up',               sets:3, reps:'3',         cue:'Explosive pull, fast transition',         visual:'pullup',   muscles: ['back','arms'] },
    ],
    pushUp: [
      { level:1, name:'Incline Push-ups',          sets:3, reps:'15',     cue:'Hands elevated, full ROM',               visual:'pushup',  muscles: ['chest','arms','shoulders'] },
      { level:2, name:'Standard Push-ups',         sets:4, reps:'20',     cue:'Rigid plank, elbows 45°',                visual:'pushup',  muscles: ['chest','arms','shoulders'] },
      { level:3, name:'Diamond Push-ups',          sets:3, reps:'15',     cue:'Hands together, tricep focus',           visual:'pushup',  muscles: ['chest','arms','shoulders'] },
      { level:4, name:'Pike Push-ups',             sets:3, reps:'12',     cue:'Hips high, head toward floor',           visual:'ohp',     muscles: ['chest','arms','shoulders'] },
      { level:5, name:'Decline Push-ups',          sets:3, reps:'15',     cue:'Feet elevated, upper chest',             visual:'pushup',  muscles: ['chest','arms','shoulders'] },
      { level:6, name:'Archer Push-ups',           sets:3, reps:'8/side', cue:'One arm loaded, other straight',         visual:'pushup',  muscles: ['chest','arms','shoulders'] },
      { level:7, name:'Pseudo-Planche Push-ups',   sets:3, reps:'8',      cue:'Hands by hips, lean forward',            visual:'pushup',  muscles: ['chest','arms','shoulders'] },
    ],
    squat: [
      { level:1, name:'Assisted Pistol Squat', sets:3, reps:'8/side', cue:'Hold support, full depth',      visual:'squat',  muscles: ['quads','glutes'] },
      { level:2, name:'Box Pistol Squat',      sets:3, reps:'6/side', cue:'Touch box at bottom',           visual:'squat',  muscles: ['quads','glutes'] },
      { level:3, name:'Pistol Squat',          sets:4, reps:'6/side', cue:'Heel flat, balance point',      visual:'squat',  muscles: ['quads','glutes'] },
      { level:4, name:'Shrimp Squat',          sets:3, reps:'6/side', cue:'Back foot held, knee to floor', visual:'squat',  muscles: ['quads','glutes'] },
      { level:5, name:'Weighted Pistol Squat', sets:4, reps:'5/side', cue:'Hold weight for progressive load', visual:'squat',  muscles: ['quads','glutes'] },
    ],
    core: [
      { level:1, name:'Plank',            sets:3, reps:'45s', cue:'Neutral spine, squeeze glutes',     visual:'plank',    muscles: ['core'] },
      { level:2, name:'Hollow Body Hold', sets:3, reps:'30s', cue:'Lower back pressed to floor',       visual:'plank',    muscles: ['core'] },
      { level:3, name:'Tuck L-Sit',       sets:4, reps:'15s', cue:'Knees to chest, arms locked',       visual:'plank',    muscles: ['core'] },
      { level:4, name:'Ab Wheel Rollout', sets:3, reps:'10',  cue:'Hips down, full extension',         visual:'plank',    muscles: ['core'] },
      { level:5, name:'L-Sit (Floor)',    sets:4, reps:'20s', cue:'Legs straight, hips off floor',     visual:'plank',    muscles: ['core'] },
      { level:6, name:'Dragon Flag',      sets:3, reps:'5',   cue:'Slow descent, stay rigid',           visual:'plank',    muscles: ['core'] },
    ],
    handstand: [
      { level:1, name:'Wall Kick-up',          sets:5, reps:'30s',        cue:'Chest to wall, kick up controlled',   visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:2, name:'Wall Handstand Hold',   sets:5, reps:'45s',        cue:'Straight body, push floor away',      visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:3, name:'Chest-to-Wall HS',      sets:4, reps:'30s',        cue:'Slightly hollow, finger pressure',    visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:4, name:'Kick to Freestanding',  sets:5, reps:'5 attempts', cue:'Find the balance point slowly',       visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:5, name:'Freestanding HS Hold',  sets:5, reps:'10s',        cue:'Find balance, breathe, adjust',       visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:6, name:'Handstand Walk',        sets:3, reps:'5m',         cue:'Shift weight through fingers',        visual:'handstand',  muscles: ['shoulders','arms','core'] },
      { level:7, name:'HSPU (Wall)',            sets:4, reps:'5',          cue:'Head to floor, press explosively',    visual:'handstand',  muscles: ['shoulders','arms','core'] },
    ],
  },

  running: [
    { name:'Easy Run',          distance:'5km',   zone:'Zone 2',   targetRPE:5, desc:'Conversational pace, nasal breathing', visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'Long Run',          distance:'10km',  zone:'Zone 2-3', targetRPE:6, desc:'Steady aerobic base build',            visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'Tempo Run',         distance:'5km',   zone:'Zone 4',   targetRPE:7, desc:'Comfortably hard, lactate threshold',  visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'400m Intervals',    distance:'8×400m',zone:'Zone 5',   targetRPE:9, desc:'90s rest between reps',               visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'800m Intervals',    distance:'5×800m',zone:'Zone 4-5', targetRPE:8, desc:'2min rest between reps',              visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'Fartlek',           distance:'6km',   zone:'Mixed',    targetRPE:7, desc:'30s surge / 60s easy, unstructured',  visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'Hill Sprints',      distance:'10×80m',zone:'Zone 5',   targetRPE:9, desc:'Max effort uphill, walk back down',   visual:'run',  muscles: ['quads','hamstrings','calves'] },
    { name:'Recovery Walk/Run', distance:'4km',   zone:'Zone 1',   targetRPE:3, desc:'Very easy, flush legs',               visual:'run',  muscles: ['quads','hamstrings','calves'] },
  ],

  striking: [
    { name:'Shadow Boxing',           duration:'5×3min', focus:'Footwork + Combos',          rpe:6, visual:'strike',  muscles: ['fullBody'] },
    { name:'Heavy Bag — Power Shots', duration:'5×2min', focus:'Hooks + Cross + Kicks',       rpe:8, visual:'strike',  muscles: ['fullBody'] },
    { name:'Pad Work (Solo Drill)',    duration:'4×3min', focus:'Combo sequences',             rpe:7, visual:'strike',  muscles: ['fullBody'] },
    { name:'Teep + Roundkick Drill',  duration:'4×2min', focus:'Range control',               rpe:7, visual:'strike',  muscles: ['fullBody'] },
    { name:'Defensive Slipping',      duration:'4×2min', focus:'Head movement',               rpe:6, visual:'strike',  muscles: ['fullBody'] },
    { name:'Clinch Knees (Solo)',      duration:'3×3min', focus:'Clinch entries + knees',      rpe:7, visual:'strike',  muscles: ['fullBody'] },
    { name:'Combination Drilling',    duration:'5×2min', focus:'6-punch + kick combos',       rpe:7, visual:'strike',  muscles: ['fullBody'] },
    { name:'Switch Kick Practice',    duration:'3×3min', focus:'Hip rotation + timing',       rpe:7, visual:'strike',  muscles: ['fullBody'] },
  ],

  grappling: [
    { name:'Guard Passing Drill',     duration:'4×5min', focus:'Toreando + Over-Under',               rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Takedown Drilling',       duration:'4×3min', focus:'Double leg + Single leg',              rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Submission Chain Drill',  duration:'3×5min', focus:'Armbar → Triangle → Omoplata',         rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Positional Drilling',     duration:'5×3min', focus:'Side control → Mount transitions',     rpe:6, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Guard Retention',         duration:'4×3min', focus:'Hip escapes + frames',                 rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Wrestling Flow',          duration:'4×3min', focus:'Level changes + sprawl',               rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Leg Lock Entry Drill',    duration:'3×5min', focus:'Heel hook + Knee bar entries',         rpe:7, visual:'grapple',  muscles: ['fullBody'] },
    { name:'Turtle + Back Take',      duration:'3×4min', focus:'Gut wrench + back body triangle',      rpe:7, visual:'grapple',  muscles: ['fullBody'] },
  ],

  mobility: [
    { name:'Hip Flexor + Quad Flow', duration:'15min', focus:'Couch stretch, 90/90, pigeon',                      visual:'mobility',  muscles: ['fullBody'] },
    { name:'Shoulder + Thoracic',    duration:'15min', focus:'Band dislocates, thoracic rotation, chest opener',   visual:'mobility',  muscles: ['fullBody'] },
    { name:'Full Body Morning Flow', duration:'20min', focus:'Sun salutations + leg swings + spine waves',         visual:'mobility',  muscles: ['fullBody'] },
    { name:'Splits Progression',     duration:'20min', focus:'Front split + straddle work',                        visual:'mobility',  muscles: ['fullBody'] },
    { name:'Ankle + Knee Stability', duration:'15min', focus:'ATG split squat, tibialis raises, calf work',        visual:'mobility',  muscles: ['fullBody'] },
    { name:'Breath + Recovery',      duration:'20min', focus:'Box breathing, progressive relaxation',              visual:'mobility',  muscles: ['fullBody'] },
    { name:'Loaded Stretching',      duration:'20min', focus:'Jefferson curl, pancake drill, RDL stretch',         visual:'mobility',  muscles: ['fullBody'] },
  ],
};

const MICRO_BREAK_MOBILITY_FLOWS = [
  {
    id: 'mobility_micro_2_neck_reset',
    name: 'Desk Neck + Breath Reset',
    duration: '2min',
    focus: 'Undo desk posture fast',
    desc: 'Neck relief + shoulder reset + calming breath',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 2,
      steps: [
        '40s chin tucks + neck glide',
        '40s wall angels',
        '40s box breathing',
      ],
    },
  },
  {
    id: 'mobility_micro_2_hip_ankle',
    name: 'Hip + Ankle Wake-Up',
    duration: '2min',
    focus: 'Open hips and ankles before next work block',
    desc: 'Counter sitting stiffness quickly',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 2,
      steps: [
        '40s standing hip circles',
        '40s ankle rocks (each side)',
        '40s nasal breathing march',
      ],
    },
  },
  {
    id: 'mobility_micro_3_tspine',
    name: 'Thoracic Desk Unlock',
    duration: '3min',
    focus: 'Restore upper-back rotation',
    desc: 'Great between long laptop blocks',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 3,
      steps: [
        '60s thoracic open books',
        '60s doorway chest opener',
        '60s deep squat breathing',
      ],
    },
  },
  {
    id: 'mobility_micro_3_spine_reset',
    name: 'Spine Reset Flow',
    duration: '3min',
    focus: 'Flexion-extension balance for back comfort',
    desc: 'Gentle spinal hygiene sequence',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 3,
      steps: [
        '60s cat-cow',
        '60s standing forward fold + hang',
        '60s wall-supported extension',
      ],
    },
  },
  {
    id: 'mobility_micro_5_full_reset',
    name: 'Full Desk Reset',
    duration: '5min',
    focus: 'Posture, hips, shoulders, and downshift',
    desc: 'Balanced full-body cool-off between tasks',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 5,
      steps: [
        '90s couch stretch (switch sides)',
        '90s thoracic rotation + reach',
        '120s box breathing walk',
      ],
    },
  },
  {
    id: 'mobility_micro_5_posterior_chain',
    name: 'Posterior Chain Refresh',
    duration: '5min',
    focus: 'Release hamstrings and lower back tension',
    desc: 'Desk-to-move reset for long seated work',
    visual: 'mobility',
    domain: 'mobility',
    pattern: 'mobility',
    progressionType: 'duration',
    muscles: ['fullBody'],
    microFlow: {
      minutes: 5,
      steps: [
        '90s hamstring hinge pulses',
        '90s glute bridge hold + reps',
        '120s crocodile breathing',
      ],
    },
  },
];

function inferProgressionType(ex, domain) {
  if (domain === 'strength') return 'load';
  if (domain === 'calisthenics') return 'skillLevel';
  if (domain === 'running') return 'pace';
  if (domain === 'mobility') return 'duration';
  if (domain === 'striking' || domain === 'grappling') return 'density';
  return ex.duration ? 'duration' : 'reps';
}

function inferPattern(ex, domain) {
  const n = (ex.name || '').toLowerCase();
  if (domain === 'strength' && (n.includes('squat') || n.includes('deadlift') || n.includes('lunge'))) return 'lower';
  if (domain === 'strength' && (n.includes('press') || n.includes('row') || n.includes('pull'))) return 'upper';
  if (domain === 'running') return 'aerobic';
  if (domain === 'mobility') return 'mobility';
  if (domain === 'calisthenics' && n.includes('handstand')) return 'inversion';
  if (domain === 'calisthenics' && (n.includes('pull') || n.includes('muscle'))) return 'vertical-pull';
  if (domain === 'calisthenics') return 'body-control';
  return domain;
}

function enrichExercise(item, domain, group, idx) {
  const id = item.id || `${domain}_${group}_${slugify(item.name)}_${idx + 1}`;
  return {
    ...item,
    id,
    domain: item.domain || domain,
    pattern: item.pattern || inferPattern(item, domain),
    progressionType: item.progressionType || inferProgressionType(item, domain),
    prerequisites: Array.isArray(item.prerequisites) ? item.prerequisites : [],
    alternatives: Array.isArray(item.alternatives) ? item.alternatives : [],
    difficultyTier: item.difficultyTier || 'base',
  };
}

function enrichExerciseDB(db) {
  return {
    ...db,
    strength: {
      legs: db.strength.legs.map((ex, i) => enrichExercise(ex, 'strength', 'legs', i)),
      upper: db.strength.upper.map((ex, i) => enrichExercise(ex, 'strength', 'upper', i)),
      full: db.strength.full.map((ex, i) => enrichExercise(ex, 'strength', 'full', i)),
    },
    calisthenics: Object.fromEntries(
      Object.entries(db.calisthenics).map(([skill, arr]) => [skill, arr.map((ex, i) => enrichExercise(ex, 'calisthenics', skill, i))]),
    ),
    running: db.running.map((ex, i) => enrichExercise(ex, 'running', 'running', i)),
    striking: db.striking.map((ex, i) => enrichExercise(ex, 'striking', 'striking', i)),
    grappling: db.grappling.map((ex, i) => enrichExercise(ex, 'grappling', 'grappling', i)),
    mobility: db.mobility.map((ex, i) => enrichExercise(ex, 'mobility', 'mobility', i)),
  };
}

const EXERCISE_DB_V5 = enrichExerciseDB(EXERCISE_DB);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

function createInitialState() {
  return {
    view: 'home',
    onboarded: false,
    onboardStep: 0,
    profile: {
      name: '',
      age: '',
      trainingAge: 'intermediate',
      bodyweight: '',
      currentBlock: 'accumulation',
      blockWeek: 1,
      sessionCount: 0,
      timeByDay: { mon: 60, tue: 60, wed: 60, thu: 60, fri: 60, sat: 90, sun: 60 },
      skillAssessments: {
        maxPullUps: 0,
        maxPushUps: 0,
        squatRM: 0,
        deadliftRM: 0,
        benchRM: 0,
        runningPaceEasy: 0,
        tuckPlancheHold: 0,
        handstandHold: 0,
      },
      primaryGoal: 'complete_athlete',
      goals: [],
    },
    programConfig: createProgramConfig(),
    athleteModel: createAthleteModel(),
    progression: createProgression(),
    readiness: createReadiness(),
    planState: createPlanState(),
    constraints: createConstraints(),
    muscleRecovery: createMuscleRecovery(),
    aiConfig: createAIConfig(),
    decisionLog: [],
    domains: {
      strength:     { level:2, sessions:0, prs:{ squat:0, deadlift:0, bench:0, ohp:0, row:0 }, trend:[] },
      calisthenics: {
        level:1, sessions:0, trend:[],
        skills: {
          pullUp:    { level:1, maxReps:0, notes:'' },
          pushUp:    { level:1, maxReps:0, notes:'' },
          squat:     { level:1, maxReps:0, notes:'' },
          core:      { level:1, holdTime:0, notes:'' },
          handstand: { level:1, holdTime:0, notes:'' },
        },
      },
      striking:     { level:1, sessions:0, trend:[] },
      grappling:    { level:1, sessions:0, trend:[] },
      mobility:     { level:1, sessions:0, trend:[] },
      conditioning: { level:1, sessions:0, vo2estimate:35, weeklyKm:0, weeklyKmResetAt:null, trend:[] },
    },
    sessionLogs: [],
    lastSessionTypes: [],
    activeSession: null,
    currentSessionType: null,
    currentMASubtype: null,
  };
}

const INITIAL_STATE = createInitialState();

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI API
// ─────────────────────────────────────────────────────────────────────────────

async function callGeminiAPI(apiKey, endpoint, userContext, workout) {
  const systemPrompt = `You are an elite personal trainer and coach with deep expertise in strength training, calisthenics, martial arts (Muay Thai, Boxing, BJJ, Wrestling), sports science, and human anatomy. You give concise, practical coaching advice tailored to the specific athlete.`;

  const contextText = `
ATHLETE: ${userContext.name}, ${userContext.age}yo, ${userContext.bodyweight}kg, intermediate level
CURRENT BLOCK: ${userContext.currentBlock} (Target RPE: ${userContext.targetRPE})
READINESS: ${userContext.readinessScore}/100 (${userContext.readinessBand}) — Sleep: ${userContext.sleep}/10, Stress: ${userContext.stress}/10
PRIMARY GOAL: ${userContext.primaryGoal}
SESSION TYPE: ${userContext.sessionType} — ${userContext.timeAvailable} minutes available
MUSCLE RECOVERY: ${userContext.fatiguedMuscles.length > 0 ? 'Fatigued: ' + userContext.fatiguedMuscles.join(', ') : 'All muscles fresh'}
RECENT SESSIONS (last 3): ${userContext.recentSessions}
INJURIES: ${userContext.injuries}
SKILL LEVELS: Pull-up L${userContext.pullUpLevel}, Handstand L${userContext.handstandLevel}, Squat L${userContext.squatLevel}

TODAY'S WORKOUT:
${workout.map((ex, i) => `${i + 1}. ${ex.name} — ${ex.sets ? ex.sets + '×' + ex.reps : ex.duration || ex.distance || ''}`).join('\n')}
`;

  const prompt = `${contextText}

Respond ONLY with a valid JSON object (no markdown, no code blocks) in this exact format:
{
  "sessionFocus": "2 sentences max: what to focus on and why today",
  "watchOut": "1 sentence: biggest risk or thing to be careful about today",
  "exercises": {
    "EXERCISE_NAME": {
      "cue": "1 specific coaching cue for this athlete",
      "why": "1 sentence: why this exercise today"
    }
  }
}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  };

  const res = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

async function callGeminiWeeklySummary(apiKey, endpoint, weekContext) {
  const prompt = `You are an elite personal trainer reviewing an athlete's training week. Be direct, specific, and actionable.

ATHLETE: ${weekContext.name}, ${weekContext.age}yo, ${weekContext.bodyweight}kg
WEEK: ${weekContext.weekStart} to ${weekContext.weekEnd}
PRIMARY GOAL: ${weekContext.primaryGoal}
CURRENT BLOCK: ${weekContext.currentBlock}

THIS WEEK'S SESSIONS (${weekContext.sessionCount} total):
${weekContext.sessionSummaries}

ADAPTATION OUTCOMES:
${weekContext.adaptationSummary}

PROGRESSION NOTES:
${weekContext.progressionNotes}

AVG READINESS: ${weekContext.avgReadiness}/100
AVG SESSION RPE: ${weekContext.avgRPE}/10

Respond ONLY with valid JSON (no markdown):
{
  "headline": "1 bold sentence summarising the week",
  "wins": ["up to 3 specific things that went well"],
  "concerns": ["up to 2 things to watch or address"],
  "nextWeekFocus": "1-2 sentences on what to prioritise next week",
  "recommendation": "one specific actionable thing to do differently next week"
}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  };

  const res = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

function getReadinessBand(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

function calculateReadiness(inputs) {
  const sleep = clamp(toNum(inputs.sleep, 7), 1, 10);
  const stress = clamp(toNum(inputs.stress, 4), 1, 10);
  const soreness = clamp(toNum(inputs.soreness, 3), 1, 10);
  const motivation = clamp(toNum(inputs.motivation, 7), 1, 10);
  const subjective = ((sleep * 3) + ((11 - stress) * 2.5) + ((11 - soreness) * 2.0) + (motivation * 2.5)) / 10;

  const hrvDelta = toNum(inputs.hrvDelta, 0);
  const restingHrDelta = toNum(inputs.restingHrDelta, 0);
  const wearableAdj = clamp((hrvDelta * 1.5) - (restingHrDelta * 1.2), -12, 12);

  const score = clamp(Math.round(subjective + wearableAdj), 0, 100);
  return { score, band: getReadinessBand(score) };
}

function getDomainFromType(type, maSubtype) {
  if (type === 'martialArts') return maSubtype === 'striking' ? 'striking' : 'grappling';
  // gym now covers both strength and calisthenics — primary domain is strength
  return { gym:'strength', calisthenics:'strength', running:'conditioning', mobility:'mobility' }[type] || null;
}

// Returns all domains affected by a session type (for dual-domain updates)
function getDomainsFromType(type, maSubtype) {
  if (type === 'martialArts') return [maSubtype === 'striking' ? 'striking' : 'grappling'];
  if (type === 'gym') return ['strength', 'calisthenics']; // gym covers both
  if (type === 'calisthenics') return ['strength', 'calisthenics']; // legacy compat
  return [getDomainFromType(type, maSubtype)].filter(Boolean);
}

function getMartialArtsSubtype(sessionLogs) {
  for (let i = sessionLogs.length - 1; i >= 0; i--) {
    if (sessionLogs[i]?.type !== 'martialArts') continue;
    if (sessionLogs[i]?.maSubtype === 'striking') return 'grappling';
    if (sessionLogs[i]?.maSubtype === 'grappling') return 'striking';
    return 'striking';
  }
  return 'striking';
}

function getWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getSessionBalance(logs, now = new Date()) {
  const weekStart = getWeekStart(now);
  const balance = { gym:0, martialArts:0, running:0, mobility:0 };
  for (const log of logs || []) {
    if (new Date(log.timestamp) >= weekStart) {
      // Legacy 'calisthenics' logs count toward gym
      const key = log.type === 'calisthenics' ? 'gym' : log.type;
      if (key in balance) balance[key] = (balance[key] || 0) + 1;
    }
  }
  return balance;
}

function getRecentLogs(logs, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return (logs || []).filter(log => new Date(log.timestamp) >= cutoff);
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function enrichPrescribedExercise(ex, state, intensityTag) {
  const volumeScale = intensityTag === 'low' ? 0.75 : intensityTag === 'high' ? 1.1 : 1;
  const nextHint = state.progression.exercises[ex.id]?.nextPrescription || null;
  const prescribedSets = ex.sets ? clamp(Math.round(ex.sets * volumeScale), 1, 10) : null;

  return {
    ...ex,
    sets: prescribedSets || ex.sets,
    prescribedLoadHint: nextHint?.loadHint || '',
    prescribedNote: nextHint?.note || '',
  };
}

function generateWorkout(type, state, maSubtype, intensityTag = 'moderate', timeMinutes = 60, sessionVariant = null) {
  const timeBase = timeMinutes <= 30 ? 2 : timeMinutes <= 45 ? 3 : timeMinutes <= 60 ? 5 : timeMinutes <= 75 ? 6 : 7;
  const coachStyle = state.programConfig?.coachStyle || 'adaptive-flexible';
  const styleAdjust = coachStyle === 'light-touch' ? -1 : 0;
  const capExercises = Math.max(2, timeBase + styleAdjust);

  // Strict: sort alphabetically instead of random for deterministic sessions
  const sortFn = coachStyle === 'strict'
    ? (a, b) => a.name.localeCompare(b.name)
    : () => Math.random() - 0.5;

  const blockedPatterns = getBlockedPatterns(state.constraints);
  const isSafe = (ex) => !blockedPatterns.includes(ex.pattern);

  let exercises = [];

  if (type === 'gym') {
    const safeLower = EXERCISE_DB_V5.strength.legs.filter(isSafe);
    const safeUpper = EXERCISE_DB_V5.strength.upper.filter(isSafe);
    const safeFull = EXERCISE_DB_V5.strength.full.filter(isSafe);
    const lowerPool = safeLower.length ? safeLower : safeUpper;
    const upperPool = safeUpper.length ? safeUpper : safeFull;

    // Split slots: ~55% barbell, ~45% calisthenics skills
    const barbellSlots = Math.ceil(capExercises * 0.55);
    const skillSlots = capExercises - barbellSlots;
    const legs = [...lowerPool].sort(sortFn).slice(0, Math.max(1, Math.ceil(barbellSlots / 2)));
    const upper = [...upperPool].sort(sortFn).slice(0, 1);
    const full = safeFull.length ? [[...safeFull].sort(sortFn)[0]] : [];
    const barbellExs = [...legs, ...upper, ...full].slice(0, barbellSlots);

    // Pick calisthenics skill exercises at current levels
    const skills = state.domains.calisthenics.skills;
    const skillExs = Object.entries(skills)
      .map(([skill, data]) => {
        const db = EXERCISE_DB_V5.calisthenics[skill];
        if (blockedPatterns.includes('inversion') && skill === 'handstand') return db.find(e => e.level <= 2) || db[0];
        if (blockedPatterns.includes('vertical-pull') && skill === 'pullUp') return db.find(e => e.level <= 2) || db[0];
        return db.find(e => e.level === data.level) || db[0];
      })
      .sort(sortFn)
      .slice(0, skillSlots);

    exercises = [...barbellExs, ...skillExs];
  } else if (type === 'martialArts') {
    const db = maSubtype === 'striking' ? EXERCISE_DB_V5.striking : EXERCISE_DB_V5.grappling;
    const safe = blockedPatterns.includes('upper') && maSubtype === 'striking'
      ? db.filter(e => !['strike'].includes(e.visual))
      : db;
    exercises = [...(safe.length ? safe : db)].sort(sortFn).slice(0, capExercises - 1);
  } else if (type === 'running') {
    const safeRun = blockedPatterns.includes('aerobic')
      ? EXERCISE_DB_V5.running.filter(e => e.targetRPE <= 4) // only recovery walk
      : EXERCISE_DB_V5.running;
    exercises = [pickRandom(safeRun.length ? safeRun : EXERCISE_DB_V5.running)];
  } else if (type === 'mobility') {
    if (sessionVariant === 'micro-break') {
      const requestedMinutes = Number(timeMinutes);
      const targetMinutes = [2, 3, 5].includes(requestedMinutes) ? requestedMinutes : 3;
      const exactPool = MICRO_BREAK_MOBILITY_FLOWS.filter(flow => flow.microFlow?.minutes === targetMinutes);
      const fallbackPool = exactPool.length ? exactPool : MICRO_BREAK_MOBILITY_FLOWS.filter(flow => flow.microFlow?.minutes === 3);
      exercises = fallbackPool.length ? [[...fallbackPool].sort(sortFn)[0]] : [];
    } else {
      exercises = [...EXERCISE_DB_V5.mobility].sort(sortFn).slice(0, Math.max(1, capExercises - 2));
    }
  }

  return exercises.filter(Boolean).map(ex => enrichPrescribedExercise(ex, state, intensityTag));
}

function computeAthleteModelFromState(state) {
  const logs = state.sessionLogs || [];
  const recent14 = getRecentLogs(logs, 14);
  const recent30 = getRecentLogs(logs, 30);

  const domainScores = {};
  for (const domain of DOMAIN_KEYS) {
    // Use getDomainsFromType to handle gym covering both strength + calisthenics
    const affectedLogs = logs.filter(log => getDomainsFromType(log.type, log.maSubtype).includes(domain));
    const sessions = affectedLogs.length;
    const quality = affectedLogs.slice(-8).reduce((acc, log) => acc + (log.completionQuality || 60), 0);
    const qAvg = sessions ? quality / Math.min(sessions, 8) : 55;
    domainScores[domain] = clamp(Math.round((sessions * 3) + qAvg * 0.7), 35, 100);
  }

  const fatigueDebt = recent14.reduce((acc, log) => acc + Math.max(0, (toNum(log.rpe, 5) - 7) * 4), 0);
  const consistencyScore = clamp(Math.round((recent14.length / 10) * 100), 0, 100);
  const controlFromSkills = Object.values(state.domains.calisthenics.skills)
    .reduce((acc, skill) => acc + toNum(skill.level, 1), 0);
  const controlScore = clamp(Math.round((controlFromSkills * 4.5) + (domainScores.mobility * 0.4)), 0, 100);
  const adaptationConfidence = clamp(Number((logs.length / 80).toFixed(2)), 0, 1);

  const performanceTrend = recent30.slice(-12).map(log => ({
    x: new Date(log.timestamp).toLocaleDateString(),
    quality: log.completionQuality || 60,
  }));

  return {
    domainScores,
    controlScore,
    fatigueDebt,
    consistencyScore,
    adaptationConfidence,
    readinessTrend: [...(state.athleteModel?.readinessTrend || [])].slice(-20),
    performanceTrend,
  };
}

function computeSessionPriority(type, state, balance, now = new Date()) {
  const target = FREQUENCY_TARGETS[type].perWeek;
  const done = balance[type] || 0;
  const deficitNeed = (target - done) * 12;

  const lastLog = state.sessionLogs[state.sessionLogs.length - 1];
  const freshnessBonus = lastLog?.type === type ? -6 : 4;

  const recent48 = (state.sessionLogs || []).filter(log => (now.getTime() - new Date(log.timestamp).getTime()) <= 48 * 60 * 60 * 1000);
  const sameTypeStrain = recent48
    .filter(log => log.type === type)
    .reduce((acc, log) => acc + Math.max(0, toNum(log.rpe, 5) - 6), 0);
  const fatiguePenalty = sameTypeStrain * 4 + Math.max(0, state.athleteModel.fatigueDebt - 20) * 0.3;

  const progressionUrgency = (state.progression.stalledItems || []).filter(item => item.type === type).length * 8;
  // Skill urgency: gym now includes calisthenics, so low-level skills boost gym priority
  const skillUrgency = type === 'gym'
    ? Object.values(state.domains.calisthenics.skills).reduce((acc, s) => acc + (s.level <= 2 ? 2 : 0), 0) * 2
    : 0;

  const injuries = state.constraints.injuries || {};
  const constraintPenalty =
    ((injuries.knee && (type === 'gym' || type === 'running')) ? 14 : 0) +
    ((injuries.back && type === 'gym') ? 14 : 0) +
    ((injuries.shoulder && (type === 'martialArts' || type === 'gym')) ? 10 : 0);

  // Muscle recovery penalties
  let musclePenalty = 0;
  if (type === 'gym') {
    if (state.muscleRecovery?.quads?.status === 'fatigued' || state.muscleRecovery?.lowerBack?.status === 'fatigued') musclePenalty += 20;
    if (state.muscleRecovery?.shoulders?.status === 'fatigued') musclePenalty += 10;
  } else if (type === 'martialArts') {
    if (state.muscleRecovery?.fullBody?.status === 'fatigued') musclePenalty += 15;
  } else if (type === 'running') {
    if (state.muscleRecovery?.quads?.status === 'fatigued' || state.muscleRecovery?.calves?.status === 'fatigued') musclePenalty += 15;
  }

  const score = deficitNeed + progressionUrgency + skillUrgency + freshnessBonus - fatiguePenalty - constraintPenalty - musclePenalty;
  return { type, score, done, target, deficit: target - done };
}

function buildRollingPlanForState(state) {
  const balance = getSessionBalance(state.sessionLogs);
  const ranked = SESSION_TYPES.map(type => computeSessionPriority(type, state, balance)).sort((a, b) => b.score - a.score);
  const [primary, secondary] = ranked;
  const readiness = state.readiness;
  const timeFit = state.constraints.timeOverrideMinutes || state.programConfig.defaultSessionMinutes;

  const reasonText = primary
    ? `${FREQUENCY_TARGETS[primary.type].label} selected: deficit ${primary.deficit > 0 ? primary.deficit : 0}, readiness ${readiness.score}, fatigue debt ${Math.round(state.athleteModel.fatigueDebt)}`
    : 'No recommendation yet';

  const weeklyFocus = ranked.slice(0, 2).map(r => FREQUENCY_TARGETS[r.type].label).join(' + ');
  const watchout =
    state.athleteModel.fatigueDebt > 35
      ? 'Fatigue debt high: prioritize quality over intensity.'
      : readiness.band === 'low'
        ? 'Low readiness: use recovery-biased session variants.'
        : 'No major risk flags.';

  return {
    generatedAt: new Date().toISOString(),
    primaryRecommendation: primary || null,
    secondaryRecommendation: secondary || null,
    reasonText,
    weeklyFocus,
    watchout,
    upcoming: ranked.slice(0, 4),
    acknowledgedPrompts: { ...(state.planState?.acknowledgedPrompts || {}) },
    timeFit,
  };
}

function getPriorityTypes(balance, state) {
  const ranked = SESSION_TYPES.map(type => computeSessionPriority(type, state, balance))
    .sort((a, b) => b.score - a.score);
  return ranked.map(r => ({ ...r, label: FREQUENCY_TARGETS[r.type].label }));
}

function createExerciseResult(ex) {
  return {
    exerciseId: ex.id,
    prescribed: {
      sets: ex.sets || null,
      reps: ex.reps || '',
      loadHint: ex.prescribedLoadHint || '',
      duration: ex.duration || '',
      distance: ex.distance || '',
      targetRPE: ex.rpe || ex.targetRPE || null,
    },
    performed: {
      setsCompleted: 0,
      topMetric: '',
      effortRPE: ex.rpe || ex.targetRPE || 5,
      pain: false,
    },
    outcome: 'hold',
  };
}

function createSessionFromType(state, type, source = 'manual', timeMinutes = null, options = {}) {
  const sessionVariant = options?.sessionVariant || null;
  const reasonOverride = options?.reasonOverride || null;
  const maSubtype = type === 'martialArts' ? getMartialArtsSubtype(state.sessionLogs) : null;
  const readinessBand = state.readiness.band || 'moderate';
  const intensityTag = readinessBand === 'low' ? 'low' : readinessBand === 'high' ? 'high' : 'moderate';
  const actualTimeMinutes = timeMinutes || state.constraints.timeOverrideMinutes || state.programConfig.defaultSessionMinutes || 60;
  const exercises = generateWorkout(type, state, maSubtype, intensityTag, actualTimeMinutes, sessionVariant);
  const exerciseResults = exercises.map(createExerciseResult);
  const blockRPE = { accumulation:7, intensification:8, realization:9, deload:5 };
  const baseTarget = blockRPE[state.profile.currentBlock] || 7;
  const targetRPE = clamp(baseTarget + (readinessBand === 'high' ? 1 : readinessBand === 'low' ? -1 : 0), 5, 9);

  return {
    id: `session_${Date.now()}`,
    type,
    maSubtype,
    exercises,
    exerciseResults,
    prescription: {
      sessionType: type,
      sessionVariant,
      intensityTag,
      targetRPE,
      reasonText: reasonOverride || state.planState.reasonText,
      source,
      timeFit: actualTimeMinutes,
    },
    readinessSnapshot: {
      score: state.readiness.score,
      band: state.readiness.band,
      inputs: { ...state.readiness.inputs },
      at: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

function evaluateExerciseOutcome(result) {
  const targetRPE = toNum(result.prescribed.targetRPE, 7);
  const sets = toNum(result.prescribed.sets, 0);
  const done = toNum(result.performed.setsCompleted, 0);
  const effort = toNum(result.performed.effortRPE, targetRPE);
  if (result.performed.pain) return 'regress';
  if (sets > 0 && done < Math.max(1, Math.floor(sets * 0.6))) return 'regress';
  if (done >= sets && effort <= targetRPE - 1) return 'advance';
  if (effort >= targetRPE + 2) return 'regress';
  return 'hold';
}

function computeCompletionQuality(rpe, recovery, exerciseResults, targetRPE) {
  const outcomes = exerciseResults || [];
  const completedRatio = outcomes.length
    ? outcomes.filter(r => toNum(r?.performed?.setsCompleted, 0) > 0).length / outcomes.length
    : 0;
  const rpeMatch = 1 - (Math.abs(toNum(rpe, targetRPE) - toNum(targetRPE, 7)) / 10);
  const recoveryNorm = clamp(toNum(recovery, 5) / 10, 0, 1);
  return Math.round(clamp((completedRatio * 45) + (rpeMatch * 35) + (recoveryNorm * 20), 0, 100));
}

function updateProgressionRecords(state, sessionType, exerciseResults, sessionRPE) {
  const progression = {
    ...state.progression,
    exercises: { ...state.progression.exercises },
    stalledItems: [...(state.progression.stalledItems || [])],
  };

  let advanced = 0;
  let regressed = 0;
  let held = 0;

  for (const r of exerciseResults) {
    const outcome = evaluateExerciseOutcome(r);
    const prev = progression.exercises[r.exerciseId] || { exposures: 0, successes: 0, failures: 0, nextPrescription: null, history: [] };
    const historyEntry = {
      date: new Date().toISOString().slice(0, 10),
      topMetric: r.performed?.topMetric || '',
      effortRPE: r.performed?.effortRPE || 0,
      outcome,
    };
    const next = {
      ...prev,
      exposures: prev.exposures + 1,
      lastOutcome: outcome,
      lastTrainedAt: new Date().toISOString(),
      history: [...(prev.history || []).slice(-19), historyEntry],
    };
    if (outcome === 'advance') {
      next.successes = prev.successes + 1;
      next.nextPrescription = { loadHint: '+2.5kg / +1 rep next time', note: 'Progress criteria met' };
      advanced += 1;
    } else if (outcome === 'regress') {
      next.failures = prev.failures + 1;
      next.nextPrescription = { loadHint: '-5% load or reduce volume', note: 'Recovery/technique before loading' };
      regressed += 1;
      const alreadyStalled = progression.stalledItems.some(item => item.id === r.exerciseId);
      if (!alreadyStalled) {
        progression.stalledItems.push({ id: r.exerciseId, type: sessionType, reason: r.performed.pain ? 'pain flag' : 'performance miss' });
      }
    } else {
      next.nextPrescription = { loadHint: 'Repeat previous target', note: 'Hold and consolidate' };
      held += 1;
    }
    progression.exercises[r.exerciseId] = next;
  }

  progression.highRPEStreak = sessionRPE >= 8 ? (state.progression.highRPEStreak || 0) + 1 : 0;
  progression.deloadRecommended = progression.highRPEStreak >= 3 || state.athleteModel.fatigueDebt > 40;
  progression.stalledItems = progression.stalledItems.slice(-20);
  progression.lastAdaptationSummary = `${advanced} advance · ${held} hold · ${regressed} regress`;

  return {
    progression,
    adaptationApplied: {
      summary: progression.lastAdaptationSummary,
      deloadRecommended: progression.deloadRecommended,
      nextFocus: progression.deloadRecommended ? 'Reduce intensity next 1-2 sessions.' : 'Continue progressive overload on advanced lifts.',
    },
  };
}

function completeSessionInternal(state, payload = {}) {
  if (!state.activeSession) return state;

  const rpe = clamp(toNum(payload.rpe, 6), 1, 10);
  const recovery = clamp(toNum(payload.recovery, 6), 1, 10);
  const notes = payload.notes || '';
  const completeAsModified = !!payload.completeAsModified;
  const sessionType = state.currentSessionType;

  const exerciseResults = (state.activeSession.exerciseResults || []).map(r => ({
    ...r,
    outcome: evaluateExerciseOutcome(r),
  }));

  const { progression, adaptationApplied } = updateProgressionRecords(state, sessionType, exerciseResults, rpe);
  const completionQuality = computeCompletionQuality(rpe, recovery, exerciseResults, state.activeSession.prescription?.targetRPE);
  const newLog = {
    ...state.activeSession,
    id: state.activeSession.id || `log_${Date.now()}`,
    rpe,
    recovery,
    notes,
    exerciseResults,
    completionQuality,
    adaptationApplied,
    completedAsModified: completeAsModified,
    completedAt: new Date().toISOString(),
  };

  const domainKeys = getDomainsFromType(sessionType, state.currentMASubtype);
  const newDomains = { ...state.domains };
  for (const domainKey of domainKeys) {
    if (domainKey && newDomains[domainKey]) {
      newDomains[domainKey] = {
        ...newDomains[domainKey],
        sessions: newDomains[domainKey].sessions + 1,
        trend: [...(newDomains[domainKey].trend || []), { s: state.profile.sessionCount + 1, rpe }],
      };
    }
  }
  // Tally running distance from actuals
  if (sessionType === 'running' && newDomains.conditioning) {
    const weekStartIso = getWeekStart(new Date()).toISOString();
    const weekStartMs = Date.parse(weekStartIso);
    const resetAtMs = newDomains.conditioning.weeklyKmResetAt ? Date.parse(newDomains.conditioning.weeklyKmResetAt) : NaN;
    const shouldResetWeeklyKm = !newDomains.conditioning.weeklyKmResetAt || !Number.isFinite(resetAtMs) || resetAtMs < weekStartMs;
    const conditioningBase = shouldResetWeeklyKm
      ? { ...newDomains.conditioning, weeklyKm: 0, weeklyKmResetAt: weekStartIso }
      : { ...newDomains.conditioning };

    const runKm = exerciseResults.reduce((acc, r) => {
      const d = parseFloat(r.performed?.actualDistance);
      return acc + (Number.isFinite(d) ? d : 0);
    }, 0);
    newDomains.conditioning = {
      ...conditioningBase,
      weeklyKm: runKm > 0 ? (toNum(conditioningBase.weeklyKm, 0) + runKm) : toNum(conditioningBase.weeklyKm, 0),
    };
  }

  // Update muscle recovery
  const sessionExercises = state.activeSession?.exercises || [];
  const newMuscleRecovery = updateMuscleRecovery(state.muscleRecovery, sessionExercises);

  const nextState = {
    ...state,
    sessionLogs: [...state.sessionLogs, newLog],
    lastSessionTypes: [...state.lastSessionTypes, state.currentSessionType].slice(-12),
    activeSession: null,
    currentSessionType: null,
    currentMASubtype: null,
    profile: { ...state.profile, sessionCount: state.profile.sessionCount + 1 },
    domains: newDomains,
    progression,
    muscleRecovery: newMuscleRecovery,
    view: 'home',
  };

  const athleteModel = computeAthleteModelFromState(nextState);
  const planState = buildRollingPlanForState({ ...nextState, athleteModel });
  const decisionLog = [
    ...(state.decisionLog || []),
    {
      at: new Date().toISOString(),
      type: 'session_completed',
      sessionType,
      completionQuality,
      adaptationSummary: adaptationApplied.summary,
      reason: newLog.prescription?.reasonText || state.planState.reasonText,
    },
  ].slice(-120);

  const progressionPrompts = (sessionType === 'gym' || sessionType === 'calisthenics')
    ? checkCalisthenicsProgressionPrompts(nextState.sessionLogs, nextState.domains.calisthenics.skills)
    : (planState.progressionPrompts || []);

  return { ...nextState, athleteModel, planState: { ...planState, progressionPrompts }, decisionLog };
}

function migrateSessionLog(log, idx) {
  const id = log.id || `legacy_${idx}_${Date.parse(log.timestamp || new Date().toISOString())}`;
  const exercises = Array.isArray(log.exercises) ? log.exercises : [];
  const legacyPrescription = log.prescription || { sessionType: log.type, intensityTag: 'moderate', targetRPE: log.rpe || 7, source: 'legacy', reasonText: 'Imported legacy session', timeFit: 60 };
  const normalizedPrescription = { sessionVariant: null, ...legacyPrescription };
  const exerciseResults = Array.isArray(log.exerciseResults) && log.exerciseResults.length
    ? log.exerciseResults
    : exercises.map(ex => ({
        exerciseId: ex.id || slugify(ex.name),
        prescribed: { sets: ex.sets || null, reps: ex.reps || '', duration: ex.duration || '', distance: ex.distance || '', targetRPE: ex.rpe || ex.targetRPE || null },
        performed: { setsCompleted: ex.sets || 0, topMetric: '', effortRPE: log.rpe || 6, pain: false },
        outcome: 'hold',
      }));
  return {
    ...log,
    id,
    readinessSnapshot: log.readinessSnapshot || { score: 70, band: 'moderate', inputs: createReadiness().inputs, at: log.timestamp || new Date().toISOString() },
    prescription: normalizedPrescription,
    exerciseResults,
    completionQuality: log.completionQuality || computeCompletionQuality(log.rpe || 6, log.recovery || 6, exerciseResults, log.rpe || 7),
    adaptationApplied: log.adaptationApplied || { summary: 'Legacy session', deloadRecommended: false, nextFocus: 'Continue baseline progression' },
  };
}

function migrateState(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') {
    const athleteModel = computeAthleteModelFromState(base);
    const planState = buildRollingPlanForState({ ...base, athleteModel });
    return { ...base, athleteModel, planState };
  }

  const merged = {
    ...base,
    ...raw,
    profile: {
      ...base.profile,
      ...(raw.profile || {}),
      timeByDay: raw.profile?.timeByDay || { mon:60, tue:60, wed:60, thu:60, fri:60, sat:90, sun:60 },
      skillAssessments: raw.profile?.skillAssessments || { maxPullUps:0, maxPushUps:0, squatRM:0, deadliftRM:0, benchRM:0, runningPaceEasy:0, tuckPlancheHold:0, handstandHold:0 },
      primaryGoal: raw.profile?.primaryGoal || 'complete_athlete',
      goals: raw.profile?.goals || [],
    },
    programConfig: {
      ...base.programConfig,
      ...(raw.programConfig || {}),
      featureFlags: { ...base.programConfig.featureFlags, ...(raw.programConfig?.featureFlags || {}) },
    },
    readiness: {
      ...base.readiness,
      ...(raw.readiness || {}),
      inputs: { ...base.readiness.inputs, ...(raw.readiness?.inputs || {}) },
    },
    constraints: {
      ...base.constraints,
      ...(raw.constraints || {}),
      injuries: { ...base.constraints.injuries, ...(raw.constraints?.injuries || {}) },
    },
    muscleRecovery: raw.muscleRecovery || createMuscleRecovery(),
    aiConfig: raw.aiConfig || createAIConfig(),
    progression: { ...base.progression, ...(raw.progression || {}), exercises: { ...(base.progression.exercises), ...(raw.progression?.exercises || {}) } },
    athleteModel: { ...base.athleteModel, ...(raw.athleteModel || {}), domainScores: { ...base.athleteModel.domainScores, ...(raw.athleteModel?.domainScores || {}) } },
    planState: {
      ...base.planState,
      ...(raw.planState || {}),
      weeklySummary: raw.planState?.weeklySummary || null,
      weeklySummaryGeneratedAt: raw.planState?.weeklySummaryGeneratedAt || null,
      weeklySummaryLoading: false,
    },
    domains: {
      ...base.domains,
      ...(raw.domains || {}),
      calisthenics: {
        ...base.domains.calisthenics,
        ...(raw.domains?.calisthenics || {}),
        skills: { ...base.domains.calisthenics.skills, ...(raw.domains?.calisthenics?.skills || {}) },
      },
      conditioning: {
        ...base.domains.conditioning,
        ...(raw.domains?.conditioning || {}),
      },
    },
    sessionLogs: (raw.sessionLogs || []).map(migrateSessionLog),
    decisionLog: Array.isArray(raw.decisionLog) ? raw.decisionLog : [],
  };

  const weekStartIso = getWeekStart(new Date()).toISOString();
  const weekStartMs = Date.parse(weekStartIso);
  const conditioning = { ...merged.domains.conditioning };
  const importedWeeklyKm = toNum(conditioning.weeklyKm, 0);
  const resetAt = conditioning.weeklyKmResetAt || null;
  const resetAtMs = resetAt ? Date.parse(resetAt) : NaN;
  const shouldResetWeeklyKm = (!resetAt && importedWeeklyKm > 0) || (resetAt && (!Number.isFinite(resetAtMs) || resetAtMs < weekStartMs));
  if (shouldResetWeeklyKm) {
    conditioning.weeklyKm = 0;
    conditioning.weeklyKmResetAt = weekStartIso;
  } else {
    conditioning.weeklyKm = importedWeeklyKm;
    conditioning.weeklyKmResetAt = resetAt;
  }

  const readinessScored = calculateReadiness(merged.readiness.inputs);
  const next = {
    ...merged,
    domains: {
      ...merged.domains,
      conditioning,
    },
    readiness: { ...merged.readiness, ...readinessScored },
  };
  const athleteModel = computeAthleteModelFromState(next);
  const planState = buildRollingPlanForState({ ...next, athleteModel });
  return { ...next, athleteModel, planState };
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'SET_BLOCK':
      return { ...state, profile: { ...state.profile, currentBlock: action.payload } };
    case 'NEXT_ONBOARD_STEP':
      return { ...state, onboardStep: Math.min(state.onboardStep + 1, 2) };
    case 'PREV_ONBOARD_STEP':
      return { ...state, onboardStep: Math.max(state.onboardStep - 1, 0) };
    case 'SET_PROFILE_FIELD': {
      const { field, value } = action.payload;
      return { ...state, profile: { ...state.profile, [field]: value } };
    }
    case 'UPDATE_PROFILE_FIELD': {
      const { field, subfield, value } = action.payload || {};
      if (subfield) {
        return {
          ...state,
          profile: {
            ...state.profile,
            [field]: { ...(state.profile[field] || {}), [subfield]: value },
          },
        };
      }
      return { ...state, profile: { ...state.profile, [field]: value } };
    }
    case 'UPDATE_AI_CONFIG': {
      return {
        ...state,
        aiConfig: { ...state.aiConfig, ...action.payload },
      };
    }
    case 'SET_AI_COACHING': {
      const { notes, loading, error } = action.payload || {};
      return {
        ...state,
        aiConfig: {
          ...state.aiConfig,
          coachingNotes: notes !== undefined ? notes : state.aiConfig.coachingNotes,
          coachingLoading: loading !== undefined ? loading : state.aiConfig.coachingLoading,
          coachingError: error !== undefined ? error : state.aiConfig.coachingError,
        },
      };
    }
    case 'SET_WEEKLY_SUMMARY': {
      const { summary, loading, generatedAt } = action.payload || {};
      return {
        ...state,
        planState: {
          ...state.planState,
          weeklySummary: summary !== undefined ? summary : state.planState.weeklySummary,
          weeklySummaryLoading: loading !== undefined ? loading : false,
          weeklySummaryGeneratedAt: generatedAt !== undefined ? generatedAt : state.planState.weeklySummaryGeneratedAt,
        },
      };
    }
    case 'SET_PROGRAM_CONFIG': {
      const next = {
        ...state,
        programConfig: {
          ...state.programConfig,
          ...(action.payload || {}),
          featureFlags: {
            ...state.programConfig.featureFlags,
            ...(action.payload?.featureFlags || {}),
          },
        },
      };
      return { ...next, planState: buildRollingPlanForState(next) };
    }
    case 'SET_DAILY_READINESS': {
      const inputs = { ...state.readiness.inputs, ...(action.payload || {}) };
      const scored = calculateReadiness(inputs);
      const readiness = { ...state.readiness, inputs, ...scored, updatedAt: new Date().toISOString() };
      const athleteModel = {
        ...state.athleteModel,
        readinessTrend: [...(state.athleteModel.readinessTrend || []), { x: new Date().toLocaleDateString(), score: readiness.score }].slice(-30),
      };
      const next = { ...state, readiness, athleteModel };
      return { ...next, planState: buildRollingPlanForState(next) };
    }
    case 'SET_CONSTRAINT_FLAG': {
      const { key, value } = action.payload || {};
      const constraints = { ...state.constraints, injuries: { ...state.constraints.injuries } };
      if (key in constraints.injuries) constraints.injuries[key] = !!value;
      if (key === 'timeOverrideMinutes') constraints.timeOverrideMinutes = value ? clamp(toNum(value, 60), 30, 120) : null;
      if (key === 'equipment' && value) {
        if (!constraints.unavailableEquipment.includes(value)) constraints.unavailableEquipment = [...constraints.unavailableEquipment, value];
      }
      const next = { ...state, constraints };
      return { ...next, planState: buildRollingPlanForState(next) };
    }
    case 'CLEAR_CONSTRAINT_FLAG': {
      const { key, value } = action.payload || {};
      const constraints = { ...state.constraints, injuries: { ...state.constraints.injuries } };
      if (key in constraints.injuries) constraints.injuries[key] = false;
      if (key === 'timeOverrideMinutes') constraints.timeOverrideMinutes = null;
      if (key === 'equipment' && value) constraints.unavailableEquipment = constraints.unavailableEquipment.filter(item => item !== value);
      const next = { ...state, constraints };
      return { ...next, planState: buildRollingPlanForState(next) };
    }
    case 'REBUILD_ROLLING_PLAN':
      return { ...state, planState: buildRollingPlanForState(state) };
    case 'COMPLETE_ONBOARDING': {
      const next = { ...state, onboarded: true, view: 'home' };
      return { ...next, planState: buildRollingPlanForState(next) };
    }
    case 'START_SESSION':
    case 'START_SESSION_FROM_PLAN': {
      const type = action.payload?.type || state.planState.primaryRecommendation?.type || 'gym';
      const source = action.type === 'START_SESSION_FROM_PLAN' ? (action.payload?.source || 'plan') : 'manual';
      const timeAvailable = action.payload?.timeAvailable || null;
      const sessionVariant = action.payload?.sessionVariant || null;
      const reasonOverride = action.payload?.reasonOverride || null;
      const activeSession = createSessionFromType(state, type, source, timeAvailable, { sessionVariant, reasonOverride });
      return {
        ...state,
        currentSessionType: type,
        currentMASubtype: activeSession.maSubtype,
        activeSession,
        aiConfig: { ...state.aiConfig, coachingNotes: null, coachingLoading: false, coachingError: null },
      };
    }
    case 'ACCEPT_ALTERNATE_SESSION': {
      const type = action.payload?.type;
      if (!type) return state;
      const decisionLog = [
        ...(state.decisionLog || []),
        { at: new Date().toISOString(), type: 'override_session', selected: type, recommended: state.planState.primaryRecommendation?.type || null },
      ].slice(-120);
      return { ...state, decisionLog };
    }
    case 'ACKNOWLEDGE_COACHING_PROMPT': {
      const promptId = action.payload?.promptId;
      if (!promptId) return state;
      return {
        ...state,
        planState: {
          ...state.planState,
          acknowledgedPrompts: {
            ...(state.planState.acknowledgedPrompts || {}),
            [promptId]: new Date().toISOString(),
          },
        },
      };
    }
    case 'LOG_EXERCISE_RESULT': {
      if (!state.activeSession) return state;
      const { exerciseId, patch } = action.payload || {};
      const exerciseResults = (state.activeSession.exerciseResults || []).map(r => {
        if (r.exerciseId !== exerciseId) return r;
        return {
          ...r,
          performed: { ...r.performed, ...(patch || {}) },
        };
      });
      return {
        ...state,
        activeSession: { ...state.activeSession, exerciseResults },
      };
    }
    case 'SWAP_SESSION_EXERCISE': {
      if (!state.activeSession) return state;
      const { oldId, newEx } = action.payload || {};
      if (!oldId || !newEx) return state;
      const enriched = enrichPrescribedExercise(newEx, state, state.activeSession.prescription?.intensityTag || 'moderate');
      const exercises = state.activeSession.exercises.map(ex => ex.id === oldId ? enriched : ex);
      const exerciseResults = state.activeSession.exerciseResults.map(r =>
        r.exerciseId === oldId ? createExerciseResult(enriched) : r
      );
      return { ...state, activeSession: { ...state.activeSession, exercises, exerciseResults } };
    }
    case 'SET_MA_SESSION_SUBTYPE': {
      if (!state.activeSession) return state;
      return { ...state, activeSession: { ...state.activeSession, maSessionSubtype: action.payload } };
    }
    case 'CANCEL_SESSION':
      return { ...state, activeSession: null, currentSessionType: null, currentMASubtype: null };
    case 'COMPLETE_SESSION':
    case 'COMPLETE_SESSION_V2':
      return completeSessionInternal(state, action.payload || {});
    case 'SET_CALI_SKILL_LEVEL': {
      const { skill, level } = action.payload;
      const maxLevels = { pullUp:9, pushUp:7, squat:5, core:6, handstand:7 };
      const clamped = Math.max(1, Math.min(level, maxLevels[skill] || 9));
      return {
        ...state,
        domains: {
          ...state.domains,
          calisthenics: {
            ...state.domains.calisthenics,
            skills: {
              ...state.domains.calisthenics.skills,
              [skill]: { ...state.domains.calisthenics.skills[skill], level: clamped },
            },
          },
        },
      };
    }
    case 'SET_PR': {
      const { lift, value } = action.payload;
      return {
        ...state,
        domains: {
          ...state.domains,
          strength: { ...state.domains.strength, prs: { ...state.domains.strength.prs, [lift]: value } },
        },
      };
    }
    case 'IMPORT_STATE':
      return migrateState(action.payload);
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBlockedPatterns(constraints) {
  const blocked = [];
  if (constraints.injuries.knee) blocked.push('lower', 'aerobic');
  if (constraints.injuries.back) blocked.push('lower');
  if (constraints.injuries.shoulder) blocked.push('upper', 'vertical-pull', 'inversion');
  return [...new Set(blocked)];
}

function getAlternatives(ex, sessionType, maSubtype) {
  const db = EXERCISE_DB_V5;
  if (ex.domain === 'strength') {
    const all = [...db.strength.legs, ...db.strength.upper, ...db.strength.full];
    return all.filter(e => e.pattern === ex.pattern && e.id !== ex.id).slice(0, 4);
  }
  if (ex.domain === 'striking') return db.striking.filter(e => e.id !== ex.id).slice(0, 4);
  if (ex.domain === 'grappling') return db.grappling.filter(e => e.id !== ex.id).slice(0, 4);
  if (ex.domain === 'mobility') return db.mobility.filter(e => e.id !== ex.id).slice(0, 4);
  if (ex.domain === 'running') return db.running.filter(e => e.id !== ex.id).slice(0, 4);
  return [];
}

function checkCalisthenicsProgressionPrompts(sessionLogs, skills) {
  // gym sessions now include calisthenics skill work; also accept legacy 'calisthenics' type
  const caliLogs = (sessionLogs || []).filter(log => log.type === 'gym' || log.type === 'calisthenics');
  if (caliLogs.length < 2) return [];
  const recentHighQuality = caliLogs.slice(-2).every(log => (log.completionQuality || 0) >= 70);
  if (!recentHighQuality) return [];
  const maxLevels = { pullUp:9, pushUp:7, squat:5, core:6, handstand:7 };
  return Object.entries(skills)
    .filter(([skill, data]) => data.level < (maxLevels[skill] || 9))
    .map(([skill, data]) => ({
      id: `levelup_${skill}`,
      skill,
      currentLevel: data.level,
      nextLevel: data.level + 1,
      message: `${skill.toUpperCase()} ready for Level ${data.level + 1} — quality threshold hit ×2!`,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG STICK FIGURE VISUALS
// ─────────────────────────────────────────────────────────────────────────────

function StickFigure({ variant = 'athletic', size = 72 }) {
  const C = '#ef4444';
  const D = '#444';
  const lw = 2;
  const vw = 80; const vh = 100;

  const Ln = ({ x1, y1, x2, y2, color = C, w = lw }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
  );
  const Hd = ({ cx, cy, r = 7 }) => (
    <circle cx={cx} cy={cy} r={r} stroke={C} strokeWidth={lw} fill="none" />
  );
  const Bar = ({ x1, y1, x2, y2 }) => (
    <>
      <Ln x1={x1} y1={y1} x2={x2} y2={y2} color="#888" w={3} />
      <circle cx={x1} cy={y1} r={5} stroke="#888" strokeWidth={1.5} fill="none" />
      <circle cx={x2} cy={y2} r={5} stroke="#888" strokeWidth={1.5} fill="none" />
    </>
  );

  const figures = {
    squat: (
      <>
        <Bar x1={4} y1={22} x2={76} y2={22} />
        <Hd cx={40} cy={10} />
        <Ln x1={40} y1={18} x2={40} y2={30} />
        {/* shoulders */}
        <Ln x1={28} y1={30} x2={52} y2={30} />
        {/* torso forward lean */}
        <Ln x1={40} y1={30} x2={36} y2={56} />
        {/* arms forward */}
        <Ln x1={28} y1={30} x2={10} y2={42} />
        <Ln x1={52} y1={30} x2={70} y2={42} />
        {/* hips */}
        <Ln x1={26} y1={56} x2={50} y2={56} />
        {/* L thigh + shin */}
        <Ln x1={26} y1={56} x2={8} y2={80} />
        <Ln x1={8} y1={80} x2={12} y2={98} />
        {/* R thigh + shin */}
        <Ln x1={50} y1={56} x2={68} y2={80} />
        <Ln x1={68} y1={80} x2={64} y2={98} />
      </>
    ),

    deadlift: (
      <>
        <Hd cx={18} cy={22} />
        {/* torso horizontal */}
        <Ln x1={18} y1={30} x2={60} y2={48} />
        {/* neck */}
        <Ln x1={18} y1={22} x2={18} y2={30} />
        {/* arms down to bar */}
        <Ln x1={28} y1={34} x2={32} y2={65} />
        <Ln x1={52} y1={44} x2={55} y2={65} />
        {/* barbell on floor */}
        <Bar x1={16} y1={68} x2={68} y2={68} />
        {/* L leg */}
        <Ln x1={60} y1={48} x2={52} y2={78} />
        <Ln x1={52} y1={78} x2={44} y2={96} />
        {/* R leg */}
        <Ln x1={60} y1={48} x2={70} y2={78} />
        <Ln x1={70} y1={78} x2={74} y2={96} />
      </>
    ),

    bench: (
      <>
        {/* bench */}
        <Ln x1={5} y1={72} x2={75} y2={72} color={D} />
        <Hd cx={10} cy={50} r={7} />
        {/* torso horizontal */}
        <Ln x1={18} y1={50} x2={65} y2={50} />
        {/* arms up pressing */}
        <Ln x1={32} y1={50} x2={30} y2={25} />
        <Ln x1={52} y1={50} x2={54} y2={25} />
        <Bar x1={18} y1={23} x2={66} y2={23} />
        {/* legs bent */}
        <Ln x1={65} y1={50} x2={68} y2={70} />
        <Ln x1={68} y1={70} x2={64} y2={90} />
        <Ln x1={65} y1={50} x2={72} y2={68} />
        <Ln x1={72} y1={68} x2={76} y2={88} />
      </>
    ),

    ohp: (
      <>
        <Bar x1={20} y1={8} x2={60} y2={8} />
        <Hd cx={40} cy={18} />
        <Ln x1={40} y1={26} x2={40} y2={58} />
        {/* shoulders */}
        <Ln x1={28} y1={34} x2={52} y2={34} />
        {/* arms up */}
        <Ln x1={28} y1={34} x2={24} y2={16} />
        <Ln x1={52} y1={34} x2={56} y2={16} />
        {/* hips + legs */}
        <Ln x1={32} y1={58} x2={48} y2={58} />
        <Ln x1={36} y1={58} x2={30} y2={80} />
        <Ln x1={30} y1={80} x2={26} y2={98} />
        <Ln x1={44} y1={58} x2={50} y2={80} />
        <Ln x1={50} y1={80} x2={54} y2={98} />
      </>
    ),

    pullup: (
      <>
        {/* bar */}
        <Ln x1={5} y1={6} x2={75} y2={6} color={D} w={3} />
        <Hd cx={40} cy={24} />
        {/* arms up */}
        <Ln x1={40} y1={24} x2={24} y2={10} />
        <Ln x1={40} y1={24} x2={56} y2={10} />
        {/* torso */}
        <Ln x1={40} y1={32} x2={40} y2={64} />
        {/* shoulders */}
        <Ln x1={28} y1={36} x2={52} y2={36} />
        {/* legs hanging */}
        <Ln x1={36} y1={64} x2={32} y2={84} />
        <Ln x1={32} y1={84} x2={30} y2={98} />
        <Ln x1={44} y1={64} x2={48} y2={84} />
        <Ln x1={48} y1={84} x2={50} y2={98} />
      </>
    ),

    pushup: (
      <>
        {/* floor */}
        <Ln x1={0} y1={82} x2={80} y2={82} color={D} />
        <Hd cx={7} cy={52} />
        {/* torso prone */}
        <Ln x1={14} y1={52} x2={64} y2={58} />
        {/* arms supporting */}
        <Ln x1={22} y1={52} x2={22} y2={80} />
        <Ln x1={50} y1={56} x2={50} y2={80} />
        {/* legs extended */}
        <Ln x1={64} y1={58} x2={70} y2={68} />
        <Ln x1={70} y1={68} x2={72} y2={80} />
        <Ln x1={64} y1={58} x2={74} y2={63} />
        <Ln x1={74} y1={63} x2={78} y2={78} />
      </>
    ),

    run: (
      <>
        <Hd cx={46} cy={10} />
        {/* torso slight forward */}
        <Ln x1={46} y1={18} x2={44} y2={50} />
        {/* shoulders */}
        <Ln x1={32} y1={26} x2={56} y2={26} />
        {/* L arm back */}
        <Ln x1={32} y1={26} x2={18} y2={42} />
        {/* R arm forward */}
        <Ln x1={56} y1={26} x2={66} y2={14} />
        {/* hips */}
        <Ln x1={36} y1={50} x2={52} y2={50} />
        {/* L leg forward */}
        <Ln x1={40} y1={50} x2={28} y2={72} />
        <Ln x1={28} y1={72} x2={20} y2={96} />
        {/* R leg back/up */}
        <Ln x1={48} y1={50} x2={64} y2={68} />
        <Ln x1={64} y1={68} x2={72} y2={52} />
      </>
    ),

    strike: (
      <>
        <Hd cx={36} cy={10} />
        {/* torso side-on slight lean */}
        <Ln x1={36} y1={18} x2={38} y2={55} />
        {/* shoulders */}
        <Ln x1={26} y1={28} x2={48} y2={28} />
        {/* L guard arm (rear) */}
        <Ln x1={26} y1={28} x2={22} y2={18} />
        <Ln x1={22} y1={18} x2={30} y2={14} />
        {/* R jab arm (extended) */}
        <Ln x1={48} y1={28} x2={70} y2={20} />
        {/* hips */}
        <Ln x1={30} y1={55} x2={48} y2={55} />
        {/* L leg front stance */}
        <Ln x1={32} y1={55} x2={24} y2={78} />
        <Ln x1={24} y1={78} x2={22} y2={96} />
        {/* R leg back stance */}
        <Ln x1={46} y1={55} x2={58} y2={75} />
        <Ln x1={58} y1={75} x2={62} y2={96} />
      </>
    ),

    grapple: (
      <>
        <Hd cx={28} cy={20} />
        {/* torso hunched forward */}
        <Ln x1={28} y1={28} x2={56} y2={44} />
        {/* shoulders */}
        <Ln x1={18} y1={32} x2={40} y2={32} />
        {/* L arm reaching */}
        <Ln x1={18} y1={32} x2={8} y2={48} />
        <Ln x1={8} y1={48} x2={6} y2={62} />
        {/* R arm up/across */}
        <Ln x1={40} y1={32} x2={62} y2={22} />
        <Ln x1={62} y1={22} x2={70} y2={12} />
        {/* L leg */}
        <Ln x1={56} y1={44} x2={46} y2={70} />
        <Ln x1={46} y1={70} x2={40} y2={94} />
        {/* R leg wide */}
        <Ln x1={56} y1={44} x2={68} y2={68} />
        <Ln x1={68} y1={68} x2={72} y2={92} />
      </>
    ),

    handstand: (
      <>
        {/* floor at bottom */}
        <Ln x1={5} y1={97} x2={75} y2={97} color={D} />
        {/* arms down to floor */}
        <Ln x1={40} y1={72} x2={26} y2={95} />
        <Ln x1={40} y1={72} x2={54} y2={95} />
        {/* torso inverted */}
        <Ln x1={40} y1={72} x2={40} y2={38} />
        {/* shoulders */}
        <Ln x1={28} y1={68} x2={52} y2={68} />
        {/* legs up */}
        <Ln x1={36} y1={38} x2={30} y2={14} />
        <Ln x1={30} y1={14} x2={28} y2={4} />
        <Ln x1={44} y1={38} x2={50} y2={14} />
        <Ln x1={50} y1={14} x2={52} y2={4} />
        {/* head inverted */}
        <Hd cx={40} cy={84} r={7} />
      </>
    ),

    plank: (
      <>
        {/* floor */}
        <Ln x1={0} y1={78} x2={80} y2={78} color={D} />
        <Hd cx={7} cy={58} />
        {/* torso rigid horizontal */}
        <Ln x1={14} y1={58} x2={66} y2={58} />
        {/* forearms on floor */}
        <Ln x1={24} y1={58} x2={22} y2={76} />
        <Ln x1={50} y1={58} x2={48} y2={76} />
        {/* legs */}
        <Ln x1={66} y1={58} x2={68} y2={76} />
        <Ln x1={66} y1={58} x2={72} y2={74} />
      </>
    ),

    mobility: (
      <>
        <Hd cx={22} cy={36} />
        {/* torso folded forward over legs */}
        <Ln x1={22} y1={44} x2={58} y2={48} />
        {/* extended leg along floor */}
        <Ln x1={58} y1={48} x2={76} y2={52} />
        {/* bent leg behind (pigeon) */}
        <Ln x1={58} y1={48} x2={44} y2={66} />
        <Ln x1={44} y1={66} x2={32} y2={78} />
        {/* arms reaching forward */}
        <Ln x1={28} y1={44} x2={52} y2={52} />
        <Ln x1={52} y1={52} x2={70} y2={56} />
        {/* floor */}
        <Ln x1={0} y1={86} x2={80} y2={86} color={D} />
      </>
    ),

    athletic: (
      <>
        <Hd cx={40} cy={9} />
        <Ln x1={40} y1={17} x2={40} y2={55} />
        {/* shoulders */}
        <Ln x1={24} y1={30} x2={56} y2={30} />
        {/* arms bent out (athletic ready) */}
        <Ln x1={24} y1={30} x2={14} y2={46} />
        <Ln x1={14} y1={46} x2={18} y2={58} />
        <Ln x1={56} y1={30} x2={66} y2={46} />
        <Ln x1={66} y1={46} x2={62} y2={58} />
        {/* hips */}
        <Ln x1={32} y1={55} x2={48} y2={55} />
        {/* legs slightly apart */}
        <Ln x1={36} y1={55} x2={30} y2={76} />
        <Ln x1={30} y1={76} x2={26} y2={96} />
        <Ln x1={44} y1={55} x2={50} y2={76} />
        <Ln x1={50} y1={76} x2={54} y2={96} />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox={`0 0 ${vw} ${vh}`}
      className="flex-shrink-0"
      style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.3))' }}
    >
      {figures[variant] || figures.athletic}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUND TIMER
// ─────────────────────────────────────────────────────────────────────────────

function RoundTimer({ workSeconds = 180, restSeconds = 60 }) {
  const [phase, setPhase] = useState('idle');
  const [remaining, setRemaining] = useState(workSeconds);
  const [round, setRound] = useState(1);

  useEffect(() => {
    if (phase === 'idle') return;
    if (remaining <= 0) {
      if (phase === 'work') { setPhase('rest'); setRemaining(restSeconds); }
      else { setRound(r => r + 1); setPhase('work'); setRemaining(workSeconds); }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, workSeconds, restSeconds]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <div className={`border p-3 space-y-2 mt-2 ${phase === 'work' ? 'border-red-500' : phase === 'rest' ? 'border-green-600' : 'border-neutral-800'}`}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-neutral-500 uppercase">ROUND {round}</div>
        <div className={`font-mono text-xs uppercase font-bold ${phase === 'work' ? 'text-red-500' : phase === 'rest' ? 'text-green-400' : 'text-neutral-600'}`}>
          {phase === 'idle' ? 'READY' : phase === 'work' ? '⚡ WORK' : '💤 REST'}
        </div>
      </div>
      <div className="font-mono text-3xl text-center text-neutral-100 tracking-widest">{mins}:{secs}</div>
      <div className="flex gap-2">
        {phase === 'idle' ? (
          <button
            onClick={() => { setPhase('work'); setRemaining(workSeconds); setRound(1); }}
            className="flex-1 bg-red-500 text-neutral-950 py-2 font-mono text-xs uppercase font-bold active:bg-red-700"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            START TIMER
          </button>
        ) : (
          <>
            <button
              onClick={() => { setPhase('idle'); setRemaining(workSeconds); setRound(1); }}
              className="flex-1 border border-neutral-700 py-2 font-mono text-xs uppercase text-neutral-500 active:bg-neutral-900"
            >
              STOP
            </button>
            <button
              onClick={() => { setPhase('work'); setRemaining(workSeconds); }}
              className="flex-1 border border-neutral-700 py-2 font-mono text-xs uppercase text-neutral-500 active:bg-neutral-900"
            >
              RESET
            </button>
          </>
        )}
      </div>
      <div className="text-neutral-700 font-mono text-xs text-center">{workSeconds / 60}:00 WORK · {restSeconds}s REST</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────────────────────────────────────

function HomeView({ state, dispatch }) {
  const [microBreakMinutes, setMicroBreakMinutes] = useState(2);
  const balance = useMemo(() => getSessionBalance(state.sessionLogs), [state.sessionLogs]);
  const priorityList = useMemo(() => getPriorityTypes(balance, state), [balance, state]);
  const recentLogs = useMemo(() => [...state.sessionLogs].reverse().slice(0, 3), [state.sessionLogs]);
  const primary = state.planState.primaryRecommendation || priorityList[0];
  const secondary = state.planState.secondaryRecommendation || priorityList[1];
  const startMicroBreak = () => {
    const reasonOverride = `MICRO BREAK (${microBreakMinutes} MIN): quick desk reset for posture, mobility, and recovery.`;
    dispatch({
      type: 'START_SESSION_FROM_PLAN',
      payload: {
        type: 'mobility',
        source: 'micro-break',
        timeAvailable: microBreakMinutes,
        sessionVariant: 'micro-break',
        reasonOverride,
      },
    });
    dispatch({ type: 'SET_VIEW', payload: 'train' });
  };

  // Weekly summary: generate when AI is enabled + week has rolled over or no summary exists
  useEffect(() => {
    if (!state.aiConfig?.enabled || !state.aiConfig?.apiKey) return;
    if (state.planState.weeklySummaryLoading) return;
    const weekStart = getWeekStart(new Date()).toISOString().slice(0, 10);
    const generatedAt = state.planState.weeklySummaryGeneratedAt;
    const alreadyThisWeek = generatedAt && generatedAt >= weekStart;
    if (alreadyThisWeek) return;
    const weekLogs = (state.sessionLogs || []).filter(l => {
      const ws = getWeekStart(new Date()).getTime();
      return new Date(l.timestamp).getTime() >= ws;
    });
    if (weekLogs.length < 2) return; // need at least 2 sessions to summarise
    dispatch({ type: 'SET_WEEKLY_SUMMARY', payload: { loading: true } });
    const weekEnd = new Date().toISOString().slice(0, 10);
    const sessionSummaries = weekLogs.map(l =>
      `- ${l.type}${l.maSubtype ? ' (' + l.maSubtype + ')' : ''}: RPE ${l.rpe}, Quality ${l.completionQuality || '?'}%`
    ).join('\n');
    const outcomes = weekLogs.flatMap(l => (l.exerciseResults || []).map(r => r.outcome));
    const advanced = outcomes.filter(o => o === 'advance').length;
    const regressed = outcomes.filter(o => o === 'regress').length;
    const avgRPE = weekLogs.length ? (weekLogs.reduce((s, l) => s + (l.rpe || 7), 0) / weekLogs.length).toFixed(1) : '?';
    const avgReadiness = weekLogs.length ? Math.round(weekLogs.reduce((s, l) => s + (l.readinessSnapshot?.score || 70), 0) / weekLogs.length) : 70;
    const stalledNames = (state.progression.stalledItems || []).slice(-3).map(i => i.id.replace(/_/g, ' ')).join(', ') || 'none';
    const weekContext = {
      name: state.profile.name || 'Athlete',
      age: state.profile.age || '?',
      bodyweight: state.profile.bodyweight || '?',
      weekStart, weekEnd,
      primaryGoal: state.profile.primaryGoal || 'complete athlete',
      currentBlock: state.profile.currentBlock,
      sessionCount: weekLogs.length,
      sessionSummaries,
      adaptationSummary: `${advanced} advances, ${regressed} regressions`,
      progressionNotes: `Stalled items: ${stalledNames}`,
      avgReadiness,
      avgRPE,
    };
    callGeminiWeeklySummary(state.aiConfig.apiKey, state.aiConfig.endpoint, weekContext)
      .then(summary => {
        dispatch({ type: 'SET_WEEKLY_SUMMARY', payload: { summary, loading: false, generatedAt: weekEnd } });
      })
      .catch(() => {
        dispatch({ type: 'SET_WEEKLY_SUMMARY', payload: { loading: false } });
      });
  }, [state.sessionLogs.length, state.aiConfig?.enabled]);

  return (
    <div className="space-y-6">
      {state.progression.deloadRecommended === true && state.profile.currentBlock !== 'deload' && (
        <div className="bg-red-950 border border-red-500 text-red-400 font-mono p-3 mb-4">
          <div className="text-xs">⚠ DELOAD RECOMMENDED — your last 3 sessions hit RPE 8+. Recovery debt is high.</div>
          <button
            onClick={() => dispatch({ type: 'SET_BLOCK', payload: 'deload' })}
            className="border border-red-500 text-red-400 px-3 py-1 font-mono text-xs mt-2"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            SWITCH TO DELOAD
          </button>
        </div>
      )}
      <div className="border border-neutral-800 p-5">
        <div className="text-red-500 font-mono text-xl uppercase tracking-widest font-bold">MIYAMOTO</div>
        <div className="text-neutral-500 font-mono text-xs mt-1">V5 PERSONAL TRAINER ENGINE</div>
        {state.onboarded && (
          <div className="mt-3 flex gap-6 text-neutral-400 font-mono text-xs">
            <div>ATHLETE: <span className="text-neutral-100">{state.profile.name || '—'}</span></div>
            <div>READINESS: <span className={`${state.readiness.score >= 75 ? 'text-green-400' : state.readiness.score >= 50 ? 'text-yellow-400' : 'text-red-500'}`}>{state.readiness.score}</span></div>
            <div>CONFIDENCE: <span className="text-neutral-100">{Math.round(state.athleteModel.adaptationConfidence * 100)}%</span></div>
          </div>
        )}
      </div>

      {state.onboarded && (state.planState.progressionPrompts || []).length > 0 && (
        <div className="border border-yellow-600 p-4 space-y-2">
          <div className="text-yellow-500 font-mono text-xs uppercase tracking-widest">⬆ LEVEL UP READY</div>
          {state.planState.progressionPrompts.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <div className="text-neutral-300 font-mono text-xs">{p.message}</div>
              <button
                onClick={() => { dispatch({ type: 'SET_CALI_SKILL_LEVEL', payload: { skill: p.skill, level: p.nextLevel } }); dispatch({ type: 'ACKNOWLEDGE_COACHING_PROMPT', payload: { promptId: p.id } }); }}
                className="bg-yellow-600 text-neutral-950 px-3 py-1 font-mono text-xs uppercase font-bold flex-shrink-0 active:bg-yellow-700"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                LEVEL UP
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Weekly AI Summary Card */}
      {state.onboarded && state.aiConfig?.enabled && (
        <div className="border border-neutral-700 bg-neutral-900 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-yellow-400 font-mono text-xs font-bold uppercase tracking-widest">⚡ WEEKLY RECAP</div>
            {state.planState.weeklySummaryGeneratedAt && (
              <div className="text-neutral-600 font-mono text-xs">{state.planState.weeklySummaryGeneratedAt}</div>
            )}
          </div>
          {state.planState.weeklySummaryLoading && (
            <div className="text-neutral-400 font-mono text-xs animate-pulse">Generating weekly summary...</div>
          )}
          {!state.planState.weeklySummaryLoading && !state.planState.weeklySummary && (
            <div className="text-neutral-600 font-mono text-xs">Complete 2+ sessions this week to generate a recap.</div>
          )}
          {state.planState.weeklySummary && !state.planState.weeklySummaryLoading && (() => {
            const s = state.planState.weeklySummary;
            return (
              <div className="space-y-2">
                {s.headline && <div className="text-neutral-100 font-mono text-xs font-bold">{s.headline}</div>}
                {s.wins?.length > 0 && (
                  <div>
                    <div className="text-green-400 font-mono text-xs uppercase mb-1">WINS</div>
                    {s.wins.map((w, i) => <div key={i} className="text-neutral-300 font-mono text-xs">✓ {w}</div>)}
                  </div>
                )}
                {s.concerns?.length > 0 && (
                  <div>
                    <div className="text-orange-400 font-mono text-xs uppercase mb-1">WATCH</div>
                    {s.concerns.map((c, i) => <div key={i} className="text-neutral-400 font-mono text-xs">⚠ {c}</div>)}
                  </div>
                )}
                {s.nextWeekFocus && (
                  <div className="border-t border-neutral-800 pt-2">
                    <div className="text-red-400 font-mono text-xs uppercase mb-1">NEXT WEEK</div>
                    <div className="text-neutral-300 font-mono text-xs">{s.nextWeekFocus}</div>
                  </div>
                )}
                {s.recommendation && (
                  <div className="text-neutral-500 font-mono text-xs italic">→ {s.recommendation}</div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {state.onboarded && (
        <>
          <div className="border border-neutral-800 p-5 space-y-4">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">READINESS CHECK (20s)</div>
            {[
              { key:'sleep', label:'Sleep quality' },
              { key:'stress', label:'Stress' },
              { key:'soreness', label:'Soreness' },
              { key:'motivation', label:'Motivation' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-mono text-xs uppercase">{label}</span>
                  <span className="text-neutral-200 font-mono text-xs">{state.readiness.inputs[key]}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={state.readiness.inputs[key]}
                  onChange={e => dispatch({ type: 'SET_DAILY_READINESS', payload: { [key]: Number(e.target.value) } })}
                  className="w-full accent-red-500"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={state.readiness.inputs.hrvDelta}
                onChange={e => dispatch({ type: 'SET_DAILY_READINESS', payload: { hrvDelta: e.target.value } })}
                placeholder="HRV Δ (optional)"
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-neutral-100 font-mono text-base"
              />
              <input
                type="number"
                value={state.readiness.inputs.restingHrDelta}
                onChange={e => dispatch({ type: 'SET_DAILY_READINESS', payload: { restingHrDelta: e.target.value } })}
                placeholder="RHR Δ (optional)"
                className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-neutral-100 font-mono text-base"
              />
            </div>
          </div>

          {/* Muscle Recovery */}
          {(() => {
            const advice = getMuscleRecoveryAdvice(state.muscleRecovery);
            const fatigued = advice.fatiguedMuscles;
            const recovering = advice.recoveringMuscles;
            if (fatigued.length === 0 && recovering.length === 0) return null;
            return (
              <div className="p-3 border border-neutral-800 bg-neutral-950">
                <div className="text-neutral-400 font-mono text-xs uppercase mb-2">Muscle Recovery</div>
                {fatigued.length > 0 && (
                  <div className="text-red-400 font-mono text-xs mb-1">
                    🔴 Fatigued: {fatigued.map(m => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}
                  </div>
                )}
                {recovering.length > 0 && (
                  <div className="text-yellow-400 font-mono text-xs">
                    🟡 Recovering: {recovering.map(m => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="border border-neutral-800 p-5 space-y-3">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">TODAY'S PRESCRIPTION</div>
            <div className="text-neutral-400 font-mono text-xs">{state.planState.reasonText}</div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="border border-red-500 p-4 space-y-1 cursor-pointer active:bg-neutral-900"
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'train' })}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center gap-1">
                  <Zap size={10} className="text-red-500" />
                  <span className="text-red-500 font-mono text-xs uppercase">PRIMARY</span>
                </div>
                <div className="text-neutral-100 font-mono text-sm font-bold">
                  {primary ? `${FREQUENCY_TARGETS[primary.type].icon} ${FREQUENCY_TARGETS[primary.type].label}` : '—'}
                </div>
                <div className="text-neutral-500 font-mono text-xs">{primary ? `${primary.done}/${primary.target} this wk` : ''}</div>
              </div>
              <div
                className="border border-neutral-700 p-4 space-y-1 cursor-pointer active:bg-neutral-900"
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'train' })}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="text-neutral-500 font-mono text-xs uppercase">ALTERNATE</div>
                <div className="text-neutral-100 font-mono text-sm font-bold">
                  {secondary ? `${FREQUENCY_TARGETS[secondary.type].icon} ${FREQUENCY_TARGETS[secondary.type].label}` : '—'}
                </div>
                <div className="text-neutral-500 font-mono text-xs">{secondary ? `${secondary.done}/${secondary.target} this wk` : ''}</div>
              </div>
            </div>
            <div className="border-l-2 border-neutral-700 pl-3 space-y-1">
              <div className="text-neutral-400 font-mono text-xs">FOCUS: {state.planState.weeklyFocus}</div>
              <div className="text-neutral-600 font-mono text-xs">WATCHOUT: {state.planState.watchout}</div>
            </div>
          </div>

          <div className="border border-neutral-800 p-5 space-y-3">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">WEEKLY BALANCE</div>
            {priorityList.map(({ type, done, target, deficit, score }) => {
              const t = FREQUENCY_TARGETS[type];
              const pct = Math.min(100, (done / target) * 100);
              const overdue = deficit > 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{t.icon}</span>
                      <span className={`font-mono text-xs ${t.color}`}>{t.label}</span>
                      {overdue && deficit >= target && (
                        <span className="text-red-500 font-mono text-xs">⚡ OVERDUE</span>
                      )}
                    </div>
                    <span className="text-neutral-400 font-mono text-xs">{done}/{target} · P{Math.round(score)}</span>
                  </div>
                  <div className="w-full bg-neutral-900 h-1.5 border border-neutral-800">
                    <div
                      className={`h-full transition-all ${done >= target ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border border-neutral-800 p-5 space-y-3">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">COOL-OFF (2-5 MIN)</div>
            <div className="text-neutral-500 font-mono text-xs">Quick desk-reset mobility flow between work blocks.</div>
            <div className="flex gap-2">
              {[2, 3, 5].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => setMicroBreakMinutes(minutes)}
                  className={`flex-1 py-2 font-mono text-xs border ${
                    microBreakMinutes === minutes ? 'border-red-500 text-red-500' : 'border-neutral-700 text-neutral-400'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {minutes}m
                </button>
              ))}
            </div>
            <button
              onClick={startMicroBreak}
              className="w-full border border-red-500 py-3 font-mono text-xs uppercase text-red-500 font-bold active:bg-neutral-900"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              START MICRO BREAK
            </button>
          </div>

          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'train' })}
            className="w-full bg-red-500 text-neutral-950 py-5 font-mono font-bold text-sm uppercase tracking-widest active:bg-red-700"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            START TRAINING →
          </button>

          {recentLogs.length > 0 && (
            <div className="border border-neutral-800 p-5 space-y-3">
              <div className="text-red-500 font-mono text-xs uppercase tracking-widest">RECENT SESSIONS</div>
              {recentLogs.map((log, i) => (
                <div key={i} className="flex justify-between items-start border-l-2 border-neutral-700 pl-3">
                  <div>
                    <div className="text-neutral-200 font-mono text-xs uppercase font-bold">
                      {log.type === 'mobility' && (log.prescription?.sessionVariant === 'micro-break' || log.prescription?.source === 'micro-break')
                        ? 'MOBILITY • MICRO BREAK'
                        : log.type}
                    </div>
                    {log.maSubtype && <div className="text-neutral-500 font-mono text-xs">{log.maSubtype}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-neutral-400 font-mono text-xs">RPE {log.rpe} · RCV {log.recovery}</div>
                    <div className="text-neutral-600 font-mono text-xs">Q {log.completionQuality || '--'}</div>
                    <div className="text-neutral-600 font-mono text-xs">{new Date(log.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN VIEW
// ─────────────────────────────────────────────────────────────────────────────

const MA_SESSION_SUBTYPES = [
  { value: 'technical', label: 'TECHNICAL', desc: 'Drilling & technique focus' },
  { value: 'conditioning', label: 'CONDITIONING', desc: 'High-volume, cardio-heavy' },
  { value: 'sparring', label: 'SPARRING / LIVE', desc: 'Live rounds, competition prep' },
];

function TrainView({ state, dispatch }) {
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [pendingMAType, setPendingMAType] = useState(null); // for sparring subtype picker
  const [maSessionSubtype, setMaSessionSubtype] = useState('technical');
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const todayKey = days[new Date().getDay()];
  const defaultTime = state.profile.timeByDay?.[todayKey] || 60;
  const [timeAvailable, setTimeAvailable] = useState(defaultTime);
  const balance = useMemo(() => getSessionBalance(state.sessionLogs), [state.sessionLogs]);
  const priorityList = useMemo(() => getPriorityTypes(balance, state), [balance, state]);
  const recommendedTypes = useMemo(() => {
    const p = state.planState.primaryRecommendation?.type;
    const s = state.planState.secondaryRecommendation?.type;
    return [p, s].filter(Boolean);
  }, [state.planState.primaryRecommendation, state.planState.secondaryRecommendation]);

  const startSession = (type, source) => {
    if (type === 'martialArts') {
      setPendingMAType({ type, source });
    } else {
      dispatch({ type: 'START_SESSION_FROM_PLAN', payload: { type, source, timeAvailable } });
    }
  };

  const confirmMASession = () => {
    dispatch({ type: 'START_SESSION_FROM_PLAN', payload: { type: pendingMAType.type, source: pendingMAType.source, timeAvailable } });
    // Store subtype after session starts (handled via SET_MA_SESSION_SUBTYPE once activeSession exists)
    // We use a small trick: dispatch after a tick
    setTimeout(() => dispatch({ type: 'SET_MA_SESSION_SUBTYPE', payload: maSessionSubtype }), 0);
    setPendingMAType(null);
  };

  // AI Coaching trigger
  useEffect(() => {
    if (!state.activeSession || !state.aiConfig.enabled || !state.aiConfig.apiKey) return;
    if (state.aiConfig.coachingLoading || state.aiConfig.coachingNotes) return;
    dispatch({ type: 'SET_AI_COACHING', payload: { loading: true } });
    const userContext = {
      name: state.profile.name || 'Athlete',
      age: state.profile.age || '?',
      bodyweight: state.profile.bodyweight || '?',
      currentBlock: state.profile.currentBlock,
      targetRPE: { accumulation:7, intensification:8, realization:9, deload:5 }[state.profile.currentBlock] || 7,
      readinessScore: state.readiness.score,
      readinessBand: state.readiness.band,
      sleep: state.readiness.inputs.sleep,
      stress: state.readiness.inputs.stress,
      primaryGoal: state.profile.primaryGoal || 'complete athlete',
      sessionType: state.currentSessionType,
      timeAvailable: state.activeSession?.prescription?.timeFit || 60,
      fatiguedMuscles: getMuscleRecoveryAdvice(state.muscleRecovery).fatiguedMuscles,
      recentSessions: (state.sessionLogs || []).slice(-3).map(l => `${l.type} RPE${l.rpe}`).join(', ') || 'none',
      injuries: Object.entries(state.constraints?.injuries || {}).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none',
      pullUpLevel: state.domains.calisthenics.skills.pullUp?.level || 1,
      handstandLevel: state.domains.calisthenics.skills.handstand?.level || 1,
      squatLevel: state.domains.calisthenics.skills.squat?.level || 1,
    };
    callGeminiAPI(
      state.aiConfig.apiKey,
      state.aiConfig.endpoint,
      userContext,
      state.activeSession.exercises || []
    ).then(notes => {
      dispatch({ type: 'SET_AI_COACHING', payload: { notes, loading: false } });
    }).catch(err => {
      dispatch({ type: 'SET_AI_COACHING', payload: { error: err.message, loading: false } });
    });
  }, [state.activeSession?.id]);


  if (!state.activeSession) {
    // Sparring subtype picker overlay
    if (pendingMAType) {
      return (
        <div className="space-y-4">
          <div className="border border-neutral-800 p-4">
            <button onClick={() => setPendingMAType(null)} className="flex items-center gap-2 text-neutral-500 font-mono text-xs uppercase mb-3">
              <ArrowLeft size={14} /> BACK
            </button>
            <div className="text-red-500 font-mono text-lg uppercase tracking-widest font-bold">MARTIAL ARTS SESSION TYPE</div>
            <div className="text-neutral-500 font-mono text-xs mt-1">{state.currentMASubtype ? `— ${state.currentMASubtype.toUpperCase()}` : ''}</div>
          </div>
          <div className="space-y-2">
            {MA_SESSION_SUBTYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setMaSessionSubtype(opt.value)}
                className={`w-full p-4 text-left border font-mono active:opacity-70 ${maSessionSubtype === opt.value ? 'border-red-500 bg-neutral-900' : 'border-neutral-800'}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${maSessionSubtype === opt.value ? 'bg-red-500' : 'bg-neutral-700'}`} />
                  <span className={`text-sm uppercase font-bold ${maSessionSubtype === opt.value ? 'text-neutral-100' : 'text-neutral-400'}`}>{opt.label}</span>
                </div>
                <div className="text-neutral-600 text-xs mt-1 pl-4">{opt.desc}</div>
              </button>
            ))}
          </div>
          <button
            onClick={confirmMASession}
            className="w-full bg-red-500 text-neutral-950 py-5 font-mono font-bold text-sm uppercase tracking-widest active:bg-red-700"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            START SESSION →
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border border-neutral-800 p-4">
          <div className="text-red-500 font-mono text-lg uppercase tracking-widest font-bold">COACHED SESSION PICKER</div>
          <div className="text-neutral-500 font-mono text-xs mt-1">{state.planState.reasonText}</div>
        </div>

        {/* Time picker */}
        <div className="mb-4">
          <div className="text-neutral-400 font-mono text-xs uppercase mb-2">Time Available</div>
          <div className="flex gap-2">
            {[30, 45, 60, 75, 90].map(t => (
              <button
                key={t}
                onClick={() => setTimeAvailable(t)}
                className={`flex-1 py-2 font-mono text-xs border ${timeAvailable === t ? 'border-red-500 text-red-500' : 'border-neutral-700 text-neutral-400'}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >{t}m</button>
            ))}
          </div>
        </div>

        {state.planState.primaryRecommendation && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startSession(state.planState.primaryRecommendation.type, 'primary')}
              className="border-2 border-red-500 p-4 text-left active:bg-neutral-900"
            >
              <div className="text-red-500 font-mono text-xs uppercase">Primary</div>
              <div className="text-neutral-100 font-mono text-sm font-bold">
                {FREQUENCY_TARGETS[state.planState.primaryRecommendation.type].icon} {FREQUENCY_TARGETS[state.planState.primaryRecommendation.type].label}
              </div>
            </button>
            {state.planState.secondaryRecommendation && (
              <button
                onClick={() => startSession(state.planState.secondaryRecommendation.type, 'secondary')}
                className="border border-neutral-700 p-4 text-left active:bg-neutral-900"
              >
                <div className="text-neutral-500 font-mono text-xs uppercase">Alternate</div>
                <div className="text-neutral-100 font-mono text-sm font-bold">
                  {FREQUENCY_TARGETS[state.planState.secondaryRecommendation.type].icon} {FREQUENCY_TARGETS[state.planState.secondaryRecommendation.type].label}
                </div>
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => setShowOverrides(v => !v)}
          className="w-full border border-neutral-800 py-3 font-mono text-xs uppercase text-neutral-500 hover:text-neutral-300"
        >
          {showOverrides ? 'HIDE MANUAL OVERRIDES' : 'SHOW MANUAL OVERRIDES'}
        </button>

        <div className="space-y-3">
          {(showOverrides ? priorityList : priorityList.filter(item => recommendedTypes.includes(item.type))).map(({ type, done, target, deficit }, rank) => {
            const t = FREQUENCY_TARGETS[type];
            const isPriority = state.planState.primaryRecommendation?.type === type;
            const isMet = done >= target;
            return (
              <button
                key={type}
                onClick={() => {
                  if (state.planState.primaryRecommendation?.type !== type) {
                    dispatch({ type: 'ACCEPT_ALTERNATE_SESSION', payload: { type } });
                  }
                  startSession(type, 'manual-override');
                }}
                className={`w-full p-5 text-left flex items-center gap-4 active:opacity-70 ${
                  isPriority
                    ? 'border-2 border-red-500 bg-neutral-900'
                    : 'border border-neutral-800'
                }`}
              style={{ WebkitTapHighlightColor: 'transparent', minHeight: 80 }}
              >
                {/* Icon */}
                <div className="text-3xl w-10 text-center flex-shrink-0">{t.icon}</div>

                {/* Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-sm uppercase tracking-widest font-bold ${t.color}`}>{t.label}</span>
                    {isPriority && (
                      <span className="bg-red-500 text-neutral-950 font-mono text-xs px-2 py-0.5 uppercase font-bold flex items-center gap-1">
                        <Zap size={9} /> COACH PICK
                      </span>
                    )}
                    {isMet && (
                      <span className="border border-green-600 text-green-500 font-mono text-xs px-2 py-0.5 uppercase">✓ MET</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-neutral-900 h-1 border border-neutral-800">
                      <div
                        className={`h-full ${isMet ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (done / target) * 100)}%` }}
                      />
                    </div>
                    <span className="text-neutral-500 font-mono text-xs">{done}/{target}×</span>
                  </div>
                </div>

                <div className="text-neutral-600 font-mono text-lg">›</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const t = FREQUENCY_TARGETS[state.currentSessionType];
  const maSessionSub = state.activeSession?.maSessionSubtype;
  const subtypeLabel = [
    state.currentMASubtype ? state.currentMASubtype.toUpperCase() : null,
    maSessionSub ? maSessionSub.toUpperCase() : null,
  ].filter(Boolean).join(' · ');
  const subtypeDisplay = subtypeLabel ? ` — ${subtypeLabel}` : '';
  const prescription = state.activeSession.prescription || {};
  const isMicroBreakSession = state.currentSessionType === 'mobility'
    && (prescription.sessionVariant === 'micro-break' || prescription.source === 'micro-break');
  const resultsById = Object.fromEntries((state.activeSession.exerciseResults || []).map(r => [r.exerciseId, r]));

  return (
    <div className="space-y-4">
      {cancelConfirm && (
        <div className="border-2 border-red-500 p-4 space-y-3 bg-neutral-950">
          <div className="text-red-500 font-mono text-xs uppercase tracking-widest">CANCEL SESSION?</div>
          <div className="text-neutral-400 font-mono text-xs">This session will be discarded. Progress lost.</div>
          <div className="flex gap-2">
            <button
              onClick={() => setCancelConfirm(false)}
              className="flex-1 border border-neutral-700 py-3 font-mono text-sm uppercase active:bg-neutral-800"
            >
              KEEP GOING
            </button>
            <button
              onClick={() => { setCancelConfirm(false); dispatch({ type: 'CANCEL_SESSION' }); }}
              className="flex-1 bg-red-500 text-neutral-950 py-3 font-mono text-sm uppercase font-bold active:bg-red-700"
            >
              CANCEL IT
            </button>
          </div>
        </div>
      )}

      <div className="border border-neutral-800 p-4 space-y-2">
        <button
          onClick={() => setCancelConfirm(true)}
          className="flex items-center gap-2 text-neutral-500 active:text-neutral-300 font-mono text-xs uppercase mb-2 py-2 -my-2 pr-4"
        >
          <ArrowLeft size={14} /> BACK
        </button>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{t.icon}</span>
          <div>
            <div className={`font-mono text-sm uppercase tracking-widest font-bold ${t.color}`}>
              {isMicroBreakSession ? 'MOBILITY • MICRO BREAK' : `${t.label}${subtypeDisplay}`}
            </div>
            <div className="text-neutral-500 font-mono text-xs">
              TARGET RPE: {prescription.targetRPE || 7} · MODE: {prescription.intensityTag || 'moderate'} · {prescription.timeFit || 60}MIN
            </div>
            <div className="text-neutral-600 font-mono text-xs">{prescription.reasonText}</div>
          </div>
        </div>
      </div>

      {/* AI Coaching Notes */}
      {state.aiConfig.enabled && (
        <div className="mb-4 p-3 border border-neutral-700 bg-neutral-900">
          {state.aiConfig.coachingLoading && (
            <div className="text-neutral-400 font-mono text-xs animate-pulse">⚡ AI COACH THINKING...</div>
          )}
          {state.aiConfig.coachingError && (
            <div className="text-red-400 font-mono text-xs">⚠ AI: {state.aiConfig.coachingError}</div>
          )}
          {state.aiConfig.coachingNotes && !state.aiConfig.coachingLoading && (
            <div className="space-y-1">
              <div className="text-yellow-400 font-mono text-xs font-bold uppercase">⚡ COACH</div>
              <div className="text-neutral-100 font-mono text-xs">{state.aiConfig.coachingNotes.sessionFocus}</div>
              {state.aiConfig.coachingNotes.watchOut && (
                <div className="text-orange-400 font-mono text-xs">⚠ {state.aiConfig.coachingNotes.watchOut}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {state.activeSession.exercises.map((ex, idx) => {
          const coachNotes = state.aiConfig.coachingNotes?.exercises || {};
          return (
            <ExerciseCard
              key={ex.id || idx}
              ex={ex}
              idx={idx}
              sessionType={state.currentSessionType}
              result={resultsById[ex.id]}
              coachNote={coachNotes[ex.name] || null}
              onResultChange={(patch) => dispatch({ type: 'LOG_EXERCISE_RESULT', payload: { exerciseId: ex.id, patch } })}
              onSwap={(oldId, newEx) => dispatch({ type: 'SWAP_SESSION_EXERCISE', payload: { oldId, newEx } })}
            />
          );
        })}
      </div>

      <SessionCompleteModal state={state} dispatch={dispatch} />
    </div>
  );
}

function ExerciseCard({ ex, idx, result, onResultChange, sessionType, onSwap, coachNote }) {
  const variant = ex.visual || 'athletic';
  const [showSwap, setShowSwap] = useState(false);
  const alternatives = useMemo(() => getAlternatives(ex, sessionType), [ex, sessionType]);

  // Parse round timer for drills with duration like "5×3min"
  const timerMatch = ex.duration ? ex.duration.match(/(\d+)(?:×(\d+)min|min)/) : null;
  const timerWorkSecs = timerMatch ? parseInt(timerMatch[2] || timerMatch[1]) * 60 : null;

  return (
    <div className="border border-neutral-800 p-4 flex gap-4 items-start">
      {/* Stick figure visual */}
      <div className="flex-shrink-0 bg-neutral-900 border border-neutral-800 flex items-center justify-center p-1" style={{ minWidth: 70 }}>
        <StickFigure variant={variant} size={60} />
      </div>

      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="text-neutral-100 font-mono text-sm font-bold uppercase flex-1">{ex.name}</div>
          {alternatives.length > 0 && (
            <button
              onClick={() => setShowSwap(v => !v)}
              className="text-neutral-600 font-mono text-xs uppercase border border-neutral-800 px-2 py-0.5 flex-shrink-0 active:bg-neutral-900"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {showSwap ? 'CLOSE' : 'SWAP'}
            </button>
          )}
        </div>

        {showSwap && (
          <div className="border border-neutral-700 bg-neutral-900 p-2 space-y-1">
            <div className="text-neutral-500 font-mono text-xs uppercase mb-1">SWAP WITH:</div>
            {alternatives.map(alt => (
              <button
                key={alt.id}
                onClick={() => { onSwap && onSwap(ex.id, alt); setShowSwap(false); }}
                className="w-full text-left border border-neutral-800 px-3 py-2 font-mono text-xs text-neutral-300 active:bg-neutral-800 flex justify-between items-center"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span>{alt.name}</span>
                <span className="text-neutral-600">{alt.sets && alt.reps ? `${alt.sets}×${alt.reps}` : alt.duration || ''}</span>
              </button>
            ))}
          </div>
        )}

        {ex.sets && ex.reps && (
          <div className="text-red-500 font-mono text-xs font-bold">{ex.sets} × {ex.reps}</div>
        )}
        {ex.duration && (
          <div className="text-red-500 font-mono text-xs font-bold">{ex.duration}</div>
        )}
        {ex.distance && (
          <div className="text-red-500 font-mono text-xs font-bold">{ex.distance} · {ex.zone}</div>
        )}
        {(ex.rpe || ex.targetRPE) && (
          <div className="text-neutral-500 font-mono text-xs">TARGET RPE: {ex.rpe || ex.targetRPE}</div>
        )}
        {ex.cue && (
          <div className="text-neutral-400 font-mono text-xs italic border-l border-neutral-700 pl-2">{ex.cue}</div>
        )}
        {ex.desc && (
          <div className="text-neutral-400 font-mono text-xs italic border-l border-neutral-700 pl-2">{ex.desc}</div>
        )}
        {ex.focus && (
          <div className="text-neutral-400 font-mono text-xs"><span className="text-neutral-600">FOCUS: </span>{ex.focus}</div>
        )}
        {Array.isArray(ex.microFlow?.steps) && ex.microFlow.steps.length > 0 && (
          <div className="border border-neutral-800 bg-neutral-900 p-2 space-y-1 mt-1">
            <div className="text-neutral-500 font-mono text-xs uppercase">MICRO FLOW · {ex.microFlow.minutes || ex.duration}</div>
            {ex.microFlow.steps.map((step, stepIdx) => (
              <div key={`${ex.id || ex.name}_step_${stepIdx}`} className="text-neutral-300 font-mono text-xs">
                {stepIdx + 1}. {step}
              </div>
            ))}
          </div>
        )}
        {ex.prescribedLoadHint && (
          <div className="text-yellow-400 font-mono text-xs">⬆ LOAD HINT: {ex.prescribedLoadHint}</div>
        )}
        {coachNote && (
          <div className="mt-2 p-2 bg-neutral-900 border-l-2 border-yellow-500">
            <div className="text-yellow-400 font-mono text-xs font-bold">COACH</div>
            <div className="text-neutral-300 font-mono text-xs">{coachNote.cue}</div>
            {coachNote.why && <div className="text-neutral-500 font-mono text-xs mt-1">{coachNote.why}</div>}
          </div>
        )}

        {/* Round timer for timed drills */}
        {timerWorkSecs && <RoundTimer workSeconds={timerWorkSecs} restSeconds={60} />}

        {result && (
          <div className="border border-neutral-800 bg-neutral-900 p-2 space-y-2 mt-2">
            <div className="text-neutral-500 font-mono text-xs uppercase">LOG RESULT</div>

            {/* Running: show actual distance + time instead of sets */}
            {ex.domain === 'running' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={result.performed.actualDistance || ''}
                  onChange={e => onResultChange({ actualDistance: e.target.value })}
                  placeholder="Dist (km)"
                  className="bg-neutral-950 border border-neutral-800 px-2 py-2 text-neutral-100 font-mono text-base"
                />
                <input
                  type="text"
                  value={result.performed.actualTime || ''}
                  onChange={e => onResultChange({ actualTime: e.target.value })}
                  placeholder="Time (mm:ss)"
                  className="bg-neutral-950 border border-neutral-800 px-2 py-2 text-neutral-100 font-mono text-base"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={result.performed.setsCompleted}
                  onChange={e => onResultChange({ setsCompleted: Number(e.target.value) })}
                  placeholder="Sets done"
                  className="bg-neutral-950 border border-neutral-800 px-2 py-2 text-neutral-100 font-mono text-base"
                />
                <input
                  type="text"
                  value={result.performed.topMetric}
                  onChange={e => onResultChange({ topMetric: e.target.value })}
                  placeholder="Top set (e.g. 80×5)"
                  className="bg-neutral-950 border border-neutral-800 px-2 py-2 text-neutral-100 font-mono text-base"
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-mono text-xs uppercase">Exercise RPE</span>
                <span className="text-neutral-100 font-mono text-xs">{result.performed.effortRPE}</span>
              </div>
              <input
                type="range" min="1" max="10"
                value={result.performed.effortRPE}
                onChange={e => onResultChange({ effortRPE: Number(e.target.value) })}
                className="w-full accent-red-500"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-mono text-red-500 uppercase">
              <input
                type="checkbox"
                checked={!!result.performed.pain}
                onChange={e => onResultChange({ pain: e.target.checked })}
              />
              Pain / issue on this exercise
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION COMPLETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function SessionCompleteModal({ state, dispatch }) {
  const [rpe, setRpe] = useState(5);
  const [recovery, setRecovery] = useState(5);
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const [completeAsModified, setCompleteAsModified] = useState(false);

  const submit = () => {
    dispatch({ type: 'COMPLETE_SESSION_V2', payload: { rpe, recovery, notes, completeAsModified } });
  };

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-red-500 text-neutral-950 py-5 font-mono font-bold text-base uppercase tracking-widest active:bg-red-700"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          COMPLETE SESSION
        </button>
      ) : (
        <div className="border border-red-500 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-red-500 font-mono text-sm uppercase tracking-widest">SESSION FEEDBACK</div>
            <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-300 font-mono text-xs uppercase">
              ← CANCEL
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-neutral-400 font-mono text-xs uppercase">RPE (effort)</label>
              <span className="text-red-500 font-mono text-sm font-bold">{rpe} / 10</span>
            </div>
            <input type="range" min="1" max="10" value={rpe}
              onChange={e => setRpe(+e.target.value)}
              className="w-full accent-red-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-neutral-400 font-mono text-xs uppercase">Recovery (how fresh?)</label>
              <span className="text-green-400 font-mono text-sm font-bold">{recovery} / 10</span>
            </div>
            <input type="range" min="1" max="10" value={recovery}
              onChange={e => setRecovery(+e.target.value)}
              className="w-full accent-green-500" />
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 font-mono text-xs uppercase">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did it feel? Any PRs?"
              className="w-full bg-neutral-900 border border-neutral-800 p-3 text-neutral-100 font-mono text-base placeholder-neutral-700 resize-none"
              rows={3}
            />
          </div>

          <label className="flex items-center gap-2 text-neutral-400 font-mono text-xs uppercase">
            <input
              type="checkbox"
              checked={completeAsModified}
              onChange={e => setCompleteAsModified(e.target.checked)}
            />
            Completed as modified (override/substitutions)
          </label>

          <button
            onClick={submit}
            className="w-full bg-red-500 text-neutral-950 py-4 font-mono font-bold text-base uppercase tracking-widest active:bg-red-700"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            LOG SESSION
          </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ProgressView({ state, dispatch }) {
  const [tab, setTab] = useState('domains');
  const topExercises = useMemo(() => {
    return Object.entries(state.progression.exercises || {})
      .sort((a, b) => (b[1].exposures || 0) - (a[1].exposures || 0))
      .slice(0, 6);
  }, [state.progression.exercises]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 border border-neutral-800">
        <button
          onClick={() => setTab('domains')}
          className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest transition ${
            tab === 'domains' ? 'bg-red-500 text-neutral-950 font-bold' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          DOMAINS
        </button>
        <button
          onClick={() => setTab('calisthenics')}
          className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest transition ${
            tab === 'calisthenics' ? 'bg-red-500 text-neutral-950 font-bold' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          SKILLS
        </button>
        <button
          onClick={() => setTab('coach')}
          className={`flex-1 py-3 font-mono text-xs uppercase tracking-widest transition ${
            tab === 'coach' ? 'bg-red-500 text-neutral-950 font-bold' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          COACH IQ
        </button>
      </div>

      {tab === 'domains' && (
        <div className="space-y-4">
          <div className="border border-neutral-800 p-4 space-y-2">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">COMPLETE ATHLETE SCORECARD</div>
            <div className="grid grid-cols-2 gap-2">
              {DOMAIN_KEYS.map((domain) => (
                <div key={domain} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-400 uppercase">{domain}</span>
                    <span className="text-neutral-100">{state.athleteModel.domainScores[domain] || 0}</span>
                  </div>
                  <div className="w-full bg-neutral-900 h-1.5 border border-neutral-800">
                    <div className="h-full bg-red-500" style={{ width: `${state.athleteModel.domainScores[domain] || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {Object.entries(state.domains).map(([key, data]) => (
            <div key={key} className="border border-neutral-800 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-neutral-200 font-mono text-sm uppercase tracking-widest font-bold">{key}</div>
                <div className="text-neutral-500 font-mono text-xs">
                  {data.sessions} sessions · Lv.{data.level}
                  {key === 'conditioning' && data.weeklyKm > 0 && ` · ${data.weeklyKm.toFixed(1)}km`}
                </div>
              </div>
              {data.trend && data.trend.length > 1 ? (
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend}>
                      <Tooltip
                        contentStyle={{ backgroundColor:'#0a0a0a', border:'1px solid #333', fontFamily:'monospace', fontSize:10 }}
                        labelFormatter={() => ''}
                      />
                      <Line type="monotone" dataKey="rpe" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-12 flex items-center">
                  <div className="text-neutral-700 font-mono text-xs">No trend data yet</div>
                </div>
              )}
            </div>
          ))}

          {/* PR board */}
          <div className="border border-neutral-800 p-4 space-y-3">
            <div className="text-red-500 font-mono text-sm uppercase tracking-widest">STRENGTH PRs (kg)</div>
            {Object.entries(state.domains.strength.prs).map(([lift, pr]) => (
              <div key={lift} className="flex items-center gap-3">
                <span className="text-neutral-400 font-mono text-xs uppercase w-16">{lift}</span>
                <input
                  type="number"
                  value={pr || ''}
                  onChange={e => dispatch({ type: 'SET_PR', payload: { lift, value: parseInt(e.target.value) || 0 } })}
                  placeholder="0"
                  className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-3 text-neutral-100 font-mono text-base"
                />
                <span className="text-neutral-600 font-mono text-xs">kg</span>
              </div>
            ))}
          </div>

          <div className="border border-neutral-800 p-4 space-y-4">
            <div className="text-red-500 font-mono text-sm uppercase tracking-widest">KEY EXERCISE PROGRESSION</div>
            {topExercises.length === 0 && (
              <div className="text-neutral-600 font-mono text-xs">No progression records yet. Complete sessions to build history.</div>
            )}
            {topExercises.map(([exerciseId, rec]) => {
              const history = rec.history || [];
              const rpeData = history.map((h, i) => ({ x: i + 1, rpe: h.effortRPE || 0 }));
              const outcomeColor = rec.lastOutcome === 'advance' ? 'text-green-400' : rec.lastOutcome === 'regress' ? 'text-red-400' : 'text-yellow-400';
              return (
                <div key={exerciseId} className="border-l-2 border-neutral-700 pl-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="text-neutral-200 font-mono text-xs font-bold">{exerciseId.replace(/_/g,' ').replace(/strength |calisthenics |running /gi,'')}</div>
                    <div className={`font-mono text-xs uppercase font-bold ${outcomeColor}`}>{rec.lastOutcome || 'hold'}</div>
                  </div>
                  <div className="flex justify-between text-neutral-500 font-mono text-xs">
                    <span>{rec.exposures || 0} sessions</span>
                    <span>{rec.nextPrescription?.loadHint || '—'}</span>
                  </div>
                  {rpeData.length > 1 ? (
                    <div className="h-12 mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={rpeData}>
                          <Line type="monotone" dataKey="rpe" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                          <Tooltip
                            contentStyle={{ backgroundColor:'#0a0a0a', border:'1px solid #333', fontFamily:'monospace', fontSize:9 }}
                            formatter={(v) => [`RPE ${v}`, '']}
                            labelFormatter={(i) => `Session ${i}`}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-neutral-700 font-mono text-xs">{rpeData.length === 1 ? '1 session logged — trend builds from 2+' : 'No data yet'}</div>
                  )}
                  {history.length > 0 && history[history.length - 1].topMetric && (
                    <div className="text-neutral-500 font-mono text-xs">Last: {history[history.length - 1].topMetric}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'calisthenics' && (
        <div className="space-y-4">
          {Object.entries(state.domains.calisthenics.skills).map(([skill, data]) => {
            const maxLevels = { pullUp:9, pushUp:7, squat:5, core:6, handstand:7 };
            const max = maxLevels[skill] || 9;
            const db = EXERCISE_DB_V5.calisthenics[skill];
            const current = db.find(e => e.level === data.level) || db[0];
            const pct = ((data.level - 1) / (max - 1)) * 100;
            const skillIcons = { pullUp:'💪', pushUp:'🤜', squat:'🦵', core:'🔥', handstand:'🤸' };

            return (
              <div key={skill} className="border border-neutral-800 p-4 space-y-3">
                {/* Skill header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{skillIcons[skill]}</span>
                    <span className="text-neutral-200 font-mono text-sm uppercase tracking-widest font-bold">{skill}</span>
                  </div>
                  <span className="text-neutral-500 font-mono text-xs">Lv {data.level}/{max}</span>
                </div>

                {/* Current exercise + visual */}
                {current && (
                  <div className="flex items-start gap-3 bg-neutral-900 p-3">
                    <div className="bg-neutral-950 border border-neutral-800 p-1 flex-shrink-0">
                      <StickFigure variant={current.visual || 'athletic'} size={52} />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="text-red-500 font-mono text-xs font-bold uppercase">{current.name}</div>
                      <div className="text-neutral-400 font-mono text-xs">{current.sets} × {current.reps}</div>
                      {current.cue && (
                        <div className="text-neutral-500 font-mono text-xs italic">{current.cue}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-neutral-900 h-2 border border-neutral-800">
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-neutral-600 font-mono text-xs">
                    <span>Lv 1</span>
                    <span>Lv {max}</span>
                  </div>
                </div>

                {/* Level controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatch({ type:'SET_CALI_SKILL_LEVEL', payload:{ skill, level: data.level - 1 } })}
                    disabled={data.level <= 1}
                    className="flex-1 border border-neutral-700 py-2 font-mono text-xs uppercase hover:bg-neutral-900 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼ LEVEL DOWN
                  </button>
                  <button
                    onClick={() => dispatch({ type:'SET_CALI_SKILL_LEVEL', payload:{ skill, level: data.level + 1 } })}
                    disabled={data.level >= max}
                    className="flex-1 border border-red-600 text-red-500 py-2 font-mono text-xs uppercase hover:bg-red-500 hover:text-neutral-950 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲ LEVEL UP
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'coach' && (
        <div className="space-y-4">
          <div className="border border-neutral-800 p-4 grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="space-y-1">
              <div className="text-neutral-500 uppercase">Control Score</div>
              <div className="text-red-500 text-lg">{state.athleteModel.controlScore}</div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500 uppercase">Consistency</div>
              <div className="text-green-400 text-lg">{state.athleteModel.consistencyScore}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500 uppercase">Fatigue Debt</div>
              <div className={`${state.athleteModel.fatigueDebt > 35 ? 'text-red-500' : 'text-yellow-400'} text-lg`}>
                {Math.round(state.athleteModel.fatigueDebt)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500 uppercase">Adaptation Confidence</div>
              <div className="text-neutral-100 text-lg">{Math.round(state.athleteModel.adaptationConfidence * 100)}%</div>
            </div>
          </div>

          <div className="border border-neutral-800 p-4 space-y-2">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">Readiness vs Performance Trend</div>
            {state.athleteModel.performanceTrend.length > 1 ? (
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={state.athleteModel.performanceTrend}>
                    <Tooltip
                      contentStyle={{ backgroundColor:'#0a0a0a', border:'1px solid #333', fontFamily:'monospace', fontSize:10 }}
                      labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="quality" stroke="#22c55e" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-neutral-600 font-mono text-xs">Need at least 2 logged sessions.</div>
            )}
          </div>

          <div className="border border-neutral-800 p-4 space-y-2">
            <div className="text-red-500 font-mono text-xs uppercase tracking-widest">Stalled Items</div>
            {(state.progression.stalledItems || []).length === 0 && (
              <div className="text-neutral-600 font-mono text-xs">No stalled items right now.</div>
            )}
            {(state.progression.stalledItems || []).slice(-8).map((item, idx) => (
              <div key={`${item.id}_${idx}`} className="text-neutral-400 font-mono text-xs border-l border-neutral-700 pl-2">
                {item.id} · {item.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function HistoryView({ state }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [intensityFilter, setIntensityFilter] = useState('all');

  const logs = useMemo(() => {
    return [...state.sessionLogs]
      .filter(log => {
        if (typeFilter === 'all') return true;
        if (typeFilter === 'gym') return log.type === 'gym' || log.type === 'calisthenics'; // legacy compat
        return log.type === typeFilter;
      })
      .filter(log => {
        if (intensityFilter === 'all') return true;
        if (intensityFilter === 'high') return toNum(log.rpe, 0) >= 8;
        if (intensityFilter === 'low') return toNum(log.rpe, 10) <= 6;
        return true;
      })
      .reverse();
  }, [state.sessionLogs, typeFilter, intensityFilter]);

  if (logs.length === 0) {
    return (
      <div className="border border-neutral-800 p-12 text-center space-y-2">
        <div className="text-neutral-500 font-mono text-sm uppercase">NO SESSIONS LOGGED YET</div>
        <div className="text-neutral-700 font-mono text-xs">Complete your first session to build history</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-neutral-100 font-mono text-base"
        >
          <option value="all">ALL TYPES</option>
          {SESSION_TYPES.map(type => (
            <option key={type} value={type}>{FREQUENCY_TARGETS[type].label}</option>
          ))}
        </select>
        <select
          value={intensityFilter}
          onChange={e => setIntensityFilter(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 px-3 py-2 text-neutral-100 font-mono text-base"
        >
          <option value="all">ALL INTENSITY</option>
          <option value="high">HIGH (RPE 8+)</option>
          <option value="low">LOW (RPE ≤6)</option>
        </select>
      </div>

      <div className="text-red-500 font-mono text-xs uppercase tracking-widest px-1">
        {logs.length} SESSION{logs.length !== 1 ? 'S' : ''} TOTAL
      </div>
      {logs.map((log, i) => {
        const t = FREQUENCY_TARGETS[log.type];
        const isMicroBreak = log.type === 'mobility'
          && (log.prescription?.sessionVariant === 'micro-break' || log.prescription?.source === 'micro-break');
        const variant = log.exercises?.[0]?.visual || 'athletic';
        const runningPaceRows = (() => {
          if (log.type !== 'running') return [];
          try {
            const namesById = Object.fromEntries((log.exercises || []).map((ex, idx) => [ex.id, ex.name || ex.id || `RUN ${idx + 1}`]));
            return (log.exerciseResults || []).map((result, idx) => {
              const exerciseName = namesById[result.exerciseId] || result.exerciseId || `RUN ${idx + 1}`;
              const distanceKm = parseFloat(result?.performed?.actualDistance);
              const totalSeconds = parseMmSsToSeconds(result?.performed?.actualTime);
              if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
                return { key: `${result.exerciseId || 'run'}_${idx}`, text: `${exerciseName}: —` };
              }
              const pace = formatPace(totalSeconds / distanceKm);
              const distanceText = String(Math.round(distanceKm * 100) / 100);
              return { key: `${result.exerciseId || 'run'}_${idx}`, text: `${exerciseName}: ${distanceText}km @ ${pace} /km` };
            });
          } catch (err) {
            return [{ key: 'running_pace_error', text: 'PACE: —' }];
          }
        })();
        return (
          <div key={i} className="border border-neutral-800 p-4 flex gap-3 items-start">
            <div className="bg-neutral-900 border border-neutral-800 flex-shrink-0 p-1">
              <StickFigure variant={variant} size={44} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className={`font-mono text-sm uppercase font-bold ${t ? t.color : 'text-neutral-100'}`}>
                    {isMicroBreak ? 'MOBILITY • MICRO BREAK' : (t ? t.label : log.type)}
                  </div>
                  {(log.maSubtype || log.maSessionSubtype) && (
                    <div className="text-neutral-500 font-mono text-xs">
                      {[log.maSubtype, log.maSessionSubtype].filter(Boolean).map(s => s.toUpperCase()).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="text-neutral-600 font-mono text-xs">{new Date(log.timestamp).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-4 text-neutral-400 font-mono text-xs">
                <span>RPE <span className="text-red-500 font-bold">{log.rpe}</span></span>
                <span>RECOVERY <span className="text-green-400 font-bold">{log.recovery}</span></span>
                <span>QUALITY <span className="text-yellow-400 font-bold">{log.completionQuality || '--'}</span></span>
              </div>
              {log.notes && (
                <div className="text-neutral-600 font-mono text-xs italic truncate">{log.notes}</div>
              )}
              {log.adaptationApplied?.summary && (
                <div className="text-neutral-500 font-mono text-xs">ADAPTATION: {log.adaptationApplied.summary}</div>
              )}
              {log.adaptationApplied?.nextFocus && (
                <div className="text-neutral-700 font-mono text-xs">NEXT: {log.adaptationApplied.nextFocus}</div>
              )}
              {runningPaceRows.length > 0 && (
                <div className="space-y-1">
                  {runningPaceRows.map(row => (
                    <div key={row.key} className="text-blue-400 font-mono text-xs">{row.text}</div>
                  ))}
                </div>
              )}
              <div className="text-neutral-700 font-mono text-xs">
                {log.exercises?.length} exercises
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function SettingsView({ state, dispatch }) {
  const [resetConfirm, setResetConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miyamoto_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result);
        dispatch({ type: 'IMPORT_STATE', payload: imported });
        dispatch({ type: 'REBUILD_ROLLING_PLAN' });
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="border border-neutral-800 p-4 space-y-3">
        <div className="text-red-500 font-mono text-sm uppercase tracking-widest">PROFILE</div>
        {['name', 'age', 'bodyweight'].map(field => (
          <div key={field} className="space-y-1">
            <label className="text-neutral-500 font-mono text-xs uppercase">{field}</label>
            <input
              type="text"
              value={state.profile[field] || ''}
              onChange={e => dispatch({ type: 'SET_PROFILE_FIELD', payload: { field, value: e.target.value } })}
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-3 text-neutral-100 font-mono text-base"
            />
          </div>
        ))}
      </div>

      {/* AI COACH */}
      <div className="space-y-3">
        <div className="text-red-500 font-mono text-sm font-bold uppercase tracking-widest">AI Coach</div>

        <label className="flex items-center justify-between">
          <span className="text-neutral-300 font-mono text-xs uppercase">Enable Gemini AI Coaching</span>
          <input
            type="checkbox"
            checked={!!state.aiConfig.enabled}
            onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: { enabled: e.target.checked } })}
          />
        </label>

        {state.aiConfig.enabled && (
          <>
            <div>
              <div className="text-neutral-500 font-mono text-xs uppercase mb-1">Gemini API Key</div>
              <input
                type="password"
                value={state.aiConfig.apiKey}
                onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: { apiKey: e.target.value } })}
                placeholder="AIza..."
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 font-mono text-base"
              />
              <div className="text-neutral-600 font-mono text-xs mt-1">Free tier: gemini-2.0-flash. Get key at aistudio.google.com</div>
            </div>
            <div>
              <div className="text-neutral-500 font-mono text-xs uppercase mb-1">Model</div>
              <select
                value={state.aiConfig.model}
                onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: {
                  model: e.target.value,
                  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${e.target.value}:generateContent`
                }})}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 font-mono text-sm"
              >
                <option value="gemini-2.0-flash">gemini-2.0-flash (free tier)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (paid)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (free tier)</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* SCHEDULE */}
      <div className="space-y-3">
        <div className="text-red-500 font-mono text-sm font-bold uppercase tracking-widest">Weekly Schedule</div>
        <div className="text-neutral-500 font-mono text-xs">Minutes available per day</div>
        <div className="grid grid-cols-7 gap-1">
          {['mon','tue','wed','thu','fri','sat','sun'].map(day => (
            <div key={day} className="text-center">
              <div className="text-neutral-500 font-mono text-xs uppercase mb-1">{day.slice(0,1).toUpperCase()}</div>
              <input
                type="number"
                min="0" max="180" step="15"
                value={state.profile.timeByDay?.[day] || 60}
                onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'timeByDay', subfield: day, value: Number(e.target.value) }})}
                className="w-full bg-neutral-950 border border-neutral-700 px-1 py-2 text-neutral-100 font-mono text-xs text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* SKILL ASSESSMENTS */}
      <div className="space-y-3">
        <div className="text-red-500 font-mono text-sm font-bold uppercase tracking-widest">Skill Assessments</div>
        {[
          { key: 'maxPullUps', label: 'Max Pull-ups', unit: 'reps' },
          { key: 'maxPushUps', label: 'Max Push-ups', unit: 'reps' },
          { key: 'squatRM', label: 'Squat 1RM', unit: 'kg' },
          { key: 'deadliftRM', label: 'Deadlift 1RM', unit: 'kg' },
          { key: 'benchRM', label: 'Bench 1RM', unit: 'kg' },
          { key: 'runningPaceEasy', label: 'Easy Run Pace', unit: 'min/km' },
          { key: 'handstandHold', label: 'Handstand Hold', unit: 'sec' },
        ].map(({ key, label, unit }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="text-neutral-300 font-mono text-xs flex-1">{label}</div>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0"
                value={state.profile.skillAssessments?.[key] || 0}
                onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'skillAssessments', subfield: key, value: Number(e.target.value) }})}
                className="w-20 bg-neutral-950 border border-neutral-700 px-2 py-1 text-neutral-100 font-mono text-sm text-right"
              />
              <span className="text-neutral-500 font-mono text-xs w-12">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-neutral-800 p-4 space-y-3">
        <div className="text-red-500 font-mono text-sm uppercase tracking-widest">PROGRAM CONFIG</div>
        <div className="space-y-1">
          <label className="text-neutral-500 font-mono text-xs uppercase">Coach style</label>
          <select
            value={state.programConfig.coachStyle}
            onChange={e => dispatch({ type: 'SET_PROGRAM_CONFIG', payload: { coachStyle: e.target.value } })}
            className="w-full bg-neutral-900 border border-neutral-800 px-3 py-3 text-neutral-100 font-mono text-base"
          >
            <option value="adaptive-flexible">Adaptive Flexible</option>
            <option value="strict">Strict Progression</option>
            <option value="light-touch">Light Touch</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-neutral-500 font-mono text-xs uppercase">Default session duration (min)</label>
          <select
            value={state.programConfig.defaultSessionMinutes}
            onChange={e => dispatch({ type: 'SET_PROGRAM_CONFIG', payload: { defaultSessionMinutes: Number(e.target.value) } })}
            className="w-full bg-neutral-900 border border-neutral-800 px-3 py-3 text-neutral-100 font-mono text-base"
          >
            <option value={45}>45</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-neutral-400 font-mono text-xs uppercase">
          <input
            type="checkbox"
            checked={!!state.programConfig.featureFlags.adaptiveEngine}
            onChange={e => dispatch({ type: 'SET_PROGRAM_CONFIG', payload: { featureFlags: { adaptiveEngine: e.target.checked } } })}
          />
          Adaptive engine enabled
        </label>
        <label className="flex items-center gap-2 text-neutral-400 font-mono text-xs uppercase">
          <input
            type="checkbox"
            checked={!!state.programConfig.featureFlags.legacyRandom}
            onChange={e => dispatch({ type: 'SET_PROGRAM_CONFIG', payload: { featureFlags: { legacyRandom: e.target.checked } } })}
          />
          Legacy random fallback
        </label>
      </div>

      {/* Block */}
      <div className="border border-neutral-800 p-4 space-y-3">
        <div className="text-red-500 font-mono text-sm uppercase tracking-widest">TRAINING BLOCK</div>
        {['accumulation', 'intensification', 'realization', 'deload'].map(block => (
          <button
            key={block}
            onClick={() => dispatch({ type: 'SET_PROFILE_FIELD', payload: { field: 'currentBlock', value: block } })}
            className={`w-full py-2 font-mono text-xs uppercase text-left px-3 transition ${
              state.profile.currentBlock === block
                ? 'bg-red-500 text-neutral-950 font-bold'
                : 'border border-neutral-800 text-neutral-400 hover:bg-neutral-900'
            }`}
          >
            {block} {block === 'accumulation' ? '— RPE 7' : block === 'intensification' ? '— RPE 8' : block === 'realization' ? '— RPE 9' : '— RPE 5'}
          </button>
        ))}
      </div>

      <div className="border border-neutral-800 p-4 space-y-3">
        <div className="text-red-500 font-mono text-sm uppercase tracking-widest">CONSTRAINTS & SAFETY</div>
        {Object.entries(state.constraints.injuries).map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 text-neutral-400 font-mono text-xs uppercase">
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => dispatch({ type: e.target.checked ? 'SET_CONSTRAINT_FLAG' : 'CLEAR_CONSTRAINT_FLAG', payload: { key } })}
            />
            Injury flag: {key}
          </label>
        ))}
        <div className="space-y-1">
          <label className="text-neutral-500 font-mono text-xs uppercase">Time override (minutes)</label>
          <input
            type="number"
            value={state.constraints.timeOverrideMinutes || ''}
            onChange={e => {
              const value = e.target.value;
              if (!value) {
                dispatch({ type: 'CLEAR_CONSTRAINT_FLAG', payload: { key: 'timeOverrideMinutes' } });
              } else {
                dispatch({ type: 'SET_CONSTRAINT_FLAG', payload: { key: 'timeOverrideMinutes', value: Number(value) } });
              }
            }}
            placeholder="Optional override"
            className="w-full bg-neutral-900 border border-neutral-800 px-3 py-3 text-neutral-100 font-mono text-base"
          />
        </div>
      </div>

      {/* Export/Import */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 border border-neutral-700 py-3 font-mono text-xs uppercase hover:bg-neutral-900 transition flex items-center justify-center gap-2"
        >
          <Download size={14} /> EXPORT
        </button>
        <label className="flex-1 border border-neutral-700 py-3 font-mono text-xs uppercase hover:bg-neutral-900 transition flex items-center justify-center gap-2 cursor-pointer">
          <Upload size={14} /> IMPORT
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      {/* Reset */}
      {!resetConfirm ? (
        <button
          onClick={() => setResetConfirm(true)}
          className="w-full border border-red-900 py-3 font-mono text-xs uppercase text-red-700 hover:border-red-600 hover:text-red-500 transition"
        >
          RESET ALL DATA
        </button>
      ) : (
        <div className="border border-red-500 p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-500 font-mono text-xs uppercase">
            <AlertTriangle size={14} /> ARE YOU SURE? THIS CANNOT BE UNDONE.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setResetConfirm(false)}
              className="flex-1 border border-neutral-700 py-2 font-mono text-xs uppercase hover:bg-neutral-900 transition"
            >
              CANCEL
            </button>
            <button
              onClick={() => { dispatch({ type: 'IMPORT_STATE', payload: createInitialState() }); setResetConfirm(false); }}
              className="flex-1 bg-red-500 text-neutral-950 py-2 font-mono text-xs uppercase font-bold hover:bg-red-600 transition"
            >
              CONFIRM RESET
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="border border-neutral-800 p-4 space-y-2 text-neutral-600 font-mono text-xs">
        <div>Total sessions: {state.profile.sessionCount}</div>
        <div>Session logs stored: {state.sessionLogs.length}</div>
        <div>Block: {state.profile.currentBlock} · Wk {state.profile.blockWeek}</div>
        <div>Readiness: {state.readiness.score} ({state.readiness.band})</div>
        <div>Control score: {state.athleteModel.controlScore}</div>
        <div>Last adaptation: {state.progression.lastAdaptationSummary}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING VIEW
// ─────────────────────────────────────────────────────────────────────────────

function OnboardingView({ state, dispatch }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bw, setBw] = useState('');
  const [duration, setDuration] = useState(60);
  const [coachStyle, setCoachStyle] = useState('adaptive-flexible');
  const [useWearable, setUseWearable] = useState(false);
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(4);

  const next = () => {
    if (state.onboardStep === 0 && name.trim()) {
      dispatch({ type: 'SET_PROFILE_FIELD', payload: { field: 'name', value: name.trim() } });
      dispatch({ type: 'NEXT_ONBOARD_STEP' });
    } else if (state.onboardStep === 1 && age && bw) {
      dispatch({ type: 'SET_PROFILE_FIELD', payload: { field: 'age', value: age } });
      dispatch({ type: 'SET_PROFILE_FIELD', payload: { field: 'bodyweight', value: bw } });
      dispatch({ type: 'NEXT_ONBOARD_STEP' });
    } else if (state.onboardStep === 2) {
      dispatch({
        type: 'SET_PROGRAM_CONFIG',
        payload: {
          coachStyle,
          defaultSessionMinutes: duration,
          useWearable,
          featureFlags: { adaptiveEngine: true, legacyRandom: false },
        },
      });
      dispatch({
        type: 'SET_DAILY_READINESS',
        payload: {
          sleep,
          stress,
          soreness: 3,
          motivation: 7,
          hrvDelta: '',
          restingHrDelta: '',
        },
      });
      dispatch({ type: 'COMPLETE_ONBOARDING' });
    }
  };

  return (
    <div className="bg-neutral-950 flex items-center justify-center p-6" style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-sm space-y-6 border border-neutral-800 p-8">
        <div>
          <div className="text-red-500 font-mono text-2xl uppercase tracking-widest font-bold">MIYAMOTO</div>
          <div className="text-neutral-600 font-mono text-xs mt-1">ADAPTIVE TRAINING SYSTEM</div>
        </div>

        <div className="text-neutral-500 font-mono text-xs">STEP {state.onboardStep + 1} / 3</div>

        {state.onboardStep === 0 && (
          <div className="space-y-4">
            <div className="text-neutral-200 font-mono text-sm uppercase">What's your name?</div>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && next()}
              placeholder="ENTER NAME"
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 font-mono text-base placeholder-neutral-700"
            />
            <button
              onClick={next}
              disabled={!name.trim()}
              className="w-full bg-red-500 text-neutral-950 py-4 font-mono font-bold text-base uppercase tracking-widest disabled:opacity-40 active:bg-red-700"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              NEXT
            </button>
          </div>
        )}

        {state.onboardStep === 1 && (
          <div className="space-y-4">
            <div className="text-neutral-200 font-mono text-sm uppercase">Your stats</div>
            <div className="space-y-1">
              <label className="text-neutral-500 font-mono text-xs uppercase">Age</label>
              <input
                type="number"
                value={age}
                autoFocus
                onChange={e => setAge(e.target.value)}
                placeholder="AGE"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 font-mono text-base placeholder-neutral-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-500 font-mono text-xs uppercase">Bodyweight (kg)</label>
              <input
                type="number"
                value={bw}
                onChange={e => setBw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && next()}
                placeholder="BW IN KG"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 font-mono text-base placeholder-neutral-700"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: 'PREV_ONBOARD_STEP' })}
                className="border border-neutral-700 px-4 py-3 font-mono text-xs uppercase hover:bg-neutral-900 transition"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={next}
                disabled={!age || !bw}
                className="flex-1 bg-red-500 text-neutral-950 py-4 font-mono font-bold text-base uppercase tracking-widest disabled:opacity-40 active:bg-red-700"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                NEXT
              </button>
            </div>
          </div>
        )}

        {state.onboardStep === 2 && (
          <div className="space-y-4">
            <div className="text-neutral-200 font-mono text-sm uppercase">Trainer Preferences</div>
            <div className="space-y-1">
              <label className="text-neutral-500 font-mono text-xs uppercase">Default session length</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 font-mono text-base"
              >
                <option value={45}>45 MIN</option>
                <option value={60}>60 MIN</option>
                <option value={90}>90 MIN</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-neutral-500 font-mono text-xs uppercase">Coach style</label>
              <select
                value={coachStyle}
                onChange={e => setCoachStyle(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 text-neutral-100 font-mono text-base"
              >
                <option value="adaptive-flexible">ADAPTIVE FLEXIBLE</option>
                <option value="strict">STRICT PROGRESSION</option>
                <option value="light-touch">LIGHT TOUCH</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-neutral-500 font-mono text-xs uppercase">Baseline readiness</div>
              <div>
                <div className="flex justify-between text-xs font-mono text-neutral-500">
                  <span>SLEEP</span><span>{sleep}</span>
                </div>
                <input type="range" min="1" max="10" value={sleep} onChange={e => setSleep(Number(e.target.value))} className="w-full accent-red-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono text-neutral-500">
                  <span>STRESS</span><span>{stress}</span>
                </div>
                <input type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} className="w-full accent-red-500" />
              </div>
              <label className="flex items-center gap-2 text-neutral-400 font-mono text-xs uppercase">
                <input type="checkbox" checked={useWearable} onChange={e => setUseWearable(e.target.checked)} />
                I use wearable metrics (optional)
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: 'PREV_ONBOARD_STEP' })}
                className="border border-neutral-700 px-4 py-3 font-mono text-xs uppercase hover:bg-neutral-900 transition"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={next}
                className="flex-1 bg-red-500 text-neutral-950 py-4 font-mono font-bold text-base uppercase tracking-widest active:bg-red-700"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                START TRAINING
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE, (init) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('miyamoto_v5');
        if (saved) return migrateState(JSON.parse(saved));
      }
    } catch(e) {}
    return migrateState(init);
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('miyamoto_v5', JSON.stringify(state));
      }
    } catch(e) {}
  }, [state]);

  if (!state.onboarded) {
    return <OnboardingView state={state} dispatch={dispatch} />;
  }

  const views = {
    home:     <HomeView     state={state} dispatch={dispatch} />,
    train:    <TrainView    state={state} dispatch={dispatch} />,
    progress: <ProgressView state={state} dispatch={dispatch} />,
    history:  <HistoryView  state={state} />,
    settings: <SettingsView state={state} dispatch={dispatch} />,
  };

  const navTabs = [
    { id:'home',     label:'HOME',     icon:Home },
    { id:'train',    label:'TRAIN',    icon:Dumbbell },
    { id:'progress', label:'PROGRESS', icon:TrendingUp },
    { id:'history',  label:'HISTORY',  icon:List },
    { id:'settings', label:'SETTINGS', icon:Settings },
  ];

  return (
    <div className="bg-neutral-950 text-neutral-100 font-mono" style={{ minHeight: '100dvh' }}>
      <div className="max-w-2xl mx-auto pt-6 px-4" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {views[state.view]}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-2xl mx-auto flex">
          {navTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: id })}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-t-2 transition active:bg-neutral-900 ${
                state.view === id
                  ? 'text-red-500 border-red-500'
                  : 'text-neutral-600 border-transparent'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs uppercase tracking-widest">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
