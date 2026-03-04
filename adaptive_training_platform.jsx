import React, { useState, useReducer, useMemo, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts';


// ─── ACCENT COLORS ──────────────────────────────────────────────────────────
const ACCENT_COLORS = {
  red:    { css: '#ef4444', dim: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   label: 'Red' },
  blue:   { css: '#3b82f6', dim: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)',  label: 'Blue' },
  green:  { css: '#22c55e', dim: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   label: 'Green' },
  purple: { css: '#a855f7', dim: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.4)',  label: 'Purple' },
  orange: { css: '#f97316', dim: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  label: 'Orange' },
  cyan:   { css: '#06b6d4', dim: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.4)',   label: 'Cyan' },
};

function applyAccent(key) {
  const a = ACCENT_COLORS[key] || ACCENT_COLORS.red;
  document.documentElement.style.setProperty('--accent', a.css);
  document.documentElement.style.setProperty('--accent-dim', a.dim);
  document.documentElement.style.setProperty('--accent-border', a.border);
}

// ─── BLOCK CONFIG ────────────────────────────────────────────────────────────
const BLOCK_CONFIG = {
  accumulation:   { label: 'Accumulation',   targetRPE: 7, color: '#3b82f6', desc: 'Build volume & base fitness' },
  intensification:{ label: 'Intensification', targetRPE: 8, color: '#f97316', desc: 'Push intensity & load' },
  realization:    { label: 'Realization',    targetRPE: 9, color: '#ef4444', desc: 'Peak performance & test PRs' },
  deload:         { label: 'Deload',         targetRPE: 5, color: '#22c55e', desc: 'Recovery & adaptation' },
};

// ─── DISCIPLINES ─────────────────────────────────────────────────────────────
const DISCIPLINES = {
  gym:         { label: 'Gym / Weights', icon: '🏋️', desc: 'Barbell & dumbbell strength training', color: '#f97316' },
  calisthenics:{ label: 'Calisthenics',  icon: '🤸', desc: 'Bodyweight skill progression',          color: '#22c55e' },
  running:     { label: 'Running',       icon: '🏃', desc: 'Zone-based cardio & intervals',          color: '#3b82f6' },
  martial_arts:{ label: 'Martial Arts',  icon: '🥋', desc: 'Striking, grappling & sparring',         color: '#ef4444' },
  mobility:    { label: 'Mobility',      icon: '🧘', desc: 'Flexibility & movement quality',          color: '#a855f7' },
  cycling:     { label: 'Cycling',       icon: '🚴', desc: 'Road cycling & HIIT on bike',             color: '#06b6d4' },
  yoga:        { label: 'Yoga',          icon: '🕉️', desc: 'Breathwork, flow & mindfulness',          color: '#ec4899' },
  hiit:        { label: 'HIIT',          icon: '⚡', desc: 'High-intensity interval training',         color: '#eab308' },
  custom:      { label: 'Custom Session',icon: '🧩', desc: 'Build your own session manually',          color: '#94a3b8' },
};

// ─── GOALS ───────────────────────────────────────────────────────────────────
const GOALS = {
  fat_loss:   { label: 'Fat Loss',          icon: '🔥', desc: 'Burn fat, preserve muscle' },
  muscle:     { label: 'Muscle Gain',       icon: '💪', desc: 'Hypertrophy & size' },
  strength:   { label: 'Strength',          icon: '🏆', desc: 'Get stronger — PRs & 1RMs' },
  endurance:  { label: 'Endurance',         icon: '🫀', desc: 'Stamina & aerobic base' },
  sport:      { label: 'Sport Performance', icon: '🥇', desc: 'Specific sport goals' },
  general:    { label: 'General Fitness',   icon: '✨', desc: 'Look good, feel great, move well' },
};

// ─── FREQUENCY TARGETS (per discipline, per week) ────────────────────────────
const FREQ_TARGETS = {
  gym:         4,
  calisthenics:3,
  running:     3,
  martial_arts:3,
  mobility:    2,
  cycling:     3,
  yoga:        2,
  hiit:        2,
};

const LEGACY_TYPE_MAP = {
  gym: 'gym',
  calisthenics: 'calisthenics',
  running: 'running',
  mobility: 'mobility',
  cycling: 'cycling',
  yoga: 'yoga',
  hiit: 'hiit',
  martialarts: 'martial_arts',
  martial_arts: 'martial_arts',
  'martial arts': 'martial_arts',
};

const INJURY_MUSCLE_MAP = {
  shoulder: ['shoulders', 'arms', 'chest'],
  back: ['back', 'lowerBack'],
  knee: ['quads', 'hamstrings', 'glutes', 'calves'],
  ankle: ['calves', 'hipFlexors'],
  wrist: ['arms', 'shoulders', 'chest'],
};

// ─── COACH PERSONAS ──────────────────────────────────────────────────────────
const COACH_PERSONAS = {
  coach:          { label: 'Supportive Coach',   desc: 'Encouraging, balanced, data-informed' },
  drill_sergeant: { label: 'Drill Sergeant',     desc: 'Intense, no excuses, push harder' },
  data_nerd:      { label: 'Data Nerd',          desc: 'Metrics-obsessed, evidence-based, analytical' },
  silent:         { label: 'Silent Mode',        desc: 'Minimal commentary, just the plan' },
};

// ─── EXERCISE DATABASE ───────────────────────────────────────────────────────
const EXERCISE_DB = {
  gym: {
    legs: [
      { name: 'Back Squat',       sets: 4, reps: '5',   cue: 'Brace core, knees track toes, full depth',  muscles: ['quads','glutes'] },
      { name: 'Deadlift',         sets: 3, reps: '5',   cue: 'Neutral spine, drive hips through, pull slack', muscles: ['hamstrings','back','glutes'] },
      { name: 'Front Squat',      sets: 3, reps: '6',   cue: 'Elbows high, torso upright, own the hole',  muscles: ['quads','core'] },
      { name: 'Romanian Deadlift',sets: 3, reps: '8',   cue: 'Hinge at hips, micro-bend knees, feel the hamstring stretch', muscles: ['hamstrings','glutes','lowerBack'] },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8 each', cue: 'Rear foot elevated, shin vertical, control descent', muscles: ['quads','glutes','hipFlexors'] },
      { name: 'Leg Press',        sets: 3, reps: '10',  cue: 'Full range, feet hip-width, do not lock knees at top', muscles: ['quads','glutes'] },
      { name: 'Hack Squat',       sets: 3, reps: '10',  cue: 'Heels elevated, deep range, squeeze glutes at top', muscles: ['quads'] },
      { name: 'Leg Curl',         sets: 3, reps: '12',  cue: 'Full extension, controlled curl, squeeze at top', muscles: ['hamstrings'] },
      { name: 'Hip Thrust',       sets: 3, reps: '10',  cue: 'Bar across hips, drive through heels, full glute squeeze', muscles: ['glutes','hamstrings'] },
      { name: 'Calf Raise',       sets: 4, reps: '15',  cue: 'Full ROM, pause at bottom, explosive up', muscles: ['calves'] },
      { name: 'Walking Lunge',    sets: 3, reps: '12 each', cue: 'Long stride, upright torso, knee touches floor', muscles: ['quads','glutes','hipFlexors'] },
    ],
    upper: [
      { name: 'Bench Press',       sets: 4, reps: '5',   cue: 'Retract scapula, slight arch, bar to lower chest', muscles: ['chest','shoulders','arms'] },
      { name: 'Overhead Press',    sets: 3, reps: '6',   cue: 'Bar from clavicle, press around chin, lock out fully', muscles: ['shoulders','arms'] },
      { name: 'Barbell Row',       sets: 3, reps: '6',   cue: 'Hinge 45°, bar to sternum, elbows back, squeeze', muscles: ['back','arms'] },
      { name: 'Pull-up',           sets: 3, reps: 'max', cue: 'Dead hang start, drive elbows to hips, chin over bar', muscles: ['back','arms'] },
      { name: 'Incline DB Press',  sets: 3, reps: '8',   cue: '30° incline, control descent, press to center', muscles: ['chest','shoulders'] },
      { name: 'Dips',              sets: 3, reps: '10',  cue: 'Lean forward for chest, upright for triceps', muscles: ['chest','arms','shoulders'] },
      { name: 'Cable Row',         sets: 3, reps: '10',  cue: 'Chest tall, pull to waist, retract blades at end', muscles: ['back','arms'] },
      { name: 'Face Pull',         sets: 3, reps: '15',  cue: 'Rope to forehead, elbows high, external rotate', muscles: ['shoulders','back'] },
      { name: 'DB Curl',           sets: 3, reps: '12',  cue: 'No swing, supinate at top, control descent', muscles: ['arms'] },
      { name: 'Skull Crusher',     sets: 3, reps: '12',  cue: 'Bar to forehead, elbows fixed, lock out', muscles: ['arms'] },
      { name: 'Lateral Raise',     sets: 3, reps: '15',  cue: 'Lead with elbow, slight lean, no shrug', muscles: ['shoulders'] },
    ],
    fullBody: [
      { name: 'Power Clean',       sets: 4, reps: '3',   cue: 'Explosive hip drive, high pull, catch in rack', muscles: ['fullBody'] },
      { name: 'Trap Bar Deadlift', sets: 3, reps: '5',   cue: 'Neutral spine, push floor away, stand tall', muscles: ['fullBody','quads','hamstrings'] },
      { name: 'KB Swing',          sets: 4, reps: '15',  cue: 'Hip hinge not squat, snap hips, float at top', muscles: ['fullBody','glutes','hamstrings'] },
      { name: 'Thruster',          sets: 3, reps: '8',   cue: 'Squat catches momentum, drive bar overhead', muscles: ['fullBody','quads','shoulders'] },
      { name: 'Bear Complex',      sets: 3, reps: '5',   cue: 'Power clean → front squat → push press → back squat → push press', muscles: ['fullBody'] },
    ],
  },

  calisthenics: {
    pullUp: {
      label: 'Pull-up / Back Chain',
      levels: [
        { name: 'Dead Hang',        sets: 3, reps: '30s hold', cue: 'Fully decompressed, packed shoulders',        muscles: ['back','arms'] },
        { name: 'Assisted Pull-up', sets: 3, reps: '8',        cue: 'Band or negatives, full ROM',                 muscles: ['back','arms'] },
        { name: 'Pull-up',          sets: 3, reps: '5',        cue: 'Chin over bar, dead hang between, own it',    muscles: ['back','arms'] },
        { name: 'Pull-up — 3×8',    sets: 3, reps: '8',        cue: 'Consistent reps, no kipping',                 muscles: ['back','arms'] },
        { name: 'Archer Pull-up',   sets: 3, reps: '5 each',   cue: 'One straight arm, shift weight laterally',    muscles: ['back','arms'] },
        { name: 'L-Sit Pull-up',    sets: 3, reps: '5',        cue: 'Hold L-sit throughout, legs parallel floor',  muscles: ['back','arms','core'] },
        { name: 'Typewriter Pull-up',sets:3, reps: '4 each',   cue: 'Travel bar side to side at top',              muscles: ['back','arms'] },
        { name: 'Muscle-up Neg',    sets: 3, reps: '5',        cue: 'Start above bar, lower slow through transition', muscles: ['back','arms','shoulders'] },
        { name: 'Muscle-up',        sets: 3, reps: '3',        cue: 'Explosive pull, lean forward, punch through', muscles: ['back','arms','shoulders'] },
      ],
    },
    pushUp: {
      label: 'Push-up / Push Chain',
      levels: [
        { name: 'Incline Push-up',      sets: 3, reps: '12',      cue: 'Hands elevated, straight body line',          muscles: ['chest','shoulders','arms'] },
        { name: 'Push-up',              sets: 3, reps: '10',      cue: 'Hollow body, chest to floor, full lock out',  muscles: ['chest','shoulders','arms'] },
        { name: 'Diamond Push-up',      sets: 3, reps: '10',      cue: 'Hands diamond, elbows travel back',           muscles: ['chest','arms'] },
        { name: 'Wide Push-up',         sets: 3, reps: '12',      cue: 'Hands wide, chest focus, no wrist flare',     muscles: ['chest','shoulders'] },
        { name: 'Decline Push-up',      sets: 3, reps: '10',      cue: 'Feet elevated, press toward feet',            muscles: ['chest','shoulders'] },
        { name: 'Archer Push-up',       sets: 3, reps: '6 each',  cue: 'One arm straight, shift weight, full depth',  muscles: ['chest','shoulders','arms'] },
        { name: 'Pseudo-Planche Push-up',sets:3, reps: '8',      cue: 'Fingers back, lean forward, feel shoulders',  muscles: ['chest','shoulders','arms'] },
      ],
    },
    squat: {
      label: 'Pistol Squat / Leg Chain',
      levels: [
        { name: 'Assisted Pistol',   sets: 3, reps: '5 each', cue: 'Ring or pole assistance, full depth', muscles: ['quads','glutes'] },
        { name: 'Box Pistol',        sets: 3, reps: '5 each', cue: 'Sit to box, stand with 1 leg',        muscles: ['quads','glutes'] },
        { name: 'Pistol Squat',      sets: 3, reps: '5 each', cue: 'Free standing, heel down, balance',   muscles: ['quads','glutes','core'] },
        { name: 'Weighted Pistol',   sets: 3, reps: '5 each', cue: 'Plate or KB overhead, stay tall',     muscles: ['quads','glutes','core'] },
        { name: 'Shrimp Squat',      sets: 3, reps: '5 each', cue: 'Rear foot to glute, knee barely touches', muscles: ['quads','glutes','hipFlexors'] },
      ],
    },
    core: {
      label: 'Core / Anti-Gravity',
      levels: [
        { name: 'Plank',            sets: 3, reps: '45s',     cue: 'Hollow body, squeeze everything',    muscles: ['core'] },
        { name: 'Hollow Hold',      sets: 3, reps: '30s',     cue: 'Lower back pressed down, legs low',  muscles: ['core'] },
        { name: 'L-Sit Tuck',       sets: 3, reps: '20s',     cue: 'Knees to chest, press down hard',    muscles: ['core','arms'] },
        { name: 'L-Sit',            sets: 3, reps: '15s',     cue: 'Legs parallel floor, toes pointed',  muscles: ['core','arms','hipFlexors'] },
        { name: 'V-Sit',            sets: 3, reps: '10s',     cue: '60° torso lean, legs higher than L', muscles: ['core','arms'] },
        { name: 'Dragon Flag',      sets: 3, reps: '5',       cue: 'Lower from top, hollow spine, slow', muscles: ['core','lowerBack'] },
      ],
    },
    handstand: {
      label: 'Handstand Progression',
      levels: [
        { name: 'Wall Kick-up',        sets: 3, reps: '5×20s',  cue: 'Chest to wall, stacked wrists-shoulders', muscles: ['shoulders','arms','core'] },
        { name: 'HS Shrug / Scaps',    sets: 3, reps: '10',     cue: 'Press through shoulders at top',          muscles: ['shoulders','core'] },
        { name: 'Wall HS Hold',        sets: 3, reps: '30s',    cue: 'Straight line from wrist to ankle',       muscles: ['shoulders','core'] },
        { name: 'Kick-up to Freestand',sets: 3, reps: '5×10s', cue: 'Controlled kick, balance with fingers',   muscles: ['shoulders','core'] },
        { name: 'Freestanding HS',     sets: 3, reps: '20s',    cue: 'Press platform, active fingers, stack',   muscles: ['shoulders','core','arms'] },
        { name: 'HS Walk',             sets: 3, reps: '5m',     cue: 'Shift weight to fingers, controlled fall',muscles: ['shoulders','core','arms'] },
        { name: 'HSPU (Wall)',         sets: 3, reps: '3',      cue: 'Controlled descent to ear level, press',  muscles: ['shoulders','arms','core'] },
      ],
    },
  },

  running: [
    { name: 'Easy Run',       duration: '30-40 min', intensity: 'Zone 2',  cue: 'Can hold full conversation, nose breathe', muscles: ['calves','fullBody'] },
    { name: 'Tempo Run',      duration: '25 min',    intensity: 'Zone 3-4',cue: 'Comfortably hard — two-word answers only',muscles: ['calves','fullBody'] },
    { name: '400m Intervals', reps: '6×400m',        intensity: 'Zone 5',  cue: '90s rest between, controlled aggressive pace', muscles: ['calves','fullBody'] },
    { name: 'Hill Sprints',   reps: '8×30s',         intensity: 'Max',     cue: 'Drive knees, pump arms, 2min walk back', muscles: ['calves','glutes','fullBody'] },
    { name: 'Long Run',       duration: '50-70 min', intensity: 'Zone 2',  cue: 'Aerobic base builder, easy effort',       muscles: ['calves','fullBody'] },
    { name: '1km Repeats',    reps: '4×1km',         intensity: 'Zone 4',  cue: '2min rest, target 5km race pace minus 10s', muscles: ['calves','fullBody'] },
    { name: 'Fartlek',        duration: '30 min',    intensity: 'Mixed',   cue: 'Surge for lamp-posts or trees, free form', muscles: ['calves','fullBody'] },
    { name: 'Strides',        reps: '6×20s',         intensity: 'Zone 5',  cue: 'Controlled sprint to 95%, full recovery', muscles: ['calves','fullBody'] },
  ],

  martial_arts: {
    striking: [
      { name: 'Shadow Boxing',    duration: '4×3min', cue: 'Visualize opponent, work all ranges, footwork', muscles: ['shoulders','core','fullBody'] },
      { name: 'Heavy Bag',        duration: '5×3min', cue: 'Power combos, move, reset, control breathing',  muscles: ['shoulders','arms','core'] },
      { name: 'Pad Work',         duration: '4×3min', cue: 'Sharp technique, defender sets rhythm',         muscles: ['shoulders','arms','core'] },
      { name: 'Sparring (Tech)',   duration: '5×3min', cue: 'Flow, no knockout shots, explore technique',   muscles: ['fullBody'] },
      { name: 'Sparring (Full)',   duration: '5×3min', cue: 'Controlled intensity, reset on clinch break',  muscles: ['fullBody'] },
      { name: 'Footwork Drill',   duration: '3×3min', cue: 'Angles, pivots, lateral movement patterns',    muscles: ['calves','core'] },
      { name: 'Reaction Pads',    duration: '3×3min', cue: 'Hands up, explosive response, reset',          muscles: ['shoulders','core'] },
      { name: 'Bag Combos',       duration: '4×3min', cue: 'Set 3-5 combination patterns, drill clean',    muscles: ['shoulders','arms','core'] },
    ],
    grappling: [
      { name: 'Guard Passing',    duration: '3×5min', cue: 'Posture first, break grips, clear hip to hip',  muscles: ['back','core','hipFlexors'] },
      { name: 'Takedown Drill',   duration: '4×3min', cue: 'Level change, penetration step, finish low',    muscles: ['legs','core','fullBody'] },
      { name: 'Submission Flow',  duration: '3×5min', cue: 'Slow roll, link attacks, feel the geometry',    muscles: ['fullBody','core','arms'] },
      { name: 'Positional Rounds',duration: '5×5min', cue: 'Start in specific position, work from there',   muscles: ['fullBody'] },
      { name: 'Leg Lock Entry',   duration: '3×5min', cue: 'Inside position, heel hook vs kneebar, wedge',  muscles: ['core','legs','fullBody'] },
      { name: 'Open Mat / Flow',  duration: '30 min', cue: 'No resistance, explore, think chess not checkers', muscles: ['fullBody'] },
      { name: 'Drilling (Reps)',  sets: 3, reps: '20 each side', cue: 'Perfect reps, technical precision',  muscles: ['fullBody','core'] },
    ],
    general: [
      { name: 'Jump Rope',        duration: '3×3min', cue: 'Light on feet, consistent rhythm, single unders', muscles: ['calves','shoulders','core'] },
      { name: 'Medicine Ball',    sets: 4, reps: '10', cue: 'Rotational power, explosive slam, wall throw',  muscles: ['core','shoulders','fullBody'] },
      { name: 'Burpee Complex',   sets: 3, reps: '10', cue: 'Snap down fast, explosive jump, stay tight',    muscles: ['fullBody'] },
    ],
  },

  mobility: [
    { name: 'Hip 90/90 Flow',     duration: '8 min',  cue: 'Active rotations, do not force, breathe into tight spots', muscles: ['hipFlexors','glutes'] },
    { name: 'Shoulder CARS',      duration: '6 min',  cue: 'Controlled articular rotation, full ROM, slow', muscles: ['shoulders'] },
    { name: 'Full Body Flow',     duration: '12 min', cue: 'Sun sal, squat, thread needle, flow link move to move', muscles: ['fullBody'] },
    { name: 'Splits Prep',        duration: '10 min', cue: 'PNF contract-relax, 2s hold, ease deeper', muscles: ['hipFlexors','hamstrings','glutes'] },
    { name: 'Ankle Mobility',     duration: '6 min',  cue: 'Wall drill, banded distraction, single leg balance', muscles: ['calves'] },
    { name: 'Thoracic Rotation',  duration: '8 min',  cue: 'Thread needle, open book, foam roller extension', muscles: ['back','shoulders'] },
    { name: 'Deep Squat Hold',    duration: '5 min',  cue: 'Heels down, torso tall, use block to scale', muscles: ['quads','hipFlexors','calves'] },
    { name: 'Loaded Stretching',  duration: '10 min', cue: 'Jefferson curl, pancake, couch stretch — weight adds traction', muscles: ['hamstrings','hipFlexors','lowerBack'] },
  ],

  cycling: [
    { name: 'Endurance Ride',  duration: '45-60 min', intensity: 'Zone 2', cue: 'Conversational pace, cadence 85-90 RPM', muscles: ['quads','glutes','calves'] },
    { name: 'Threshold Ride',  duration: '20 min',    intensity: 'Zone 4', cue: 'Barely sustainable, steady power output', muscles: ['quads','glutes','calves'] },
    { name: 'Sprint Intervals',reps: '8×30s',         intensity: 'Max',    cue: 'All out sprint, 2min easy spin recovery', muscles: ['quads','glutes','calves','fullBody'] },
    { name: 'Hill Climbing',   duration: '30 min',    intensity: 'Zone 3-4',cue: 'Seated and standing, consistent power',  muscles: ['quads','glutes','calves'] },
    { name: 'Recovery Ride',   duration: '30 min',    intensity: 'Zone 1', cue: 'Very easy, promote blood flow to legs',   muscles: ['quads','calves'] },
  ],

  yoga: [
    { name: 'Sun Salutation A',  reps: '5 rounds',  cue: 'Link breath to motion, downdog long holds', muscles: ['fullBody'] },
    { name: 'Warrior Flow',      duration: '20 min', cue: 'Warrior 1→2→3, hold 5 breaths each',      muscles: ['hipFlexors','core','shoulders'] },
    { name: 'Yin — Hips',        duration: '20 min', cue: 'Dragon, pigeon, frog — 2-3 min per pose', muscles: ['hipFlexors','glutes'] },
    { name: 'Core & Balance',    duration: '15 min', cue: 'Boat, side plank, tree, warrior 3',        muscles: ['core','hipFlexors'] },
    { name: 'Breathwork + Restore', duration: '15 min', cue: 'Box breathing, legs-up-wall, savasana', muscles: ['fullBody'] },
  ],

  hiit: [
    { name: 'Tabata (20/10)',    reps: '8 rounds',  duration: '4 min per exercise', cue: 'All out effort, 4-5 exercises circuit', muscles: ['fullBody'] },
    { name: 'AMRAP (15 min)',    duration: '15 min',intensity: 'Max',  cue: 'As many rounds as possible of 3-move circuit', muscles: ['fullBody'] },
    { name: 'EMOM (20 min)',     duration: '20 min',intensity: 'High', cue: 'At top of every minute, 6-10 reps hard move', muscles: ['fullBody'] },
    { name: 'Circuit Training',  sets: 4, reps: '45s/15s',  cue: '6-station circuit, 45s work 15s transition', muscles: ['fullBody'] },
    { name: 'Pyramid Intervals', reps: '30/20/10s', intensity: 'Max',  cue: 'Increasing then decreasing work intervals',  muscles: ['fullBody'] },
  ],
};
// ─── INITIAL STATE ───────────────────────────────────────────────────────────
function createMuscleRecovery() {
    return {
        quads: { lastTrained: null, recoveryHours: 48, status: 'fresh' },
        hamstrings: { lastTrained: null, recoveryHours: 48, status: 'fresh' },
        glutes: { lastTrained: null, recoveryHours: 48, status: 'fresh' },
        chest: { lastTrained: null, recoveryHours: 48, status: 'fresh' },
        back: { lastTrained: null, recoveryHours: 60, status: 'fresh' },
        shoulders: { lastTrained: null, recoveryHours: 36, status: 'fresh' },
        arms: { lastTrained: null, recoveryHours: 36, status: 'fresh' },
        core: { lastTrained: null, recoveryHours: 24, status: 'fresh' },
        lowerBack: { lastTrained: null, recoveryHours: 72, status: 'fresh' },
        hipFlexors: { lastTrained: null, recoveryHours: 24, status: 'fresh' },
        calves: { lastTrained: null, recoveryHours: 24, status: 'fresh' },
        fullBody: { lastTrained: null, recoveryHours: 48, status: 'fresh' },
    };
}

function normalizeLegacyType(type) {
    const key = String(type || '').trim().toLowerCase();
    return LEGACY_TYPE_MAP[key] || null;
}

function parseTimestamp(input) {
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (typeof input === 'string') {
        const ts = Date.parse(input);
        if (!Number.isNaN(ts)) return ts;
    }
    return Date.now();
}

function mapLegacySessionLog(log, idx) {
    if (!log || typeof log !== 'object') return null;
    const type = normalizeLegacyType(log.type || log.sessionType || log.category);
    if (!type) return null;
    const timestamp = parseTimestamp(log.timestamp || log.ts || log.date || log.startedAt);
    const rawExercises = Array.isArray(log.exerciseResults) ? log.exerciseResults : (Array.isArray(log.exercises) ? log.exercises : []);
    return {
        id: log.id || `legacy-${idx}-${timestamp}`,
        type,
        maSubtype: log.maSubtype || (log.striking ? 'striking' : null),
        timestamp,
        duration: Number.isFinite(log.duration) ? log.duration : 0,
        overallRPE: Number.isFinite(log.overallRPE) ? log.overallRPE : (Number.isFinite(log.rpe) ? log.rpe : 7),
        recovery: Number.isFinite(log.recovery) ? log.recovery : 7,
        energyRating: Number.isFinite(log.energyRating) ? log.energyRating : (Number.isFinite(log.energy) ? log.energy : 7),
        notes: log.notes || '',
        bodyweight: Number.isFinite(log.bodyweight) ? log.bodyweight : null,
        exerciseResults: rawExercises.map((ex) => ({
            name: ex.name || 'Exercise',
            done: !!ex.done,
            setsCompleted: Number.isFinite(ex.setsCompleted) ? ex.setsCompleted : 0,
            topMetric: ex.topMetric || '',
            effortRPE: Number.isFinite(ex.effortRPE) ? ex.effortRPE : null,
            pain: !!ex.pain,
        })),
    };
}

function inferDisciplines(profileDisciplines, sessionLogs) {
    const fromProfile = Array.isArray(profileDisciplines) ? profileDisciplines.map(normalizeLegacyType).filter(Boolean) : [];
    const fromLogs = Array.from(new Set((sessionLogs || []).map((l) => normalizeLegacyType(l.type)).filter(Boolean)));
    const combined = Array.from(new Set([...fromProfile, ...fromLogs])).filter((d) => d && d !== 'custom');
    return combined.length ? combined : ['gym', 'mobility'];
}

function buildDomainScoresFromLogs(sessionLogs, disciplines) {
    const scores = {};
    disciplines.forEach((d) => {
        scores[d] = { sessions: 0, level: 1, trend: [] };
    });
    (sessionLogs || []).forEach((log) => {
        if (!scores[log.type]) return;
        scores[log.type].sessions += 1;
        scores[log.type].trend = [...scores[log.type].trend.slice(-19), Number.isFinite(log.overallRPE) ? log.overallRPE : 7];
    });
    return scores;
}

function getDefaultBlockForGoal(goal) {
    if (goal === 'strength' || goal === 'sport') return 'intensification';
    if (goal === 'fat_loss' || goal === 'endurance') return 'accumulation';
    return 'accumulation';
}

function getDefaultCoachPersona(goal, fitnessLevels) {
    const levels = Object.values(fitnessLevels || {});
    const hasAdvanced = levels.includes('advanced');
    if (goal === 'strength' || goal === 'sport') return hasAdvanced ? 'drill_sergeant' : 'coach';
    if (goal === 'endurance') return 'data_nerd';
    if (goal === 'general') return 'coach';
    return 'coach';
}

function getDefaultAdaptation(goal, fitnessLevels) {
    const levels = Object.values(fitnessLevels || {});
    const hasBeginner = levels.length === 0 || levels.includes('beginner');
    if (hasBeginner) return 'conservative';
    if (goal === 'strength' || goal === 'sport') return 'aggressive';
    return 'moderate';
}

function buildInitialSkillState(disciplines) {
    const skills = {};
    if (disciplines.includes('calisthenics')) {
        Object.keys(EXERCISE_DB.calisthenics).forEach((k) => {
            skills[k] = { level: 0 };
        });
    }
    if (disciplines.includes('running')) {
        skills.runningPace = { level: 0, track: 'running' };
    }
    if (disciplines.includes('martial_arts')) {
        skills.martialTiming = { level: 0, track: 'martial_arts' };
    }
    return skills;
}

function computeWeeklyGoalCheckFromState(state) {
    const target = Math.max(1, state.profile.daysPerWeek || 5);
    const completed = getSessionsThisWeek(state.sessionLogs).length;
    const pct = Math.round((completed / target) * 100);
    return {
        completed,
        target,
        percent: pct,
        status: pct >= 100 ? 'on-track' : pct >= 70 ? 'close' : 'behind',
    };
}

function normalizeReadinessInputs(inputs) {
    const merged = { ...INITIAL_STATE.readiness.inputs, ...(inputs || {}) };
    if (!Number.isFinite(merged.energyLevel) && Number.isFinite(merged.energy)) {
        merged.energyLevel = merged.energy;
    }
    if (!Number.isFinite(merged.energyLevel)) merged.energyLevel = 7;
    delete merged.energy;
    return merged;
}

const GEMINI_ALLOWED_MODELS = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-flash-latest',
];
const GEMINI_DEFAULT_MODEL = 'gemini-3-flash-preview';
const GEMINI_LEGACY_MODEL_MAP = {
    'gemini-1.5-flash': GEMINI_DEFAULT_MODEL,
    'gemini-1.5-pro': GEMINI_DEFAULT_MODEL,
    'gemini-2.0-flash': GEMINI_DEFAULT_MODEL,
};

