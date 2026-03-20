import React, { useState } from 'react';
import {
  SurfaceCard,
  CoachField,
  CoachInput,
  CoachTextarea,
  InlineBadge,
  cx
} from '../ui/core';
import { toTitleCase, formatCoachDateRange } from '../../utils/helpers';
import { getEffectivePlaceEquipment, isPlaceAvailableNow, getAvailabilityLabel } from '../../utils/workoutLogic';
import { getModelHealthEntry } from '../../utils/gemini';

// ----------------------------------------------------
// Coach Model Status Card
// ----------------------------------------------------

export function CoachModelStatusCard({ state }) {
  const model = state.aiConfig?.model || 'unknown';
  const health = getModelHealthEntry(state.aiConfig, model);
  const isCooldown = health.inCooldownUntil && Date.now() < health.inCooldownUntil;

  return (
    <SurfaceCard padding="p-4" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Model Status</div>
        <InlineBadge tone={isCooldown ? 'warn' : 'good'}>{isCooldown ? 'Cooldown' : 'Active'}</InlineBadge>
      </div>
      <div className="text-sm font-semibold text-neutral-100">{model}</div>
      <div className="text-xs text-neutral-500">
        Success: {health.successCount} · Failed: {health.failureCount}
      </div>
      {health.lastFailureAt && (
        <div className="text-[11px] text-neutral-500">
          Last error ({new Date(health.lastFailureAt).toLocaleTimeString()}): {health.lastFailureReason}
        </div>
      )}
      {isCooldown && (
        <div className="text-xs text-yellow-500 font-semibold mt-1">
          Temp demoted until {new Date(health.inCooldownUntil).toLocaleTimeString()}
        </div>
      )}
    </SurfaceCard>
  );
}

// ----------------------------------------------------
// Setup Place Card
// ----------------------------------------------------

