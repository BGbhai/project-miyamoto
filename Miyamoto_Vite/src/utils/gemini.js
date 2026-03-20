import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_ALLOWED_MODELS,
  GEMINI_RETRY_DELAYS_MS,
  COACH_MODEL_PRIORITY,
  MODEL_FAILURE_DEMOTION_WINDOW_MS
} from '../constants/config';
import { sleepMs, clamp } from './helpers';

export function buildGeminiEndpoint(modelId) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
}

export function buildGeminiStreamEndpoint(modelId) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse`;
}

export function normalizeGeminiModel(modelId) {
  const norm = String(modelId || '').trim().toLowerCase();
  if (GEMINI_ALLOWED_MODELS.includes(norm)) return norm;
  return GEMINI_DEFAULT_MODEL;
}

export function createGeminiParseError(failureType, rawTextSnippet, source, originalError = null) {
  const err = new Error(`AI returned invalid ${failureType}.`);
  err.isGeminiParseError = true;
  err.failureType = failureType;
  err.rawTextSnippet = String(rawTextSnippet || '').slice(0, 200);
  err.source = source || 'primary';
  err.originalError = originalError;
  return err;
}

export function sanitizeGeminiText(raw) {
  let cleaned = String(raw || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

export function parseGeminiJson(raw, failureLabel = 'JSON') {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw createGeminiParseError(failureLabel, raw, 'primary', err);
  }
}

export function getModelHealthEntry(aiConfig, model) {
  const health = aiConfig?.modelHealth || {};
  return health[model] || {
    successCount: 0,
    failureCount: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    inCooldownUntil: null,
  };
}

export function isModelHealthy(aiConfig, model, now = Date.now()) {
  const entry = getModelHealthEntry(aiConfig, model);
  if (entry.inCooldownUntil && now < entry.inCooldownUntil) {
    return false;
  }
  return true;
}

export function applyModelAttemptHistory(aiConfig, attempts = []) {
  if (!aiConfig || !attempts || !attempts.length) return aiConfig;
  const now = Date.now();
  const nextHealth = { ...(aiConfig.modelHealth || {}) };
  let newLastSuccessfulModel = aiConfig.lastSuccessfulModel || null;

  attempts.forEach(attempt => {
    const { model, success, errorText } = attempt;
    if (!model) return;
    const current = nextHealth[model] || {
      successCount: 0,
      failureCount: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      inCooldownUntil: null,
    };
    if (success) {
      newLastSuccessfulModel = model;
      nextHealth[model] = {
        ...current,
        successCount: current.successCount + 1,
      };
    } else {
      nextHealth[model] = {
        ...current,
        failureCount: current.failureCount + 1,
        lastFailureAt: now,
        lastFailureReason: String(errorText || 'Unknown error').slice(0, 100),
        inCooldownUntil: now + MODEL_FAILURE_DEMOTION_WINDOW_MS,
      };
    }
  });

  return {
    ...aiConfig,
    modelHealth: nextHealth,
    lastSuccessfulModel: newLastSuccessfulModel,
  };
}

export function normalizeModelRankings(rawRankings) {
  const validRankings = (Array.isArray(rawRankings) ? rawRankings : [])
    .filter(model => GEMINI_ALLOWED_MODELS.includes(model));
  if (validRankings.length === 0) {
    return GEMINI_ALLOWED_MODELS.slice().sort((a, b) => (COACH_MODEL_PRIORITY[b] || 0) - (COACH_MODEL_PRIORITY[a] || 0));
  }
  return validRankings;
}

export function getQualityRankedModelChain(aiConfig, primaryModelOverride) {
  const primary = primaryModelOverride || aiConfig?.model || GEMINI_DEFAULT_MODEL;
  const policy = aiConfig?.fallbackPolicy || 'best_other_available';
  const rankings = normalizeModelRankings(aiConfig?.modelRankings);
  const chain = [primary];
  if (policy === 'none') {
    return chain;
  }
  const orderedAvailable = rankings.filter(model => model !== primary);
  return [...chain, ...orderedAvailable];
}

export async function callGeminiApiWithRetry(config, buildBody, parseResult, requestType = 'AI request') {
  const { apiKey, model, endpoint, timeoutMs = 15000, retryDelaysMs = GEMINI_RETRY_DELAYS_MS, maxRetryAfterMs } = config;
  if (!apiKey) throw new Error(`${requestType} failed: No API key configured`);

  let lastError = null;
  const localDelays = [...(retryDelaysMs || [])];
  let attempt = 0;

  while (attempt <= localDelays.length) {
    attempt++;
    const isLastAttempt = attempt > localDelays.length;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-client': 'miyamoto-v6-web',
        },
        body: JSON.stringify(buildBody()),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429 && !isLastAttempt) {
        let retryAfterRaw = response.headers.get('Retry-After');
        let delayMs = localDelays[attempt - 1];
        if (retryAfterRaw) {
          const parsedDelayMs = parseInt(retryAfterRaw, 10) * 1000;
          if (!isNaN(parsedDelayMs) && parsedDelayMs > 0) {
            if (maxRetryAfterMs && parsedDelayMs > maxRetryAfterMs) {
               throw new Error(`${requestType} failed: Server requested too much wait time (${Math.round(parsedDelayMs / 1000)}s)`);
            }
            delayMs = Math.max(delayMs, parsedDelayMs);
          }
        }
        console.warn(`[${requestType}] Rate limited on attempt ${attempt}. Retrying in ${Math.round(delayMs / 1000)}s...`);
        lastError = new Error(`${requestType} failed: Rate limited (429)`);
        await sleepMs(delayMs);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`${requestType} failed with status ${response.status}: ${errText.slice(0, 100)}`);
        err.status = response.status;
        throw err;
      }

      const rawJson = await response.json();
      const rawText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`${requestType} failed: Missing generated text in API response.`);

      const parsed = parseResult(rawText);
      return parsed;

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error(`${requestType} failed: Request timed out at ${timeoutMs}ms`);
      } else {
        lastError = err;
      }

      if (!isLastAttempt && (!err.status || err.status >= 500 || err.status === 429)) {
        const delayMs = localDelays[attempt - 1];
        console.warn(`[${requestType}] Error on attempt ${attempt}: ${err.message}. Retrying in ${Math.round(delayMs / 1000)}s...`);
        await sleepMs(delayMs);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

export function buildStructuredRepairBody({ schema, originalPrompt, rawText, requestLabel, maxOutputTokens = 1500 }) {
  return {
    contents: [
      {
        parts: [
          { text: `You are MIYAMOTO's AI coach payload repair tool.` },
          { text: `The original prompt asked for a ${requestLabel} matching a specific JSON schema.` },
          { text: `The AI produced broken JSON or deviated from the strict structure. The raw output was:\n\n---\n${String(rawText || '').slice(0, 1500)}\n---\n\nFix it so it exactly matches the requested JSON structure. Do NOT wrap it in markdown block quotes. Return raw JSON.` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
}

