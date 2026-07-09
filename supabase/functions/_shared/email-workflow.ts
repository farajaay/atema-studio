// ATEMA STUDIO — owner workflow-confirmation digest email.
//
// Sent to the studio inbox by the workflow-reminders cron whenever one or
// more booking steps have reached their target date (has this started?) or
// blown past their contract deadline (this is delayed — confirm its state).
// One digest per cron run, grouping every due step across bookings, so the
// owner gets a single actionable email instead of a drip.
//
// Pure string assembly, stationery-dressed like email-change.ts. Subjects
// stay ASCII-only: denomailer 1.6.0 emits broken RFC 2047 for mixed-script
// subjects (same constraint as the other renderers).

import { STATIONERY } from './stationery.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

export interface WorkflowDigestItem {
  bookingRef:   string;
  customerName: string;
  eventDate:    string;      // yyyy-mm-dd
  stepTitleAr:  string;
  kind:         'due' | 'overdue';
  target:       string;      // yyyy-mm-dd
  deadline:     string;      // yyyy-mm-dd
  daysLate:     number;      // past target (due) / past deadline (overdue)
}

export interface RenderedEmail {
  subject: string;
  html:    string;
  text:    string;
}

export function renderWorkflowDigestEmail(opts: {
  items:    WorkflowDigestItem[];
  adminUrl: string;
}): RenderedEmail {
  const S = STATIONERY;
  const overdueCount = opts.items.filter(i => i.kind === 'overdue').length;
  const dueCount     = opts.items.length - overdueCount;

  const subject =
    `[ATEMA] Workflow check - ` +
    [overdueCount && `${overdueCount} delayed`, dueCount && `${dueCount} starting`]
      .filter(Boolean).join(', ');

  const text = [
    'متابعة سير العمل — مراحل تحتاج تأكيدك:',
    '',
    ...opts.items.map(i => {
      const state = i.kind === 'overdue'
        ? `متأخرة ${i.daysLate} يوم عن الموعد النهائي (${i.deadline})`
        : `حان موعدها في ${i.target}`;
      return `• ${i.bookingRef} — ${i.customerName} — ${i.stepTitleAr}: ${state}`;
    }),
    '',
    'هل بدأت كل مرحلة أم أنها متأخرة؟ أكّدي حالتها من تبويب «سير العمل» في بطاقة الحجز:',
    opts.adminUrl,
  ].join('\n');

  const itemCard = (i: WorkflowDigestItem) => {
    const overdue = i.kind === 'overdue';
    const accent  = overdue ? S.warnAccent : S.goldDeep;
    const stateAr = overdue
      ? `متأخرة — تجاوزت الموعد النهائي بـ ${i.daysLate} ${i.daysLate === 1 ? 'يوم' : 'أيام'}`
      : 'حان موعد البدء — هل بدأت؟';
    return `
        <tr><td style="padding:0 32px 12px;">
          <div style="background:${S.paperAlt};border:1px solid ${S.borderHair};border-right:3px solid ${accent};border-radius:10px;padding:14px 18px;font-family:${S.fontBody};text-align:right;">
            <div style="font-size:11px;letter-spacing:0.08em;color:${S.inkFaint};margin-bottom:4px;">
              ${esc(i.bookingRef)} · ${esc(i.customerName)} · المناسبة <span dir="ltr">${esc(i.eventDate)}</span>
            </div>
            <div style="font-size:14.5px;font-weight:700;color:${S.ink};margin-bottom:6px;">${esc(i.stepTitleAr)}</div>
            <div style="font-size:12.5px;font-weight:600;color:${accent};margin-bottom:4px;">${esc(stateAr)}</div>
            <div style="font-size:11.5px;color:${S.inkMuted};">
              الموعد المستهدف: <span dir="ltr">${esc(i.target)}</span>
              &nbsp;·&nbsp; الموعد النهائي حسب العقد: <span dir="ltr">${esc(i.deadline)}</span>
            </div>
          </div>
        </td></tr>`;
  };

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${S.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${S.paper};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${S.card};border:1px solid ${S.borderHair};border-radius:16px;box-shadow:${S.cardShadow};overflow:hidden;">
        <tr><td style="background:${S.noirGrad};padding:26px 0;text-align:center;">
          <div style="font-family:${S.fontWordmark};color:${S.goldHi};font-size:24px;letter-spacing:6px;">ATEMA</div>
          <div style="font-family:${S.fontBody};color:${S.goldChampagne};font-size:10px;letter-spacing:4px;margin-top:4px;">STUDIO</div>
        </td></tr>
        <tr><td style="padding:28px 32px 18px;text-align:center;font-family:${S.fontBody};">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${S.goldDeep};">متابعة سير العمل</p>
          <p style="margin:0;font-size:13px;line-height:1.9;color:${S.inkSoft};">
            المراحل التالية تحتاج تأكيدك — هل بدأت، أم أنها متأخرة؟
          </p>
        </td></tr>
        ${opts.items.map(itemCard).join('')}
        <tr><td style="padding:10px 32px 26px;text-align:center;">
          <a href="${esc(opts.adminUrl)}" style="display:inline-block;background:${S.goldDeep};color:${S.card};font-family:${S.fontBody};font-size:13.5px;font-weight:700;text-decoration:none;border-radius:10px;padding:12px 30px;">
            فتح لوحة التحكم — تبويب سير العمل
          </a>
        </td></tr>
        <tr><td style="background:${S.paperAlt};border-top:1px solid ${S.borderHair};padding:16px 32px;text-align:center;font-family:${S.fontBody};font-size:11px;color:${S.inkFaint};">
          تذكير تلقائي من نظام متابعة سير العمل — المواعيد محسوبة من عقد كل حجز.
          <br><span dir="ltr">Automatic workflow reminder — dates derive from each booking's contract.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
