import { clamp, toNum, slugify, isClockValue, toTitleCase, timeToMinutes } from './helpers';
import {
  COACH_EQUIPMENT_ALIAS_MAP,
  COACH_FALLBACK_ALLOWED_EQUIPMENT,
  WEEKLY_SUMMARY_COOLDOWN_MS
} from '../constants/config';

// ----------------------------------------------------
// Core Evaluators
// ----------------------------------------------------

export function calculateReadiness(inputs = {}) {
  const sleep = clamp(toNum(inputs.sleep, 6), 1, 10);
  const stress = clamp(toNum(inputs.stress, 6), 1, 10);
  const soreness = clamp(toNum(inputs.soreness, 6), 1, 10);
  const motivation = clamp(toNum(inputs.motivation, 6), 1, 10);
  const energy = clamp(toNum(inputs.energy, 6), 1, 10);

  const recoveryWeight = 0.35;
  const stressWeight = 0.25;
  const driveWeight = 0.40;

  const recoveryScore = sleep * 0.5 + ((11 - soreness) * 0.5);
  const stressScore = 11 - stress;
  const driveScore = motivation * 0.5 + energy * 0.5;

  let raw = (recoveryScore * recoveryWeight) + (stressScore * stressWeight) + (driveScore * driveWeight);
  const sittingLoadMap = { light: 0, moderate: -0.5, heavy: -1.5, marathon: -2.5 };
  raw += (sittingLoadMap[inputs.sittingLoad || 'moderate'] || 0);

  if (sleep <= 4 || soreness >= 9 || energy <= 3) {
    raw = Math.min(raw, 5.9);
  }

  const score = clamp(Math.round(raw * 10), 10, 100);
  const band = score >= 80 ? 'high' : score >= 60 ? 'moderate' : 'low';

  return { score, band };
}

export function calculateRecoveryScore(muscleRecovery = {}) {
  const keys = Object.keys(muscleRecovery);
  if (!keys.length) return 100;
  const metrics = keys.map(key => muscleRecovery[key]);
  const maxPainOrSoreness = Math.max(...metrics.map(m => Math.max(m.soreness, m.pain)));
  const avgFatigue = metrics.reduce((sum, m) => sum + m.fatigue, 0) / metrics.length;
  let score = 100 - (maxPainOrSoreness * 8) - (avgFatigue * 4);
  return clamp(Math.round(score), 0, 100);
}

// ----------------------------------------------------
// Muscle & Recovery State
// ----------------------------------------------------

export const ALL_MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'hipFlexors'
];

export function updateMuscleRecovery(currentState = {}, items = []) {
  if (!items.length) return currentState;
  const next = { ...currentState };
  
  items.forEach(item => {
    (item.muscles || []).forEach(muscle => {
      const key = String(muscle).trim();
      if (!key) return;
      const current = next[key] || { fatigue: 0, soreness: 0, pain: 0, lastWorked: null };
      next[key] = {
        ...current,
        fatigue: clamp(current.fatigue + 3, 0, 10),
        soreness: clamp(current.soreness + Math.floor(Math.random() * 3), 0, 10),
        lastWorked: new Date().toISOString()
      };
    });
  });
  return next;
}

export function decayMuscleRecovery(currentState = {}) {
  const next = {};
  const decayRate = 2; // Decays over time
  for (const [key, metrics] of Object.entries(currentState)) {
    const fatigue = clamp(metrics.fatigue - decayRate, 0, 10);
    const soreness = clamp(metrics.soreness - 1, 0, 10);
    const pain = clamp(metrics.pain - 1, 0, 10);
    if (fatigue > 0 || soreness > 0 || pain > 0) {
      next[key] = { ...metrics, fatigue, soreness, pain };
    }
  }
  return next;
}