export async function callGeminiStructuredAcrossModels(requestOptions) {
  const {
    aiConfig,
    requestType,
    buildPrimaryBody,
    buildRepairBody,
    parseResult,
    timeoutMs,
    retryDelaysMs,
    maxRetryAfterMs,
  } = requestOptions;

  const chain = getQualityRankedModelChain(aiConfig);
  let masterError = null;
  const attemptHistory = [];
  const now = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const currentModel = chain[i];
    if (!isModelHealthy(aiConfig, currentModel, now) && i < chain.length - 1) {
      console.log(`[${requestType}] Skipping ${currentModel} as it is marked unhealthy.`);
      continue;
    }

    try {
      console.log(`[${requestType}] Trying model: ${currentModel}`);
      const rawResult = await callGeminiApiWithRetry(
        {
          apiKey: aiConfig.apiKey,
          model: currentModel,
          endpoint: buildGeminiEndpoint(currentModel),
          timeoutMs,
          retryDelaysMs,
          maxRetryAfterMs,
        },
        buildPrimaryBody,
        (rawText) => ({ rawText, result: parseResult(rawText, 'primary') }),
        `${requestType} with ${currentModel}`
      );

      attemptHistory.push({ model: currentModel, success: true });
      return {
        result: rawResult.result,
        modelUsed: currentModel,
        usedFallback: i > 0,
        attempts: attemptHistory,
      };

    } catch (err) {
      attemptHistory.push({ model: currentModel, success: false, errorText: err.message });
      console.warn(`[${requestType}] Model ${currentModel} failed:`, err.message);

      if (err.isGeminiParseError && buildRepairBody) {
        try {
          console.log(`[${requestType}] Invoking self-repair on model: ${currentModel}`);
          const repaired = await callGeminiApiWithRetry(
            {
              apiKey: aiConfig.apiKey,
              model: currentModel,
              endpoint: buildGeminiEndpoint(currentModel),
              timeoutMs: Math.max(10000, Math.floor(timeoutMs * 0.6)),
              retryDelaysMs: [],
            },
            () => buildRepairBody(err.rawTextSnippet),
            (rawText) => parseResult(rawText, 'self_repair'),
            `Self-repair of ${requestType} with ${currentModel}`
          );
          
          attemptHistory.push({ model: currentModel, success: true, isRepair: true });
          return {
            result: repaired,
            modelUsed: currentModel,
            usedFallback: i > 0,
            attempts: attemptHistory,
          };
        } catch (repairErr) {
          attemptHistory.push({ model: currentModel, success: false, isRepair: true, errorText: repairErr.message });
          console.warn(`[${requestType}] Self-repair on model ${currentModel} failed:`, repairErr.message);
          masterError = repairErr;
        }
      } else {
        masterError = err;
      }
    }
  }

  if (masterError) {
    masterError.modelAttempts = attemptHistory;
    masterError.lastModelTried = chain[chain.length - 1];
  }
  throw masterError || new Error(`${requestType} failed: Exhausted fallback chain.`);
}

