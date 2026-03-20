import React, { useEffect, useReducer, useMemo } from 'react';
import {
  COACH_STORAGE_KEY,
  ACCENT_PRESETS
} from './constants/config';
import { cx, buildRoadmapRefreshReason } from './utils/helpers';
import { coachReducer } from './context/coachReducer';
import {
  createCoachState,
  hydrateCoachState
} from './utils/factories';
import { 
  buildLocalRoadmapSourceSignature,
  buildRoadmapAIRefreshSignature,
  shouldRefreshRoadmapAI,
  buildLocalCoachRoadmap
} from './utils/workoutLogic';
import { runCoachRoadmapRefresh } from './utils/aiOrchestrator';

import { CoachSetupView } from './components/views/CoachSetupView';
import { CoachTodayView, CoachSettingsView } from './components/views/CoachViews';
import { CoachTrainView, CoachInsightsView, CoachHistoryView } from './components/views/CoachViews2';
import { CoachChatView } from './components/views/CoachChatView';
import { Home, MessageSquare, Dumbbell, TrendingUp, List, Settings } from './components/ui/core';

export default function App() {
  const [state, dispatch] = useReducer(coachReducer, null, hydrateCoachState);

  // Roadmap synchronization logic
  const localRoadmapSignature = buildLocalRoadmapSourceSignature(state);
  const localRoadmapReason = buildRoadmapRefreshReason(state, state.coachRoadmap);
  
  const localRoadmap = useMemo(() => ({
    ...buildLocalCoachRoadmap(state, localRoadmapReason),
    sourceSignature: localRoadmapSignature,
    aiRefreshSignature: state.coachRoadmap?.aiRefreshSignature || null,
  }), [localRoadmapSignature, localRoadmapReason, state]);
  
  const roadmapAIRefreshSignature = buildRoadmapAIRefreshSignature(state);

  // Persist state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Coach state save failed:', err?.message || err);
    }
  }, [state]);

  // Set theming hook
  useEffect(() => {
    document.getElementById('root')?.setAttribute('data-app-mounted', '1');
    const preset = state.programConfig?.accentPreset || 'ember';
    const hex = state.programConfig?.accentHex || ACCENT_PRESETS[preset] || ACCENT_PRESETS.ember;
    const root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-strong', hex);
    const r = parseInt(hex.slice(1, 3), 16) || 239;
    const g = parseInt(hex.slice(3, 5), 16) || 68;
    const b = parseInt(hex.slice(5, 7), 16) || 68;
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  }, [state.programConfig?.accentPreset, state.programConfig?.accentHex]);

  // Sync internal local roadmap
  useEffect(() => {
    if (!state.setupComplete) return;
    dispatch({
      type: 'SYNC_LOCAL_ROADMAP',
      payload: { roadmap: localRoadmap },
    });
  }, [state.setupComplete, localRoadmapSignature]);

  // Auto-trigger AI refresh when signatures diverge or interval exceeded
  useEffect(() => {
    if (!shouldRefreshRoadmapAI(state, roadmapAIRefreshSignature)) return;
    runCoachRoadmapRefresh(state, dispatch, {
      reason: localRoadmapReason,
      localRoadmap: {
        ...localRoadmap,
        aiRefreshSignature: roadmapAIRefreshSignature,
      },
      sourceSignature: localRoadmapSignature,
      aiRefreshSignature: roadmapAIRefreshSignature,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.setupComplete, roadmapAIRefreshSignature, state.aiConfig?.enabled, state.aiConfig?.apiKey, state.aiConfig?.model, localRoadmapSignature]);

  // Setup/Onboarding routing
  if (!state.setupComplete) {
    return <CoachSetupView state={state} dispatch={dispatch} />;
  }

  // Define tab navigation
  const navTabs = [
    { id: 'today', label: 'TODAY', icon: Home },
    { id: 'chat', label: 'CHAT', icon: MessageSquare },
    { id: 'train', label: 'TRAIN', icon: Dumbbell },
    { id: 'insights', label: 'INSIGHTS', icon: TrendingUp },
    { id: 'history', label: 'HISTORY', icon: List },
    { id: 'settings', label: 'SETTINGS', icon: Settings },
  ];

  return (
    <div className="scrollable safe-bottom" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="max-w-lg mx-auto pt-6 px-4 pb-20">
        {state.view === 'today' && <CoachTodayView state={state} dispatch={dispatch} />}
        {state.view === 'chat' && <CoachChatView state={state} dispatch={dispatch} />}
        {state.view === 'train' && <CoachTrainView state={state} dispatch={dispatch} />}
        {state.view === 'insights' && <CoachInsightsView state={state} />}
        {state.view === 'history' && <CoachHistoryView state={state} />}
        {state.view === 'settings' && <CoachSettingsView state={state} dispatch={dispatch} />}
      </div>

      <div className="nav-bar">
        <div className="max-w-lg mx-auto flex w-full">
          {navTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: id })}
              style={state.view === id
                ? { color: 'var(--accent)', borderColor: 'var(--accent)', WebkitTapHighlightColor: 'transparent' }
                : { WebkitTapHighlightColor: 'transparent' }}
              className={cx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 border-t-2 transition active:bg-neutral-900',
                state.view === id ? 'border-red-500' : 'text-neutral-600 border-transparent'
              )}
            >
              <Icon size={18} />
              <span className="text-[10px] font-semibold uppercase">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