export function getCoachRecoverySummary(state) {
  const fatigueThreshold = 6;
  const model = state.muscleRecovery || {};
  const fatigued = [];
  const recovering = [];
  
  Object.entries(model).forEach(([id, metrics]) => {
    if (metrics.pain >= 5) fatigued.push(id);
    else if (metrics.fatigue >= fatigueThreshold || metrics.soreness >= 6) fatigued.push(id);
    else if (metrics.fatigue > 0 || metrics.soreness > 0) recovering.push(id);
  });
  
  const targetMuscles = [];
  const stiffnessAreas = String(state.coachContext?.inputs?.stiffnessAreas || '').toLowerCase();
  const painAreas = String(state.coachContext?.inputs?.painAreas || '').toLowerCase();
  
  ALL_MUSCLE_GROUPS.forEach(muscle => {
     if (stiffnessAreas.includes(muscle.toLowerCase()) || painAreas.includes(muscle.toLowerCase())) {
         if (!targetMuscles.includes(muscle)) targetMuscles.push(muscle);
     }
  });

  return {
    recoveryScore: calculateRecoveryScore(model),
    fatiguedMuscles: fatigued,
    recoveringMuscles: recovering,
    targetMuscles: targetMuscles.length ? targetMuscles : ALL_MUSCLE_GROUPS.slice(0, 4) // Default fallback
  };
}

// ----------------------------------------------------
// Equipment and Place Evaluation
// ----------------------------------------------------

export function normalizeEquipmentText(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(label => {
      const keyRaw = slugify(label);
      const aliased = COACH_EQUIPMENT_ALIAS_MAP[keyRaw.replace(/-/g, ' ')] || keyRaw;
      return { label, key: slugify(aliased) };
    });
}

export function normalizeEquipmentRequirementKey(rawRequirement) {
  const keyRaw = slugify(rawRequirement);
  const aliased = COACH_EQUIPMENT_ALIAS_MAP[keyRaw.replace(/-/g, ' ')] || keyRaw;
  return slugify(aliased);
}

export function getEffectivePlaceEquipment(place) {
  if (!place) return [];
  const available = place.equipmentNormalized || [];
  const blockedNames = new Set((place.unavailableEquipmentNormalized || []).map(info => info.key));
  return available.filter(item => !blockedNames.has(item.key));
}

export function isTimeInWindow(clockNow, windowArg) {
  return clockNow >= windowArg.start && clockNow <= windowArg.end;
}

export function isPlaceAvailableNow(place, now = new Date()) {
  if (!place) return false;
  if (place.availabilityOverride === 'available') return true;
  if (place.availabilityOverride === 'unavailable') return false;

  const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dayIndex];
  const windows = place.weeklyAvailability?.[dayKey] || [];
  
  if (windows.length === 0) return true; // Default behavior

  const clockString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  return windows.some(w => isTimeInWindow(clockString, w));
}


// ----------------------------------------------------
// State Readers
// ----------------------------------------------------

export function getProgramItems(state) {
  return Array.isArray(state?.programs?.items) ? state.programs.items : [];
}

export function getPlaceItems(state) {
  return Array.isArray(state?.places?.items) ? state.places.items : [];
}

export function getActivePrograms(state) {
  return getProgramItems(state).filter(p => !p.archived && p.active);
}

export function getProgramById(state, id) {
  return getProgramItems(state).find(p => p.id === id) || null;
}

export function getPlaceById(state, id) {
  return getPlaceItems(state).find(p => p.id === id) || null;
}

export function getPlaceMap(state) {
  return getPlaceItems(state).reduce((map, place) => {
    map[place.id] = place;
    return map;
  }, {});
}

// ----------------------------------------------------
// State Evaluators
// ----------------------------------------------------

export function getCoachTrainingLogs(state) {
  return (Array.isArray(state?.sessionLogs) ? state.sessionLogs : []).filter(log => log.countsTowardTraining);
}

export function getCoachResetLogs(state) {
  return (Array.isArray(state?.sessionLogs) ? state.sessionLogs : []).filter(log => !log.countsTowardTraining);
}

export function getRecentCoachLogs(state, limit = 5) {
  return (Array.isArray(state?.sessionLogs) ? state.sessionLogs : []).slice().reverse().slice(0, limit);
}

export function getRecommendationMissSignal(state) {
  if (!state?.coachPlan?.recommendation) return false;
  const rec = state.coachPlan.recommendation;
  if (!rec.countsTowardTraining) return false;
  const now = Date.now();
  const recTime = new Date(rec.generatedAt).getTime();
  if (isNaN(recTime)) return false;
  return (now - recTime) > 24 * 60 * 60 * 1000;
}

export function buildLocalRoadmapSourceSignature(state) {
  const activeProgramCount = getActivePrograms(state).length;
  const programUpdateSignature = state.programs?.updatedAt || '';
  const placeUpdateSignature = state.places?.updatedAt || '';
  return `active:${activeProgramCount};prog:${programUpdateSignature};place:${placeUpdateSignature}`;
}

