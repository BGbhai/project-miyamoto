import { clamp, toNum, moveItem } from '../utils/helpers';
import { calculateReadiness, updateMuscleRecovery } from '../utils/workoutLogic';
import { appendAuditEntries } from '../utils/auditUtils';
import { createCoachProgram, createCoachPlace, createAuditEntry } from '../utils/factories';

export function applyProgramPatches(items = [], patches = []) {
  if (!patches.length) return items;
  const mergedPatches = patches.reduce((acc, entry) => {
    if (!entry?.id) return acc;
    acc[entry.id] = { ...(acc[entry.id] || {}), ...(entry.patch || {}) };
    return acc;
  }, {});
  return items.map(item => {
    return mergedPatches[item.id] ? { ...item, ...mergedPatches[item.id] } : item;
  });
}

function normalizeCoachChatMessage(raw) {
  if (!raw) return null;
  return {
    id: raw.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    role: raw.role === 'coach' ? 'coach' : 'user',
    text: String(raw.text || '').trim(),
    actionSummary: typeof raw.actionSummary === 'string' ? raw.actionSummary.trim() : undefined
  };
}

function appendCoachChatMessages(existing = [], additions = []) {
  return [...existing, ...additions].slice(-50);
}

export function coachReducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'SET_SETUP_STEP':
      return { ...state, setupStep: clamp(toNum(action.payload, 0), 0, 3) };
    case 'COMPLETE_SETUP':
      return { ...state, setupComplete: true, view: 'today' };
    case 'UPDATE_PROFILE_FIELD': {
      const { field, value } = action.payload || {};
      if (!field) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          [field]: value,
        },
      };
    }
    case 'TOGGLE_PROFILE_INJURY': {
      const key = action.payload?.key;
      if (!key) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          injuries: {
            ...state.profile.injuries,
            [key]: !state.profile.injuries[key],
          },
        },
      };
    }
    case 'UPDATE_COACH_INPUT': {
      const { field, value } = action.payload || {};
      if (!field) return state;
      const inputs = {
        ...state.coachContext.inputs,
        [field]: field === 'availableMinutes'
          ? clamp(toNum(value, state.coachContext.inputs.availableMinutes), 5, 240)
          : value,
      };
      return {
        ...state,
        coachContext: {
          inputs,
          readiness: calculateReadiness(inputs),
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    }
    case 'APPEND_COACH_CHAT_MESSAGE': {
      const message = normalizeCoachChatMessage(action.payload);
      if (!message) return state;
      return {
        ...state,
        coachChat: {
          ...state.coachChat,
          messages: appendCoachChatMessages(state.coachChat?.messages, [message]),
        },
      };
    }
    case 'SET_COACH_CHAT_LOADING':
      return {
        ...state,
        coachChat: {
          ...state.coachChat,
          loading: !!action.payload,
        },
      };
    case 'SET_COACH_CHAT_ERROR':
      return {
        ...state,
        coachChat: {
          ...state.coachChat,
          error: action.payload || null,
        },
      };
    case 'CLEAR_COACH_CHAT_PROPOSAL':
      return {
        ...state,
        coachChat: {
          ...state.coachChat,
          pendingProposal: null,
        },
      };
    case 'CLEAR_COACH_CHAT_HISTORY':
      return {
        ...state,
        coachChat: {
          ...state.coachChat,
          messages: [],
          error: null,
          lastGeneratedRecommendationId: null,
        },
      };
    case 'ADD_PROGRAM': {
      const nextProgram = createCoachProgram(action.payload || {});
      return {
        ...state,
        programs: {
          items: [...(state.programs?.items || []), nextProgram],
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'UPDATE_PROGRAM': {
      const { id, patch } = action.payload || {};
      if (!id) return state;
      return {
        ...state,
        programs: {
          items: (state.programs?.items || []).map(item => item.id === id ? { ...item, ...(patch || {}) } : item),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'DELETE_PROGRAM': {
      const id = action.payload?.id;
      if (!id) return state;
      return {
        ...state,
        programs: {
          items: (state.programs?.items || []).filter(item => item.id !== id),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'TOGGLE_PROGRAM': {
      const id = action.payload?.id;
      if (!id) return state;
      return {
        ...state,
        programs: {
          items: (state.programs?.items || []).map(item => item.id === id ? { ...item, active: !item.active } : item),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'ADD_PLACE': {
      const nextPlace = createCoachPlace(action.payload || {});
      return {
        ...state,
        places: {
          items: [...(state.places?.items || []), nextPlace],
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'UPDATE_PLACE': {
      const { id, patch } = action.payload || {};
      if (!id) return state;
      return {
        ...state,
        places: {
          items: (state.places?.items || []).map(item => item.id === id ? { ...item, ...(patch || {}) } : item),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'DELETE_PLACE': {
      const id = action.payload?.id;
      if (!id) return state;
      return {
        ...state,
        places: {
          items: (state.places?.items || []).filter(item => item.id !== id),
          updatedAt: new Date().toISOString(),
        },
        programs: {
          items: (state.programs?.items || []).map(program => ({
            ...program,
            preferredPlaceIds: (program.preferredPlaceIds || []).filter(placeId => placeId !== id),
          })),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'COACH_REQUEST_START':
      return {
        ...state,
        coachPlan: {
          ...state.coachPlan,
          loading: true,
          error: null,
        },
      };
    case 'COACH_REQUEST_ERROR':
      return {
        ...state,
        coachPlan: {
          ...state.coachPlan,
          loading: false,
          error: action.payload || 'Coach request failed.',
        },
      };
    case 'CANCEL_ACTIVE_SESSION':
      return {
        ...state,
        activeSession: null,
        view: 'today',
      };
    case 'COMPLETE_AI_SESSION': {
      if (!state.activeSession) return state;
      const session = state.activeSession;
      const payload = action.payload || {};
      const completedAt = new Date().toISOString();
      const completionQuality = Math.round(Math.random() * 20 + + 80); // Simple fallback
      const log = {
        ...session,
        completedAt,
        rpe: clamp(toNum(payload.rpe, 6), 1, 10),
        recovery: clamp(toNum(payload.recovery, 6), 1, 10),
        energyLevel: clamp(toNum(payload.energyLevel, 7), 1, 10),
        notes: String(payload.notes || '').trim(),
        completionQuality,
      };
      const itemsForRecovery = (session.items || []).map(item => ({
        muscles: [...(item.musclesPrimary || []), ...(item.musclesSecondary || [])],
      }));
      const nextMuscleRecovery = session.countsTowardTraining
        ? updateMuscleRecovery(state.muscleRecovery, itemsForRecovery)
        : state.muscleRecovery;
      return {
        ...state,
        sessionLogs: [...(state.sessionLogs || []), log],
        profile: {
          ...state.profile,
          sessionCount: (state.profile?.sessionCount || 0) + (session.countsTowardTraining ? 1 : 0),
        },
        muscleRecovery: nextMuscleRecovery,
        activeSession: null,
        postSessionSummary: {
          id: log.id,
          variant: log.variant,
          title: log.summary || (log.variant === 'desk_reset' ? 'Desk Reset complete' : 'Workout complete'),
          programName: log.programName,
          placeName: log.placeName,
          completionQuality,
          rpe: log.rpe,
          recovery: log.recovery,
          energyLevel: log.energyLevel,
          completedAt,
          countsTowardTraining: log.countsTowardTraining,
        },
        view: session.countsTowardTraining ? 'train' : 'today',
      };
    }
    case 'DISMISS_POST_SESSION_SUMMARY':
      return {
        ...state,
        postSessionSummary: null,
        view: action.payload?.view || 'today',
      };
    case 'UPDATE_AI_CONFIG': {
      const patch = action.payload || {};
      return {
        ...state,
        aiConfig: {
          ...state.aiConfig,
          ...(patch || {}),
        },
      };
    }
    case 'RESET_COACH_STATE': {
      // Basic reset using initial data structures, this avoids cyclical factory/hydrate dependencies
      return {
         ...state,
         programs: { items: [], updatedAt: new Date().toISOString() },
         places: { items: [], updatedAt: new Date().toISOString() },
         sessionLogs: [],
         activeSession: null,
      };
    }
    default:
      return state;
  }
}
