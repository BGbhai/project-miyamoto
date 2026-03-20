import React, { useState, useEffect } from 'react';
import {
  ViewHeader,
  SurfaceCard,
  StatPill,
  InlineBadge,
  CoachField,
  CoachSelect,
  CoachInput,
  CoachTextarea,
  EmptyState,
  SegmentedTabs,
  cx
} from '../ui/core';
import {
  CoachPendingPlaceCard,
  CoachRoadmapSnapshotCard,
  CoachRecommendationCard,
  CoachSetupPlaceCard,
  CoachProgramPreferenceEditor,
  CoachModelStatusCard
} from '../coach/SetupCards';
import {
  getProgramItems,
  getPlaceItems,
  getActivePrograms,
  isPlaceAvailableNow,
  getCoachRecoverySummary,
  getCoachTrainingLogs,
  getCoachResetLogs,
  getProgramById,
  getPlaceMap,
  calculateReadiness,
  getAvailabilityLabel,
  formatProgramTargetSummary
} from '../../utils/workoutLogic';
import { toTitleCase, clamp, toNum, downloadJsonFile } from '../../utils/helpers';
import { runCoachGeneration } from '../../utils/aiOrchestrator';
import { COACH_SITTING_LOAD_OPTIONS, GEMINI_ALLOWED_MODELS, COACH_LEGACY_BACKUP_KEY } from '../../constants/config';
import { getQualityRankedModelChain } from '../../utils/gemini';

// ----------------------------------------------------
// Today View
// ----------------------------------------------------

