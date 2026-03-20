import React, { useState, useEffect } from 'react';
import {
  ViewHeader,
  SurfaceCard,
  StatPill,
  InlineBadge,
  CoachField,
  CoachInput,
  CoachTextarea,
  EmptyState,
  SegmentedTabs,
  cx
} from '../ui/core';
import { CoachModelStatusCard } from '../coach/SetupCards';
import {
  getCoachRecoverySummary,
  getCoachTrainingLogs,
  getCoachResetLogs,
  getProgramById,
} from '../../utils/workoutLogic';
import { clamp, toNum, toTitleCase, formatCoachDateRange } from '../../utils/helpers';

// ----------------------------------------------------
// Train View
// ----------------------------------------------------

export function CoachTrainView({ state, dispatch }) {
  const activeSession = state.activeSession;
  const [rpe, setRpe] = useState(6);
  const [recovery, setRecovery] = useState(6);
  const [energyLevel, setEnergyLevel] = useState(7);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setRpe(6);
    setRecovery(6);
    setEnergyLevel(7);
    setNotes('');
  }, [activeSession?.id, state.postSessionSummary?.id]);

  if (!activeSession) {
    if (state.postSessionSummary) {
      const summary = state.postSessionSummary;
      return (
        <SurfaceCard className="space-y-4" padding="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Session Logged</div>
          <div className="text-lg font-semibold text-neutral-100">{summary.title}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatPill label="Quality" value={`${summary.completionQuality}%`} tone="accent" />
            <StatPill label="Recovery" value={summary.recovery} />
            <StatPill label="Energy" value={summary.energyLevel} />
          </div>
          <div className="text-sm text-neutral-400">
            {summary.programName || 'Recovery'} · {summary.placeName || 'Unknown place'}
          </div>
          <button
            onClick={() => dispatch({ type: 'DISMISS_POST_SESSION_SUMMARY', payload: { view: 'today' } })}
            className="btn-accent w-full py-4 text-sm font-semibold uppercase tracking-[0.16em]"
          >
            Back to Today
          </button>
        </SurfaceCard>
      );
    }

    return (
      <EmptyState
        title="No Active Session"
        body="Generate a coached workout or desk reset from Today."
        actionLabel="Open Today"
        onAction={() => dispatch({ type: 'SET_VIEW', payload: 'today' })}
      />
    );
  }

  const completedCount = (activeSession.itemResults || []).filter(item => item.completed).length;
  const completionPct = activeSession.items?.length
    ? Math.round((completedCount / activeSession.items.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow={activeSession.countsTowardTraining ? 'Workout' : 'Reset'}
        title={activeSession.summary}
        subtitle={`${activeSession.programName || 'Coach'} · ${activeSession.placeName}`}
        actions={
          <button onClick={() => dispatch({ type: 'CANCEL_ACTIVE_SESSION' })} className="btn-ghost px-3 py-2 text-xs font-semibold uppercase">
            Cancel
          </button>
        }
      />

      <SurfaceCard tone={activeSession.source === 'safe_fallback' ? 'soft' : 'accent'} className="space-y-4" padding="p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <InlineBadge tone={activeSession.countsTowardTraining ? 'accent' : 'warn'}>
              {activeSession.variant === 'desk_reset' ? 'Desk Reset' : 'Coach Session'}
            </InlineBadge>
            <div className="text-xs text-neutral-500">{activeSession.placeName}</div>
          </div>
          <div className="text-sm text-neutral-300">{activeSession.rationale}</div>
        </div>
        {(activeSession.roadmapPhase || activeSession.roadmapNextMilestone) && (
          <div className="card-sharp p-3 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Roadmap Context</div>
            <div className="text-sm text-neutral-100">{activeSession.roadmapPhase || 'Current phase'}</div>
            <div className="text-sm text-neutral-400">{activeSession.roadmapPhaseFocus || activeSession.roadmapNextMilestone}</div>
            {activeSession.roadmapEtaLowDate && activeSession.roadmapEtaHighDate && (
              <div className="text-xs text-neutral-500">
                ETA {formatCoachDateRange(activeSession.roadmapEtaLowDate, activeSession.roadmapEtaHighDate)} · {activeSession.onPlanStatus || 'on_plan'}
              </div>
            )}
          </div>
        )}
        <div className="progress-bar w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="text-xs text-neutral-500">
          {completedCount}/{activeSession.items?.length || 0} items marked complete
        </div>
        <div className="flex flex-wrap gap-2">
          {(activeSession.tags || []).map(tag => <InlineBadge key={tag}>{tag}</InlineBadge>)}
        </div>
        {activeSession.placeEquipmentSnapshot?.length > 0 && (
          <div className="text-xs text-neutral-500">
            Equipment snapshot: {activeSession.placeEquipmentSnapshot.join(', ')}
          </div>
        )}
        {(activeSession.modelUsed || activeSession.usedFallbackMode) && (
          <div className="text-xs text-neutral-500">
            Model: {activeSession.modelUsed || 'unknown'}{activeSession.usedFallbackMode ? ' · fallback limits used' : ''}
          </div>
        )}
      </SurfaceCard>

      {(activeSession.contraindications || []).length > 0 && (
        <SurfaceCard className="space-y-2" padding="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Contraindications</div>
          <div className="text-sm text-yellow-200">{activeSession.contraindications.join(' · ')}</div>
        </SurfaceCard>
      )}

      {(activeSession.items || []).map(item => {
        const result = (activeSession.itemResults || []).find(entry => entry.itemId === item.id) || { completed: false, effort: item.targetEffort || 5, notes: '' };
        return (
          <SurfaceCard key={item.id} className="space-y-3" padding="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-base font-semibold text-neutral-100">{item.name}</div>
                <div className="text-sm text-neutral-400">{item.instructions}</div>
              </div>
              <button
                onClick={() => dispatch({ type: 'UPDATE_ACTIVE_SESSION_ITEM', payload: { itemId: item.id, patch: { completed: !result.completed } } })}
                className={cx('px-3 py-2 text-xs font-semibold uppercase rounded-lg border flex-shrink-0 transition-colors', result.completed ? 'accent-dim accent-border' : 'btn-ghost')}
              >
                {result.completed ? 'Done' : 'Mark'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.sets ? <InlineBadge tone="soft">{item.sets} sets</InlineBadge> : null}
              {item.reps ? <InlineBadge tone="soft">{item.reps}</InlineBadge> : null}
              {item.duration ? <InlineBadge tone="soft">{item.duration}</InlineBadge> : null}
              <InlineBadge tone="soft">Effort {item.targetEffort}</InlineBadge>
            </div>
            <div className="text-xs text-neutral-500">
              Targets: {[...(item.musclesPrimary || []), ...(item.musclesSecondary || [])].join(', ') || 'general'}
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Effort</div>
              <CoachInput
                type="number"
                min="1"
                max="10"
                value={result.effort}
                onChange={e => dispatch({ type: 'UPDATE_ACTIVE_SESSION_ITEM', payload: { itemId: item.id, patch: { effort: clamp(toNum(e.target.value, result.effort), 1, 10) } } })}
                className="py-1 px-2"
              />
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Notes</div>
              <CoachInput
                value={result.notes}
                onChange={e => dispatch({ type: 'UPDATE_ACTIVE_SESSION_ITEM', payload: { itemId: item.id, patch: { notes: e.target.value } } })}
                placeholder="What happened here?"
                className="py-1 px-2"
              />
            </div>
          </SurfaceCard>
        );
      })}

      <SurfaceCard className="space-y-4" padding="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Session Feedback</div>
        <div className="grid grid-cols-3 gap-3">
          <CoachField label="RPE">
            <CoachInput type="number" min="1" max="10" value={rpe} onChange={e => setRpe(clamp(toNum(e.target.value, rpe), 1, 10))} />
          </CoachField>
          <CoachField label="Recovery">
            <CoachInput type="number" min="1" max="10" value={recovery} onChange={e => setRecovery(clamp(toNum(e.target.value, recovery), 1, 10))} />
          </CoachField>
          <CoachField label="Energy">
            <CoachInput type="number" min="1" max="10" value={energyLevel} onChange={e => setEnergyLevel(clamp(toNum(e.target.value, energyLevel), 1, 10))} />
          </CoachField>
        </div>
        <CoachField label="Notes">
          <CoachTextarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Session summary for the coach" />
        </CoachField>
        <button
          onClick={() => dispatch({ type: 'COMPLETE_AI_SESSION', payload: { rpe, recovery, energyLevel, notes } })}
          className="btn-accent w-full py-4 text-sm font-semibold uppercase tracking-[0.16em]"
        >
          Complete Session
        </button>
      </SurfaceCard>
    </div>
  );
}

