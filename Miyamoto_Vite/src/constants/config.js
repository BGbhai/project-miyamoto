// AI and Gemini Configuration Constants

export const GEMINI_ALLOWED_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash', 'gemini-flash-latest'];
export const GEMINI_DEFAULT_MODEL = 'gemini-3-flash-preview';
export const GEMINI_LEGACY_MODEL_MAP = {
  'gemini-1.5-flash': GEMINI_DEFAULT_MODEL,
  'gemini-1.5-pro': GEMINI_DEFAULT_MODEL,
  'gemini-2.0-flash': GEMINI_DEFAULT_MODEL,
};

export const COACH_MODEL_PRIORITY = {
  'gemini-3-flash-preview': 100,
  'gemini-2.5-flash': 95,
  'gemini-flash-latest': 90,
  'gemini-3.1-flash-lite-preview': 70,
};

// Retry, Cooldown, and Timeout Specs
export const GEMINI_RETRY_DELAYS_MS = [1500, 3000, 6000];
export const WEEKLY_SUMMARY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const AI_PLAN_REQUEST_TIMEOUT_MS = 25000;
export const AI_PLAN_COOLDOWN_MS = 15 * 60 * 1000;
export const AI_PLAN_RETRY_DELAYS_MS = [1000];
export const AI_PLAN_MAX_RETRY_AFTER_MS = 15000;
export const AI_PLAN_FRESHNESS_HOURS = 16;
export const MODEL_FAILURE_DEMOTION_WINDOW_MS = 30 * 60 * 1000;
export const AI_SESSION_RETRY_DELAYS_MS = [1000, 2500, 5000];
export const AI_ROADMAP_RETRY_DELAYS_MS = [1500, 3000, 6000];
export const ROADMAP_HORIZON_WEEKS = 12;
export const ROADMAP_AI_REFRESH_COOLDOWN_MS = 3 * 60 * 60 * 1000;

export const COACH_CHAT_MAX_OUTPUT_TOKENS = 1024;
export const COACH_CHAT_CONTINUATION_LIMIT = 2;
export const AI_PRIMARY_PLAN_SOURCES = new Set(['ai', 'ai_guardrail_corrected']);

// UI Configs
export const ACCENT_PRESETS = {
  ember: '#ef4444',
  cyan: '#06b6d4',
  lime: '#84cc16',
  amber: '#f59e0b',
};

// Data Store Keys
export const COACH_STORAGE_KEY = 'miyamoto_v6_ai_coach';
export const COACH_LEGACY_BACKUP_KEY = 'miyamoto_v6_legacy_backup';
export const LEGACY_STORAGE_KEY = 'miyamoto_v5_data'; // Inherited
export const COACH_STATE_VERSION = 7;

export const COACH_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const COACH_DAY_LABELS = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};
export const COACH_PLACE_OVERRIDE_OPTIONS = ['auto', 'available', 'unavailable'];
export const COACH_SITTING_LOAD_OPTIONS = ['light', 'moderate', 'heavy', 'marathon'];
export const COACH_FALLBACK_ALLOWED_EQUIPMENT = new Set(['bodyweight', 'none', 'floor', 'wall', 'chair', 'mat']);

export const COACH_EQUIPMENT_ALIAS_MAP = {
  dumbbells: 'dumbbell',
  'dumb bells': 'dumbbell',
  'dumb bell': 'dumbbell',
  kettlebells: 'kettlebell',
  barbells: 'barbell',
  'bar bell': 'barbell',
  'bar bells': 'barbell',
  'pullup bar': 'pull-up bar',
  'pull up bar': 'pull-up bar',
  'chinup bar': 'pull-up bar',
  'chin up bar': 'pull-up bar',
  bands: 'resistance band',
  band: 'resistance band',
  bench: 'bench',
  rack: 'rack',
  rings: 'gymnastic rings',
  'gym rings': 'gymnastic rings',
  'parallettes bars': 'parallettes',
  'parallel bars': 'parallettes',
  'heavy bag': 'heavy bag',
  mitts: 'focus mitts',
  pads: 'thai pads',
  treadmill: 'treadmill',
  bike: 'air bike',
};
