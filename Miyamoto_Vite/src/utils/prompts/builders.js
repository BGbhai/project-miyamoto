import {
  formatCoachDateRange,
  toTitleCase,
} from '../helpers';
import {
  getProgramById,
  getCurrentPhaseFromForecast,
  getRecommendationMissSignal,
  getPlaceMap,
  getActivePrograms,
  getPlaceItems,
  getEffectivePlaceEquipment,
  getAvailabilityLabel,
  calculateReadiness,
  getCoachRecoverySummary,
  getRecentCoachLogs,
  getRoadmapSnapshotForProgram,
  formatProgramTargetSummary
} from '../workoutLogic';
import { GEMINI_DEFAULT_MODEL } from '../../constants/config';

export function summarizeRecentCoachLog(log) {
  const tags = (log?.tags || []).slice(0, 4).join(', ') || 'none';
  const muscles = (log?.targetMuscles || []).slice(0, 4).join(', ') || 'none';
  const dateLabel = new Date(log?.completedAt || log?.generatedAt || Date.now()).toLocaleDateString();
  return `${dateLabel} · ${log?.variant || 'session'} · ${log?.programName || 'Coach'} @ ${log?.placeName || 'Unknown'} · tags=${tags} · muscles=${muscles} · RPE=${log?.rpe || '?'}`;
}

export function buildProgramsPrompt(state) {
  const placeMap = getPlaceMap(state);
  return getActivePrograms(state).map(program => (
    `- id=${program.id}; name=${program.name}; goal=${program.goal || 'none'}; targetType=${program.targetType}; currentLevel=${program.currentLevel || 'unset'}; targetLevel=${program.targetLevel || 'unset'}; successCriteria=${program.successCriteria || 'unset'}; weeklyTargetSessions=${program.weeklyTargetSessions || 3}; preferredPlaces=${(program.preferredPlaceIds || []).map(id => placeMap[id]?.name || id).join(' > ') || 'none'}; coachingNotes=${program.coachingNotes || 'none'}`
  )).join('\n') || '- none';
}

export function buildPlacesPrompt(state, now = new Date()) {
  return getPlaceItems(state).map(place => {
    const equipment = getEffectivePlaceEquipment(place);
    return `- id=${place.id}; name=${place.name}; availability=${getAvailabilityLabel(place, now)}; note=${place.note || 'none'}; equipmentLabels=${equipment.map(item => item.label).join(', ') || 'bodyweight only'}; equipmentKeys=${equipment.map(item => item.key).join(', ') || 'bodyweight'}; unavailableEquipment=${(place.unavailableEquipmentNormalized || []).map(item => item.label).join(', ') || 'none'}`;
  }).join('\n') || '- none';
}

export function summarizeCoachCurrentFocus(state) {
  if (state?.activeSession) {
    const session = state.activeSession;
    return `Active session: ${session.summary || session.programName || 'Coach session'} at ${session.placeName || 'unknown place'} (${session.variant || 'session'})`;
  }
  if (state?.coachPlan?.recommendation) {
    const rec = state.coachPlan.recommendation;
    return `Current recommendation: ${rec.summary || rec.programName || 'Coach recommendation'} at ${rec.placeName || 'unknown place'} (${rec.variant || 'session'})`;
  }
  return 'No active session or pending recommendation.';
}

export function buildRoadmapSummaryPrompt(state) {
  const forecasts = (state?.coachRoadmap?.programForecasts || []).map(forecast => {
    const program = getProgramById(state, forecast.programId);
    const phase = getCurrentPhaseFromForecast(forecast, 0);
    return `- ${program?.name || forecast.programId}: nextMilestone=${forecast.nextMilestone}; eta=${formatCoachDateRange(forecast.etaLowDate, forecast.etaHighDate)}; confidence=${forecast.confidence}; drift=${forecast.driftStatus}; phase=${phase?.label || 'none'}; weeklyTarget=${forecast.currentWeek?.targetSessions || 0}; completedThisWeek=${forecast.currentWeek?.completedSessions || 0}`;
  });
  return forecasts.join('\n') || '- no roadmap yet';
}

