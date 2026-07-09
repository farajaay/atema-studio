// ATEMA STUDIO — Booking workflow timeline (admin booking modal → «سير العمل»).
//
// Renders the contract-derived production ladder for one booking and lets
// Fatima answer the question the workflow-reminders emails ask her: has this
// step started, or is it delayed? Marking a step started / done / skipped
// here is the confirmation; lateness (متأخرة) is never stored — it is
// derived live from the contract dates by _shared/workflow.ts, the same
// module the email cron uses.

import { useCallback, useEffect, useState } from 'react';
import type { Booking } from '../hooks/useAdminData';
import {
  WORKFLOW_STEPS, currentStepKey, stepView, workflowStepDef,
  type WorkflowStatus, type WorkflowStepKey, type StepView,
} from '../../supabase/functions/_shared/workflow';
import {
  fetchWorkflowSteps, updateWorkflowStep, type WorkflowStepRow,
} from '../services/workflow';
import {
  CheckCircle2, Circle, CircleDashed, Clock, AlertTriangle, Loader2,
  Play, Check, SkipForward, Undo2,
} from 'lucide-react';

const VIEW_CONFIG: Record<StepView, { label: string; bg: string; color: string }> = {
  upcoming:    { label: 'قادمة',        bg: 'var(--a-surface-alt)', color: 'var(--a-text-muted)' },
  due:         { label: 'حان موعدها',   bg: '#fef3c7', color: '#d97706' },
  overdue:     { label: 'متأخرة',       bg: '#fee2e2', color: '#dc2626' },
  in_progress: { label: 'جارية',        bg: '#dbeafe', color: '#2563eb' },
  done:        { label: 'مكتملة',       bg: '#d1fae5', color: '#059669' },
  skipped:     { label: 'متخطّاة',      bg: 'var(--a-surface-alt)', color: 'var(--a-text-muted)' },
};

function viewIcon(view: StepView) {
  switch (view) {
    case 'done':        return <CheckCircle2 size={18} color="#059669" />;
    case 'in_progress': return <Play size={18} color="#2563eb" />;
    case 'overdue':     return <AlertTriangle size={18} color="#dc2626" />;
    case 'due':         return <Clock size={18} color="#d97706" />;
    case 'skipped':     return <CircleDashed size={18} color="#9ca3af" />;
    default:            return <Circle size={18} color="#9ca3af" />;
  }
}

