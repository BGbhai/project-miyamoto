import React, { useState, useRef, useEffect } from 'react';
import { ViewHeader, SurfaceCard, CoachInput, cx } from '../ui/core';
import { runCoachChatAI } from '../../utils/aiOrchestrator';

export function CoachChatView({ state, dispatch }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const messages = Array.isArray(state.coachChat?.messages) ? state.coachChat.messages : [];
  const loading = state.coachChat?.loading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    runCoachChatAI(state, dispatch, inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)]">
      <ViewHeader
        eyebrow="Chat"
        title="Ask Coach"
        subtitle="Discuss readiness, request program adjustments, or ask for a specific desk reset right now."
        actions={
          messages.length > 0 && (
            <button
              onClick={() => dispatch({ type: 'CLEAR_COACH_CHAT_HISTORY' })}
              className="btn-ghost px-3 py-2 text-xs font-semibold uppercase"
            >
              Clear
            </button>
          )
        }
      />
      
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1 rounded-xl">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-8">
             <div className="text-neutral-500 text-sm">
                Try asking:
             </div>
             <div className="flex flex-col gap-2 w-full max-w-[240px]">
               {['I only have 15 minutes today.', 'Modify my program for a knee injury.', 'I need a quick desk reset.'].map(suggestion => (
                 <button
                   key={suggestion}
                   onClick={() => setInputText(suggestion)}
                   className="card-sharp p-3 text-sm text-neutral-300 text-left hover:bg-neutral-800 transition"
                 >
                   "{suggestion}"
                 </button>
               ))}
             </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cx('flex w-full', msg.role === 'coach' ? 'justify-start' : 'justify-end')}>
              <SurfaceCard
                padding="p-3"
                tone={msg.role === 'coach' ? 'dimmed' : 'accent'}
                className={cx('max-w-[85%] rounded-2xl', msg.role === 'user' ? 'rounded-tr-sm bg-red-500/10 border-red-500/20' : 'rounded-tl-sm')}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-1">
                  {msg.role === 'coach' ? 'Coach' : 'You'}
                </div>
                <div className="text-sm text-neutral-100 whitespace-pre-wrap">{msg.text}</div>
                {msg.actionSummary && (
                  <div className="mt-2 text-[11px] text-yellow-500 font-semibold bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded">
                    ⚡ {msg.actionSummary}
                  </div>
                )}
              </SurfaceCard>
            </div>
          ))
        )}
        {loading && (
          <div className="flex w-full justify-start">
            <SurfaceCard padding="p-3" tone="dimmed" className="max-w-[85%] rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </SurfaceCard>
          </div>
        )}
        {state.coachChat?.error && (
           <div className="text-sm text-center text-red-400 p-2 bg-red-500/10 rounded-xl">
             {state.coachChat.error}
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="pt-4 flex gap-2">
        <CoachInput
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask for a tailored workout..."
          className="flex-1 bg-neutral-900 border-neutral-800 rounded-full px-4 h-12"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white disabled:opacity-50 disabled:bg-neutral-800 transition shadow-lg shadow-red-500/20"
        >
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <line x1="22" y1="2" x2="11" y2="13"></line>
             <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
           </svg>
        </button>
      </form>
    </div>
  );
}
