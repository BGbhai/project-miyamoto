import {
  COACH_STATE_VERSION,
  GEMINI_DEFAULT_MODEL,
  GEMINI_ALLOWED_MODELS,
  COACH_MODEL_PRIORITY,
  COACH_STORAGE_KEY,
  LEGACY_STORAGE_KEY
} from '../constants/config';
import { clamp, toNum, slugify } from './helpers';
import { normalizeEquipmentText } from './workoutLogic';

export function createAIConfig(overrides = {}) {
  const modelRankings = GEMINI_ALLOWED_MODELS.slice().sort((a, b) => (COACH_MODEL_PRIORITY[b] || 0) - (COACH_MODEL_PRIORITY[a] || 0));
  return {
    enabled: true,
    apiKey: '',
    model: GEMINI_DEFAULT_MODEL,
    planningModel: GEMINI_DEFAULT_MODEL,
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`,
    fallbackPolicy: 'best_other_available',
    modelRankings,
    modelHealth: {},
    lastSuccessfulModel: null,
    ...overrides,
  };
}

export function createProgramConfig(overrides = {}) {
  return {
    accentPreset: 'ember',
    accentHex: '#ef4444',
    ...overrides,
  };
}

export function createCoachProgram(overrides = {}) {
  const name = String(overrides.name || '').trim() || 'New Program';
  return {
    id: `program_${slugify(name)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    goal: String(overrides.goal || '').trim(),
    targetType: String(overrides.targetType || 'level'),
    currentLevel: String(overrides.currentLevel || '').trim(),
    targetLevel: String(overrides.targetLevel || '').trim(),
    successCriteria: String(overrides.successCriteria || '').trim(),
    weeklyTargetSessions: clamp(toNum(overrides.weeklyTargetSessions, 3), 1, 14),
    coachingNotes: String(overrides.coachingNotes || '').trim(),
    preferredPlaceIds: Array.isArray(overrides.preferredPlaceIds) ? overrides.preferredPlaceIds : [],
    active: true,
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

export function createCoachPlace(overrides = {}) {
  const name = String(overrides.name || '').trim() || 'New Place';
  const equipmentRaw = String(overrides.equipmentRaw || '').trim();
  const unavailableRaw = String(overrides.unavailableEquipmentRaw || '').trim();
  return {
    id: `place_${slugify(name)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    availabilityOverride: 'auto',
    weeklyAvailability: overrides.weeklyAvailability || {},
    equipmentRaw,
    equipmentNormalized: normalizeEquipmentText(equipmentRaw),
    unavailableEquipmentRaw: unavailableRaw,
    unavailableEquipmentNormalized: normalizeEquipmentText(unavailableRaw),
    createdAt: new Date().toISOString(),
  };
}

export function createAuditEntry(overrides = {}) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type: overrides.type || 'info',
    title: overrides.title || 'Event logged',
    detail: overrides.detail || '',
    source: overrides.source || 'system',
    reasonCode: overrides.reasonCode || 'unknown',
  };
}

export function readLegacyBackupMeta() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { available: false, capturedAt: null };
    const parsed = JSON.parse(raw);
    const hasData = Array.isArray(parsed?.sessions) && parsed.sessions.length > 0;
    return {
      available: hasData,
      capturedAt: hasData ? new Date().toISOString() : null,
    };
  } catch (err) {
    return { available: false, capturedAt: null };
  }
}

export function createCoachState(overrides = {}) {
  return {
    version: COACH_STATE_VERSION,
    setupStep: 0,
    setupComplete: false,
    view: 'setup',
    activeSession: null,
    postSessionSummary: null,
    profile: {
      name: '',
      age: '',
      bodyweight: '',
      overallGoal: '',
      injuries: {
        shoulder: false,
        back: false,
        knee: false,
      },
      sessionCount: 0,
    },
    coachContext: {
      inputs: {
        sleep: 7,
        stress: 5,
        soreness: 3,
        motivation: 7,
        energy: 7,
        painAreas: '',
        stiffnessAreas: '',
        availableMinutes: 45,
        sittingLoad: 'moderate',
        coachNote: '',
      },
      readiness: { score: 70, band: 'moderate' },
      lastUpdatedAt: new Date().toISOString(),
    },
    muscleRecovery: {},
    programs: {
      items: [],
      updatedAt: new Date().toISOString(),
    },
    places: {
      items: [],
      updatedAt: new Date().toISOString(),
    },
    coachPlan: {
      loading: false,
      error: null,
      recommendation: null,
      pendingPlaceResolution: null,
      lastGeneratedAt: null,
    },
    coachRoadmap: {
      loading: false,
      error: null,
      summary: '',
      driftStatus: 'stable',
      programForecasts: [],
      roadmapChanges: [],
      lastReforecastReason: 'initial_setup',
      sourceSignature: null,
      aiRefreshSignature: null,
      updatedAt: null,
    },
    coachChat: {
      messages: [],
      loading: false,
      error: null,
      pendingProposal: null,
      lastGeneratedRecommendationId: null,
    },
    sessionLogs: [],
    coachAuditLog: [
      createAuditEntry({
        title: 'App initialized',
        detail: 'Started MIYAMOTO v6 with live context coach.',
        source: 'system',
        reasonCode: 'init',
      }),
    ],
    aiConfig: createAIConfig(),
    programConfig: createProgramConfig(),
    legacyBackupMeta: readLegacyBackupMeta(),
    ...overrides,
  };
}

export function hydrateCoachState() {
  const fallback = createCoachState();
  try {
    const raw = localStorage.getItem(COACH_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== COACH_STATE_VERSION) {
      console.warn(`Version mismatch or invalid storage. Expected ${COACH_STATE_VERSION}, found ${parsed?.version}. Providing fresh state.`);
      localStorage.setItem(COACH_LEGACY_BACKUP_KEY, raw);
      return {
        ...fallback,
        legacyBackupMeta: { available: true, capturedAt: new Date().toISOString() }
      };
    }

    const { modelHealth, ...aiConfigRest } = parsed.aiConfig || {};
    const mergedHealth = { ...fallback.aiConfig.modelHealth, ...modelHealth };
    return {
      ...fallback,
      ...parsed,
      activeSession: parsed.activeSession || null,
      postSessionSummary: parsed.postSessionSummary || null,
      coachPlan: {
        ...fallback.coachPlan,
        ...(parsed.coachPlan || {}),
        loading: false,
      },
      coachChat: {
        ...fallback.coachChat,
        ...(parsed.coachChat || {}),
        loading: false,
      },
      aiConfig: {
        ...fallback.aiConfig,
        ...aiConfigRest,
        modelHealth: mergedHealth,
      },
    };
  } catch (err) {
    console.error('Failed to hydrate coach state:', err);
    return fallback;
  }
}
