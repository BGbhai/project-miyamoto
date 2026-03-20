import {
  callGeminiStructuredAcrossModels,
  buildStructuredRepairBody,
  parseGeminiJson,
  applyModelAttemptHistory
} from './gemini';
import {
  buildCoachPrescriptionSchema,
  buildCoachChatSchema,
  buildCoachRoadmapSchema
} from './prompts/schemas';
import {
  buildCoachPrescriptionPrompt,
  buildCoachChatSystemPrompt,
  buildCoachChatContents,
  buildCoachRoadmapPrompt
} from './prompts/builders';
import {
  getPlaceById,
  getActivePrograms,
  getProgramById,
  isPlaceAvailableNow,
  classifyCoachAIError,
  buildLocalRoadmapSourceSignature
} from './workoutLogic';
import { logCoachAction } from './auditUtils';
import { normalizeCoachPrescription } from './schemaNormalizers';

export async function runCoachGeneration(state, dispatch, request) {
  if (state.coachPlan.loading || !state.aiConfig?.enabled) return;

  dispatch({ type: 'COACH_REQUEST_START' });

  const program = getProgramById(state, request.programId)
    || getActivePrograms(state)[0]
    || { id: 'recovery_block', name: 'Recovery', goal: 'Decompress and prepare' };

  let place = getPlaceById(state, state.coachPlan.pendingPlaceResolution?.placeId);
  let requiresPlaceResolution = false;

  if (!place) {
    const preferredIds = program.preferredPlaceIds || [];
    for (const id of preferredIds) {
      const p = getPlaceById(state, id);
      if (p && isPlaceAvailableNow(p)) {
        place = p;
        break;
      }
    }
  }

  if (!place) {
    const allAvailable = state.places.items.filter(p => isPlaceAvailableNow(p));
    if (allAvailable.length === 1) {
      place = allAvailable[0];
    } else if (allAvailable.length > 1) {
      requiresPlaceResolution = true;
      dispatch({
        type: 'COACH_REQUIRE_PLACE_RESOLUTION',
        payload: {
          request,
          options: allAvailable.map(p => ({ id: p.id, name: p.name })),
        },
      });
      return;
    } else if (state.places.items.length > 0) {
      place = state.places.items[0];
    } else {
      place = { id: 'unknown', name: 'Unknown Place', equipmentNormalized: [] };
    }
  }

  try {
    const schema = buildCoachPrescriptionSchema();
    const resultContainer = await callGeminiStructuredAcrossModels({
      aiConfig: state.aiConfig,
      requestType: 'Coach Prescription',
      timeoutMs: 30000,
      buildPrimaryBody: () => ({
        contents: [{ parts: [{ text: buildCoachPrescriptionPrompt(state, request, program, place) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      buildRepairBody: (rawText) => buildStructuredRepairBody({
        schema,
        originalPrompt: 'Coach Prescription',
        rawText,
        requestLabel: 'workout prescription',
      }),
      parseResult: (rawText, sourceLabel) => {
        const parsed = parseGeminiJson(rawText, sourceLabel);
        return normalizeCoachPrescription(parsed, state, program, place, sourceLabel);
      },
    });

    const prescription = resultContainer.result;
    dispatch({
      type: 'COACH_REQUEST_SUCCESS',
      payload: {
        recommendation: {
          ...prescription,
          placeId: place.id,
          placeName: place.name,
          programId: program.id,
          programName: program.name,
          countsTowardTraining: prescription.variant !== 'desk_reset',
        },
      },
    });

    dispatch({
      type: 'UPDATE_AI_CONFIG',
      payload: applyModelAttemptHistory(state.aiConfig, resultContainer.attempts),
    });

  } catch (err) {
    console.error('Coach Generation Failed:', err);
    const { reason } = classifyCoachAIError(err);
    dispatch({ type: 'COACH_REQUEST_ERROR', payload: reason });
    if (err.modelAttempts) {
      dispatch({
        type: 'UPDATE_AI_CONFIG',
        payload: applyModelAttemptHistory(state.aiConfig, err.modelAttempts),
      });
    }
  }
}

export async function runCoachChatAI(state, dispatch, userMessage) {
  if (state.coachChat.loading || !state.aiConfig?.enabled || !userMessage.trim()) return;

  dispatch({ type: 'SET_COACH_CHAT_LOADING', payload: true });
  dispatch({ type: 'SET_COACH_CHAT_ERROR', payload: null });
  dispatch({ type: 'APPEND_COACH_CHAT_MESSAGE', payload: { role: 'user', text: userMessage } });

  try {
    const schema = buildCoachChatSchema();
    const resultContainer = await callGeminiStructuredAcrossModels({
      aiConfig: state.aiConfig,
      requestType: 'Coach Chat',
      timeoutMs: 20000,
      buildPrimaryBody: () => ({
        contents: buildCoachChatContents(state, userMessage, 'json'),
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      buildRepairBody: (rawText) => buildStructuredRepairBody({
        schema,
        originalPrompt: 'Coach Chat Action JSON',
        rawText,
        requestLabel: 'chat reply',
        maxOutputTokens: 1000,
      }),
      parseResult: (rawText, sourceLabel) => parseGeminiJson(rawText, sourceLabel),
    });

    const payloadRaw = resultContainer.result;
    const actions = Array.isArray(payloadRaw.actions) ? payloadRaw.actions : [];
    
    // Process structural actions (simplified for utility file extraction)
    // The actual component UI will handle dispatching these back to the reducer
    // We just return the parsed intent to the caller
    dispatch({
      type: 'APPEND_COACH_CHAT_MESSAGE',
      payload: { role: 'coach', text: payloadRaw.reply || 'Got it.', actionSummary: actions.length ? `Prepared ${actions.length} action(s).` : undefined },
    });

    // Handle Generation Action if present
    const genAction = actions.find(a => a.type === 'generate_session');
    if (genAction) {
       dispatch({
         type: 'PROCESS_COACH_PROPOSAL',
         payload: {
           type: 'generate_session',
           variant: genAction.variant === 'desk_reset' ? 'desk_reset' : 'workout',
           programId: genAction.programId || null,
           placeId: genAction.placeId || null,
         }
       });
    }
    
    dispatch({
      type: 'UPDATE_AI_CONFIG',
      payload: applyModelAttemptHistory(state.aiConfig, resultContainer.attempts),
    });

  } catch (err) {
    console.error('Coach Chat Failed:', err);
    const { reason } = classifyCoachAIError(err);
    dispatch({ type: 'SET_COACH_CHAT_ERROR', payload: reason });
    if (err.modelAttempts) {
      dispatch({
        type: 'UPDATE_AI_CONFIG',
        payload: applyModelAttemptHistory(state.aiConfig, err.modelAttempts),
      });
    }
  } finally {
    dispatch({ type: 'SET_COACH_CHAT_LOADING', payload: false });
  }
}

export async function runCoachRoadmapRefresh(state, dispatch, config = {}) {
  if (state.coachRoadmap?.loading || !state.aiConfig?.enabled) return;
  const { reason = 'periodic', localRoadmap, sourceSignature, aiRefreshSignature } = config;

  dispatch({ type: 'ROADMAP_REFRESH_START', payload: { reason, sourceSignature, aiRefreshSignature } });

  try {
    const schema = buildCoachRoadmapSchema();
    const resultContainer = await callGeminiStructuredAcrossModels({
      aiConfig: { ...state.aiConfig, model: state.aiConfig.planningModel || GEMINI_DEFAULT_MODEL },
      requestType: 'Roadmap Refresh',
      timeoutMs: 45000,
      buildPrimaryBody: () => ({
        contents: [{ parts: [{ text: buildCoachRoadmapPrompt(state, localRoadmap, reason) }] }],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      buildRepairBody: (rawText) => buildStructuredRepairBody({
        schema,
        originalPrompt: 'Roadmap JSON',
        rawText,
        requestLabel: '12-week roadmap forecast',
      }),
      parseResult: (rawText, sourceLabel) => parseGeminiJson(rawText, sourceLabel),
    });

    const roadmapData = resultContainer.result;
    
    dispatch({
      type: 'ROADMAP_REFRESH_SUCCESS',
      payload: {
        roadmapData,
        sourceSignature,
        aiRefreshSignature,
      },
    });

    dispatch({
      type: 'UPDATE_AI_CONFIG',
      payload: applyModelAttemptHistory(state.aiConfig, resultContainer.attempts),
    });

  } catch (err) {
    console.error('Roadmap Refresh Failed:', err);
    const { reason: errorReason } = classifyCoachAIError(err);
    dispatch({ type: 'ROADMAP_REFRESH_ERROR', payload: errorReason });
    if (err.modelAttempts) {
      dispatch({
        type: 'UPDATE_AI_CONFIG',
        payload: applyModelAttemptHistory(state.aiConfig, err.modelAttempts),
      });
    }
  }
}
