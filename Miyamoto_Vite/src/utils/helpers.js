export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function slugify(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function cx(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

export function toTitleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isClockValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ''));
}

export function isValidWindow(windowLike) {
  if (!windowLike) return false;
  const start = String(windowLike.start || '');
  const end = String(windowLike.end || '');
  return isClockValue(start) && isClockValue(end) && start < end;
}

export function formatAvailabilityWindows(windows = []) {
  return (windows || []).map(windowLike => `${windowLike.start}-${windowLike.end}`).join(', ');
}

export function parseAvailabilityInput(text) {
  return String(text || '')
    .split(',')
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const match = chunk.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
      if (!match) return null;
      return { start: match[1], end: match[2] };
    })
    .filter(isValidWindow)
    .slice(0, 6);
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toISODateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatCoachDateRange(lowDate, highDate) {
  if (!lowDate && !highDate) return 'No forecast yet';
  const low = lowDate ? new Date(lowDate).toLocaleDateString() : 'now';
  const high = highDate ? new Date(highDate).toLocaleDateString() : low;
  return low === high ? low : `${low} - ${high}`;
}

export function moveItem(array = [], from, to) {
  const next = [...array];
  const [removed] = next.splice(from, 1);
  if (!removed) return array;
  next.splice(to, 0, removed);
  return next;
}

export function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function downloadJsonFile(filename, dataObj) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", filename);
  dlAnchorElem.click();
}

export function buildRoadmapRefreshReason(state, currentRoadmap) {
  if (!currentRoadmap) return 'initial_generation';
  const now = Date.now();
  if (now - new Date(currentRoadmap.updatedAt || 0).getTime() > 7 * 24 * 60 * 60 * 1000) return 'weekly_refresh';
  
  if (state.programs?.updatedAt && state.programs.updatedAt > (currentRoadmap.sourceSignatureUpdatedAt || '')) {
      return 'program_changed';
  }
  return 'periodic';
}