// ----------------------------------------------------
// Data Formatters
// ----------------------------------------------------

export function getAvailabilityLabel(place, now = new Date()) {
  if (place.availabilityOverride === 'available') return 'Always available (override)';
  if (place.availabilityOverride === 'unavailable') return 'Blocked (override)';
  
  const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dayIndex];
  const windows = place.weeklyAvailability?.[dayKey] || [];
  
  if (windows.length === 0) return 'Open schedule';
  return `${toTitleCase(dayKey)}: ${windows.map(w => `${w.start}-${w.end}`).join(', ')}`;
}

export function formatProgramTargetSummary(program) {
  if (!program) return 'No target';
  if (program.targetType === 'milestone') return `Milestone: ${program.successCriteria || 'Not set'}`;
  return `${program.currentLevel || 'Unrated'} → ${program.targetLevel || 'No target'} (${program.weeklyTargetSessions || 3}x/wk)`;
}

export function getCurrentPhaseFromForecast(forecast, minWeeksRemaining = 0) {
  if (!forecast?.phaseBlocks?.length) return null;
  const blocks = forecast.phaseBlocks;
  // Basic heuristic: assume the first block is current unless marked otherwise.
  return blocks[0];
}

export function classifyCoachAIError(err) {
  const msg = (err?.message || '').toLowerCase();
  let reason = 'Coach request failed.';
  if (err?.status === 429 || msg.includes('rate limit')) reason = 'Coach is busy (rate limit). Wait a moment and try again.';
  else if (msg.includes('invalid') || msg.includes('parse')) reason = 'Coach failed to format its response. Wait a moment and try again.';
  else if (msg.includes('timed out')) reason = 'Coach timed out. The request was too complex.';
  return { error: err, reason };
}

export function appendCoachChatMessages(existing = [], additions = []) {
  return [...existing, ...additions].slice(-50);
}

export function normalizeCoachChatMessage(raw) {
    if (!raw) return null;
    return {
      id: raw.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      role: raw.role === 'coach' ? 'coach' : 'user',
      text: String(raw.text || '').trim(),
      actionSummary: typeof raw.actionSummary === 'string' ? raw.actionSummary.trim() : undefined
    };
}

// ----------------------------------------------------
// Roadmap Evaluation
// ----------------------------------------------------

export function getRoadmapSnapshotForProgram(state, programId) {
  if (!state?.coachRoadmap?.programForecasts) return null;
  return state.coachRoadmap.programForecasts.find(f => f.programId === programId) || null;
}

export function buildRoadmapAIRefreshSignature(state) {
  if (!state.coachRoadmap?.aiRefreshSignature) return 'never_run';
  return `${state.coachRoadmap.updatedAt}_${state.coachRoadmap.lastReforecastReason}`;
}

export function shouldRefreshRoadmapAI(state, aiRefreshSignature) {
  if (!state.aiConfig?.enabled) return false;
  
  if (!state.coachRoadmap?.updatedAt) return true;
  
  const now = Date.now();
  const lastUpdate = new Date(state.coachRoadmap.updatedAt).getTime();
  if (now - lastUpdate > 7 * 24 * 60 * 60 * 1000) return true;
  
  if (state.coachRoadmap.aiRefreshSignature !== aiRefreshSignature) return true;

  const currentSourceSig = buildLocalRoadmapSourceSignature(state);
  if (state.coachRoadmap.sourceSignature && state.coachRoadmap.sourceSignature !== currentSourceSig) {
      return true;
  }
  
  return false;
}

export function buildLocalCoachRoadmap(state, reason) {
  return {
    timestamp: new Date().toISOString(),
    triggerReason: reason,
    activePrograms: getActivePrograms(state).map(p => ({
        id: p.id,
        name: p.name,
        goal: p.goal,
        currentLevel: p.currentLevel,
        targetLevel: p.targetLevel,
        targetType: p.targetType,
        successCriteria: p.successCriteria,
    })),
    recentLogs: getRecentCoachLogs(state, 10).map(log => ({
        date: log.completedAt,
        programId: log.programId,
        training: log.countsTowardTraining,
        quality: log.completionQuality,
        rpe: log.rpe
    })),
    recoverySummary: getCoachRecoverySummary(state)
  };
}