export function CoachSetupPlaceCard({ place, dispatch }) {
  const effectiveEquipment = getEffectivePlaceEquipment(place);
  const isAvailable = isPlaceAvailableNow(place);

  return (
    <SurfaceCard className="space-y-4" padding="p-4" tone={isAvailable ? 'base' : 'dimmed'}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-neutral-100">{place.name || 'Unnamed place'}</div>
          <div className="text-xs text-neutral-500">{getAvailabilityLabel(place)}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({
              type: 'UPDATE_PLACE',
              payload: { id: place.id, patch: { availabilityOverride: place.availabilityOverride === 'auto' ? 'unavailable' : 'auto' } }
            })}
            className={cx('px-3 py-2 text-[11px] font-semibold uppercase rounded-lg border', place.availabilityOverride === 'unavailable' ? 'accent-dim accent-border' : 'btn-ghost')}
          >
            {place.availabilityOverride === 'unavailable' ? 'Blocked' : 'Block'}
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_PLACE', payload: { id: place.id } })}
            className="btn-ghost px-3 py-2 text-[11px] font-semibold uppercase"
          >
            Remove
          </button>
        </div>
      </div>

      <CoachField label="Place Name">
        <CoachInput
          value={place.name}
          onChange={e => dispatch({ type: 'UPDATE_PLACE', payload: { id: place.id, patch: { name: e.target.value } } })}
        />
      </CoachField>

      <CoachField label="Equipment Inventory (comma separated)">
        <CoachTextarea
          rows={2}
          value={place.equipmentRaw}
          onChange={e => dispatch({ type: 'UPDATE_PLACE', payload: { id: place.id, patch: { equipmentRaw: e.target.value, equipmentNormalized: e.target.value.split(',').map(s => ({ label: s.trim(), key: s.trim() })).filter(i => i.label) } } })}
          placeholder="Dumbbells, Pull-up bar, Bench"
        />
      </CoachField>

      <CoachField label="Temporarily Unavailable Equipment (comma separated)">
        <CoachTextarea
          rows={2}
          value={place.unavailableEquipmentRaw || ''}
          onChange={e => dispatch({ type: 'UPDATE_PLACE', payload: { id: place.id, patch: { unavailableEquipmentRaw: e.target.value, unavailableEquipmentNormalized: e.target.value.split(',').map(s => ({ label: s.trim(), key: s.trim() })).filter(i => i.label) } } })}
          placeholder="Broken cable machine"
        />
      </CoachField>

      {(effectiveEquipment.length > 0) && (
        <div className="card-sharp p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Effective Equipment</div>
          <div className="flex flex-wrap gap-2">
            {effectiveEquipment.map(item => <InlineBadge key={item.key}>{item.label}</InlineBadge>)}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

// ----------------------------------------------------
// Program Preference Editor
// ----------------------------------------------------

export function CoachProgramPreferenceEditor({ program, state, dispatch }) {
  const preferences = program.preferredPlaceIds || [];
  const allPlaces = Array.isArray(state?.places?.items) ? state.places.items : [];

  const togglePlace = (placeId) => {
    let next = [...preferences];
    if (next.includes(placeId)) {
      next = next.filter(id => id !== placeId);
    } else {
      next.push(placeId);
    }
    dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { preferredPlaceIds: next } } });
  };

  const movePlace = (index, direction) => {
    let next = [...preferences];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    dispatch({ type: 'UPDATE_PROGRAM', payload: { id: program.id, patch: { preferredPlaceIds: next } } });
  };

  return (
    <div className="space-y-3">
      {preferences.length > 0 && (
        <div className="space-y-1">
          {preferences.map((placeId, index) => {
            const place = allPlaces.find(p => p.id === placeId);
            if (!place) return null;
            return (
              <div key={placeId} className="flex items-center justify-between gap-2 card-sharp p-2">
                <div className="text-sm font-semibold text-neutral-100 truncate flex items-center gap-2">
                  <span className="text-neutral-500 w-4">{index + 1}.</span> {place.name}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => movePlace(index, -1)} disabled={index === 0} className="w-8 h-8 flex items-center justify-center btn-ghost rounded disabled:opacity-30">↑</button>
                  <button onClick={() => movePlace(index, 1)} disabled={index === preferences.length - 1} className="w-8 h-8 flex items-center justify-center btn-ghost rounded disabled:opacity-30">↓</button>
                  <button onClick={() => togglePlace(placeId)} className="w-8 h-8 flex items-center justify-center btn-ghost rounded text-red-400">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {allPlaces.filter(p => !preferences.includes(p.id)).map(place => (
          <button
            key={place.id}
            onClick={() => togglePlace(place.id)}
            className="px-3 py-2 text-[11px] font-semibold uppercase rounded-lg border btn-ghost"
          >
            + {place.name}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wider">
        Coach checks these places in order to auto-select available locations.
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Pending Place Card
// ----------------------------------------------------

export function CoachPendingPlaceCard({ state, dispatch }) {
  const pending = state.coachPlan?.pendingPlaceResolution;
  if (!pending) return null;

  return (
    <SurfaceCard padding="p-5" className="border-accent relative overflow-hidden">
      <div className="absolute inset-0 bg-accent opacity-[0.03]" />
      <div className="relative space-y-4">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Place Required</div>
          <div className="text-lg font-semibold text-neutral-100">Multiple places are available.</div>
          <div className="text-sm text-neutral-400">Where are you training right now?</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(pending.options || []).map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                dispatch({
                  type: 'COACH_RESOLVE_PLACE',
                  payload: { placeId: opt.id },
                });
                import('../../utils/aiOrchestrator').then(module => {
                  module.runCoachGeneration(state, dispatch, pending.request);
                });
              }}
              className="btn-accent py-4 text-sm font-semibold uppercase tracking-[0.16em]"
            >
              {opt.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => dispatch({ type: 'COACH_CANCEL_PLACE_RESOLUTION' })}
          className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
        >
          Cancel
        </button>
      </div>
    </SurfaceCard>
  );
}

// ----------------------------------------------------
// Recommendation Card
// ----------------------------------------------------

export function CoachRecommendationCard({ recommendation, dispatch }) {
  if (!recommendation) return null;

  return (
    <SurfaceCard padding="p-5" className="border-accent relative overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="absolute inset-0 bg-accent opacity-[0.03]" />
      <div className="relative space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">AI Proposal</div>
            <InlineBadge tone={recommendation.countsTowardTraining ? 'accent' : 'warn'}>
              {recommendation.variant === 'desk_reset' ? 'Desk Reset' : 'Workout'}
            </InlineBadge>
          </div>
          <div className="text-lg font-semibold text-neutral-100">{recommendation.summary || 'Coach Recommendation'}</div>
          <div className="text-xs text-neutral-500">
            {recommendation.programName || 'Recovery'} · {recommendation.placeName || 'Unknown place'}
          </div>
        </div>
        <div className="text-sm text-neutral-300">{recommendation.rationale}</div>
        
        {recommendation.usedFallbackMode && (
          <div className="card-sharp p-3 text-[11px] text-yellow-500 font-semibold uppercase tracking-wide border-yellow-500/20 bg-yellow-500/5">
            Warning: The AI generated some exercises that require equipment you don't have. They were removed for safety.
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'REJECT_COACH_RECOMMENDATION' })}
            className="btn-ghost flex-1 py-3 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            Dismiss
          </button>
          <button
            onClick={() => dispatch({ type: 'START_COACH_SESSION', payload: recommendation })}
            className="btn-accent flex-1 py-3 text-sm font-semibold uppercase tracking-[0.16em]"
          >
            Start
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ----------------------------------------------------
// Roadmap Snapshot Card
// ----------------------------------------------------

export function CoachRoadmapSnapshotCard({ state, dispatch, programId = null }) {
  const { coachRoadmap, programs } = state;
  const programForecasts = Array.isArray(coachRoadmap?.programForecasts) ? coachRoadmap.programForecasts : [];
  
  if (coachRoadmap?.loading) {
    return (
      <SurfaceCard padding="p-4" className="flex items-center justify-center animate-pulse">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Refreshing Roadmap...</div>
      </SurfaceCard>
    );
  }

  const pId = programId || programs?.items?.[0]?.id;
  const forecast = programForecasts.find(f => f.programId === pId);
  const driftStatus = forecast?.driftStatus || coachRoadmap?.driftStatus || 'stable';
  const etaLow = forecast?.etaLowDate;
  const etaHigh = forecast?.etaHighDate;
  const hasRoadmap = !!forecast;

  return (
    <SurfaceCard padding="p-5" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] accent">Roadmap Live Insight</div>
          <div className="text-sm text-neutral-400 mt-1">
            {hasRoadmap 
              ? forecast?.nextMilestone || 'No milestone marked'
              : 'Add a program target and let the coach generate a forecast.'}
          </div>
        </div>
        {hasRoadmap && (
          <InlineBadge tone={driftStatus === 'stable' ? 'good' : driftStatus === 'watch' ? 'soft' : 'warn'}>
            {driftStatus}
          </InlineBadge>
        )}
      </div>

      {hasRoadmap && (
         <div className="card-sharp p-3 flex justify-between gap-4">
           <div>
             <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">ETA Window</div>
             <div className="text-sm font-semibold text-neutral-100">
               {etaLow && etaHigh ? formatCoachDateRange(etaLow, etaHigh) : 'TBD'}
             </div>
           </div>
           <div className="text-right">
             <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Confidence</div>
             <div className="text-sm font-semibold text-neutral-100">{forecast.confidence}%</div>
           </div>
         </div>
      )}

      {hasRoadmap && forecast?.phaseBlocks?.[0] && (
        <div className="text-sm text-neutral-400 border-l border-red-500/20 pl-3">
          Phase 1: <span className="font-semibold text-neutral-200">{forecast.phaseBlocks[0].label}</span> ({forecast.phaseBlocks[0].weeks}w)
        </div>
      )}

      <button
        onClick={() => {
           import('../../utils/aiOrchestrator').then(module => {
             module.runCoachRoadmapRefresh(state, dispatch, { reason: 'user_requested_refresh' });
           });
        }}
        className="btn-ghost w-full py-3 text-xs font-semibold uppercase tracking-[0.16em]"
      >
        Force Refresh Roadmap
      </button>
    </SurfaceCard>
  );
}