export function CoachTodayView({ state, dispatch }) {
  const activePrograms = getActivePrograms(state);
  const [selectedProgramId, setSelectedProgramId] = useState(activePrograms[0]?.id || '');
  const availablePlaces = getPlaceItems(state).filter(place => isPlaceAvailableNow(place));
  const recovery = getCoachRecoverySummary(state);
  const trainingLogs = getCoachTrainingLogs(state);
  const resetLogs = getCoachResetLogs(state);
  const placeMap = getPlaceMap(state);

  useEffect(() => {
    if (!activePrograms.some(program => program.id === selectedProgramId)) {
      setSelectedProgramId(activePrograms[0]?.id || '');
    }
  }, [activePrograms.length, selectedProgramId, state.programs.updatedAt]);

  const selectedProgram = selectedProgramId ? getProgramById(state, selectedProgramId) : null;
  const pendingPlaceResolution = state.coachPlan?.pendingPlaceResolution || null;
  const readiness = state.coachContext?.readiness || calculateReadiness(state.coachContext?.inputs || {});

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Today"
        title="AI Coach"
        subtitle="Daily sessions adapt to your readiness, while the roadmap tracks milestones, ETA windows, and drift."
        actions={(
          <div className="flex gap-2">
            {state.activeSession && (
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'train' })}
                className="btn-ghost px-3 py-2 text-xs font-semibold uppercase"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'chat' })}
              className="btn-ghost px-3 py-2 text-xs font-semibold uppercase"
            >
              Ask Coach
            </button>
          </div>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Readiness" value={`${readiness.score}`} tone="accent" />
        <StatPill label="Roadmap" value={toTitleCase(state.coachRoadmap?.driftStatus || 'stable')} />
        <StatPill label="Desk Resets" value={resetLogs.length} />
      </div>

      <SurfaceCard className="space-y-4" padding="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Daily Check-In</div>
            <div className="text-sm text-neutral-400 mt-1">The coach uses this to choose between a full session and a reset.</div>
          </div>
          <InlineBadge tone={readiness.band === 'high' ? 'good' : readiness.band === 'low' ? 'warn' : 'soft'}>
            {readiness.band}
          </InlineBadge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
             ['sleep', 'Sleep'],
             ['stress', 'Stress'],
             ['soreness', 'Soreness'],
             ['motivation', 'Motivation'],
             ['energy', 'Energy'],
           ].map(([field, label]) => (
            <CoachField key={field} label={label}>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>{label}</span>
                  <span>{state.coachContext.inputs[field]}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={state.coachContext.inputs[field]}
                  onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field, value: Number(e.target.value) } })}
                  className="w-full accent-red-500 bg-neutral-800 rounded-lg appearance-none h-2 cursor-pointer"
                />
              </div>
            </CoachField>
          ))}
          <CoachField label="Sitting Load">
            <CoachSelect
              value={state.coachContext.inputs.sittingLoad}
              onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field: 'sittingLoad', value: e.target.value } })}
            >
              {COACH_SITTING_LOAD_OPTIONS.map(option => (
                <option key={option} value={option}>{toTitleCase(option)}</option>
              ))}
            </CoachSelect>
          </CoachField>
          <CoachField label="Available Minutes">
            <CoachInput
              type="number"
              min="5"
              max="240"
              value={state.coachContext.inputs.availableMinutes}
              onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field: 'availableMinutes', value: e.target.value } })}
            />
          </CoachField>
        </div>
        <div className="grid gap-3">
          <CoachField label="Pain Areas">
            <CoachInput
              value={state.coachContext.inputs.painAreas}
              onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field: 'painAreas', value: e.target.value } })}
              placeholder="knee, lower back, shoulder"
            />
          </CoachField>
          <CoachField label="Stiffness Areas">
            <CoachInput
              value={state.coachContext.inputs.stiffnessAreas}
              onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field: 'stiffnessAreas', value: e.target.value } })}
              placeholder="hips, thoracic spine, calves"
            />
          </CoachField>
          <CoachField label="Extra Note">
            <CoachTextarea
              rows={2}
              value={state.coachContext.inputs.coachNote}
              onChange={e => dispatch({ type: 'UPDATE_COACH_INPUT', payload: { field: 'coachNote', value: e.target.value } })}
              placeholder="Short context for the coach"
            />
          </CoachField>
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3" padding="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Places Right Now</div>
        <div className="flex flex-wrap gap-2">
          {getPlaceItems(state).map(place => (
            <InlineBadge key={place.id} tone={isPlaceAvailableNow(place) ? 'good' : 'soft'}>
              {place.name} · {getAvailabilityLabel(place)}
            </InlineBadge>
          ))}
        </div>
        {availablePlaces.length > 0 && (
          <div className="text-sm text-neutral-400">
            Available now: {availablePlaces.map(place => place.name).join(', ')}.
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard tone="accent" className="space-y-4" padding="p-5">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Coach Generation</div>
          <div className="text-sm text-neutral-400">
            The coach adapts each session to your selected place, equipment inventory, and current readiness.
          </div>
        </div>
        {activePrograms.length === 0 ? (
          <EmptyState
            title="No Programs"
            body="Add at least one program in Settings before generating a coached workout."
            actionLabel="Open Settings"
            onAction={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
          />
        ) : (
          <>
            <CoachField label="Program">
              <CoachSelect value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)}>
                {activePrograms.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </CoachSelect>
            </CoachField>
            {selectedProgram && (
              <div className="card-sharp p-3 space-y-2">
                <div className="text-sm font-semibold text-neutral-100">{selectedProgram.goal}</div>
                <div className="text-xs text-neutral-500">{programSummaryFromProgram(selectedProgram, placeMap)}</div>
                <div className="text-xs text-neutral-400">{formatProgramTargetSummary(selectedProgram)}</div>
                {selectedProgram.coachingNotes && <div className="text-xs text-neutral-400">{selectedProgram.coachingNotes}</div>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runCoachGeneration(state, dispatch, { variant: 'workout', programId: selectedProgramId || null })}
                className="btn-accent py-4 text-sm font-semibold uppercase tracking-[0.16em]"
                disabled={state.coachPlan.loading || !selectedProgramId}
              >
                {state.coachPlan.loading ? 'Generating...' : 'Coach Workout'}
              </button>
              <button
                onClick={() => runCoachGeneration(state, dispatch, { variant: 'desk_reset', programId: selectedProgramId || null })}
                className="btn-ghost py-4 text-sm font-semibold uppercase tracking-[0.16em]"
                disabled={state.coachPlan.loading}
              >
                Desk Reset
              </button>
            </div>
            {state.coachPlan.error && (
              <div className="text-sm text-red-400">{state.coachPlan.error}</div>
            )}
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'chat' })}
              className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
            >
              Ask Coach Instead
            </button>
          </>
        )}
      </SurfaceCard>

      {pendingPlaceResolution && <CoachPendingPlaceCard state={state} dispatch={dispatch} />}

      <CoachRoadmapSnapshotCard state={state} dispatch={dispatch} programId={selectedProgramId || null} />

      <CoachRecommendationCard recommendation={state.coachPlan.recommendation} dispatch={dispatch} />

      {state.coachRoadmap?.error && (
        <SurfaceCard className="space-y-2" padding="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Roadmap Refresh</div>
          <div className="text-sm text-yellow-200">{state.coachRoadmap.error}</div>
        </SurfaceCard>
      )}

      <SurfaceCard className="space-y-4" padding="p-5">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Coach Feed</div>
          <div className="text-lg font-semibold text-neutral-100">What the coach changed</div>
          <div className="text-sm text-neutral-400">Automatic place or program changes are logged here.</div>
        </div>
        <div className="space-y-2">
          {state.coachAuditLog.length === 0 ? (
            <div className="text-sm text-neutral-500">No coach changes logged yet.</div>
          ) : (
            state.coachAuditLog.slice(0, 5).map(entry => (
              <div key={entry.id} className="card-sharp p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-100">{entry.title}</div>
                  <InlineBadge tone={entry.source === 'user' ? 'soft' : 'accent'}>{entry.source}</InlineBadge>
                </div>
                <div className="text-sm text-neutral-400">{entry.detail}</div>
                <div className="text-[11px] text-neutral-500">{new Date(entry.at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3" padding="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Recovery Snapshot</div>
        <div className="text-sm text-neutral-400">
          Target muscles right now: {recovery.targetMuscles.join(', ') || 'none'}. Recovery score {recovery.recoveryScore}%.
        </div>
      </SurfaceCard>
    </div>
  );
}

function programSummaryFromProgram(program, placeMap) {
    if (!program) return 'No program selected';
    const placeNames = (program.preferredPlaceIds || []).map(id => placeMap[id]?.name || id).join(', ') || 'None';
    return `Priority Places: ${placeNames}`;
}

// ----------------------------------------------------
// Programs Section (Settings)
// ----------------------------------------------------

export function CoachProgramsSection({ state, dispatch }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [targetType, setTargetType] = useState('level');
  const [currentLevel, setCurrentLevel] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [weeklyTargetSessions, setWeeklyTargetSessions] = useState(3);
  return (
    <div className="space-y-4">
      <SurfaceCard className="space-y-3" padding="p-4">
        <CoachField label="New Program Name">
          <CoachInput value={name} onChange={e => setName(e.target.value)} placeholder="Strength" />
        </CoachField>
        <CoachField label="New Program Goal">
          <CoachInput value={goal} onChange={e => setGoal(e.target.value)} placeholder="Build strength and power" />
        </CoachField>
        <div className="grid grid-cols-2 gap-3">
          <CoachField label="Target Type">
            <CoachSelect value={targetType} onChange={e => setTargetType(e.target.value)}>
              <option value="level">Level</option>
              <option value="milestone">Milestone</option>
            </CoachSelect>
          </CoachField>
          <CoachField label="Weekly Target Sessions">
            <CoachInput type="number" min="1" max="14" value={weeklyTargetSessions} onChange={e => setWeeklyTargetSessions(clamp(toNum(e.target.value, weeklyTargetSessions), 1, 14))} />
          </CoachField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CoachField label="Current Level">
            <CoachInput value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} placeholder="Level 2" />
          </CoachField>
          <CoachField label="Target Level">
            <CoachInput value={targetLevel} onChange={e => setTargetLevel(e.target.value)} placeholder="Level 5" />
          </CoachField>
        </div>
        <CoachField label="Success Criteria">
          <CoachTextarea rows={2} value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} placeholder="Example: 5 clean pull-ups at bodyweight + 20kg" />
        </CoachField>
        <button
          onClick={() => {
            const trimmedName = name.trim();
            const trimmedGoal = goal.trim();
            if (!trimmedName || !trimmedGoal) return;
            dispatch({
              type: 'ADD_PROGRAM',
              payload: {
                name: trimmedName,
                goal: trimmedGoal,
                targetType,
                currentLevel,
                targetLevel,
                successCriteria,
                weeklyTargetSessions,
              },
            });
            setName('');
            setGoal('');
            setTargetType('level');
            setCurrentLevel('');
            setTargetLevel('');
            setSuccessCriteria('');
            setWeeklyTargetSessions(3);
          }}
          className="btn-accent w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          Add Program
        </button>
      </SurfaceCard>
      
      {getProgramItems(state).length === 0 ? (
        <EmptyState title="No Programs" body="Programs are your coaching tracks. Add one to get started." />
      ) : (
        getProgramItems(state).map(program => (
          <SurfaceCard key={program.id} className="space-y-4" padding="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-neutral-100">{program.name || 'Unnamed program'}</div>
                <div className="text-xs text-neutral-500">{program.goal || 'No goal set'}</div>
                <div className="text-xs text-neutral-400">{formatProgramTargetSummary(program)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_PROGRAM', payload: { id: program.id } })}
                  className={cx('px-3 py-2 text-[11px] font-semibold uppercase rounded-lg border', program.active ? 'accent-dim accent-border' : 'btn-ghost')}
                >
                  {program.active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => dispatch({ type: 'DELETE_PROGRAM', payload: { id: program.id } })}
                  className="btn-ghost px-3 py-2 text-[11px] font-semibold uppercase"
                >
                  Remove
                </button>
              </div>
            </div>
            <CoachField label="Program Name">
              <CoachInput value={program.name} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { name: e.target.value } } })} />
            </CoachField>
            <CoachField label="Goal">
              <CoachTextarea rows={2} value={program.goal} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { goal: e.target.value } } })} />
            </CoachField>
            <div className="grid grid-cols-2 gap-3">
              <CoachField label="Target Type">
                <CoachSelect value={program.targetType} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { targetType: e.target.value } } })}>
                  <option value="level">Level</option>
                  <option value="milestone">Milestone</option>
                </CoachSelect>
              </CoachField>
              <CoachField label="Weekly Target Sessions">
                <CoachInput type="number" min="1" max="14" value={program.weeklyTargetSessions} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { weeklyTargetSessions: clamp(toNum(e.target.value, program.weeklyTargetSessions), 1, 14) } } })} />
              </CoachField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CoachField label="Current Level">
                <CoachInput value={program.currentLevel} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { currentLevel: e.target.value } } })} />
              </CoachField>
              <CoachField label="Target Level">
                <CoachInput value={program.targetLevel} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { targetLevel: e.target.value } } })} />
              </CoachField>
            </div>
            <CoachField label="Success Criteria">
              <CoachTextarea rows={2} value={program.successCriteria} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { successCriteria: e.target.value } } })} />
            </CoachField>
            <CoachField label="Coach Notes">
              <CoachTextarea rows={2} value={program.coachingNotes} onChange={e => dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { coachingNotes: e.target.value } } })} />
            </CoachField>
            <CoachField label="Preferred Places">
              <CoachProgramPreferenceEditor program={program} state={state} dispatch={dispatch} />
            </CoachField>
          </SurfaceCard>
        ))
      )}
    </div>
  );
}