export function buildCoachRoadmapPrompt(state, localRoadmap, reason = 'refresh') {
  const profile = state.profile || {};
  const readiness = state.coachContext?.readiness || calculateReadiness(state?.coachContext?.inputs || {});
  const recovery = getCoachRecoverySummary(state);
  const recentLogs = getRecentCoachLogs(state, 10).map(summarizeRecentCoachLog).join('\n') || 'No recent sessions.';
  const localForecastSummary = (localRoadmap?.programForecasts || []).map(forecast => {
    const program = getProgramById(state, forecast.programId);
    return `- ${program?.name || forecast.programId}: eta=${formatCoachDateRange(forecast.etaLowDate, forecast.etaHighDate)}; nextMilestone=${forecast.nextMilestone}; confidence=${forecast.confidence}; drift=${forecast.driftStatus}; notes=${forecast.forecastNotes}`;
  }).join('\n') || '- none';
  return `You are MIYAMOTO, generating a rolling 12-week coaching roadmap.

ATHLETE:
- Name: ${profile.name || 'Athlete'}
- Overall goal: ${profile.overallGoal || 'not set'}
- Persistent injuries: ${Object.entries(profile.injuries || {}).filter(([, flag]) => flag).map(([key]) => key).join(', ') || 'none'}
- Current readiness: ${readiness.score} (${readiness.band})
- Recovery target muscles: ${(recovery.targetMuscles || []).join(', ') || 'none'}

ACTIVE PROGRAMS:
${buildProgramsPrompt(state)}

PLACES:
${buildPlacesPrompt(state)}

RECENT LOGS:
${recentLogs}

LOCAL DRAFT ROADMAP:
${localForecastSummary}

REFORECAST REASON:
- ${reason}

RULES:
1. Keep the roadmap vague: weekly intent counts and phase focus, not exact exercise prescriptions.
2. Forecast with date ranges, not exact promises.
3. Respect injuries, readiness, recent adherence, and preferred places.
4. Return one forecast per active program id.
5. Return JSON only.

JSON SHAPE:
{
  "summary": "short roadmap summary",
  "driftStatus": "stable | watch | slipping",
  "programForecasts": [
    {
      "programId": "program id",
      "etaLowDate": "YYYY-MM-DD",
      "etaHighDate": "YYYY-MM-DD",
      "confidence": 72,
      "nextMilestone": "short milestone text",
      "forecastNotes": "why this forecast looks like this",
      "phaseBlocks": [
        { "label": "Build", "focus": "what matters in this block", "weeks": "1-4" }
      ],
      "weeklyIntents": [
        { "weekIndex": 1, "focus": "focus for that week", "targetSessions": 3 }
      ]
    }
  ],
  "roadmapChanges": [
    {
      "type": "program_note",
      "programId": "program id",
      "note": "coaching note",
      "reason": "why it changed"
    }
  ]
}`;
}