function normalizeGeminiModel(model) {
    const mappedModel = GEMINI_LEGACY_MODEL_MAP[model] || model;
    return GEMINI_ALLOWED_MODELS.includes(mappedModel) ? mappedModel : GEMINI_DEFAULT_MODEL;
}

const INITIAL_STATE = {
    version: 7,
    view: 'home',
    onboarded: false,
    onboardStep: 0,
    profile: {
        name: '',
        age: 25,
        sex: 'male',
        bodyweight: 75,
        goal: '',
        disciplines: [],
        fitnessLevels: {},
        daysPerWeek: 5,
        sessionMinutes: 60,
        accentColor: 'red',
    },
    programConfig: {
        currentBlock: 'accumulation',
        blockWeek: 1,
        adaptationAggressiveness: 'moderate',
        coachPersona: 'coach',
    },
    athleteModel: {
        domainScores: {},
        fatigueDebt: 0,
        consistencyScore: 0,
        readinessTrend: [],
        streakDays: 0,
        lastSessionDate: null,
    },
    progression: {
        exercises: {},
        skills: {},
        stalledItems: [],
        deloadRecommended: false,
        highRPEStreak: 0,
    },
    readiness: {
        inputs: { sleep: 7, stress: 5, soreness: 5, motivation: 7, energyLevel: 7 },
        score: 70,
        band: 'moderate',
        lastUpdated: null,
    },
    muscleRecovery: createMuscleRecovery(),
    aiConfig: {
        enabled: false,
        apiKey: '',
        model: GEMINI_DEFAULT_MODEL,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
    aiMemory: {
        coachingNotes: [],
        weeklySummary: null,
        weeklyGoalCheck: null,
        lastSummaryAt: null,
        chatHistory: [],
        preBrief: null,
        postSessionSummary: null,
    },
    planState: {
        recommendation: null,
        secondaryRec: null,
        progressionPrompts: [],
    },
    constraints: {
        injuries: { shoulder: false, back: false, knee: false, ankle: false, wrist: false },
        blockedPatterns: [],
        customSubstitutions: {},
    },
    sessionLogs: [],
    activeSession: null,
    currentSessionType: null,
    decisionLog: [],
};

// ─── STATE MIGRATION ─────────────────────────────────────────────────────────
function migrateState(saved) {
    const raw = (saved && typeof saved === 'object') ? saved : {};
    const isLegacy = typeof raw.version !== 'number' || raw.version < 7;
    const legacyProfile = raw.profile || {};
    const legacyLogs = Array.isArray(raw.sessionLogs) ? raw.sessionLogs
        : (Array.isArray(raw.logs) ? raw.logs : []);
    const migratedLogs = legacyLogs.map((log, i) => mapLegacySessionLog(log, i)).filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp);
    const inferredDisciplines = inferDisciplines(legacyProfile.disciplines, migratedLogs);
    const domainScoresFromLogs = buildDomainScoresFromLogs(migratedLogs, inferredDisciplines);
    const readinessInputs = normalizeReadinessInputs(raw.readiness?.inputs || {});
    const source = isLegacy ? {
        ...raw,
        version: 7,
        profile: {
            ...(raw.profile || {}),
            disciplines: inferredDisciplines,
            goal: raw.profile?.goal || raw.goal || '',
        },
        sessionLogs: migratedLogs.length ? migratedLogs : (Array.isArray(raw.sessionLogs) ? raw.sessionLogs : []),
        readiness: {
            ...(raw.readiness || {}),
            inputs: readinessInputs,
        },
        athleteModel: {
            ...(raw.athleteModel || {}),
            domainScores: Object.keys(raw.athleteModel?.domainScores || {}).length ? raw.athleteModel.domainScores : domainScoresFromLogs,
        },
        programConfig: {
            ...(raw.programConfig || {}),
            coachPersona: raw.programConfig?.coachPersona || (raw.programConfig?.coachStyle === 'silent' ? 'silent' : undefined),
        },
        planState: {
            ...(raw.planState || {}),
            secondaryRec: raw.planState?.secondaryRec || raw.planState?.secondaryRecommendation || null,
        },
    } : raw;

    const s = { ...INITIAL_STATE, ...source };
    s.profile = { ...INITIAL_STATE.profile, ...(source.profile || {}) };
    s.programConfig = { ...INITIAL_STATE.programConfig, ...(source.programConfig || {}) };
    s.athleteModel = {
        ...INITIAL_STATE.athleteModel,
        ...(source.athleteModel || {}),
        domainScores: {
            ...(INITIAL_STATE.athleteModel.domainScores || {}),
            ...(source.athleteModel?.domainScores || {}),
        },
    };
    s.progression = { ...INITIAL_STATE.progression, ...(source.progression || {}) };
    if (!s.progression.exercises) s.progression.exercises = {};
    if (!s.progression.skills) s.progression.skills = {};
    if (!s.progression.stalledItems) s.progression.stalledItems = [];
    s.readiness = { ...INITIAL_STATE.readiness, ...(source.readiness || {}) };
    s.readiness.inputs = normalizeReadinessInputs(source.readiness?.inputs || {});
    if (!s.muscleRecovery) s.muscleRecovery = createMuscleRecovery();
    s.aiConfig = { ...INITIAL_STATE.aiConfig, ...(source.aiConfig || {}) };
    s.aiConfig.model = normalizeGeminiModel(s.aiConfig.model);
    s.aiMemory = { ...INITIAL_STATE.aiMemory, ...(source.aiMemory || {}) };
    if (!Array.isArray(s.aiMemory.chatHistory)) s.aiMemory.chatHistory = [];
    s.aiMemory.preBrief = s.aiMemory.preBrief || null;
    s.aiMemory.postSessionSummary = s.aiMemory.postSessionSummary || null;
    s.planState = { ...INITIAL_STATE.planState, ...(source.planState || {}) };
    if (!s.planState.secondaryRec && source.planState?.secondaryRecommendation) {
        s.planState.secondaryRec = source.planState.secondaryRecommendation;
    }
    s.constraints = { ...INITIAL_STATE.constraints, ...(source.constraints || {}) };
    s.constraints.injuries = { ...INITIAL_STATE.constraints.injuries, ...(source.constraints?.injuries || {}) };
    if (!Array.isArray(s.constraints.blockedPatterns)) s.constraints.blockedPatterns = [];
    if (!s.constraints.customSubstitutions) s.constraints.customSubstitutions = {};
    if (!Array.isArray(s.sessionLogs)) s.sessionLogs = [];
    if (!Array.isArray(s.decisionLog)) s.decisionLog = [];
    if (!s.profile.disciplines || !s.profile.disciplines.length) {
        s.profile.disciplines = inferDisciplines([], s.sessionLogs);
    }
    if (!Object.keys(s.athleteModel.domainScores || {}).length) {
        s.athleteModel.domainScores = buildDomainScoresFromLogs(s.sessionLogs, s.profile.disciplines);
    }
    if (typeof s.version !== 'number' || s.version < 7) s.version = 7;
    return s;
}