export default function WorkflowTracker({ booking }: { booking: Booking }) {
  const [rows, setRows]       = useState<WorkflowStepRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [notes, setNotes]     = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchWorkflowSteps(booking.id, booking.event_date);
    setRows(data);
    setFailed(data === null);
    if (data) {
      const n: Record<string, string> = {};
      for (const r of data) n[r.id] = r.note ?? '';
      setNotes(n);
    }
    setLoading(false);
  }, [booking.id, booking.event_date]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(step: WorkflowStepRow, status: WorkflowStatus) {
    setBusyId(step.id);
    const ok = await updateWorkflowStep(step, status, notes[step.id]);
    // Completions re-anchor dependent targets — reload the whole ladder.
    if (ok) await load();
    setBusyId(null);
  }

  async function saveNote(step: WorkflowStepRow) {
    const note = notes[step.id] ?? '';
    if ((step.note ?? '') === note.trim()) return;
    await updateWorkflowStep(step, step.status, note);
    setRows(prev => prev?.map(r => r.id === step.id ? { ...r, note: note.trim() || null } : r) ?? prev);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loader2 size={28} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  if (failed || !rows) {
    return (
      <div style={{ padding: '16px 18px', background: '#fef3c7', border: '1px solid #fde68a',
        borderRadius: '10px', fontSize: '13px', color: '#92400e', lineHeight: 1.8 }}>
        تعذّر تحميل سير العمل — تأكدي من تطبيق
        <span dir="ltr" style={{ fontFamily: 'monospace', margin: '0 6px' }}>migrations-2026-07-workflow.sql</span>
        في Supabase.
      </div>
    );
  }

  const statuses: Partial<Record<WorkflowStepKey, WorkflowStatus>> = {};
  for (const r of rows) statuses[r.step_key] = r.status;
  const current  = currentStepKey(statuses);
  const doneCount = rows.filter(r => r.status === 'done' || r.status === 'skipped').length;

  const btn = (bg: string, color: string, border = 'transparent'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '7px', border: `1px solid ${border}`,
    background: bg, color, fontWeight: 600, cursor: 'pointer',
    fontSize: '11.5px', fontFamily: 'inherit',
  });

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        background: 'var(--a-surface-alt)', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-gold)',
          textTransform: 'uppercase', letterSpacing: '1px' }}>سير العمل</div>
        <div style={{ fontSize: '12px', color: 'var(--a-text-soft)' }}>
          {doneCount} / {rows.length} مراحل منجزة
          {current && <> · المرحلة الحالية: <b style={{ color: 'var(--a-text)' }}>{workflowStepDef(current).titleAr}</b></>}
        </div>
      </div>

      {/* Ladder */}
      {rows.map((step, i) => {
        const def  = WORKFLOW_STEPS.find(d => d.key === step.step_key);
        const view = stepView({ status: step.status, target: step.target_date, deadline: step.deadline_date });
        const chip = VIEW_CONFIG[view];
        const isCurrent = step.step_key === current;
        const busy = busyId === step.id;
        const needsAttention = view === 'due' || view === 'overdue';

        return (
          <div key={step.id} style={{ display: 'flex', gap: '12px' }}>
            {/* Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
              {viewIcon(view)}
              {i < rows.length - 1 && (
                <div style={{ flex: 1, width: '2px', minHeight: '18px', margin: '4px 0',
                  background: step.status === 'done' ? '#05966955' : 'var(--a-border)' }} />
              )}
            </div>

            {/* Card */}
            <div style={{ flex: 1, marginBottom: '10px',
              background: isCurrent ? 'var(--a-surface-alt)' : 'transparent',
              border: `1px solid ${needsAttention ? chip.color + '55' : isCurrent ? 'var(--a-border-strong, var(--a-border))' : 'var(--a-border)'}`,
              borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--a-text)' }}>{def?.titleAr}</span>
                <span style={{ background: chip.bg, color: chip.color, padding: '2px 9px',
                  borderRadius: '20px', fontSize: '10.5px', fontWeight: 700 }}>{chip.label}</span>
                {isCurrent && view !== 'overdue' && view !== 'due' && (
                  <span style={{ fontSize: '10.5px', color: 'var(--a-gold)', fontWeight: 700 }}>← المرحلة الحالية</span>
                )}
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--a-text-muted)', marginTop: '5px' }}>
                الموعد المستهدف: <span dir="ltr">{step.target_date}</span>
                {step.deadline_date !== step.target_date && (
                  <> · الموعد النهائي (العقد): <span dir="ltr">{step.deadline_date}</span></>
                )}
                {step.completed_at && (
                  <> · اكتملت في <span dir="ltr">{step.completed_at.slice(0, 10)}</span></>
                )}
              </div>

              {/* Confirmation actions — the answer to "بدأت أم متأخرة؟" */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '9px', flexWrap: 'wrap' }}>
                {busy ? (
                  <Loader2 size={14} color="#D4AF7A" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    {step.status === 'pending' && (
                      <button onClick={() => setStatus(step, 'in_progress')} style={btn('#dbeafe', '#2563eb')}>
                        <Play size={11} />بدأت
                      </button>
                    )}
                    {(step.status === 'pending' || step.status === 'in_progress') && (
                      <button onClick={() => setStatus(step, 'done')} style={btn('#d1fae5', '#059669')}>
                        <Check size={11} />اكتملت
                      </button>
                    )}
                    {step.status === 'pending' && (
                      <button onClick={() => setStatus(step, 'skipped')}
                        style={btn('var(--a-surface)', 'var(--a-text-muted)', 'var(--a-border)')}>
                        <SkipForward size={11} />غير مشمولة
                      </button>
                    )}
                    {step.status !== 'pending' && (
                      <button onClick={() => setStatus(step, 'pending')}
                        style={btn('var(--a-surface)', 'var(--a-text-soft)', 'var(--a-border)')}>
                        <Undo2 size={11} />تراجع
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Delay note — surfaces in the ladder for the paper trail */}
              {(needsAttention || (step.note ?? '') !== '' || (notes[step.id] ?? '') !== '') && (
                <input
                  value={notes[step.id] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [step.id]: e.target.value }))}
                  onBlur={() => saveNote(step)}
                  placeholder="ملاحظة (سبب التأخير، تفاصيل…) — تُحفظ تلقائياً"
                  dir="rtl"
                  style={{ width: '100%', boxSizing: 'border-box', marginTop: '9px',
                    padding: '7px 10px', border: '1px solid var(--a-border)', borderRadius: '7px',
                    fontSize: '12px', fontFamily: 'inherit', outline: 'none',
                    background: 'var(--a-surface)', color: 'var(--a-text)' }}
                />
              )}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: '11px', color: 'var(--a-text-muted)', lineHeight: 1.8, marginTop: '6px' }}>
        المواعيد محسوبة من العقد (المادة الثانية والرابعة والخامسة) انطلاقاً من تاريخ المناسبة؛
        المراحل التابعة (المراجعة، اختيار الألبوم، تسليمه) يُعاد حساب مواعيدها من تاريخ الإنجاز الفعلي
        للمرحلة السابقة. عند حلول موعد مرحلة دون تأكيدها يصلك بريد تذكيري تلقائي —
        التأكيد يكون من هنا: «بدأت» أو «اكتملت»، وإلا بقيت معلَّمة متأخرة.
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