export function buildCoachPrescriptionPrompt(state, request, program, place) {
  const now = new Date();
  const profile = state.profile || {};
  const inputs = state.coachContext?.inputs || {};
  const readiness = state.coachContext?.readiness || calculateReadiness(inputs);
  const recovery = getCoachRecoverySummary(state);
  const recentLogs = getRecentCoachLogs(state, 6).map(summarizeRecentCoachLog).join('\n') || 'No recent sessions.';
  const equipment = getEffectivePlaceEquipment(place);
  const variantIntent = request.variant === 'desk_reset'
    ? 'desk_reset'
    : 'coach_session';
  const placeStatus = getAvailabilityLabel(place, now);
  const roadmapSnapshot = getRoadmapSnapshotForProgram(state, program?.id);

  return `You are MIYAMOTO, an autonomous AI fitness coach.

The app has NO fixed exercise library. You may generate new drills, workouts, and desk resets.
Your output must be structured, safe, equipment-aware, place-aware, and aligned with the stored roadmap when one exists.

ATHLETE:
- Name: ${profile.name || 'Athlete'}
- Age: ${profile.age || 'unknown'}
- Bodyweight: ${profile.bodyweight || 'unknown'}
- Overall goal: ${profile.overallGoal || 'not set'}
- Persistent injuries: ${Object.entries(profile.injuries || {}).filter(([, flag]) => flag).map(([key]) => key).join(', ') || 'none'}

CHECK-IN:
- Available minutes: ${inputs.availableMinutes || 45}
- Sleep: ${inputs.sleep}/10
- Stress: ${inputs.stress}/10
- Soreness: ${inputs.soreness}/10
- Motivation: ${inputs.motivation}/10
- Energy: ${inputs.energy}/10
- Pain areas: ${inputs.painAreas || 'none'}
- Stiffness areas: ${inputs.stiffnessAreas || 'none'}
- Sitting load today: ${inputs.sittingLoad || 'moderate'}
- Additional note: ${inputs.coachNote || 'none'}
- Readiness score: ${readiness.score} (${readiness.band})

RECOVERY MODEL:
- Fatigued muscles: ${(recovery.fatiguedMuscles || []).join(', ') || 'none'}
- Recovering muscles: ${(recovery.recoveringMuscles || []).join(', ') || 'none'}
- Current target muscles from pain/stiffness/recovery: ${(recovery.targetMuscles || []).join(', ') || 'none'}

ACTIVE PROGRAMS:
${buildProgramsPrompt(state)}

PLACES:
${buildPlacesPrompt(state, now)}

CURRENT REQUEST:
- Requested mode: ${variantIntent}
- Requested program: ${program?.name || 'general recovery'}
- Requested program goal: ${program?.goal || 'none'}
- Requested program target: ${program ? formatProgramTargetSummary(program) : 'none'}
- Selected place: ${place?.name || 'unknown'}
- Selected place availability status now: ${placeStatus}
- Effective equipment labels at selected place: ${equipment.map(item => item.label).join(', ') || 'bodyweight only'}
- Effective equipment keys at selected place: ${equipment.map(item => item.key).join(', ') || 'bodyweight'}

RECENT SESSION HISTORY:
${recentLogs}

ROADMAP SNAPSHOT:
${roadmapSnapshot
  ? `- Current phase: ${roadmapSnapshot.currentPhase?.label || 'none'}
- Current phase focus: ${roadmapSnapshot.currentPhase?.focus || 'none'}
- Next milestone: ${roadmapSnapshot.nextMilestone}
- ETA range: ${roadmapSnapshot.etaLabel}
- Weekly target: ${roadmapSnapshot.thisWeek?.targetSessions || 0}
- Weekly completed: ${roadmapSnapshot.thisWeek?.completedSessions || 0}
- Drift status: ${roadmapSnapshot.driftStatus}`
  : '- No stored roadmap yet. Use current readiness, recovery, and recent training to choose the next best intervention.'}

RULES:
1. Hard guardrails win. Do not prescribe movements that obviously conflict with injuries, pain areas, or missing equipment.
2. If the athlete requested a workout but recovery state suggests a reset is safer, you may return variant="desk_reset".
3. Desk resets must prioritize recovery muscles, stiffness, sitting load, and low-risk mobility / breathing / decompression.
4. Use only equipment whose keys exist at the selected place, unless the drill is clearly bodyweight/floor/wall/chair based.
5. If a roadmap exists, stay consistent with the current phase unless readiness/recovery clearly justify a compensatory session.
6. Return JSON only.

JSON SHAPE:
{
  "variant": "workout | desk_reset",
  "summary": "short headline",
  "rationale": "why this is the right intervention now",
  "recoveryIntent": "primary recovery focus",
  "tags": ["short", "tags"],
  "targetMuscles": ["quads", "glutes"],
  "contraindications": ["avoid painful spinal flexion"],
  "items": [
    {
      "name": "exercise or drill name",
      "instructions": "clear instructions in 1-3 sentences",
      "sets": 3,
      "reps": "8",
      "duration": "45s",
      "targetEffort": 6,
      "musclesPrimary": ["quads"],
      "musclesSecondary": ["core"],
      "equipmentNeeded": ["barbell", "rack"],
      "movementTags": ["squat", "strength"],
      "contraindications": ["skip if sharp knee pain"],
      "recoveryIntent": "reload | decompress | mobilize | prime",
      "placeSuitability": ["${place?.name || 'selected place'}"]
    }
  ]
}`;
}

