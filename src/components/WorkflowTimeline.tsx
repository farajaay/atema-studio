// ATEMA STUDIO — Booking workflow timeline graphic.
//
// A compact horizontal "journey" strip above the detailed step ladder
// (WorkflowTracker.tsx) — same data, just an at-a-glance visualisation:
// a gold progress line threading through 8 nodes, the current step glowing,
// overdue steps flagged red. Purely presentational; all state comes from
// the same rows the ladder already fetched (_shared/workflow.ts stepView).

import { useEffect, useRef } from 'react';
import {
  WORKFLOW_STEPS, currentStepKey, stepView,
  type WorkflowStepKey, type WorkflowStatus, type StepView,
} from '../../supabase/functions/_shared/workflow';
import type { WorkflowStepRow } from '../services/workflow';

// Short labels for the compact node caption — the full titles live in
// WORKFLOW_STEPS and are used verbatim in the detailed ladder below.
const SHORT_LABEL: Record<WorkflowStepKey, string> = {
  final_payment:   'الدفعة الثانية',
  event:           'المناسبة',
  editing:         'التعديل',
  gallery:         'المعرض',
  video:           'الفيلم',
  review:          'المراجعة',
  album_selection: 'اختيار الألبوم',
  album_delivery:  'الألبوم',
};

const NODE_COLOR: Record<StepView, string> = {
  upcoming:    'var(--a-text-muted)',
  due:         '#d97706',
  overdue:     '#dc2626',
  in_progress: '#2563eb',
  done:        '#059669',
  skipped:     'var(--a-text-muted)',
};

const NODE_LABEL: Record<StepView, string> = {
  upcoming: '', due: 'حان الموعد', overdue: 'متأخرة',
  in_progress: 'جارية', done: '', skipped: '',
};

export default function WorkflowTimeline({ rows }: { rows: WorkflowStepRow[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [rows]);

  const byKey = new Map(rows.map(r => [r.step_key, r]));
  const statuses: Partial<Record<WorkflowStepKey, WorkflowStatus>> = {};
  for (const r of rows) statuses[r.step_key] = r.status;
  const current = currentStepKey(statuses);

  return (
    <div style={{ position: 'relative', marginBottom: '22px' }}>
      <div ref={scrollerRef} className="wf-timeline-scroll" style={{
        display: 'flex', alignItems: 'flex-start', overflowX: 'auto',
        padding: '14px 10px 4px', gap: 0,
      }}>
        {WORKFLOW_STEPS.map((def, i) => {
          const row  = byKey.get(def.key);
          const view: StepView = row
            ? stepView({ status: row.status, target: row.target_date, deadline: row.deadline_date })
            : 'upcoming';
          const isCurrent = def.key === current;
          const color = NODE_COLOR[view];
          const prevDone = i > 0 && (() => {
            const prevKey = WORKFLOW_STEPS[i - 1].key;
            const s = statuses[prevKey];
            return s === 'done' || s === 'skipped';
          })();

          return (
            <div key={def.key} style={{ display: 'flex', alignItems: 'flex-start', flex: '0 0 auto' }}>
              {i > 0 && (
                <div style={{
                  flex: '0 0 30px', height: '2px', marginTop: '17px',
                  background: prevDone ? 'var(--a-gold)' : 'var(--a-border)',
                  transition: 'background 0.3s',
                }} />
              )}
              <div ref={isCurrent ? currentRef : undefined}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '76px', flexShrink: 0 }}>
                {/* Node — fixed-size wrapper so the ring never shifts layout */}
                <div style={{ position: 'relative', width: '22px', height: '22px' }}>
                  {isCurrent && (
                    <div className="wf-node-pulse" style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      boxShadow: `0 0 0 4px ${color}33`,
                    }} />
                  )}
                  <div style={{
                    position: 'absolute', top: '4px', left: '4px', width: '14px', height: '14px',
                    borderRadius: '50%',
                    background: view === 'upcoming' ? 'var(--a-surface)' : color,
                    border: `2px solid ${color}`,
                    boxSizing: 'border-box',
                    transition: 'background 0.3s, border-color 0.3s',
                  }} />
                </div>
                <div style={{
                  marginTop: '8px', fontSize: '11px', fontWeight: isCurrent ? 700 : 600,
                  color: view === 'upcoming' ? 'var(--a-text-muted)' : 'var(--a-text)',
                  textAlign: 'center', lineHeight: 1.4, minHeight: '30px',
                }}>
                  {SHORT_LABEL[def.key]}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--a-text-muted)', whiteSpace: 'nowrap' }}>
                  {(row?.completed_at ? row.completed_at.slice(0, 10) : row?.target_date ?? def.key).slice(5)}
                </div>
                {NODE_LABEL[view] && (
                  <div style={{ marginTop: '3px', fontSize: '9.5px', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                    {NODE_LABEL[view]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edge fades hint that the strip scrolls */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '20px', pointerEvents: 'none',
        background: 'linear-gradient(to left, var(--a-surface), transparent)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '20px', pointerEvents: 'none',
        background: 'linear-gradient(to right, var(--a-surface), transparent)' }} />

      <style>{`
        .wf-timeline-scroll::-webkit-scrollbar { height: 5px; }
        .wf-timeline-scroll::-webkit-scrollbar-thumb { background: var(--a-border); border-radius: 3px; }
        .wf-timeline-scroll { scrollbar-width: thin; }
        @keyframes wf-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.25); } }
        .wf-node-pulse { animation: wf-pulse 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