// ─── REDUCER ─────────────────────────────────────────────────────────────────
function appReducer(state, action) {
    switch (action.type) {

        case 'SET_VIEW':
            return { ...state, view: action.view };

        case 'NEXT_ONBOARD_STEP':
            return { ...state, onboardStep: state.onboardStep + 1 };

        case 'PREV_ONBOARD_STEP':
            return { ...state, onboardStep: Math.max(0, state.onboardStep - 1) };

        case 'SET_ONBOARD_PROFILE':
            return { ...state, profile: { ...state.profile, ...action.fields } };

        case 'COMPLETE_ONBOARDING': {
            const { profile } = action;
            const accentColor = profile.accentColor || 'red';
            applyAccent(accentColor);
            const domainScores = {};
            profile.disciplines.forEach(d => { domainScores[d] = { sessions: 0, level: 1, trend: [] }; });
            const skillsInit = buildInitialSkillState(profile.disciplines);
            const currentBlock = getDefaultBlockForGoal(profile.goal);
            const coachPersona = getDefaultCoachPersona(profile.goal, profile.fitnessLevels);
            const adaptationAggressiveness = getDefaultAdaptation(profile.goal, profile.fitnessLevels);
            const recommendation = profile.disciplines[0] || 'gym';
            return {
                ...state,
                onboarded: true,
                profile: { ...state.profile, ...profile },
                athleteModel: { ...state.athleteModel, domainScores },
                progression: { ...state.progression, skills: skillsInit },
                programConfig: { ...state.programConfig, currentBlock, blockWeek: 1, coachPersona, adaptationAggressiveness },
                planState: { ...state.planState, recommendation, secondaryRec: null },
            };
        }

        case 'SET_PROFILE_FIELD':
            if (action.key === 'disciplines') {
                const nextDisciplines = Array.isArray(action.value) ? action.value : state.profile.disciplines;
                const baseSkills = buildInitialSkillState(nextDisciplines);
                const mergedSkills = { ...baseSkills, ...(state.progression.skills || {}) };
                return {
                    ...state,
                    profile: { ...state.profile, disciplines: nextDisciplines },
                    progression: { ...state.progression, skills: mergedSkills },
                };
            }
            return { ...state, profile: { ...state.profile, [action.key]: action.value } };

        case 'APPLY_ACCENT': {
            applyAccent(action.color);
            return { ...state, profile: { ...state.profile, accentColor: action.color } };
        }

        case 'SET_READINESS':
            return {
                ...state,
                readiness: {
                    ...state.readiness,
                    inputs: normalizeReadinessInputs({ ...state.readiness.inputs, ...action.inputs }),
                    ...action.derived,
                    lastUpdated: Date.now(),
                },
            };

        case 'SET_AI_CONFIG': {
            const nextAIConfig = { ...state.aiConfig, ...(action.fields || {}) };
            if (Object.prototype.hasOwnProperty.call(action.fields || {}, 'model')) {
                nextAIConfig.model = normalizeGeminiModel(action.fields.model);
            }
            return { ...state, aiConfig: nextAIConfig };
        }

        case 'SET_CHAT_HISTORY':
            return { ...state, aiMemory: { ...state.aiMemory, chatHistory: action.history.slice(-30) } };

        case 'SET_PRE_BRIEF':
            return { ...state, aiMemory: { ...state.aiMemory, preBrief: action.brief } };

        case 'SET_WEEKLY_SUMMARY':
            return {
                ...state,
                aiMemory: {
                    ...state.aiMemory,
                    weeklySummary: action.summary,
                    weeklyGoalCheck: action.goalCheck || state.aiMemory.weeklyGoalCheck,
                    lastSummaryAt: Date.now(),
                },
            };

        case 'SET_WEEKLY_GOAL_CHECK':
            return { ...state, aiMemory: { ...state.aiMemory, weeklyGoalCheck: action.payload } };

        case 'SET_POST_SESSION_SUMMARY':
            return { ...state, aiMemory: { ...state.aiMemory, postSessionSummary: action.summary } };

        case 'START_SESSION': {
            const { sessionType, exercises, maSubtype } = action;
            return {
                ...state,
                activeSession: {
                    type: sessionType,
                    maSubtype: maSubtype || null,
                    exercises: exercises.map((ex, i) => ({ ...ex, id: `${sessionType}-${i}`, done: false, setsCompleted: 0, topMetric: '', effortRPE: null, pain: false })),
                    startedAt: Date.now(),
                },
                currentSessionType: sessionType,
                aiMemory: { ...state.aiMemory, preBrief: null },
            };
        }

        case 'TOGGLE_EXERCISE_DONE': {
            if (!state.activeSession) return state;
            const exercises = state.activeSession.exercises.map((ex, i) =>
                i === action.idx ? { ...ex, done: !ex.done, setsCompleted: !ex.done ? (ex.sets || 3) : 0 } : ex
            );
            return { ...state, activeSession: { ...state.activeSession, exercises } };
        }

        case 'SET_EXERCISE_LOG': {
            if (!state.activeSession) return state;
            const exercises = state.activeSession.exercises.map((ex, i) =>
                i === action.idx ? { ...ex, ...action.fields } : ex
            );
            return { ...state, activeSession: { ...state.activeSession, exercises } };
        }

        case 'SWAP_EXERCISE': {
            if (!state.activeSession) return state;
            const exercises = state.activeSession.exercises.map((ex, i) =>
                i === action.idx ? { ...action.replacement, id: ex.id, done: false, setsCompleted: 0, topMetric: '', effortRPE: null, pain: false } : ex
            );
            return { ...state, activeSession: { ...state.activeSession, exercises } };
        }

        case 'COMPLETE_SESSION': {
            const { rpe, recovery, energyLevel: energyRating, notes } = action;
            const session = state.activeSession;
            if (!session) return state;

            const now = Date.now();
            const log = {
                id: `log-${now}`,
                type: session.type,
                maSubtype: session.maSubtype,
                timestamp: now,
                duration: Math.round((now - session.startedAt) / 60000),
                overallRPE: rpe,
                recovery,
                energyRating,
                notes,
                bodyweight: Number.isFinite(state.profile.bodyweight) ? state.profile.bodyweight : null,
                exerciseResults: session.exercises.map(ex => ({
                    name: ex.name, done: ex.done, setsCompleted: ex.setsCompleted,
                    topMetric: ex.topMetric, effortRPE: ex.effortRPE, pain: ex.pain,
                })),
            };

            // Update muscle recovery
            const muscleRecovery = { ...state.muscleRecovery };
            session.exercises.forEach(ex => {
                if (!ex.done || !ex.muscles) return;
                ex.muscles.forEach(m => {
                    if (muscleRecovery[m]) {
                        muscleRecovery[m] = { ...muscleRecovery[m], lastTrained: now, status: rpe >= 8 ? 'fatigued' : 'recovering' };
                    }
                });
            });

            // Update domain scores
            const domainScores = { ...state.athleteModel.domainScores };
            if (domainScores[session.type]) {
                const d = { ...domainScores[session.type] };
                d.sessions = (d.sessions || 0) + 1;
                d.trend = [...(d.trend || []).slice(-19), rpe];
                domainScores[session.type] = d;
            }

            // Update progression per exercise
            const exercises = { ...state.progression.exercises };
            session.exercises.forEach(ex => {
                if (!ex.done) return;
                const prev = exercises[ex.name] || { level: 0, history: [], outcome: 'hold' };
                let outcome = 'hold';
                const targetRPE = BLOCK_CONFIG[state.programConfig.currentBlock]?.targetRPE || 7;
                if (ex.pain) outcome = 'regress';
                else if (ex.setsCompleted < (ex.sets || 3) * 0.6) outcome = 'regress';
                else if (ex.effortRPE >= targetRPE + 2) outcome = 'regress';
                else if (ex.setsCompleted >= (ex.sets || 3) && ex.effortRPE <= targetRPE - 1) outcome = 'advance';
                exercises[ex.name] = {
                    ...prev,
                    lastDone: now,
                    outcome,
                    history: [...(prev.history || []).slice(-19), { date: now, effortRPE: ex.effortRPE, topMetric: ex.topMetric, outcome }],
                };
            });

            // Streak calculation
            const lastDate = state.athleteModel.lastSessionDate;
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            const lastDateStr = lastDate ? new Date(lastDate).toDateString() : null;
            const newStreak = lastDateStr === yesterday ? (state.athleteModel.streakDays || 0) + 1
                : lastDateStr === today ? (state.athleteModel.streakDays || 0)
                    : 1;

            // Coach note storage
            const coachingNotes = state.aiMemory.coachingNotes ? [...state.aiMemory.coachingNotes] : [];

            return {
                ...state,
                activeSession: null,
                currentSessionType: null,
                sessionLogs: [log, ...state.sessionLogs],
                muscleRecovery,
                athleteModel: { ...state.athleteModel, domainScores, lastSessionDate: now, streakDays: newStreak },
                progression: { ...state.progression, exercises },
                aiMemory: { ...state.aiMemory, coachingNotes: coachingNotes.slice(-20) },
            };
        }

        case 'STORE_COACHING_NOTE': {
            const notes = [...(state.aiMemory.coachingNotes || []), { ts: Date.now(), note: action.note, sessionType: action.sessionType }];
            return { ...state, aiMemory: { ...state.aiMemory, coachingNotes: notes.slice(-20) } };
        }

        case 'SET_SKILL_LEVEL': {
            const { discipline, skill, level } = action;
            const skills = { ...state.progression.skills, [skill]: { ...(state.progression.skills[skill] || {}), level } };
            return { ...state, progression: { ...state.progression, skills } };
        }

        case 'SET_BLOCK':
            return { ...state, programConfig: { ...state.programConfig, currentBlock: action.block, blockWeek: 1 } };

        case 'SET_PROGRAM_CONFIG':
            return { ...state, programConfig: { ...state.programConfig, ...action.fields } };

        case 'SET_CONSTRAINTS':
            return { ...state, constraints: { ...state.constraints, ...action.fields } };

        case 'SET_INJURIES':
            return { ...state, constraints: { ...state.constraints, injuries: { ...state.constraints.injuries, ...action.injuries } } };

        case 'SET_CUSTOM_SUBSTITUTION':
            return {
                ...state,
                constraints: {
                    ...state.constraints,
                    customSubstitutions: {
                        ...state.constraints.customSubstitutions,
                        [action.from]: action.to,
                    },
                },
            };

        case 'SET_BLOCKED_PATTERNS':
            return {
                ...state,
                constraints: {
                    ...state.constraints,
                    blockedPatterns: Array.isArray(action.patterns) ? action.patterns : state.constraints.blockedPatterns,
                },
            };

        case 'IMPORT_STATE': {
            const migrated = migrateState(action.data);
            applyAccent(migrated.profile?.accentColor || 'red');
            return migrated;
        }

        case 'IMPORT_V5_LOCAL_STATE': {
            const migrated = migrateState(action.data);
            applyAccent(migrated.profile?.accentColor || 'red');
            return migrated;
        }

        case 'RESET_ALL':
            applyAccent('red');
            return { ...INITIAL_STATE };

        default:
            return state;
    }
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function computeReadinessScore(inputs) {
    const { sleep, stress, soreness, motivation, energyLevel } = normalizeReadinessInputs(inputs);
    const raw = (sleep * 20) + ((10 - stress) * 10) + ((10 - soreness) * 10) + (motivation * 15) + (energyLevel * 15);
    const score = Math.round(Math.min(100, raw * 100 / 700));
    const band = score >= 75 ? 'high' : score >= 50 ? 'moderate' : 'low';
    return { score, band };
}

function getMuscleStatus(recovery) {
    if (!recovery.lastTrained) return 'fresh';
    const hoursElapsed = (Date.now() - recovery.lastTrained) / 3600000;
    if (hoursElapsed >= recovery.recoveryHours) return 'fresh';
    if (hoursElapsed >= recovery.recoveryHours * 0.5) return 'recovering';
    return 'fatigued';
}

function updateMuscleStatuses(muscleRecovery) {
    const updated = {};
    Object.entries(muscleRecovery).forEach(([k, v]) => {
        updated[k] = { ...v, status: getMuscleStatus(v) };
    });
    return updated;
}

function getWeekStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
}

function getSessionsThisWeek(sessionLogs) {
    const ws = getWeekStart();
    return sessionLogs.filter(l => l.timestamp >= ws);
}

function getSessionCountByType(sessionLogs, disciplines) {
    const ws = getWeekStart();
    const counts = {};
    disciplines.forEach(d => { counts[d] = 0; });
    sessionLogs.filter(l => l.timestamp >= ws).forEach(l => {
        if (counts[l.type] !== undefined) counts[l.type]++;
    });
    return counts;
}

