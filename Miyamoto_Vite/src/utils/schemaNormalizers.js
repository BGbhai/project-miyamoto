import {
  COACH_FALLBACK_ALLOWED_EQUIPMENT
} from '../constants/config';
import {
  normalizeEquipmentRequirementKey,
  getEffectivePlaceEquipment,
  calculateReadiness
} from './workoutLogic';

export function createGeminiParseError(failureType, rawTextSnippet, source, originalError = null) {
  const err = new Error(`AI returned invalid ${failureType}.`);
  err.isGeminiParseError = true;
  err.failureType = failureType;
  err.rawTextSnippet = String(rawTextSnippet || '').slice(0, 200);
  err.source = source || 'primary';
  err.originalError = originalError;
  return err;
}

export function normalizeCoachPrescription(parsed, state, program, place, sourceLabel = 'primary') {
  if (!parsed || typeof parsed !== 'object') {
    throw createGeminiParseError('JSON format (not an object)', JSON.stringify(parsed), sourceLabel);
  }

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
  if (itemsRaw.length === 0) {
    throw createGeminiParseError('Schema requirement (missing items)', JSON.stringify(parsed), sourceLabel);
  }

  const equipmentLookup = new Set(getEffectivePlaceEquipment(place).map(item => item.key));
  let fallbackInjected = false;

  const validItems = [];
  for (const item of itemsRaw) {
    if (!item || !item.name) continue; // Skip totally malformed items
    
    // Check if equipment is actually matched at the place
    const needed = Array.isArray(item.equipmentNeeded) ? item.equipmentNeeded : [];
    let isSafe = true;
    for (const req of needed) {
      const key = normalizeEquipmentRequirementKey(req);
      if (!COACH_FALLBACK_ALLOWED_EQUIPMENT.includes(key) && !equipmentLookup.has(key)) {
        isSafe = false;
        break;
      }
    }

    if (!isSafe) {
       console.warn(`[AI Coach Normalizer] Stripped unsafe item: ${item.name} due to missing equipment constraint.`);
       fallbackInjected = true;
       continue;
    }
    
    validItems.push({
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: String(item.name || 'Unknown drill').slice(0, 100),
      instructions: String(item.instructions || 'Do the movement safely.').slice(0, 500),
      sets: parseInt(item.sets, 10) || null,
      reps: item.reps ? String(item.reps) : null,
      duration: item.duration ? String(item.duration) : null,
      targetEffort: parseInt(item.targetEffort, 10) || 5,
      musclesPrimary: Array.isArray(item.musclesPrimary) ? item.musclesPrimary.map(String) : [],
      musclesSecondary: Array.isArray(item.musclesSecondary) ? item.musclesSecondary.map(String) : [],
      equipmentNeeded: needed.map(String),
      movementTags: Array.isArray(item.movementTags) ? item.movementTags.map(String) : [],
      contraindications: Array.isArray(item.contraindications) ? item.contraindications.map(String) : [],
      recoveryIntent: String(item.recoveryIntent || 'general_activation'),
      placeSuitability: Array.isArray(item.placeSuitability) ? item.placeSuitability.map(String) : [],
    });
  }

  if (validItems.length === 0) {
    throw createGeminiParseError('Safety constraints (all items required missing equipment)', JSON.stringify(parsed), sourceLabel);
  }

  const inputs = state.coachContext?.inputs || {};
  const readiness = state.coachContext?.readiness || calculateReadiness(inputs);

  return {
    id: `presc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    variant: parsed.variant === 'desk_reset' ? 'desk_reset' : 'workout',
    summary: String(parsed.summary || 'Coach Session').slice(0, 200),
    rationale: String(parsed.rationale || 'Built from your recent data.').slice(0, 400),
    recoveryIntent: String(parsed.recoveryIntent || 'balanced').slice(0, 200),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 10) : [],
    targetMuscles: Array.isArray(parsed.targetMuscles) ? parsed.targetMuscles.map(String) : [],
    contraindications: Array.isArray(parsed.contraindications) ? parsed.contraindications.map(String) : [],
    items: validItems,
    generatedAt: new Date().toISOString(),
    source: fallbackInjected ? 'ai_partial_fallback' : 'ai',
    usedFallbackMode: fallbackInjected,
    readinessSnapshot: readiness,
    modelUsed: null, // Assigned in orchestrator
  };
}