// ----------------------------------------------------
// Places Section (Settings)
// ----------------------------------------------------

export function CoachPlacesSection({ state, dispatch }) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-4">
      <SurfaceCard className="space-y-3" padding="p-4">
        <CoachField label="New Place Name">
          <CoachInput value={name} onChange={e => setName(e.target.value)} placeholder="Gym" />
        </CoachField>
        <button
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            dispatch({ type: 'ADD_PLACE', payload: { name: trimmed } });
            setName('');
          }}
          className="btn-accent w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          Add Place
        </button>
      </SurfaceCard>
      {getPlaceItems(state).length === 0 ? (
        <EmptyState title="No Places" body="Places define where you can train and what equipment exists there." />
      ) : (
        getPlaceItems(state).map(place => (
          <CoachSetupPlaceCard key={place.id} place={place} dispatch={dispatch} />
        ))
      )}
    </div>
  );
}

// ----------------------------------------------------
// System Section (Settings)
// ----------------------------------------------------

export function CoachSystemSection({ state, dispatch }) {
  const [resetConfirm, setResetConfirm] = useState(false);
  
  const exportLegacyBackup = () => {
    try {
      const raw = localStorage.getItem(COACH_LEGACY_BACKUP_KEY);
      if (!raw) return;
      downloadJsonFile(`miyamoto_legacy_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.parse(raw));
    } catch (err) {
      console.warn('Legacy backup export failed:', err?.message || err);
    }
  };

  return (
    <div className="space-y-4">
      <SurfaceCard className="space-y-4" padding="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">AI Coach</div>
        <label className="flex items-center justify-between gap-3 text-sm text-neutral-300">
          <span>Enable AI coach</span>
          <input
            type="checkbox"
            checked={!!state.aiConfig.enabled}
            onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: { enabled: e.target.checked } })}
          />
        </label>
        <CoachField label="Gemini API Key">
          <CoachInput
            type="password"
            value={state.aiConfig.apiKey}
            onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: { apiKey: e.target.value } })}
            placeholder="AIza..."
          />
        </CoachField>
        <CoachField label="Model">
          <CoachSelect
            value={state.aiConfig.model}
            onChange={e => dispatch({ type: 'UPDATE_AI_CONFIG', payload: { model: e.target.value } })}
          >
            {GEMINI_ALLOWED_MODELS.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </CoachSelect>
        </CoachField>
        <CoachField label="Fallback Policy">
          <div className="card-sharp p-3 text-sm text-neutral-300">
            {state.aiConfig.fallbackPolicy || 'best_other_available'}
          </div>
        </CoachField>
        <CoachField label="Fallback Order">
          <div className="card-sharp p-3 text-sm text-neutral-300">
            {getQualityRankedModelChain(state.aiConfig, state.aiConfig.model).join(' -> ')}
          </div>
        </CoachField>
      </SurfaceCard>

      <CoachModelStatusCard state={state} />

      <SurfaceCard className="space-y-3" padding="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Backups</div>
        <button
          onClick={() => downloadJsonFile(`miyamoto_coach_${new Date().toISOString().slice(0, 10)}.json`, state)}
          className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          Export Current Coach State
        </button>
        <button
          onClick={exportLegacyBackup}
          disabled={!state.legacyBackupMeta?.available}
          className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
        >
          Export Legacy Backup
        </button>
        <div className="text-xs text-neutral-500">
          Legacy backup: {state.legacyBackupMeta?.available ? `captured ${state.legacyBackupMeta.capturedAt || 'earlier'}` : 'not available'}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3" padding="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Diagnostics</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <StatPill label="Programs" value={getProgramItems(state).length} tone="accent" />
          <StatPill label="Places" value={getPlaceItems(state).length} />
          <StatPill label="Logs" value={state.sessionLogs.length} />
          <StatPill label="Version" value={state.version} />
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3" padding="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Reset</div>
        {resetConfirm ? (
          <div className="space-y-3">
            <div className="text-sm text-neutral-400">
              This clears the current coach state but keeps any legacy backup export.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResetConfirm(false)} className="btn-ghost flex-1 py-3 text-xs font-semibold uppercase">Cancel</button>
              <button onClick={() => { dispatch({ type: 'RESET_COACH_STATE' }); setResetConfirm(false); }} className="btn-accent flex-1 py-3 text-xs font-semibold uppercase">Reset Coach</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setResetConfirm(true)} className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]">
            Reset Current Coach State
          </button>
        )}
      </SurfaceCard>
    </div>
  );
}

// ----------------------------------------------------
// Settings View
// ----------------------------------------------------

export function CoachSettingsView({ state, dispatch }) {
  const [tab, setTab] = useState('profile');
  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Settings"
        title="Programs, places, and system"
        subtitle="The runtime model is programs + places + equipment + AI-generated coaching."
      />

      <SegmentedTabs
        tabs={[
          { id: 'profile', label: 'Profile' },
          { id: 'programs', label: 'Programs' },
          { id: 'places', label: 'Places' },
          { id: 'system', label: 'System' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <SurfaceCard className="space-y-4" padding="p-5">
          <CoachField label="Name">
            <CoachInput value={state.profile.name} onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'name', value: e.target.value } })} />
          </CoachField>
          <div className="grid grid-cols-2 gap-3">
            <CoachField label="Age">
              <CoachInput type="number" value={state.profile.age} onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'age', value: e.target.value } })} />
            </CoachField>
            <CoachField label="Bodyweight (kg)">
              <CoachInput type="number" value={state.profile.bodyweight} onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'bodyweight', value: e.target.value } })} />
            </CoachField>
          </div>
          <CoachField label="Overall Goal">
            <CoachTextarea rows={3} value={state.profile.overallGoal} onChange={e => dispatch({ type: 'UPDATE_PROFILE_FIELD', payload: { field: 'overallGoal', value: e.target.value } })} />
          </CoachField>
          <CoachField label="Persistent Injury Flags">
            <div className="flex flex-wrap gap-2">
              {Object.keys(state.profile.injuries || {}).map(key => (
                <button
                  key={key}
                  onClick={() => dispatch({ type: 'TOGGLE_PROFILE_INJURY', payload: { key } })}
                  className={cx('px-3 py-2 text-xs font-semibold uppercase rounded-lg border', state.profile.injuries[key] ? 'accent-dim accent-border' : 'btn-ghost')}
                >
                  {key}
                </button>
              ))}
            </div>
          </CoachField>
        </SurfaceCard>
      )}

      {tab === 'programs' && <CoachProgramsSection state={state} dispatch={dispatch} />}
      {tab === 'places' && <CoachPlacesSection state={state} dispatch={dispatch} />}
      {tab === 'system' && <CoachSystemSection state={state} dispatch={dispatch} />}
    </div>
  );
}