function computeSessionPriority(state) {
    const { profile, athleteModel, readiness, muscleRecovery, sessionLogs } = state;
    const { disciplines, daysPerWeek } = profile;
    const weeklyCount = getSessionCountByType(sessionLogs, disciplines);
    const scores = {};
    const muscleStatuses = updateMuscleStatuses(muscleRecovery);

    disciplines.forEach(disc => {
        const done = weeklyCount[disc] || 0;
        const target = FREQ_TARGETS[disc] || 2;
        const deficit = Math.max(0, target - done);
        let score = deficit * 30;

        // Readiness modifier
        if (readiness.band === 'low') {
            if (disc === 'mobility' || disc === 'yoga') score += 20;
            if (disc === 'gym') score -= 10;
        }
        if (readiness.band === 'high') {
            if (disc === 'gym' || disc === 'hiit') score += 15;
        }

        // Muscle freshness (gym and calisthenics)
        if (disc === 'gym' || disc === 'calisthenics') {
            const freshMuscles = ['quads', 'chest', 'back', 'shoulders'].filter(m => muscleStatuses[m]?.status === 'fresh').length;
            score += freshMuscles * 5;
        }

        // Last session recency (avoid repeating same type)
        const lastOfType = sessionLogs.find(l => l.type === disc);
        if (lastOfType) {
            const hoursAgo = (Date.now() - lastOfType.timestamp) / 3600000;
            if (hoursAgo < 16) score -= 40;
        }

        scores[disc] = Math.max(0, score);
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : disciplines[0];
}

function getExercisePoolForType(type, maSubtype) {
    if (type === 'gym') return [...EXERCISE_DB.gym.legs, ...EXERCISE_DB.gym.upper, ...EXERCISE_DB.gym.fullBody];
    if (type === 'mobility') return EXERCISE_DB.mobility;
    if (type === 'martial_arts') {
        const sub = maSubtype || 'striking';
        return [...(EXERCISE_DB.martial_arts[sub] || EXERCISE_DB.martial_arts.striking), ...EXERCISE_DB.martial_arts.general];
    }
    if (type === 'calisthenics') return Object.values(EXERCISE_DB.calisthenics).flatMap((s) => s.levels);
    if (type === 'running') return EXERCISE_DB.running;
    if (type === 'cycling') return EXERCISE_DB.cycling;
    if (type === 'yoga') return EXERCISE_DB.yoga;
    if (type === 'hiit') return EXERCISE_DB.hiit;
    return [];
}

function isExerciseBlocked(exercise, constraints) {
    if (!exercise) return true;
    const injuries = constraints?.injuries || {};
    const blockedPatterns = Array.isArray(constraints?.blockedPatterns) ? constraints.blockedPatterns : [];
    const injuredMuscles = Object.entries(injuries)
        .filter(([, active]) => !!active)
        .flatMap(([inj]) => INJURY_MUSCLE_MAP[inj] || []);
    const touchesInjuredMuscle = (exercise.muscles || []).some((m) => injuredMuscles.includes(m));
    const name = (exercise.name || '').toLowerCase();
    const patternBlocked = blockedPatterns.some((p) => name.includes(String(p || '').toLowerCase()));
    return touchesInjuredMuscle || patternBlocked;
}

function applySubstitutionsAndConstraints(exercises, type, state, maSubtype) {
    const pool = getExercisePoolForType(type, maSubtype);
    const byName = Object.fromEntries(pool.map((e) => [e.name, e]));
    return exercises.map((ex) => {
        const customTarget = state.constraints?.customSubstitutions?.[ex.name];
        let candidate = ex;
        if (customTarget && byName[customTarget]) {
            candidate = { ...byName[customTarget], sets: ex.sets || byName[customTarget].sets || 3 };
        }
        if (!isExerciseBlocked(candidate, state.constraints)) return candidate;
        const alt = pool.find((p) => p.name !== ex.name && !isExerciseBlocked(p, state.constraints));
        if (!alt) return null;
        return { ...alt, sets: ex.sets || alt.sets || 3 };
    }).filter(Boolean);
}

function generateWorkout(type, state, maSubtype, timeMinutes) {
    const exercises = [];
    const time = timeMinutes || state.profile.sessionMinutes || 60;
    const volume = time <= 30 ? 'low' : time <= 60 ? 'moderate' : 'high';
    const sets = volume === 'low' ? 2 : volume === 'moderate' ? 3 : 4;

    if (type === 'gym') {
        const db = EXERCISE_DB.gym;
        const legCount = volume === 'low' ? 1 : 2;
        const upperCount = volume === 'low' ? 2 : volume === 'moderate' ? 3 : 4;
        const fullCount = volume === 'high' ? 1 : 0;
        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
        shuffle(db.legs).slice(0, legCount).forEach(ex => exercises.push({ ...ex, sets }));
        shuffle(db.upper).slice(0, upperCount).forEach(ex => exercises.push({ ...ex, sets }));
        shuffle(db.fullBody).slice(0, fullCount).forEach(ex => exercises.push({ ...ex, sets }));

    } else if (type === 'calisthenics') {
        const skills = state.progression.skills || {};
        const db = EXERCISE_DB.calisthenics;
        Object.entries(db).forEach(([skillKey, skillData]) => {
            const skillLevel = skills[skillKey]?.level || 0;
            const level = skillData.levels[Math.min(skillLevel, skillData.levels.length - 1)];
            if (level) exercises.push({ ...level, sets, skillKey, levelIdx: skillLevel });
        });

    } else if (type === 'running') {
        const pool = EXERCISE_DB.running;
        const pick = Math.floor(Math.random() * pool.length);
        exercises.push({ ...pool[pick] });

    } else if (type === 'martial_arts') {
        const sub = maSubtype || 'striking';
        const db = EXERCISE_DB.martial_arts;
        const pool = [...(db[sub] || db.striking), ...db.general];
        const count = volume === 'low' ? 3 : volume === 'moderate' ? 4 : 5;
        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
        shuffle(pool).slice(0, count).forEach(ex => exercises.push({ ...ex }));

    } else if (type === 'mobility') {
        const count = volume === 'low' ? 3 : volume === 'moderate' ? 4 : 5;
        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
        shuffle(EXERCISE_DB.mobility).slice(0, count).forEach(ex => exercises.push({ ...ex }));

    } else if (type === 'cycling') {
        const pool = EXERCISE_DB.cycling;
        const pick = Math.floor(Math.random() * pool.length);
        exercises.push({ ...pool[pick] });

    } else if (type === 'yoga') {
        const count = volume === 'low' ? 2 : volume === 'moderate' ? 3 : 4;
        const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
        shuffle(EXERCISE_DB.yoga).slice(0, count).forEach(ex => exercises.push({ ...ex }));

    } else if (type === 'hiit') {
        const pool = EXERCISE_DB.hiit;
        const pick = Math.floor(Math.random() * pool.length);
        exercises.push({ ...pool[pick] });
    } else if (type === 'custom') {
        return [];
    }

    return applySubstitutionsAndConstraints(exercises, type, state, maSubtype);
}

function getSwapAlternatives(exercise, type, state, maSubtype) {
    const pool = getExercisePoolForType(type, maSubtype);
    return pool
        .filter((e) => e.name !== exercise.name)
        .filter((e) => !isExerciseBlocked(e, state.constraints))
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
}

function formatTime(ts) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── AI FUNCTIONS ─────────────────────────────────────────────────────────────
async function callGeminiAPI(apiKey, endpoint, model, prompt) {
    const normalizedModel = normalizeGeminiModel(model);
    const url = `${endpoint}/${normalizedModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function buildCoachContext(state) {
    const { profile, programConfig, readiness, muscleRecovery, sessionLogs, athleteModel } = state;
    const weekSessions = getSessionsThisWeek(sessionLogs);
    const muscleStatuses = updateMuscleStatuses(muscleRecovery);
    const freshMuscles = Object.entries(muscleStatuses).filter(([, v]) => v.status === 'fresh').map(([k]) => k);
    const fatiguedMuscles = Object.entries(muscleStatuses).filter(([, v]) => v.status === 'fatigued').map(([k]) => k);
    const persona = COACH_PERSONAS[programConfig.coachPersona]?.label || 'Coach';
    const goal = GOALS[profile.goal]?.label || profile.goal;

    return `You are an AI personal fitness coach. Persona: ${persona}. 
User: ${profile.name}, ${profile.age}yo, ${profile.bodyweight}kg, goal: ${goal}.
Disciplines: ${profile.disciplines.map(d => DISCIPLINES[d]?.label).join(', ')}.
Block: ${BLOCK_CONFIG[programConfig.currentBlock]?.label} (week ${programConfig.blockWeek}).
Readiness today: ${readiness.score}/100 (${readiness.band}). Sleep:${readiness.inputs.sleep} Stress:${readiness.inputs.stress} Soreness:${readiness.inputs.soreness} Energy:${readiness.inputs.energyLevel}.
Sessions this week: ${weekSessions.length}/${profile.daysPerWeek} target.
Fresh muscles: ${freshMuscles.join(', ') || 'none tracked'}.
Fatigued: ${fatiguedMuscles.join(', ') || 'none'}.
Streak: ${athleteModel.streakDays} days.`;
}

async function callPreSessionBrief(state, sessionType, dispatch) {
    const { aiConfig } = state;
    if (!aiConfig.enabled || !aiConfig.apiKey) return;
    const ctx = buildCoachContext(state);
    const disc = DISCIPLINES[sessionType]?.label || sessionType;
    const prompt = `${ctx}
The user is about to start a ${disc} session (${state.profile.sessionMinutes} min).
Give a 3-bullet pre-session brief. Bullets: 1) Today's focus cue. 2) Key adaptation insight based on muscle recovery/readiness. 3) One mindset or pacing note.
Format: JSON {"focus":"...","insight":"...","mindset":"..."}. Return ONLY the JSON, no markdown.`;
    try {
        const text = await callGeminiAPI(aiConfig.apiKey, aiConfig.endpoint, aiConfig.model, prompt);
        const clean = text.replace(/```json?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        dispatch({ type: 'SET_PRE_BRIEF', brief: parsed });
    } catch (e) { }
}