export function buildCoachChatSystemPrompt(state, mode = 'json') {
  const profile = state.profile || {};
  const inputs = state.coachContext?.inputs || {};
  const readiness = state.coachContext?.readiness || calculateReadiness(inputs);
  const recovery = getCoachRecoverySummary(state);
  const recentLogs = getRecentCoachLogs(state, 6).map(summarizeRecentCoachLog).join('\n') || 'No recent sessions.';
  const currentFocus = summarizeCoachCurrentFocus(state);
  const base = `You are MIYAMOTO, an autonomous AI fitness coach inside a live app.

The live runtime model is:
- programs
- places
- equipment inventories
- availability overrides
- readiness and recovery state
- AI-generated workouts and desk resets

ATHLETE:
- Name: ${profile.name || 'Athlete'}
- Age: ${profile.age || 'unknown'}
- Bodyweight: ${profile.bodyweight || 'unknown'}
- Overall goal: ${profile.overallGoal || 'not set'}
- Persistent injuries: ${Object.entries(profile.injuries || {}).filter(([, flag]) => flag).map(([key]) => key).join(', ') || 'none'}

CHECK-IN:
- Available minutes: ${inputs.availableMinutes || 45}
- Sleep: ${inputs.sleep}/10
- Stress: ${inputs.stress}/10
- Soreness: ${inputs.soreness}/10
- Motivation: ${inputs.motivation}/10
- Energy: ${inputs.energy}/10
- Pain areas: ${inputs.painAreas || 'none'}
- Stiffness areas: ${inputs.stiffnessAreas || 'none'}
- Sitting load: ${inputs.sittingLoad || 'moderate'}
- Coach note: ${inputs.coachNote || 'none'}
- Readiness: ${readiness.score} (${readiness.band})

RECOVERY:
- Fatigued muscles: ${(recovery.fatiguedMuscles || []).join(', ') || 'none'}
- Recovering muscles: ${(recovery.recoveringMuscles || []).join(', ') || 'none'}
- Current target muscles: ${(recovery.targetMuscles || []).join(', ') || 'none'}

ACTIVE PROGRAMS:
${buildProgramsPrompt(state)}

PLACES:
${buildPlacesPrompt(state)}

CURRENT FOCUS:
${currentFocus}

RECENT LOGS:
${recentLogs}

ROADMAP:
${buildRoadmapSummaryPrompt(state)}

RULES:
1. Be concise, practical, and specific.
2. If the user asks for a workout or desk reset, do not generate the workout here. Emit a generate_session action instead.
3. If the user asks to change programs, preferred places, place availability, or place equipment, emit structured actions instead of only describing the change.
4. If the user asks about timeline, milestones, or progression, answer from the stored roadmap and recent drift state.
5. Use exact ids from the provided programs and places when possible.
6. If you are unsure which program or place the user means, ask a clarifying question and emit no actions.
7. Never emit actions that conflict with active injuries or obviously impossible equipment/place context.
8. Keep structural changes limited to what the user actually asked for.`;

  if (mode === 'text') {
    return `${base}

Reply in plain text only. Do not return JSON.`;
  }

  return `${base}

Return JSON only with this exact shape:
{
  "reply": "short conversational reply to the athlete",
  "actions": [
    {
      "type": "generate_session",
      "variant": "workout | desk_reset",
      "programId": "program id or omitted",
      "placeId": "place id or omitted"
    },
    {
      "type": "program_note",
      "programId": "program id",
      "note": "new coaching note",
      "reason": "why this should change"
    },
    {
      "type": "program_place_preferences",
      "programId": "program id",
      "preferredPlaceIds": ["place id", "place id"],
      "reason": "why the order should change"
    },
    {
      "type": "place_availability_override",
      "placeId": "place id",
      "value": "auto | available | unavailable",
      "reason": "why this should change"
    },
    {
      "type": "place_equipment_update",
      "placeId": "place id",
      "raw": "comma-separated equipment list",
      "reason": "why this should change"
    },
    {
      "type": "place_unavailable_equipment_update",
      "placeId": "place id",
      "raw": "comma-separated temporarily unavailable equipment list",
      "reason": "why this should change"
    }
  ]
}`;
}

export function buildCoachChatContents(state, userMessage, mode = 'json') {
  const history = (state?.coachChat?.messages || []).slice(-12).map(message => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.text }],
  }));
  return [
    { role: 'model', parts: [{ text: buildCoachChatSystemPrompt(state, mode) }] },
    ...history,
    { role: 'user', parts: [{ text: String(userMessage || '').trim() }] },
  ];
}