export async function callGeminiTextAcrossModels(requestOptions) {
  const {
    aiConfig,
    requestType,
    buildBody,
    timeoutMs,
    retryDelaysMs,
    maxRetryAfterMs,
  } = requestOptions;

  const chain = getQualityRankedModelChain(aiConfig);
  let masterError = null;
  const attemptHistory = [];
  const now = Date.now();

  for (let i = 0; i < chain.length; i++) {
    const currentModel = chain[i];
    if (!isModelHealthy(aiConfig, currentModel, now) && i < chain.length - 1) {
      console.log(`[${requestType}] Skipping ${currentModel} as it is marked unhealthy.`);
      continue;
    }

    try {
      console.log(`[${requestType}] Trying model: ${currentModel}`);
      const text = await callGeminiApiWithRetry(
        {
          apiKey: aiConfig.apiKey,
          model: currentModel,
          endpoint: buildGeminiEndpoint(currentModel),
          timeoutMs,
          retryDelaysMs,
          maxRetryAfterMs,
        },
        buildBody,
        (rawText) => sanitizeGeminiText(rawText),
        `${requestType} with ${currentModel}`
      );

      attemptHistory.push({ model: currentModel, success: true });
      return {
        text,
        modelUsed: currentModel,
        usedFallback: i > 0,
        attempts: attemptHistory,
      };

    } catch (err) {
      attemptHistory.push({ model: currentModel, success: false, errorText: err.message });
      console.warn(`[${requestType}] Model ${currentModel} failed:`, err.message);
      masterError = err;
    }
  }

  if (masterError) {
    masterError.modelAttempts = attemptHistory;
    masterError.lastModelTried = chain[chain.length - 1];
  }
  throw masterError || new Error(`${requestType} failed: Exhausted fallback chain.`);
}
