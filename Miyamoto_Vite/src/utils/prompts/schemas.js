export function buildCoachPrescriptionSchema() {
    return {
      type: 'object',
      properties: {
        variant: { type: 'string', enum: ['workout', 'desk_reset'] },
        summary: { type: 'string' },
        rationale: { type: 'string' },
        recoveryIntent: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        targetMuscles: { type: 'array', items: { type: 'string' } },
        contraindications: { type: 'array', items: { type: 'string' } },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              instructions: { type: 'string' },
              sets: { type: 'integer' },
              reps: { type: 'string' },
              duration: { type: 'string' },
              targetEffort: { type: 'integer' },
              musclesPrimary: { type: 'array', items: { type: 'string' } },
              musclesSecondary: { type: 'array', items: { type: 'string' } },
              equipmentNeeded: { type: 'array', items: { type: 'string' } },
              movementTags: { type: 'array', items: { type: 'string' } },
              contraindications: { type: 'array', items: { type: 'string' } },
              recoveryIntent: { type: 'string' },
              placeSuitability: { type: 'array', items: { type: 'string' } }
            },
            required: ['name', 'instructions', 'targetEffort']
          }
        }
      },
      required: ['variant', 'summary', 'rationale', 'recoveryIntent', 'items']
    };
  }
  
  export function buildCoachRoadmapSchema() {
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        driftStatus: { type: 'string', enum: ['stable', 'watch', 'slipping'] },
        programForecasts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              programId: { type: 'string' },
              etaLowDate: { type: 'string' },
              etaHighDate: { type: 'string' },
              confidence: { type: 'integer' },
              nextMilestone: { type: 'string' },
              forecastNotes: { type: 'string' },
              phaseBlocks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    focus: { type: 'string' },
                    weeks: { type: 'string' }
                  },
                  required: ['label', 'focus', 'weeks']
                }
              },
              weeklyIntents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    weekIndex: { type: 'integer' },
                    focus: { type: 'string' },
                    targetSessions: { type: 'integer' }
                  },
                  required: ['weekIndex', 'focus', 'targetSessions']
                }
              }
            },
            required: ['programId', 'confidence', 'nextMilestone']
          }
        },
        roadmapChanges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['program_note'] },
              programId: { type: 'string' },
              note: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['type', 'programId', 'note']
          }
        }
      },
      required: ['driftStatus', 'programForecasts']
    };
  }
  
  export function buildCoachChatSchema() {
    return {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: [
                  'generate_session',
                  'program_note',
                  'program_place_preferences',
                  'place_availability_override',
                  'place_equipment_update',
                  'place_unavailable_equipment_update'
                ]
              },
              variant: { type: 'string' },
              programId: { type: 'string' },
              placeId: { type: 'string' },
              note: { type: 'string' },
              reason: { type: 'string' },
              preferredPlaceIds: { type: 'array', items: { type: 'string' } },
              value: { type: 'string' },
              raw: { type: 'string' }
            },
            required: ['type']
          }
        }
      },
      required: ['reply']
    };
  }
