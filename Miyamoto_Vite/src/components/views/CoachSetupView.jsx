import React, { useState } from 'react';
import { ViewHeader, SurfaceCard, CoachInput, CoachField, CoachTextarea, cx } from '../ui/core';

export function CoachSetupView({ state, dispatch }) {
  const step = state.setupStep || 0;
  
  const [profile, setProfile] = useState({
    name: state.profile?.name || '',
    age: state.profile?.age || '',
    bodyweight: state.profile?.bodyweight || '',
    overallGoal: state.profile?.overallGoal || '',
  });

  const [aiKey, setAiKey] = useState(state.aiConfig?.apiKey || '');
  
  const handleNext = () => {
    if (step === 0 && !profile.name.trim()) return;
    if (step === 1) {
       dispatch({ 
         type: 'UPDATE_PROFILE_FIELD', 
         payload: { field: 'name', value: profile.name } 
       });
       dispatch({ 
         type: 'UPDATE_PROFILE_FIELD', 
         payload: { field: 'age', value: profile.age } 
       });
       dispatch({ 
         type: 'UPDATE_PROFILE_FIELD', 
         payload: { field: 'bodyweight', value: profile.bodyweight } 
       });
       dispatch({ 
         type: 'UPDATE_PROFILE_FIELD', 
         payload: { field: 'overallGoal', value: profile.overallGoal } 
       });
    }
    if (step === 2) {
       dispatch({
         type: 'UPDATE_AI_CONFIG',
         payload: { apiKey: aiKey, enabled: !!aiKey }
       });
    }
    
    if (step < 2) {
       dispatch({ type: 'SET_SETUP_STEP', payload: step + 1 });
    } else {
       dispatch({ type: 'COMPLETE_SETUP' });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] justify-center space-y-6">
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map(i => (
          <div key={i} className={cx("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-red-500" : "bg-neutral-800")} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <ViewHeader
            eyebrow="Welcome"
            title="Meet MIYAMOTO"
            subtitle="Your autonomous AI fitness coach and recovery engine."
          />
          <SurfaceCard className="space-y-4">
            <CoachField label="What should the coach call you?">
              <CoachInput 
                autoFocus
                placeholder="First Name" 
                value={profile.name} 
                onChange={e => setProfile({ ...profile, name: e.target.value })} 
                onKeyDown={e => e.key === 'Enter' && handleNext()}
              />
            </CoachField>
          </SurfaceCard>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <ViewHeader
            eyebrow="Profile"
            title="Athlete Context"
            subtitle="Help the coach understand your body and baseline."
          />
          <SurfaceCard className="space-y-4">
             <div className="grid grid-cols-2 gap-3">
               <CoachField label="Age (opt)">
                 <CoachInput type="number" placeholder="30" value={profile.age} onChange={e => setProfile({ ...profile, age: e.target.value })} />
               </CoachField>
               <CoachField label="Weight kg (opt)">
                 <CoachInput type="number" placeholder="80" value={profile.bodyweight} onChange={e => setProfile({ ...profile, bodyweight: e.target.value })} />
               </CoachField>
             </div>
             <CoachField label="What is your overall training goal?">
               <CoachTextarea 
                 rows={3} 
                 placeholder="I want to be able to do 10 strict pull-ups and run 5k pain-free." 
                 value={profile.overallGoal} 
                 onChange={e => setProfile({ ...profile, overallGoal: e.target.value })} 
               />
             </CoachField>
          </SurfaceCard>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <ViewHeader
            eyebrow="Engine"
            title="Wake up the Coach"
            subtitle="MIYAMOTO brings its own workout logic, but relies on a Gemini API key to synthesize dynamic plans."
          />
          <SurfaceCard className="space-y-4 border-accent relative overflow-hidden">
             <div className="absolute inset-0 bg-red-500/5" />
             <div className="relative">
               <CoachField label="Gemini API Key">
                 <CoachInput 
                   type="password" 
                   placeholder="AIzaSy..." 
                   value={aiKey} 
                   onChange={e => setAiKey(e.target.value)} 
                   onKeyDown={e => e.key === 'Enter' && handleNext()}
                 />
                 <div className="text-xs text-neutral-500 mt-2">
                   Your key never leaves this device. It is only sent directly to Google's servers. Obtain a free tier key from Google AI Studio. You can skip this and add it later in Settings.
                 </div>
               </CoachField>
             </div>
          </SurfaceCard>
        </div>
      )}

      <div className="pt-4 flex justify-between gap-3">
         {step > 0 ? (
           <button onClick={() => dispatch({ type: 'SET_SETUP_STEP', payload: step - 1 })} className="btn-ghost px-6 py-4 text-sm font-semibold uppercase">
             Back
           </button>
         ) : <div />}
         <button 
           onClick={handleNext} 
           disabled={step === 0 && !profile.name.trim()}
           className="btn-accent px-8 py-4 text-sm font-semibold uppercase tracking-widest shadow-lg shadow-red-500/20 disabled:opacity-50"
         >
           {step === 2 ? 'Complete Setup' : 'Continue'}
         </button>
      </div>
    </div>
  );
}