async function callPostSessionSummary(state, sessionLog, dispatch) {
    const { aiConfig } = state;
    if (!aiConfig.enabled || !aiConfig.apiKey) return null;
    const ctx = buildCoachContext(state);
    const prompt = `${ctx}
User just completed a ${DISCIPLINES[sessionLog.type]?.label || sessionLog.type} session.
Duration: ${sessionLog.duration} min. Overall RPE: ${sessionLog.overallRPE}/10. Recovery: ${sessionLog.recovery}/10. Notes: "${sessionLog.notes || 'none'}".
Exercises completed: ${sessionLog.exerciseResults.filter(e => e.done).map(e => e.name).join(', ')}.
Give a short 3-part coaching summary. Be direct, no filler.
Format: JSON {"verdict":"...","insight":"...","nextFocus":"..."}. Return ONLY the JSON, no markdown.`;
    try {
        const text = await callGeminiAPI(aiConfig.apiKey, aiConfig.endpoint, aiConfig.model, prompt);
        const clean = text.replace(/```json?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        dispatch({ type: 'STORE_COACHING_NOTE', note: parsed, sessionType: sessionLog.type });
        dispatch({ type: 'SET_POST_SESSION_SUMMARY', summary: parsed });
        return parsed;
    } catch (e) {
        return null;
    }
}

async function callWeeklySummary(state, dispatch) {
    const { aiConfig } = state;
    if (!aiConfig.enabled || !aiConfig.apiKey) return;
    const week = getSessionsThisWeek(state.sessionLogs);
    if (week.length < 2) return;
    const last = state.aiMemory.lastSummaryAt;
    if (last && (Date.now() - last) < 6 * 24 * 3600 * 1000) return;
    const ctx = buildCoachContext(state);
    const details = week.map(s => `${DISCIPLINES[s.type]?.label}: RPE ${s.overallRPE}, ${s.duration}min`).join(' | ');
    const goalCheck = computeWeeklyGoalCheckFromState(state);
    const prompt = `${ctx}
This week's sessions (${week.length}): ${details}.
Weekly goal progress: ${goalCheck.completed}/${goalCheck.target} (${goalCheck.percent}%).
Write a weekly training summary. Be concise and actionable.
Format: JSON {"headline":"...","wins":["...","..."],"concerns":["..."],"nextWeekFocus":"...","goalCheck":{"status":"on-track|close|behind","percent":80}}. Return ONLY the JSON, no markdown.`;
    try {
        const text = await callGeminiAPI(aiConfig.apiKey, aiConfig.endpoint, aiConfig.model, prompt);
        const clean = text.replace(/```json?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        const mergedGoalCheck = parsed.goalCheck ? {
            ...goalCheck,
            ...parsed.goalCheck,
            percent: Number.isFinite(parsed.goalCheck.percent) ? parsed.goalCheck.percent : goalCheck.percent,
        } : goalCheck;
        dispatch({ type: 'SET_WEEKLY_SUMMARY', summary: parsed, goalCheck: mergedGoalCheck });
        dispatch({ type: 'SET_WEEKLY_GOAL_CHECK', payload: mergedGoalCheck });
    } catch (e) { }
}

async function callChatMessage(state, message, history, dispatch) {
    const { aiConfig } = state;
    if (!aiConfig.enabled || !aiConfig.apiKey) return 'AI coach disabled. Enable it in Settings with a Gemini API key.';
    const ctx = buildCoachContext(state);
    const histText = history.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`).join('\n');
    const prompt = `${ctx}\n\nConversation:\n${histText}\nUser: ${message}\n\nRespond as their fitness coach. Be direct, specific, and practical. 2-4 sentences max unless explaining something complex.`;
    try {
        return await callGeminiAPI(aiConfig.apiKey, aiConfig.endpoint, aiConfig.model, prompt);
    } catch (e) {
        return `Connection error: ${e.message}. Check your API key in Settings.`;
    }
}

async function callAIGreeting(state) {
    const { aiConfig } = state;
    if (!aiConfig.enabled || !aiConfig.apiKey) return '';
    const ctx = buildCoachContext(state);
    const prompt = `${ctx}
Write one short greeting for the user (max 20 words), with one actionable training hint for today. No markdown.`;
    try {
        const text = await callGeminiAPI(aiConfig.apiKey, aiConfig.endpoint, aiConfig.model, prompt);
        return text.trim();
    } catch {
        return '';
    }
}

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Icon = {
    Home: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('path', { d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' }), React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' })),
    Train: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('path', { d: 'M6 5v14M18 5v14M6 8h12M6 16h12' })),
    Chart: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' })),
    List: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('line', { x1: 8, y1: 6, x2: 21, y2: 6 }), React.createElement('line', { x1: 8, y1: 12, x2: 21, y2: 12 }), React.createElement('line', { x1: 8, y1: 18, x2: 21, y2: 18 }), React.createElement('line', { x1: 3, y1: 6, x2: 3.01, y2: 6 }), React.createElement('line', { x1: 3, y1: 12, x2: 3.01, y2: 12 }), React.createElement('line', { x1: 3, y1: 18, x2: 3.01, y2: 18 })),
    Settings: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('circle', { cx: 12, cy: 12, r: 3 }), React.createElement('path', { d: 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 10-2.83-2.83l-.06.06A1.65 1.65 0 0015 14.1a1.65 1.65 0 00-1.82-.33l-.09.06A1.65 1.65 0 0012 13a1.65 1.65 0 00-.91.46l-.09.06a1.65 1.65 0 00-1.82.33 1.65 1.65 0 00-.33 1.82l.06.09A1.65 1.65 0 009 17a1.65 1.65 0 00-.46.91l-.06.09a2 2 0 102.83 2.83l.06-.06A1.65 1.65 0 0013 20.9a1.65 1.65 0 001.82.33l.09-.06A1.65 1.65 0 0016 21a1.65 1.65 0 00.91-.46l.09-.06a1.65 1.65 0 001.82-.33 1.65 1.65 0 00.33-1.82l-.06-.09A1.65 1.65 0 0019 17a1.65 1.65 0 00.46-.91l.06-.09z' })),
    Zap: (p = {}) => React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })),
    Check: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polyline', { points: '20 6 9 17 4 12' })),
    X: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }), React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })),
    ChevronRight: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polyline', { points: '9 18 15 12 9 6' })),
    ChevronLeft: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polyline', { points: '15 18 9 12 15 6' })),
    Send: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('line', { x1: 22, y1: 2, x2: 11, y2: 13 }), React.createElement('polygon', { points: '22 2 15 22 11 13 2 9 22 2' })),
    AlertTriangle: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' }), React.createElement('line', { x1: 12, y1: 9, x2: 12, y2: 13 }), React.createElement('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 })),
    Refresh: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('polyline', { points: '23 4 23 10 17 10' }), React.createElement('path', { d: 'M20.49 15a9 9 0 11-2.12-9.36L23 10' })),
    Bot: (p = {}) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p }, React.createElement('rect', { x: 3, y: 11, width: 18, height: 10, rx: 2 }), React.createElement('circle', { cx: 9, cy: 16, r: 1 }), React.createElement('circle', { cx: 15, cy: 16, r: 1 }), React.createElement('path', { d: 'M12 11V8M8 8h8' })),
};
// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function OnboardingView({ state, dispatch }) {
    const { onboardStep } = state;
    const [local, setLocal] = useState({
        name: '', age: 25, sex: 'male', bodyweight: 75,
        goal: '', disciplines: [],
        fitnessLevels: {}, daysPerWeek: 5, sessionMinutes: 60, accentColor: 'red',
    });

    const update = fields => setLocal(p => ({ ...p, ...fields }));
    const toggleDisc = d => {
        const next = local.disciplines.includes(d)
            ? local.disciplines.filter(x => x !== d)
            : [...local.disciplines, d];
        update({ disciplines: next });
    };
    const setFitnessLevel = (disc, lvl) => update({ fitnessLevels: { ...local.fitnessLevels, [disc]: lvl } });

    const canNext = [
        local.name.trim().length > 0,
        local.goal !== '',
        local.disciplines.length > 0,
        true,
        true,
    ][onboardStep];

    const finish = () => {
        dispatch({ type: 'COMPLETE_ONBOARDING', profile: local });
    };

    const steps = ['You', 'Goal', 'Train', 'Level', 'Schedule'];
    const progress = ((onboardStep + 1) / steps.length) * 100;

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
            <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-8">
                {/* header */}
                <div className="mb-8">
                    <div className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
                        STEP {onboardStep + 1} OF {steps.length} — {steps[onboardStep].toUpperCase()}
                    </div>
                    <div className="progress-bar mt-2">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Step 1 — Identity */}
                {onboardStep === 0 && (
                    <div className="fade-in">
                        <h1 className="text-3xl font-bold mb-2">Welcome.</h1>
                        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Let's build your personal AI coaching profile.</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>YOUR NAME</label>
                                <input value={local.name} onChange={e => update({ name: e.target.value })}
                                    placeholder="Enter your name"
                                    className="w-full px-4 py-3 rounded-lg text-sm font-medium"
                                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>AGE</label>
                                    <input type="number" value={local.age} onChange={e => update({ age: +e.target.value })} min={13} max={80}
                                        className="w-full px-4 py-3 rounded-lg text-sm font-medium"
                                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>BODYWEIGHT (kg)</label>
                                    <input type="number" value={local.bodyweight} onChange={e => update({ bodyweight: +e.target.value })} min={30} max={250}
                                        className="w-full px-4 py-3 rounded-lg text-sm font-medium"
                                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>BIOLOGICAL SEX</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['male', 'female'].map(s => (
                                        <button key={s} onClick={() => update({ sex: s })}
                                            className="py-3 rounded-lg text-sm font-semibold capitalize transition-all"
                                            style={local.sex === s ? { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' } : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>ACCENT COLOR</label>
                                <div className="flex gap-3 flex-wrap">
                                    {Object.entries(ACCENT_COLORS).map(([k, v]) => (
                                        <button key={k} onClick={() => { update({ accentColor: k }); applyAccent(k); }}
                                            className="w-8 h-8 rounded-full border-2 transition-all"
                                            style={{ background: v.css, borderColor: local.accentColor === k ? '#fff' : 'transparent' }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2 — Goal */}
                {onboardStep === 1 && (
                    <div className="fade-in">
                        <h1 className="text-3xl font-bold mb-2">Your goal.</h1>
                        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>This shapes your program and how your coach talks to you.</p>
                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(GOALS).map(([k, g]) => (
                                <button key={k} onClick={() => update({ goal: k })}
                                    className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                                    style={local.goal === k ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' } : { background: 'var(--card)', border: '1px solid var(--border)' }}>
                                    <span className="text-2xl">{g.icon}</span>
                                    <div>
                                        <div className="font-semibold text-sm">{g.label}</div>
                                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{g.desc}</div>
                                    </div>
                                    {local.goal === k && <div className="ml-auto accent"><Icon.Check /></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3 — Disciplines */}
                {onboardStep === 2 && (
                    <div className="fade-in">
                        <h1 className="text-3xl font-bold mb-2">What do you train?</h1>
                        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Select all that apply. Your coach will track each one.</p>
                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(DISCIPLINES).filter(([k]) => k !== 'custom').map(([k, d]) => {
                                const active = local.disciplines.includes(k);
                                return (
                                    <button key={k} onClick={() => toggleDisc(k)}
                                        className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                                        style={active ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' } : { background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <span className="text-xl">{d.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">{d.label}</div>
                                            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{d.desc}</div>
                                        </div>
                                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                            style={active ? { background: 'var(--accent)' } : { border: '1px solid var(--border)' }}>
                                            {active && <Icon.Check style={{ color: '#fff', width: 12, height: 12 }} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 4 — Fitness Level */}
                {onboardStep === 3 && (
                    <div className="fade-in">
                        <h1 className="text-3xl font-bold mb-2">Your level.</h1>
                        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Be honest — your coach adapts load and complexity to this.</p>
                        <div className="space-y-5">
                            {local.disciplines.map(disc => (
                                <div key={disc} className="card p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-lg">{DISCIPLINES[disc].icon}</span>
                                        <span className="font-semibold text-sm">{DISCIPLINES[disc].label}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['beginner', 'intermediate', 'advanced'].map(lvl => (
                                            <button key={lvl} onClick={() => setFitnessLevel(disc, lvl)}
                                                className="py-2 rounded text-xs font-semibold capitalize transition-all"
                                                style={(local.fitnessLevels[disc] === lvl) ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                                {lvl}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 5 — Schedule */}
                {onboardStep === 4 && (
                    <div className="fade-in">
                        <h1 className="text-3xl font-bold mb-2">Your schedule.</h1>
                        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Your coach will use this to balance your weekly training load.</p>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold tracking-wider mb-3" style={{ color: 'var(--muted)' }}>DAYS PER WEEK — {local.daysPerWeek} days</label>
                                <input type="range" min={2} max={7} value={local.daysPerWeek}
                                    onChange={e => update({ daysPerWeek: +e.target.value })}
                                    className="w-full slider-accent" style={{ accentColor: 'var(--accent)' }} />
                                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--muted)' }}>
                                    <span>2 days</span><span>7 days</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold tracking-wider mb-3" style={{ color: 'var(--muted)' }}>DEFAULT SESSION LENGTH — {local.sessionMinutes} min</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[30, 45, 60, 90].map(m => (
                                        <button key={m} onClick={() => update({ sessionMinutes: m })}
                                            className="py-3 rounded-lg text-sm font-semibold transition-all"
                                            style={local.sessionMinutes === m ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                            {m}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
                                <div className="text-xs font-semibold mb-2 accent">YOUR PROGRAM SUMMARY</div>
                                <div className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
                                    <div>🎯 Goal: <span style={{ color: 'var(--text)' }}>{GOALS[local.goal]?.label}</span></div>
                                    <div>🏋️ Disciplines: <span style={{ color: 'var(--text)' }}>{local.disciplines.map(d => DISCIPLINES[d].icon).join(' ')}</span></div>
                                    <div>📅 Schedule: <span style={{ color: 'var(--text)' }}>{local.daysPerWeek}×/week · {local.sessionMinutes}min sessions</span></div>
                                    <div>🚦 Block: <span style={{ color: 'var(--text)' }}>Accumulation (building base)</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* nav buttons */}
                <div className="mt-8 flex gap-3">
                    {onboardStep > 0 && (
                        <button onClick={() => dispatch({ type: 'PREV_ONBOARD_STEP' })}
                            className="btn-ghost flex items-center gap-2 px-4 py-3 text-sm font-semibold">
                            <Icon.ChevronLeft /> Back
                        </button>
                    )}
                    <button
                        onClick={onboardStep === steps.length - 1 ? finish : () => dispatch({ type: 'NEXT_ONBOARD_STEP' })}
                        disabled={!canNext}
                        className="btn-accent flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2"
                        style={!canNext ? { opacity: 0.4 } : {}}>
                        {onboardStep === steps.length - 1 ? '🚀 Start Training' : <><span>Continue</span><Icon.ChevronRight /></>}
                    </button>
                </div>
            </div>
        </div>
    );
}
// ─── HOME VIEW ────────────────────────────────────────────────────────────────
function HomeView({ state, dispatch }) {
    const { profile, readiness, athleteModel, sessionLogs, aiConfig, aiMemory, programConfig, muscleRecovery } = state;
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [aiGreeting, setAiGreeting] = useState('');
    const [greetingLoading, setGreetingLoading] = useState(false);
    const chatEndRef = useRef(null);
    const greetingRef = useRef('');

    const weekSessions = useMemo(() => getSessionsThisWeek(sessionLogs), [sessionLogs]);
    const weekProgress = Math.min(100, Math.round((weekSessions.length / (profile.daysPerWeek || 5)) * 100));
    const recommendation = useMemo(() => computeSessionPriority(state), [state]);
    const recDisc = DISCIPLINES[recommendation];
    const block = BLOCK_CONFIG[programConfig.currentBlock];
    const updatedMuscles = useMemo(() => updateMuscleStatuses(muscleRecovery), [muscleRecovery]);
    const goalCheck = aiMemory.weeklyGoalCheck || computeWeeklyGoalCheckFromState(state);

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [aiMemory.chatHistory]);

    // Auto-generate weekly summary
    useEffect(() => {
        if (!aiConfig.enabled || !aiConfig.apiKey || summaryLoading) return;
        if (weekSessions.length >= 2) {
            const lastAt = aiMemory.lastSummaryAt;
            if (!lastAt || (Date.now() - lastAt) > 6 * 24 * 3600 * 1000) {
                setSummaryLoading(true);
                callWeeklySummary(state, dispatch).finally(() => setSummaryLoading(false));
            }
        }
    }, [sessionLogs.length, aiConfig.enabled, aiConfig.apiKey, aiMemory.lastSummaryAt, summaryLoading]);

    useEffect(() => {
        const greetingKey = `${new Date().toDateString()}-${readiness.band}-${profile.goal}-${weekSessions.length}`;
        if (greetingRef.current === greetingKey) return;
        greetingRef.current = greetingKey;
        if (!aiConfig.enabled || !aiConfig.apiKey) {
            setAiGreeting('');
            return;
        }
        setGreetingLoading(true);
        callAIGreeting(state)
            .then((text) => setAiGreeting(text || ''))
            .finally(() => setGreetingLoading(false));
    }, [aiConfig.enabled, aiConfig.apiKey, readiness.band, profile.goal, weekSessions.length]);

    const sendChat = async () => {
        if (!chatInput.trim()) return;
        const msg = chatInput.trim();
        setChatInput('');
        const userMsg = { role: 'user', text: msg, ts: Date.now() };
        const newHist = [...(aiMemory.chatHistory || []), userMsg];
        dispatch({ type: 'SET_CHAT_HISTORY', history: newHist });
        setChatLoading(true);
        const reply = await callChatMessage(state, msg, newHist, dispatch);
        const coachMsg = { role: 'coach', text: reply, ts: Date.now() };
        dispatch({ type: 'SET_CHAT_HISTORY', history: [...newHist, coachMsg] });
        setChatLoading(false);
    };

    const fallbackGreeting = () => {
        const hr = new Date().getHours();
        const time = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
        const name = profile.name ? `, ${profile.name}` : '';
        if (readiness.band === 'high') return `Good ${time}${name}. You're firing on all cylinders today.`;
        if (readiness.band === 'low') return `Good ${time}${name}. Prioritize recovery today — your body is signaling rest.`;
        return `Good ${time}${name}. Solid baseline today — let's get some work done.`;
    };

    const muscleTagClass = s => s === 'fresh' ? 'tag-fresh' : s === 'recovering' ? 'tag-recovering' : 'tag-fatigued';

    return (
        <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-4">

                {/* Greeting card */}
                <div className="card-sharp p-4 fade-in">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <div className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--muted)' }}>🤖 AI COACH</div>
                            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text)' }}>
                                {greetingLoading ? 'Coach is checking your state...' : (aiGreeting || fallbackGreeting())}
                            </p>
                        </div>
                        <button onClick={() => setChatOpen(p => !p)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-all"
                            style={chatOpen ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                            <Icon.Bot /> Chat
                        </button>
                    </div>
                </div>

                {/* AI Chat Panel */}
                {chatOpen && (
                    <div className="card-sharp overflow-hidden fade-in">
                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="text-xs font-semibold tracking-widest accent">COACH CHAT</div>
                            {!aiConfig.enabled && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Enable AI in Settings → AI Coach to use this feature</div>}
                        </div>
                        <div className="p-3 space-y-2 scrollable" style={{ maxHeight: 260, minHeight: 80 }}>
                            {(aiMemory.chatHistory || []).length === 0 && (
                                <div className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>Ask me anything about your training...</div>
                            )}
                            {(aiMemory.chatHistory || []).map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                                        style={m.role === 'user'
                                            ? { background: 'var(--accent)', color: '#fff' }
                                            : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <span className="pulse" style={{ color: 'var(--muted)' }}>Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                                placeholder="Ask your coach..."
                                className="flex-1 px-3 py-2 rounded-lg text-xs"
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                                className="btn-accent px-3 py-2 rounded-lg"
                                style={(!chatInput.trim() || chatLoading) ? { opacity: 0.4 } : {}}>
                                <Icon.Send style={{ width: 14, height: 14 }} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Recommendation card */}
                <div className="p-4 rounded-xl fade-in" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
                    <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>TODAY'S RECOMMENDATION</div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{recDisc?.icon}</span>
                        <div>
                            <div className="text-lg font-bold">{recDisc?.label}</div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>{profile.sessionMinutes} min · {block?.label} · RPE {block?.targetRPE}</div>
                        </div>
                    </div>
                    <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'train' })}
                        className="btn-accent w-full py-3 text-sm font-bold rounded-lg">
                        START SESSION →
                    </button>
                </div>

                {/* Weekly snapshot */}
                <div className="card p-4 fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>WEEKLY PROGRESS</div>
                        <div className="text-xs font-bold accent">{weekSessions.length}/{profile.daysPerWeek} sessions</div>
                    </div>
                    <div className="progress-bar mb-3">
                        <div className="progress-fill" style={{ width: `${weekProgress}%` }} />
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                        <div>🔥 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{athleteModel.streakDays || 0}</span> day streak</div>
                        <div>📅 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{weekProgress}%</span> goal</div>
                        {sessionLogs.length > 0 && <div>⏱ Last: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatTime(sessionLogs[0].timestamp)}</span></div>}
                    </div>
                </div>

                {/* Discipline balance */}
                {profile.disciplines.length > 0 && (
                    <div className="card p-4 fade-in">
                        <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>THIS WEEK'S BALANCE</div>
                        <div className="space-y-2">
                            {profile.disciplines.map(disc => {
                                const done = getSessionCountByType(sessionLogs, profile.disciplines)[disc] || 0;
                                const target = FREQ_TARGETS[disc] || 2;
                                const pct = Math.min(100, Math.round((done / target) * 100));
                                return (
                                    <div key={disc} className="flex items-center gap-3">
                                        <span className="text-sm w-5 text-center">{DISCIPLINES[disc].icon}</span>
                                        <div className="flex-1 progress-bar">
                                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="text-xs mono w-10 text-right" style={{ color: 'var(--muted)' }}>{done}/{target}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Weekly AI Summary */}
                {aiMemory.weeklySummary && (
                    <div className="card-sharp p-4 fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon.Zap className="accent" />
                            <div className="text-xs font-semibold tracking-widest accent">WEEKLY RECAP</div>
                        </div>
                        <p className="text-sm font-semibold mb-3">{aiMemory.weeklySummary.headline}</p>
                        {aiMemory.weeklySummary.wins?.length > 0 && (
                            <div className="mb-2">
                                <div className="text-xs font-semibold mb-1" style={{ color: '#22c55e' }}>✓ WINS</div>
                                {aiMemory.weeklySummary.wins.map((w, i) => <div key={i} className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{w}</div>)}
                            </div>
                        )}
                        {aiMemory.weeklySummary.concerns?.length > 0 && (
                            <div className="mb-2">
                                <div className="text-xs font-semibold mb-1" style={{ color: '#f97316' }}>⚡ FOCUS</div>
                                {aiMemory.weeklySummary.concerns.map((c, i) => <div key={i} className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{c}</div>)}
                            </div>
                        )}
                        {aiMemory.weeklySummary.nextWeekFocus && (
                            <div className="text-xs font-medium mt-2 pt-2" style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                                Next week: {aiMemory.weeklySummary.nextWeekFocus}
                            </div>
                        )}
                        <div className="text-xs mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
                            <span>Goal progress</span>
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                                {goalCheck.completed}/{goalCheck.target} ({goalCheck.percent}% · {goalCheck.status})
                            </span>
                        </div>
                        {summaryLoading && <div className="text-xs pulse mt-2 accent">Refreshing recap...</div>}
                    </div>
                )}
                {summaryLoading && !aiMemory.weeklySummary && (
                    <div className="card-sharp p-4 text-center text-xs accent pulse fade-in">Generating weekly AI recap...</div>
                )}

                {/* Muscle Recovery */}
                <div className="card p-4 fade-in">
                    <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>MUSCLE RECOVERY</div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(updatedMuscles).map(([k, v]) => (
                            <span key={k} className={`chip ${muscleTagClass(v.status)}`} style={{ fontSize: 11 }}>
                                {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Readiness check */}
                <ReadinessWidget state={state} dispatch={dispatch} />

                {/* Recent sessions */}
                {sessionLogs.length > 0 && (
                    <div className="fade-in">
                        <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>RECENT SESSIONS</div>
                        <div className="space-y-2">
                            {sessionLogs.slice(0, 3).map((log, i) => (
                                <div key={log.id || i} className="card p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{DISCIPLINES[log.type]?.icon || '🏋️'}</span>
                                        <div>
                                            <div className="text-sm font-semibold">{DISCIPLINES[log.type]?.label || log.type}</div>
                                            <div className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(log.timestamp)} · {log.duration}min</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold accent">RPE {log.overallRPE}</div>
                                        <div className="text-xs" style={{ color: 'var(--muted)' }}>recovery {log.recovery}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReadinessWidget({ state, dispatch }) {
    const [open, setOpen] = useState(false);
    const [inputs, setInputs] = useState(normalizeReadinessInputs(state.readiness.inputs));
    const { score, band } = state.readiness;
    const bandColor = band === 'high' ? '#22c55e' : band === 'moderate' ? '#fbbf24' : '#ef4444';

    const save = () => {
        const derived = computeReadinessScore(inputs);
        dispatch({ type: 'SET_READINESS', inputs, derived });
        setOpen(false);
    };

    const labels = { sleep: 'Sleep Quality', stress: 'Stress Level', soreness: 'Muscle Soreness', motivation: 'Motivation', energyLevel: 'Energy Level' };
    const inverted = ['stress', 'soreness'];

    return (
        <div className="card p-4 fade-in">
            <div className="flex items-center justify-between mb-2" onClick={() => setOpen(p => !p)} style={{ cursor: 'pointer' }}>
                <div>
                    <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>READINESS CHECK</div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="text-lg font-bold" style={{ color: bandColor }}>{score}/100</div>
                        <span className="chip" style={{ fontSize: 10, color: bandColor, borderColor: bandColor + '50', background: bandColor + '15', padding: '2px 8px' }}>
                            {band.toUpperCase()}
                        </span>
                    </div>
                </div>
                <Icon.ChevronRight style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--muted)' }} />
            </div>
            {open && (
                <div className="border-t pt-4 mt-2 space-y-3 fade-in" style={{ borderColor: 'var(--border)' }}>
                    {Object.entries(inputs).map(([k, v]) => (
                        <div key={k}>
                            <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: 'var(--muted)' }}>{labels[k]}</span>
                                <span className="font-semibold">{v}/10 {inverted.includes(k) ? '(lower=better)' : ''}</span>
                            </div>
                            <input type="range" min={1} max={10} value={v}
                                onChange={e => setInputs(p => ({ ...p, [k]: +e.target.value }))}
                                className="w-full" style={{ accentColor: 'var(--accent)' }} />
                        </div>
                    ))}
                    <button onClick={save} className="btn-accent w-full py-2 text-xs font-semibold rounded-lg mt-2">
                        UPDATE READINESS
                    </button>
                </div>
            )}
        </div>
    );
}
// ─── TRAIN VIEW ───────────────────────────────────────────────────────────────
function TrainView({ state, dispatch }) {
    const { activeSession, profile, aiConfig, aiMemory } = state;
    const [selectedType, setSelectedType] = useState(null);
    const [maSubtype, setMaSubtype] = useState('striking');
    const [sessionMinutes, setSessionMinutes] = useState(profile.sessionMinutes || 60);
    const [briefLoading, setBriefLoading] = useState(false);
    const [swapIdx, setSwapIdx] = useState(null);
    const [swapOptions, setSwapOptions] = useState([]);
    const [showComplete, setShowComplete] = useState(false);
    const [customDraft, setCustomDraft] = useState({ name: '', sets: 3, reps: '10', cue: '', muscles: '' });
    const [customExercises, setCustomExercises] = useState([]);

    const startSession = async (type, manualExercises = null) => {
        const exercises = manualExercises || generateWorkout(type, state, maSubtype, sessionMinutes);
        if (!exercises || !exercises.length) return;
        dispatch({ type: 'START_SESSION', sessionType: type, exercises, maSubtype: type === 'martial_arts' ? maSubtype : null });
        setSelectedType(null);
        // Pre-session AI brief
        if (aiConfig.enabled && aiConfig.apiKey) {
            setBriefLoading(true);
            await callPreSessionBrief({ ...state, profile: { ...state.profile, sessionMinutes } }, type, dispatch);
            setBriefLoading(false);
        }
    };

    const openSwap = (idx) => {
        const ex = activeSession.exercises[idx];
        setSwapOptions(getSwapAlternatives(ex, activeSession.type, state, activeSession.maSubtype));
        setSwapIdx(idx);
    };

    const addCustomExercise = () => {
        if (!customDraft.name.trim()) return;
        const muscles = customDraft.muscles
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean);
        const ex = {
            name: customDraft.name.trim(),
            sets: Math.max(1, Number(customDraft.sets) || 3),
            reps: customDraft.reps || '10',
            cue: customDraft.cue || 'Custom exercise',
            muscles: muscles.length ? muscles : ['fullBody'],
        };
        setCustomExercises((prev) => [...prev, ex]);
        setCustomDraft({ name: '', sets: 3, reps: '10', cue: '', muscles: '' });
    };

    // ── Discipline picker ──
    if (!activeSession) {
        return (
            <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
                <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold mb-1">Start Training</h2>
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>Choose your discipline and session length.</p>
                    </div>

                    {/* Time picker */}
                    <div className="card p-4 mb-5">
                        <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>SESSION LENGTH</div>
                        <div className="grid grid-cols-4 gap-2">
                            {[30, 45, 60, 90].map(m => (
                                <button key={m} onClick={() => setSessionMinutes(m)}
                                    className="py-2 rounded-lg text-sm font-semibold transition-all"
                                    style={sessionMinutes === m
                                        ? { background: 'var(--accent)', color: '#fff' }
                                        : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                    {m}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Discipline cards */}
                    <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>YOUR DISCIPLINES</div>
                    <div className="space-y-3">
                        <div className="card p-4 fade-in">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">🧩</span>
                                <div className="font-semibold text-sm">Custom Session Builder</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input value={customDraft.name} onChange={(e) => setCustomDraft((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="Exercise name"
                                    className="col-span-2 px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <input type="number" min={1} value={customDraft.sets} onChange={(e) => setCustomDraft((p) => ({ ...p, sets: +e.target.value }))}
                                    placeholder="Sets"
                                    className="px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <input value={customDraft.reps} onChange={(e) => setCustomDraft((p) => ({ ...p, reps: e.target.value }))}
                                    placeholder="Reps/Duration"
                                    className="px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <input value={customDraft.cue} onChange={(e) => setCustomDraft((p) => ({ ...p, cue: e.target.value }))}
                                    placeholder="Cue (optional)"
                                    className="col-span-2 px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <input value={customDraft.muscles} onChange={(e) => setCustomDraft((p) => ({ ...p, muscles: e.target.value }))}
                                    placeholder="Muscles CSV (e.g. quads,glutes)"
                                    className="col-span-2 px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                            </div>
                            <button onClick={addCustomExercise} className="btn-ghost w-full py-2 text-xs font-semibold mb-2">Add Exercise</button>
                            {customExercises.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                    {customExercises.map((ex, i) => (
                                        <div key={`${ex.name}-${i}`} className="flex items-center justify-between text-xs px-2 py-1.5 rounded"
                                            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                            <span>{ex.name} · {ex.sets}×{ex.reps}</span>
                                            <button onClick={() => setCustomExercises((prev) => prev.filter((_, idx) => idx !== i))}
                                                className="accent" style={{ fontWeight: 700 }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button onClick={() => startSession('custom', customExercises)}
                                className="btn-accent w-full py-3 text-sm font-bold rounded-lg"
                                style={!customExercises.length ? { opacity: 0.4 } : {}}
                                disabled={!customExercises.length}>
                                START CUSTOM SESSION →
                            </button>
                        </div>
                        {profile.disciplines.map(disc => {
                            const d = DISCIPLINES[disc];
                            const weekCount = getSessionCountByType(state.sessionLogs, profile.disciplines)[disc] || 0;
                            const target = FREQ_TARGETS[disc] || 2;
                            const pct = Math.min(100, (weekCount / target) * 100);
                            return (
                                <button key={disc} onClick={() => setSelectedType(disc === selectedType ? null : disc)}
                                    className="w-full fade-in"
                                    style={{ textAlign: 'left' }}>
                                    <div className="card p-4 transition-all"
                                        style={selectedType === disc ? { border: '1px solid var(--accent-border)', background: 'var(--accent-dim)' } : {}}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">{d.icon}</span>
                                            <div className="flex-1">
                                                <div className="font-semibold">{d.label}</div>
                                                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{weekCount}/{target} this week</div>
                                            </div>
                                            <Icon.ChevronRight style={{ color: 'var(--muted)', transform: selectedType === disc ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </div>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                                        {selectedType === disc && (
                                            <div className="mt-4 fade-in space-y-2">
                                                {disc === 'martial_arts' && (
                                                    <div className="mb-3">
                                                        <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--muted)' }}>SUBTYPE</div>
                                                        <div className="flex gap-2">
                                                            {['striking', 'grappling', 'general'].map(s => (
                                                                <button key={s} onClick={e => { e.stopPropagation(); setMaSubtype(s); }}
                                                                    className="flex-1 py-2 text-xs font-semibold rounded capitalize transition-all"
                                                                    style={maSubtype === s
                                                                        ? { background: 'var(--accent)', color: '#fff' }
                                                                        : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={e => { e.stopPropagation(); startSession(disc); }}
                                                    className="btn-accent w-full py-3 text-sm font-bold rounded-lg">
                                                    BEGIN SESSION →
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ── Active session ──
    const session = activeSession;
    const disc = DISCIPLINES[session.type];
    const block = BLOCK_CONFIG[state.programConfig.currentBlock];
    const doneCount = session.exercises.filter(e => e.done).length;
    const pre = aiMemory.preBrief;

    return (
        <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-4">

                {/* session header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{disc?.icon}</span>
                            <span className="text-lg font-bold">{disc?.label}</span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                            {doneCount}/{session.exercises.length} done · RPE target {block?.targetRPE}
                        </div>
                    </div>
                    <button onClick={() => setShowComplete(true)}
                        className="btn-accent px-4 py-2 text-xs font-bold rounded-lg">
                        FINISH
                    </button>
                </div>

                {/* progress bar */}
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${session.exercises.length ? (doneCount / session.exercises.length) * 100 : 0}%` }} />
                </div>

                {/* AI pre-session brief */}
                {briefLoading && (
                    <div className="card-sharp p-4 text-xs accent pulse">Coach is reviewing your readiness...</div>
                )}
                {pre && !briefLoading && (
                    <div className="card-sharp p-4 fade-in" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Icon.Bot className="accent" style={{ width: 14, height: 14 }} />
                            <div className="text-xs font-semibold tracking-widest accent">COACH BRIEF</div>
                        </div>
                        <div className="space-y-1.5 text-xs" style={{ color: 'var(--text)' }}>
                            <div>🎯 <strong>Focus:</strong> {pre.focus}</div>
                            <div>💡 <strong>Insight:</strong> {pre.insight}</div>
                            <div>🧠 <strong>Mindset:</strong> {pre.mindset}</div>
                        </div>
                    </div>
                )}

                {/* Exercise list */}
                {session.exercises.map((ex, idx) => (
                    <ExerciseCard key={ex.id || idx} ex={ex} idx={idx} dispatch={dispatch}
                        onSwap={() => openSwap(idx)} sessionType={session.type} />
                ))}

                {/* Complete button */}
                <button onClick={() => setShowComplete(true)}
                    className="btn-accent w-full py-4 text-sm font-bold rounded-lg mt-4">
                    COMPLETE SESSION ({doneCount} exercises done)
                </button>
            </div>

            {/* Swap modal */}
            {swapIdx !== null && (
                <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={() => setSwapIdx(null)}>
                    <div className="w-full max-w-lg mx-auto p-4 rounded-t-2xl fade-in"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'var(--muted)' }}>SWAP EXERCISE</div>
                        <div className="space-y-2">
                            {swapOptions.map((opt, i) => (
                                <button key={i} onClick={() => {
                                    const fromName = activeSession.exercises[swapIdx]?.name;
                                    dispatch({ type: 'SWAP_EXERCISE', idx: swapIdx, replacement: opt });
                                    if (fromName) {
                                        dispatch({ type: 'SET_CUSTOM_SUBSTITUTION', from: fromName, to: opt.name });
                                    }
                                    setSwapIdx(null);
                                }}
                                    className="w-full card p-3 flex items-center justify-between hover:border-accent text-sm font-medium text-left transition-all">
                                    <span>{opt.name}</span>
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{opt.sets}×{opt.reps || opt.duration}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setSwapIdx(null)} className="btn-ghost w-full py-3 text-sm font-semibold mt-3">Cancel</button>
                    </div>
                </div>
            )}

            {/* Complete modal */}
            {showComplete && (
                <SessionCompleteModal state={state} dispatch={dispatch} onClose={() => setShowComplete(false)} />
            )}
        </div>
    );
}

function ExerciseCard({ ex, idx, dispatch, onSwap, sessionType }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="card fade-in" style={ex.done ? { opacity: 0.6 } : {}}>
            <div className="p-4 flex items-start gap-3" onClick={() => setExpanded(p => !p)} style={{ cursor: 'pointer' }}>
                <button onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EXERCISE_DONE', idx }); }}
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                    style={ex.done ? { background: 'var(--accent)' } : { border: '2px solid var(--border)' }}>
                    {ex.done && <Icon.Check style={{ width: 12, height: 12, color: '#fff' }} />}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{ex.name}</div>
                    <div className="text-xs mt-0.5 mono" style={{ color: 'var(--muted)' }}>
                        {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.duration || ex.reps || ''}
                        {ex.intensity ? ` · ${ex.intensity}` : ''}
                    </div>
                    {ex.cue && expanded && (
                        <div className="text-xs mt-2 leading-relaxed px-3 py-2 rounded" style={{ color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            💡 {ex.cue}
                        </div>
                    )}
                </div>
                <button onClick={e => { e.stopPropagation(); onSwap(); }}
                    className="text-xs px-2 py-1 rounded flex-shrink-0"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    swap
                </button>
            </div>
            {ex.done && expanded && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <label className="block text-xs font-semibold tracking-wider mb-1" style={{ color: 'var(--muted)' }}>TOP SET</label>
                        <input value={ex.topMetric || ''} placeholder="e.g. 80kg×5"
                            onChange={e => dispatch({ type: 'SET_EXERCISE_LOG', idx, fields: { topMetric: e.target.value } })}
                            className="w-full px-2 py-1.5 rounded text-xs"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wider mb-1" style={{ color: 'var(--muted)' }}>EFFORT RPE</label>
                        <input type="number" min={1} max={10} value={ex.effortRPE || ''} placeholder="1-10"
                            onChange={e => dispatch({ type: 'SET_EXERCISE_LOG', idx, fields: { effortRPE: +e.target.value } })}
                            className="w-full px-2 py-1.5 rounded text-xs"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                        <input type="checkbox" id={`pain-${idx}`} checked={!!ex.pain}
                            onChange={e => dispatch({ type: 'SET_EXERCISE_LOG', idx, fields: { pain: e.target.checked } })}
                            style={{ accentColor: '#ef4444' }} />
                        <label htmlFor={`pain-${idx}`} className="text-xs" style={{ color: 'var(--muted)' }}>⚡ Pain / discomfort flagged</label>
                    </div>
                </div>
            )}
        </div>
    );
}

function SessionCompleteModal({ state, dispatch, onClose }) {
    const [rpe, setRpe] = useState(7);
    const [recovery, setRecovery] = useState(7);
    const [energyLevel, setEnergyLevel] = useState(7);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [postSummary, setPostSummary] = useState(null);

    const handleComplete = async () => {
        setSaving(true);
        dispatch({ type: 'COMPLETE_SESSION', rpe, recovery, energyLevel, notes });
        const log = {
            type: state.activeSession.type, timestamp: Date.now(),
            duration: Math.round((Date.now() - state.activeSession.startedAt) / 60000),
            overallRPE: rpe, recovery, energyRating: energyLevel, notes,
            exerciseResults: state.activeSession.exercises,
        };
        const summary = await callPostSessionSummary(state, log, dispatch);
        setPostSummary(summary);
        setCompleted(true);
        setSaving(false);
    };

    const sliders = [
        { label: 'Overall RPE', key: 'rpe', val: rpe, set: setRpe, desc: 'How hard was this session?' },
        { label: 'Recovery Quality', key: 'rec', val: recovery, set: setRecovery, desc: 'How well can you recover?' },
        { label: 'Energy Level', key: 'en', val: energyLevel, set: setEnergyLevel, desc: 'How did energy hold up?' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="w-full max-w-lg mx-auto rounded-t-2xl fade-in"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="p-6">
                    <div className="text-lg font-bold mb-1">Session Complete 💪</div>
                    <div className="text-xs mb-6" style={{ color: 'var(--muted)' }}>Log how it felt so your coach can adapt your next session.</div>

                    {!completed ? (
                        <>
                            <div className="space-y-5">
                                {sliders.map(s => (
                                    <div key={s.key}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-semibold">{s.label}</span>
                                            <span className="font-bold accent">{s.val}/10</span>
                                        </div>
                                        <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{s.desc}</div>
                                        <input type="range" min={1} max={10} value={s.val}
                                            onChange={e => s.set(+e.target.value)}
                                            className="w-full" style={{ accentColor: 'var(--accent)' }} />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>NOTES (optional)</label>
                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                                        placeholder="How did it feel? Any PRs, pains, or observations..."
                                        className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed resize-none"
                                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={onClose} className="btn-ghost flex-1 py-3 text-sm font-semibold">Cancel</button>
                                <button onClick={handleComplete} disabled={saving}
                                    className="btn-accent flex-1 py-3 text-sm font-bold"
                                    style={saving ? { opacity: 0.6 } : {}}>
                                    {saving ? 'Saving...' : 'LOG SESSION'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="card-sharp p-4 fade-in" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
                                <div className="text-xs font-semibold tracking-widest mb-2 accent">POST-SESSION SUMMARY</div>
                                {postSummary ? (
                                    <div className="space-y-1.5 text-xs">
                                        <div><strong>Verdict:</strong> {postSummary.verdict}</div>
                                        <div><strong>Insight:</strong> {postSummary.insight}</div>
                                        <div><strong>Next Focus:</strong> {postSummary.nextFocus}</div>
                                    </div>
                                ) : (
                                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Session logged. Enable AI Coach in Settings for post-session analysis.</div>
                                )}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { dispatch({ type: 'SET_VIEW', view: 'home' }); onClose(); }}
                                    className="btn-accent flex-1 py-3 text-sm font-bold">
                                    Back To Home
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function buildBodyweightTrend(sessionLogs, currentBodyweight) {
    const points = (sessionLogs || [])
        .filter((s) => Number.isFinite(s.bodyweight))
        .slice()
        .reverse()
        .slice(-12)
        .map((s, i) => ({ i: i + 1, bw: s.bodyweight }));
    if (!points.length && Number.isFinite(currentBodyweight)) {
        return [{ i: 1, bw: currentBodyweight }];
    }
    return points;
}

function getWeekKey(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
}

function buildWeeklyVolume(sessionLogs) {
    const buckets = {};
    (sessionLogs || []).forEach((log) => {
        const key = getWeekKey(log.timestamp);
        const volume = (log.exerciseResults || []).reduce((acc, ex) => acc + (Number.isFinite(ex.setsCompleted) ? ex.setsCompleted : 0), 0);
        buckets[key] = (buckets[key] || 0) + volume;
    });
    return Object.entries(buckets)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-8)
        .map(([week, volume], i) => ({ i: i + 1, week, volume }));
}

function withProjection(series) {
    if (!Array.isArray(series) || series.length < 2) return series || [];
    const n = series.length;
    const first = series[0].rpe;
    const last = series[n - 1].rpe;
    const slope = (last - first) / Math.max(1, n - 1);
    return series.map((p, idx) => ({ ...p, proj: +(first + slope * idx).toFixed(2) }));
}

function buildSkillCatalog(disciplines) {
    const catalog = {};
    if (disciplines.includes('calisthenics')) {
        Object.entries(EXERCISE_DB.calisthenics).forEach(([key, data]) => {
            catalog[key] = { label: data.label, levels: data.levels };
        });
    }
    if (disciplines.includes('running')) {
        catalog.runningPace = {
            label: 'Running Pace Progression',
            levels: [
                { name: 'Run-Walk Base', cue: 'Build consistency at easy pace' },
                { name: 'Steady Zone 2', cue: 'Extend easy run duration weekly' },
                { name: 'Tempo Comfort', cue: 'Hold tempo effort with stable form' },
                { name: 'Race-Pace Intervals', cue: 'Sustain higher-intensity repeats' },
            ],
        };
    }
    if (disciplines.includes('martial_arts')) {
        catalog.martialTiming = {
            label: 'Martial Timing & Reactions',
            levels: [
                { name: 'Fundamentals', cue: 'Footwork and guard discipline first' },
                { name: 'Flow Drills', cue: 'Add combinations and transitions' },
                { name: 'Pressure Reps', cue: 'Maintain composure under pace' },
                { name: 'Live Decision Speed', cue: 'React fast, recover shape instantly' },
            ],
        };
    }
    return catalog;
}
// ─── PROGRESS VIEW ────────────────────────────────────────────────────────────
function ProgressView({ state, dispatch }) {
    const [tab, setTab] = useState('overview');
    const { profile, athleteModel, progression, muscleRecovery, sessionLogs } = state;
    const updatedMuscles = useMemo(() => updateMuscleStatuses(muscleRecovery), [muscleRecovery]);
    const tabs = ['overview', 'domains', 'skills', 'muscles'];
    const bodyweightTrend = useMemo(() => buildBodyweightTrend(sessionLogs, profile.bodyweight), [sessionLogs, profile.bodyweight]);
    const weeklyVolume = useMemo(() => buildWeeklyVolume(sessionLogs), [sessionLogs]);
    const skillCatalog = useMemo(() => buildSkillCatalog(profile.disciplines), [profile.disciplines]);

    return (
        <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="max-w-lg mx-auto">
                {/* Tab bar */}
                <div className="flex border-b sticky top-0 z-10" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className="flex-1 py-3 text-xs font-semibold capitalize transition-all"
                            style={tab === t ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' } : { color: 'var(--muted)' }}>
                            {t}
                        </button>
                    ))}
                </div>

                <div className="px-4 py-4 space-y-4">
                    {/* OVERVIEW TAB */}
                    {tab === 'overview' && (
                        <div className="fade-in space-y-4">
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Total Sessions', val: sessionLogs.length, icon: '🏋️' },
                                    { label: 'Day Streak', val: `${athleteModel.streakDays || 0}🔥`, icon: '' },
                                    { label: 'This Week', val: getSessionsThisWeek(sessionLogs).length, icon: '📅' },
                                ].map(s => (
                                    <div key={s.label} className="card p-3 text-center">
                                        <div className="text-xl font-bold accent">{s.val}</div>
                                        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Session frequency heatmap (last 4 weeks) */}
                            <div className="card p-4">
                                <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>LAST 28 DAYS</div>
                                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(28, 1fr)' }}>
                                    {Array.from({ length: 28 }).map((_, i) => {
                                        const dayTs = Date.now() - (27 - i) * 86400000;
                                        const dayStr = new Date(dayTs).toDateString();
                                        const hasSession = sessionLogs.some(l => new Date(l.timestamp).toDateString() === dayStr);
                                        return (
                                            <div key={i} className="rounded-sm" title={new Date(dayTs).toLocaleDateString()}
                                                style={{ height: 12, background: hasSession ? 'var(--accent)' : 'var(--border)', opacity: hasSession ? 1 : 0.5 }} />
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--muted)' }}>
                                    <span>28 days ago</span><span>Today</span>
                                </div>
                            </div>

                            {/* RPE trend across all sessions */}
                            {sessionLogs.length >= 3 && (
                                <div className="card p-4">
                                    <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>OVERALL RPE TREND</div>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <AreaChart data={sessionLogs.slice().reverse().slice(-15).map((l, i) => ({ i: i + 1, rpe: l.overallRPE }))}>
                                            <defs>
                                                <linearGradient id="rpeGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="rpe" stroke="var(--accent)" strokeWidth={2}
                                                fill="url(#rpeGrad)" dot={false} />
                                            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }}
                                                formatter={v => [`RPE ${v}`, '']} labelFormatter={() => ''} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Bodyweight trend */}
                            <div className="card p-4">
                                <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>BODYWEIGHT TREND</div>
                                {bodyweightTrend.length >= 2 ? (
                                    <ResponsiveContainer width="100%" height={90}>
                                        <LineChart data={bodyweightTrend}>
                                            <Line type="monotone" dataKey="bw" stroke="var(--accent)" strokeWidth={2} dot={false} />
                                            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 10 }}
                                                formatter={v => [`${v} kg`, '']} labelFormatter={() => ''} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Log sessions to build bodyweight trend.</div>
                                )}
                            </div>

                            {/* Weekly volume */}
                            <div className="card p-4">
                                <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--muted)' }}>WEEKLY VOLUME (SETS COMPLETED)</div>
                                {weeklyVolume.length >= 2 ? (
                                    <ResponsiveContainer width="100%" height={100}>
                                        <AreaChart data={weeklyVolume}>
                                            <Area type="monotone" dataKey="volume" stroke="var(--accent)" fill="var(--accent-dim)" strokeWidth={2} />
                                            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 10 }}
                                                formatter={v => [`${v} sets`, '']} labelFormatter={label => weeklyVolume[label - 1]?.week || ''} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Need at least 2 logged weeks for volume trend.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DOMAINS TAB */}
                    {tab === 'domains' && (
                        <div className="fade-in space-y-4">
                            {profile.disciplines.map(disc => {
                                const d = DISCIPLINES[disc];
                                const domainData = athleteModel.domainScores?.[disc] || { sessions: 0, trend: [] };
                                const chartData = withProjection((domainData.trend || []).map((rpe, i) => ({ i: i + 1, rpe })));
                                return (
                                    <div key={disc} className="card p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{d.icon}</span>
                                                <div>
                                                    <div className="font-semibold text-sm">{d.label}</div>
                                                    <div className="text-xs" style={{ color: 'var(--muted)' }}>{domainData.sessions || 0} sessions logged</div>
                                                </div>
                                            </div>
                                            {domainData.trend?.length > 0 && (
                                                <div className="text-xs mono accent font-bold">RPE {domainData.trend.slice(-1)[0]}</div>
                                            )}
                                        </div>
                                        {chartData.length >= 2 ? (
                                            <ResponsiveContainer width="100%" height={60}>
                                                <LineChart data={chartData}>
                                                    <Line type="monotone" dataKey="rpe" stroke="var(--accent)" strokeWidth={2} dot={false} />
                                                    <Line type="monotone" dataKey="proj" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                                                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 10 }}
                                                        formatter={(v, key) => [key === 'proj' ? `Projected ${v}` : `RPE ${v}`, '']} labelFormatter={() => ''} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>Log 2+ sessions to see trend</div>
                                        )}
                                        {/* Per-exercise history */}
                                        {Object.entries(progression.exercises || {})
                                            .filter(([, v]) => v.history?.length >= 2)
                                            .slice(0, 3)
                                            .map(([name, ex]) => (
                                                <div key={name} className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="text-xs font-medium">{name}</div>
                                                        <span className="chip text-xs" style={{
                                                            fontSize: 10, padding: '2px 6px',
                                                            color: ex.outcome === 'advance' ? '#22c55e' : ex.outcome === 'regress' ? '#ef4444' : 'var(--muted)',
                                                            background: ex.outcome === 'advance' ? 'rgba(34,197,94,0.1)' : ex.outcome === 'regress' ? 'rgba(239,68,68,0.1)' : 'transparent',
                                                            border: '1px solid currentColor',
                                                        }}>{ex.outcome}</span>
                                                    </div>
                                                    <ResponsiveContainer width="100%" height={40}>
                                                        <LineChart data={ex.history.slice(-10).map((h, i) => ({ i, rpe: h.effortRPE }))}>
                                                            <Line type="monotone" dataKey="rpe" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SKILLS TAB */}
                    {tab === 'skills' && (
                        <div className="fade-in space-y-4">
                            {Object.keys(skillCatalog).length === 0 ? (
                                <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
                                    Add a skill-oriented discipline (Calisthenics, Running, Martial Arts) to track skills.
                                </div>
                            ) : (
                                Object.entries(skillCatalog).map(([skillKey, skillData]) => {
                                    const level = progression.skills?.[skillKey]?.level || 0;
                                    const max = skillData.levels.length - 1;
                                    const current = skillData.levels[level];
                                    return (
                                        <div key={skillKey} className="card p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <div className="font-semibold text-sm">{skillData.label}</div>
                                                    <div className="text-xs mt-0.5 accent font-medium">{current?.name}</div>
                                                </div>
                                                <div className="text-xs mono" style={{ color: 'var(--muted)' }}>Lv {level + 1}/{max + 1}</div>
                                            </div>
                                            <div className="progress-bar mb-3">
                                                <div className="progress-fill" style={{ width: `${((level) / max) * 100}%` }} />
                                            </div>
                                            {current?.cue && (
                                                <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                                                    💡 {current.cue}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <button onClick={() => dispatch({ type: 'SET_SKILL_LEVEL', discipline: 'skills', skill: skillKey, level: Math.max(0, level - 1) })}
                                                    className="btn-ghost flex-1 py-2 text-xs font-semibold" disabled={level <= 0}>↓ Regress</button>
                                                <button onClick={() => dispatch({ type: 'SET_SKILL_LEVEL', discipline: 'skills', skill: skillKey, level: Math.min(max, level + 1) })}
                                                    className="btn-accent flex-1 py-2 text-xs font-semibold" disabled={level >= max}>↑ Level Up</button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* MUSCLE MAP TAB */}
                    {tab === 'muscles' && (
                        <div className="fade-in">
                            <MuscleMap muscles={updatedMuscles} />
                            <div className="grid grid-cols-1 gap-2 mt-4">
                                {Object.entries(updatedMuscles).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <span className="text-xs font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                                        <div className="flex items-center gap-2">
                                            {v.lastTrained && <span className="text-xs" style={{ color: 'var(--muted)' }}>{Math.round((Date.now() - v.lastTrained) / 3600000)}h ago</span>}
                                            <span className={`chip`} style={{
                                                fontSize: 10, padding: '2px 8px',
                                                color: v.status === 'fresh' ? '#22c55e' : v.status === 'recovering' ? '#fbbf24' : '#ef4444',
                                                background: v.status === 'fresh' ? 'rgba(34,197,94,0.1)' : v.status === 'recovering' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: '1px solid currentColor',
                                            }}>{v.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 justify-center mt-4 text-xs" style={{ color: 'var(--muted)' }}>
                                <span style={{ color: '#22c55e' }}>● Fresh</span>
                                <span style={{ color: '#fbbf24' }}>● Recovering</span>
                                <span style={{ color: '#ef4444' }}>● Fatigued</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MuscleMap({ muscles }) {
    const c = k => {
        const s = muscles[k]?.status;
        return s === 'fresh' ? '#22c55e' : s === 'recovering' ? '#fbbf24' : s === 'fatigued' ? '#ef4444' : '#3f3f46';
    };
    const o = k => muscles[k]?.status === 'fresh' || muscles[k]?.status === 'recovering' || muscles[k]?.status === 'fatigued' ? 0.75 : 0.35;
    return (
        <div className="flex justify-center">
            <svg viewBox="0 0 200 380" width="180" height="342" style={{ display: 'block' }}>
                {/* Head */}
                <ellipse cx="100" cy="28" rx="22" ry="26" fill="#27272a" />
                {/* Neck */}
                <rect x="90" y="50" width="20" height="18" rx="4" fill="#27272a" />
                {/* Torso */}
                <rect x="64" y="66" width="72" height="90" rx="8" fill="#27272a" />
                {/* Chest */}
                <ellipse cx="84" cy="85" rx="16" ry="12" fill={c('chest')} opacity={o('chest')} />
                <ellipse cx="116" cy="85" rx="16" ry="12" fill={c('chest')} opacity={o('chest')} />
                {/* Shoulders */}
                <ellipse cx="54" cy="74" rx="14" ry="12" fill={c('shoulders')} opacity={o('shoulders')} />
                <ellipse cx="146" cy="74" rx="14" ry="12" fill={c('shoulders')} opacity={o('shoulders')} />
                {/* Back (shown as inner torso overlay) */}
                <rect x="72" y="98" width="56" height="50" rx="4" fill={c('back')} opacity={o('back') * 0.7} />
                {/* Core */}
                <rect x="76" y="108" width="48" height="42" rx="4" fill={c('core')} opacity={o('core')} />
                {/* Lower Back */}
                <rect x="76" y="140" width="48" height="16" rx="4" fill={c('lowerBack')} opacity={o('lowerBack')} />
                {/* Arms */}
                <rect x="38" y="82" width="18" height="60" rx="8" fill={c('arms')} opacity={o('arms')} />
                <rect x="144" y="82" width="18" height="60" rx="8" fill={c('arms')} opacity={o('arms')} />
                {/* Forearms */}
                <rect x="36" y="144" width="16" height="48" rx="7" fill="#27272a" />
                <rect x="148" y="144" width="16" height="48" rx="7" fill="#27272a" />
                {/* Pelvis */}
                <ellipse cx="100" cy="165" rx="34" ry="14" fill="#27272a" />
                {/* Hip flexors */}
                <ellipse cx="83" cy="170" rx="14" ry="10" fill={c('hipFlexors')} opacity={o('hipFlexors')} />
                <ellipse cx="117" cy="170" rx="14" ry="10" fill={c('hipFlexors')} opacity={o('hipFlexors')} />
                {/* Glutes */}
                <ellipse cx="83" cy="182" rx="18" ry="14" fill={c('glutes')} opacity={o('glutes')} />
                <ellipse cx="117" cy="182" rx="18" ry="14" fill={c('glutes')} opacity={o('glutes')} />
                {/* Quads */}
                <rect x="68" y="192" width="28" height="72" rx="12" fill={c('quads')} opacity={o('quads')} />
                <rect x="104" y="192" width="28" height="72" rx="12" fill={c('quads')} opacity={o('quads')} />
                {/* Hamstrings (behind) */}
                <rect x="70" y="208" width="24" height="52" rx="10" fill={c('hamstrings')} opacity={o('hamstrings') * 0.6} />
                <rect x="106" y="208" width="24" height="52" rx="10" fill={c('hamstrings')} opacity={o('hamstrings') * 0.6} />
                {/* Knees */}
                <ellipse cx="82" cy="268" rx="14" ry="9" fill="#27272a" />
                <ellipse cx="118" cy="268" rx="14" ry="9" fill="#27272a" />
                {/* Calves */}
                <rect x="70" y="276" width="24" height="60" rx="10" fill={c('calves')} opacity={o('calves')} />
                <rect x="106" y="276" width="24" height="60" rx="10" fill={c('calves')} opacity={o('calves')} />
                {/* Feet */}
                <ellipse cx="82" cy="340" rx="16" ry="8" fill="#27272a" />
                <ellipse cx="118" cy="340" rx="16" ry="8" fill="#27272a" />
            </svg>
        </div>
    );
}

// ─── HISTORY VIEW ─────────────────────────────────────────────────────────────
function HistoryView({ state }) {
    const { sessionLogs, profile } = state;
    const [filter, setFilter] = useState('all');
    const filterTypes = useMemo(() => {
        const types = new Set([...(profile.disciplines || []), ...sessionLogs.map((l) => l.type)]);
        return Array.from(types).filter(Boolean);
    }, [profile.disciplines, sessionLogs]);

    const filtered = filter === 'all' ? sessionLogs : sessionLogs.filter(l => l.type === filter);

    return (
        <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap mb-5">
                    <button onClick={() => setFilter('all')}
                        className={`chip ${filter === 'all' ? 'chip-active' : ''}`}>All</button>
                    {filterTypes.map(d => (
                        <button key={d} onClick={() => setFilter(d)}
                            className={`chip ${filter === d ? 'chip-active' : ''}`}>
                            {DISCIPLINES[d]?.icon} {DISCIPLINES[d]?.label}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
                        No sessions logged yet. Start training!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((log, i) => (
                            <HistoryCard key={log.id || i} log={log} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function HistoryCard({ log }) {
    const [open, setOpen] = useState(false);
    const disc = DISCIPLINES[log.type];
    const done = (log.exerciseResults || []).filter(e => e.done).length;
    const total = (log.exerciseResults || []).length;

    return (
        <div className="card fade-in">
            <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setOpen(p => !p)}>
                <span className="text-xl">{disc?.icon || '🏋️'}</span>
                <div className="flex-1">
                    <div className="font-semibold text-sm">{disc?.label || log.type}
                        {log.maSubtype && <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>{log.maSubtype}</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{formatDate(log.timestamp)} · {log.duration}min · {done}/{total} exercises</div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold accent">RPE {log.overallRPE}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>😴 {log.recovery}</div>
                </div>
            </div>
            {open && (
                <div className="px-4 pb-4 border-t pt-3 fade-in" style={{ borderColor: 'var(--border)' }}>
                    {log.notes && <p className="text-xs mb-3 italic" style={{ color: 'var(--muted)' }}>"{log.notes}"</p>}
                    {(log.exerciseResults || []).map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{ background: ex.done ? '#22c55e' : '#3f3f46' }} />
                            <span className="text-xs flex-1">{ex.name}</span>
                            {ex.topMetric && <span className="text-xs mono accent">{ex.topMetric}</span>}
                            {ex.effortRPE && <span className="text-xs" style={{ color: 'var(--muted)' }}>RPE {ex.effortRPE}</span>}
                            {ex.pain && <span className="text-xs" style={{ color: '#ef4444' }}>⚡</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
// ─── SETTINGS VIEW ────────────────────────────────────────────────────────────
function SettingsView({ state, dispatch }) {
    const { profile, programConfig, aiConfig, constraints } = state;
    const fileRef = useRef(null);
    const [section, setSection] = useState('goal');
    const [resetConfirm, setResetConfirm] = useState(false);
    const [exportDone, setExportDone] = useState(false);
    const [blockedPatternsInput, setBlockedPatternsInput] = useState((constraints.blockedPatterns || []).join(', '));
    const [v5Preview, setV5Preview] = useState(null);
    const [v5Error, setV5Error] = useState('');

    const exportData = () => {
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `miyamoto-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setExportDone(true);
        setTimeout(() => setExportDone(false), 2000);
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                dispatch({ type: 'IMPORT_STATE', data: JSON.parse(ev.target.result) });
            } catch {
                alert('Invalid backup file.');
            }
        };
        reader.readAsText(file);
    };

    const previewV5Import = () => {
        try {
            const raw = localStorage.getItem('miyamoto_v5');
            if (!raw) {
                setV5Error('No miyamoto_v5 data found in this browser.');
                setV5Preview(null);
                return;
            }
            const parsed = JSON.parse(raw);
            const migrated = migrateState(parsed);
            setV5Preview({
                name: migrated.profile.name || 'Unknown',
                sessions: migrated.sessionLogs.length,
                disciplines: migrated.profile.disciplines.join(', '),
            });
            setV5Error('');
        } catch {
            setV5Error('Could not parse miyamoto_v5 data.');
            setV5Preview(null);
        }
    };

    const importV5Now = () => {
        try {
            const raw = localStorage.getItem('miyamoto_v5');
            if (!raw) {
                setV5Error('No miyamoto_v5 data found in this browser.');
                return;
            }
            const confirmed = window.confirm('Import migrated `miyamoto_v5` data and replace current V7 state? A rollback backup will be created first.');
            if (!confirmed) return;
            localStorage.setItem('miyamoto_v7_backup_before_v5_import', JSON.stringify(state));
            dispatch({ type: 'IMPORT_V5_LOCAL_STATE', data: JSON.parse(raw) });
            setV5Error('');
        } catch {
            setV5Error('Failed to import V5 data.');
        }
    };

    const restorePreImportBackup = () => {
        try {
            const raw = localStorage.getItem('miyamoto_v7_backup_before_v5_import');
            if (!raw) return;
            dispatch({ type: 'IMPORT_STATE', data: JSON.parse(raw) });
        } catch { }
    };

    const saveBlockedPatterns = () => {
        const patterns = blockedPatternsInput
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
        dispatch({ type: 'SET_BLOCKED_PATTERNS', patterns });
    };

    const sections = [
        { id: 'goal', label: 'Goal Recalibration' },
        { id: 'disciplines', label: 'Discipline Manager' },
        { id: 'persona', label: 'AI Persona' },
        { id: 'accent', label: 'Accent Color' },
        { id: 'ai', label: 'AI Coach' },
        { id: 'constraints', label: 'Constraints' },
        { id: 'v5import', label: 'V5 Import' },
        { id: 'data', label: 'Data' },
    ];

    return (
        <div className="scrollable safe-bottom" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="max-w-lg mx-auto">
                <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                    {sections.map((s) => (
                        <button key={s.id} onClick={() => setSection(s.id)}
                            className="flex-shrink-0 px-4 py-3 text-xs font-semibold transition-all"
                            style={section === s.id ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' } : { color: 'var(--muted)' }}>
                            {s.label}
                        </button>
                    ))}
                </div>

                <div className="px-4 py-5 space-y-4">
                    {section === 'goal' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>GOAL RECALIBRATION</div>
                            {Object.entries(GOALS).map(([k, g]) => (
                                <button key={k} onClick={() => dispatch({ type: 'SET_PROFILE_FIELD', key: 'goal', value: k })}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-all"
                                    style={profile.goal === k ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' } : { background: 'var(--card)', border: '1px solid var(--border)' }}>
                                    <span>{g.icon}</span>
                                    <span className="font-medium">{g.label}</span>
                                    {profile.goal === k && <Icon.Check className="ml-auto accent" style={{ width: 14, height: 14 }} />}
                                </button>
                            ))}
                        </div>
                    )}

                    {section === 'disciplines' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>DISCIPLINE MANAGER</div>
                            {Object.entries(DISCIPLINES).filter(([k]) => k !== 'custom').map(([k, d]) => {
                                const active = profile.disciplines.includes(k);
                                return (
                                    <button key={k} onClick={() => {
                                        const next = active ? profile.disciplines.filter((x) => x !== k) : [...profile.disciplines, k];
                                        dispatch({ type: 'SET_PROFILE_FIELD', key: 'disciplines', value: next });
                                    }}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                                        style={active ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' } : { background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <span className="text-xl">{d.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">{d.label}</div>
                                            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{d.desc}</div>
                                        </div>
                                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={active ? { background: 'var(--accent)' } : { border: '1px solid var(--border)' }}>
                                            {active && <Icon.Check style={{ color: '#fff', width: 12, height: 12 }} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {section === 'persona' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>AI PERSONA</div>
                            {Object.entries(COACH_PERSONAS).map(([k, p]) => (
                                <button key={k} onClick={() => dispatch({ type: 'SET_PROGRAM_CONFIG', fields: { coachPersona: k } })}
                                    className="w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all"
                                    style={programConfig.coachPersona === k ? { background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' } : { background: 'var(--card)', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div className="font-semibold text-sm">{p.label}</div>
                                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{p.desc}</div>
                                    </div>
                                    {programConfig.coachPersona === k && <Icon.Check className="accent" style={{ width: 14, height: 14 }} />}
                                </button>
                            ))}
                        </div>
                    )}

                    {section === 'accent' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>ACCENT COLOR</div>
                            <div className="flex gap-3 flex-wrap">
                                {Object.entries(ACCENT_COLORS).map(([k, v]) => (
                                    <button key={k} onClick={() => dispatch({ type: 'APPLY_ACCENT', color: k })}
                                        className="w-9 h-9 rounded-full border-2 transition-all"
                                        style={{ background: v.css, borderColor: profile.accentColor === k ? '#fff' : 'transparent' }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {section === 'ai' && (
                        <div className="fade-in space-y-4">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>AI COACH</div>
                            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                <div>
                                    <div className="font-semibold text-sm">Enable AI Coaching</div>
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Uses Gemini for briefs, chat, and summaries. Defaults to Gemini 3 Flash Preview.</div>
                                </div>
                                <button onClick={() => dispatch({ type: 'SET_AI_CONFIG', fields: { enabled: !aiConfig.enabled } })}
                                    className="w-12 h-6 rounded-full transition-all flex-shrink-0"
                                    style={{ background: aiConfig.enabled ? 'var(--accent)' : 'var(--border)', position: 'relative' }}>
                                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: aiConfig.enabled ? 28 : 4 }} />
                                </button>
                            </div>
                            {aiConfig.enabled && (
                                <div className="space-y-3 fade-in">
                                    <div>
                                        <label className="block text-xs font-semibold tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>GEMINI API KEY</label>
                                        <input type="password" value={aiConfig.apiKey} onChange={(e) => dispatch({ type: 'SET_AI_CONFIG', fields: { apiKey: e.target.value } })}
                                            placeholder="AIza..."
                                            className="w-full px-4 py-3 rounded-lg text-sm font-mono"
                                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>MODEL</label>
                                        <select value={aiConfig.model} onChange={(e) => dispatch({ type: 'SET_AI_CONFIG', fields: { model: e.target.value } })}
                                            className="w-full px-4 py-3 rounded-lg text-sm"
                                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Default)</option>
                                            <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview (Lightweight)</option>
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-flash-latest">Gemini Flash Latest (Alias)</option>
                                        </select>
                                        <div className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                                            Deprecated saved model IDs are auto-upgraded to the latest supported default.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {section === 'constraints' && (
                        <div className="fade-in space-y-4">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>CONSTRAINTS</div>
                            {Object.entries(constraints.injuries).map(([k, active]) => (
                                <div key={k} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                    <div className="font-medium capitalize">{k}</div>
                                    <button onClick={() => dispatch({ type: 'SET_INJURIES', injuries: { [k]: !active } })}
                                        className="w-12 h-6 rounded-full transition-all flex-shrink-0"
                                        style={{ background: active ? '#ef4444' : 'var(--border)', position: 'relative' }}>
                                        <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: active ? 28 : 4 }} />
                                    </button>
                                </div>
                            ))}
                            <div className="card p-4">
                                <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--muted)' }}>BLOCKED PATTERNS</div>
                                <input value={blockedPatternsInput} onChange={(e) => setBlockedPatternsInput(e.target.value)}
                                    placeholder="comma separated, e.g. deadlift, burpee"
                                    className="w-full px-3 py-2 rounded text-xs"
                                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                                <button onClick={saveBlockedPatterns} className="btn-ghost w-full py-2 text-xs font-semibold mt-2">Save Patterns</button>
                            </div>
                            {Object.keys(constraints.customSubstitutions || {}).length > 0 && (
                                <div className="card p-4">
                                    <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--muted)' }}>CUSTOM SUBSTITUTIONS</div>
                                    <div className="space-y-1.5">
                                        {Object.entries(constraints.customSubstitutions).map(([from, to]) => (
                                            <div key={from} className="text-xs flex justify-between" style={{ color: 'var(--muted)' }}>
                                                <span>{from}</span>
                                                <span className="accent">→ {to}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {section === 'v5import' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>V6/V5 DATA IMPORT</div>
                            <button onClick={previewV5Import} className="btn-ghost w-full py-3 text-sm font-semibold">Preview `miyamoto_v5` Data</button>
                            {v5Preview && (
                                <div className="card p-4 text-xs" style={{ color: 'var(--muted)' }}>
                                    <div>Name: <span style={{ color: 'var(--text)' }}>{v5Preview.name}</span></div>
                                    <div>Sessions: <span style={{ color: 'var(--text)' }}>{v5Preview.sessions}</span></div>
                                    <div>Disciplines: <span style={{ color: 'var(--text)' }}>{v5Preview.disciplines || 'none'}</span></div>
                                </div>
                            )}
                            {v5Error && <div className="text-xs" style={{ color: '#ef4444' }}>{v5Error}</div>}
                            <button onClick={importV5Now} className="btn-accent w-full py-3 text-sm font-bold">Import From `miyamoto_v5`</button>
                            <button onClick={restorePreImportBackup} className="btn-ghost w-full py-3 text-sm font-semibold">Restore Pre-Import Backup</button>
                        </div>
                    )}

                    {section === 'data' && (
                        <div className="fade-in space-y-3">
                            <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--muted)' }}>DATA MANAGEMENT</div>
                            <button onClick={exportData}
                                className="btn-ghost w-full py-4 text-sm font-semibold flex items-center justify-center gap-2">
                                {exportDone ? <><Icon.Check /> Exported!</> : '⬇️ Export Backup (JSON)'}
                            </button>
                            <button onClick={() => fileRef.current?.click()}
                                className="btn-ghost w-full py-4 text-sm font-semibold">⬆️ Import Backup (JSON)</button>
                            <input ref={fileRef} type="file" accept=".json" onChange={importData} className="hidden" />
                            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                {!resetConfirm ? (
                                    <button onClick={() => setResetConfirm(true)}
                                        className="w-full py-4 text-sm font-semibold rounded-xl"
                                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                                        🗑️ Reset All Data
                                    </button>
                                ) : (
                                    <div className="p-4 rounded-xl text-sm space-y-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
                                        <p style={{ color: '#ef4444' }}>This will erase all your sessions, progress, and settings. Are you certain?</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setResetConfirm(false)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                                            <button onClick={() => dispatch({ type: 'RESET_ALL' })}
                                                className="flex-1 py-2 rounded text-sm font-bold"
                                                style={{ background: '#ef4444', color: '#fff' }}>Yes, Reset</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center text-xs pt-2" style={{ color: 'var(--muted)' }}>
                                Miyamoto V7.0 · {state.sessionLogs.length} sessions · {(JSON.stringify(state).length / 1024).toFixed(1)}KB stored
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── NAV BAR ─────────────────────────────────────────────────────────────────
function NavBar({ view, dispatch, hasActive }) {
const tabs = [
{ id: 'home', label: 'Home', icon: Icon.Home },
{ id: 'train', label: 'Train', icon: Icon.Train },
{ id: 'progress', label: 'Progress', icon: Icon.Chart },
{ id: 'history', label: 'History', icon: Icon.List },
{ id: 'settings', label: 'Settings', icon: Icon.Settings },
];
return (
<nav className="nav-bar">
    {tabs.map(t => {
    const active = view === t.id;
    const isTrainWithSession = t.id === 'train' && hasActive;
    return (
    <button key={t.id} onClick={()=> dispatch({ type: 'SET_VIEW', view: t.id })}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all"
        style={{ color: active ? 'var(--accent)' : 'var(--muted)', borderTop: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
        <t.icon style={{ width: 18, height: 18 }} />
        <span className="text-xs font-semibold" style={{ fontSize: 10 }}>{isTrainWithSession ? 'ACTIVE' :
            t.label.toUpperCase()}</span>
        {isTrainWithSession &&
        <div className="w-1.5 h-1.5 rounded-full pulse" style={{ background: '#22c55e' }} />}
    </button>
    );
    })}
</nav>
);
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
const LS_KEY = 'miyamoto_v7';

function App() {
const saved = useMemo(() => {
try {
const raw = localStorage.getItem(LS_KEY);
return raw ? migrateState(JSON.parse(raw)) : INITIAL_STATE;
} catch { return INITIAL_STATE; }
}, []);

const [state, dispatch] = useReducer(appReducer, saved);

// Apply saved accent on load
useEffect(() => { applyAccent(state.profile?.accentColor || 'red'); }, []);

// Persist state
useEffect(() => {
try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}, [state]);

const { view, onboarded, activeSession } = state;

if (!onboarded) return React.createElement(OnboardingView, { state, dispatch });

return (
<div style={{ display: 'flex' , flexDirection: 'column' , height: '100%' }}>
    <div
      key={view}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
        {view === 'home' && React.createElement(HomeView, { state, dispatch })}
        {view === 'train' && React.createElement(TrainView, { state, dispatch })}
        {view === 'progress' && React.createElement(ProgressView, { state, dispatch })}
        {view === 'history' && React.createElement(HistoryView, { state, dispatch })}
        {view === 'settings' && React.createElement(SettingsView, { state, dispatch })}
    </div>
    <NavBar view={view} dispatch={dispatch} hasActive={!!activeSession} />
</div>
);
}


export default App;