// ----------------------------------------------------
// Insights View
// ----------------------------------------------------

export function CoachInsightsView({ state }) {
  const trainingLogs = getCoachTrainingLogs(state);
  const resetLogs = getCoachResetLogs(state);
  const recovery = getCoachRecoverySummary(state);
  const forecasts = state.coachRoadmap?.programForecasts || [];

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Insights"
        title="Roadmap and coaching telemetry"
        subtitle="Forecasts, adherence drift, recovery state, and model reliability are summarized here."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Workouts" value={trainingLogs.length} tone="accent" />
        <StatPill label="Roadmap" value={toTitleCase(state.coachRoadmap?.driftStatus || 'stable')} />
        <StatPill label="Desk Resets" value={resetLogs.length} />
      </div>

      <SurfaceCard className="space-y-3" padding="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Recovery Model</div>
        <div className="text-sm text-neutral-300">Recovery score {recovery.recoveryScore}%</div>
        <div className="text-sm text-neutral-400">
          Fatigued: {(recovery.fatiguedMuscles || []).join(', ') || 'none'}
        </div>
        <div className="text-sm text-neutral-400">
          Recovering: {(recovery.recoveringMuscles || []).join(', ') || 'none'}
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3" padding="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Roadmap Summary</div>
        <div className="text-sm text-neutral-300">{state.coachRoadmap?.summary || 'No roadmap summary yet.'}</div>
        <div className="text-xs text-neutral-500">
          Last reforecast reason: {state.coachRoadmap?.lastReforecastReason || 'none'} · Updated {state.coachRoadmap?.updatedAt ? new Date(state.coachRoadmap.updatedAt).toLocaleString() : 'never'}
        </div>
      </SurfaceCard>

      {forecasts.length === 0 ? (
        <EmptyState title="No Roadmap Yet" body="Add program targets and let the coach generate a 12-week forecast." />
      ) : (
        forecasts.map(forecast => {
          const program = getProgramById(state, forecast.programId);
          return (
            <SurfaceCard key={forecast.programId} className="space-y-4" padding="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-neutral-100">{program?.name || 'Program'}</div>
                  <div className="text-sm text-neutral-400">{formatProgramTargetSummary(program)}</div>
                </div>
                <InlineBadge tone={forecast.driftStatus === 'stable' ? 'good' : forecast.driftStatus === 'watch' ? 'soft' : 'warn'}>
                  {forecast.driftStatus}
                </InlineBadge>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatPill label="ETA" value={formatCoachDateRange(forecast.etaLowDate, forecast.etaHighDate)} tone="accent" />
                <StatPill label="Confidence" value={`${forecast.confidence}%`} />
                <StatPill label="Adherence" value={`${forecast.adherenceScore || 100}%`} />
              </div>
              <div className="card-sharp p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Next Milestone</div>
                <div className="text-sm text-neutral-100">{forecast.nextMilestone}</div>
                <div className="text-sm text-neutral-400">{forecast.forecastNotes}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(forecast.phaseBlocks || []).map(block => (
                  <div key={block.id || block.label} className="card-sharp p-3 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{block.weeks}</div>
                    <div className="text-sm font-semibold text-neutral-100">{block.label}</div>
                    <div className="text-xs text-neutral-400">{block.focus}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Weekly Intents</div>
                {(forecast.weeklyIntents || []).slice(0, 4).map(week => (
                  <div key={`${forecast.programId}_${week.weekIndex}`} className="card-sharp p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-100">{week.label || `Week ${week.weekIndex}`}</div>
                      <div className="text-xs text-neutral-400">{week.focus}</div>
                    </div>
                    <InlineBadge tone={week.status === 'missed' ? 'warn' : week.status === 'done' || week.status === 'on_track' ? 'good' : 'soft'}>
                      {week.completedSessions || 0}/{week.targetSessions}
                    </InlineBadge>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          );
        })
      )}
      <CoachModelStatusCard state={state} />
    </div>
  );
}

// ----------------------------------------------------
// History View
// ----------------------------------------------------

export function CoachHistoryView({ state }) {
  const [filter, setFilter] = useState('all');
  const logs = [...(state.sessionLogs || [])].reverse().filter(log => {
    if (filter === 'training') return !!log.countsTowardTraining;
    if (filter === 'reset') return !log.countsTowardTraining;
    return true;
  });

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="History"
        title="Session history"
        subtitle="Every generated workout and desk reset is stored with place, tags, and recovery intent."
      />
      <SegmentedTabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'training', label: 'Training' },
          { id: 'reset', label: 'Desk Resets' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {logs.length === 0 ? (
        <EmptyState title="No History Yet" body="Complete a coached session or reset to populate history." />
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <SurfaceCard key={log.id} className="space-y-3" padding="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-neutral-100">{log.summary || (log.countsTowardTraining ? (log.programName || 'Workout') : 'Desk Reset')}</div>
                  <div className="text-xs text-neutral-500">
                    {log.programName || 'Recovery'} · {log.placeName || 'Unknown place'} · {new Date(log.completedAt).toLocaleString()}
                  </div>
                </div>
                <InlineBadge tone={log.countsTowardTraining ? 'accent' : 'warn'}>
                  {log.countsTowardTraining ? 'Training' : 'Reset'}
                </InlineBadge>
              </div>
              <div className="text-sm text-neutral-400">{log.recoveryIntent || log.rationale}</div>
              {(log.roadmapPhase || log.modelUsed) && (
                <div className="text-xs text-neutral-500">
                  {log.roadmapPhase ? `${log.roadmapPhase}` : 'No roadmap phase'}{log.modelUsed ? ` · ${log.modelUsed}${log.usedFallback ? ' fallback' : ''}` : ''}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(log.tags || []).map(tag => <InlineBadge key={tag}>{tag}</InlineBadge>)}
              </div>
              {(log.items || []).length > 0 && (
                <div className="text-xs text-neutral-500">
                  {(log.items || []).slice(0, 4).map(item => item.name).join(' · ')}
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
