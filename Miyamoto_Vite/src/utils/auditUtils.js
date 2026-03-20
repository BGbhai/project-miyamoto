import { createAuditEntry } from './factories';

export function appendAuditEntries(existing = [], newEntries = []) {
  if (!newEntries || newEntries.length === 0) return existing;
  return [...newEntries, ...existing].slice(0, 100);
}

export function logCoachAction(state, actionType, detail, source = 'system', reasonCode = 'unknown') {
  if (!state) return null;
  const entry = createAuditEntry({
    type: actionType,
    title: getAuditTitle(actionType),
    detail,
    source,
    reasonCode,
  });
  return appendAuditEntries(state.coachAuditLog || [], [entry]);
}

function getAuditTitle(type) {
  switch (type) {
    case 'program_note': return 'Program Note Updated';
    case 'program_place_preferences': return 'Program Priorities Updated';
    case 'place_availability_override': return 'Place Availability Changed';
    case 'place_equipment_update': return 'Equipment Inventory Updated';
    case 'place_unavailable_equipment_update': return 'Equipment Marked Unavailable';
    case 'workout_generated': return 'Workout Generated';
    case 'reset_generated': return 'Desk Reset Generated';
    case 'roadmap_refreshed': return 'Roadmap Refreshed';
    default: return 'System Event';
  }
}
