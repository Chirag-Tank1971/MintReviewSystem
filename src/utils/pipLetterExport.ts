import { PerformanceImprovementPlan } from '../types';
import { LetterSettings, DEFAULT_LETTER_SETTINGS } from './letterExport';

function esc(val: unknown): string {
  return String(val ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

/** Formal PIP letter: plan details, goals, check-in schedule, consequences and signature lines. */
export function generatePipLetterHtml(plan: PerformanceImprovementPlan, settings: LetterSettings = DEFAULT_LETTER_SETTINGS): string {
  const goalRows = plan.goals
    .map(
      (g, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${esc(g.description)}</td>
          <td>${esc(g.targetMetric || '—')}</td>
          <td style="white-space:nowrap;">${g.dueDate ? fmt(g.dueDate) : fmt(plan.endDate)}</td>
        </tr>`
    )
    .join('');

  const ack = plan.employeeAcknowledgement?.acknowledged
    ? `<div class="ack">Acknowledged by employee on ${fmt(plan.employeeAcknowledgement.acknowledgedAt)}${
        plan.employeeAcknowledgement.comments ? ` — “${esc(plan.employeeAcknowledgement.comments)}”` : ''
      }</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Performance Improvement Plan - ${esc(plan.employeeName)} (${esc(plan.employeeCode)})</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; line-height: 1.6; }
    .container { max-width: 740px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { font-size: 16px; font-weight: 800; }
    .muted { color: #64748b; font-size: 11px; }
    .conf { font-size: 10px; font-weight: 800; color: #b91c1c; letter-spacing: 1px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
    .subject { font-weight: 800; margin: 14px 0 10px; }
    h3 { font-size: 12px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #cbd5e1; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    ul { margin: 4px 0; padding-left: 18px; }
    .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 48px; text-align: center; }
    .sig { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; }
    .ack { margin-top: 14px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; color: #166534; }
    .footer { font-size: 9.5px; color: #94a3b8; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand">${esc(settings.companyName)}</div>
        <div class="muted">${esc(settings.divisionName)}</div>
      </div>
      <div style="text-align:right;">
        <div class="conf">STRICTLY CONFIDENTIAL</div>
        <div class="muted">Ref: HR/PIP/${esc(plan.employeeCode)}</div>
        <div class="muted">Date: ${fmt(plan.publishedAt || plan.createdAt)}</div>
      </div>
    </div>

    <div class="details">
      <div style="grid-column: span 2; font-size: 14px; font-weight: 800;">${esc(plan.employeeName)}</div>
      <div>Employee code: <strong>${esc(plan.employeeCode)}</strong></div>
      <div>Department: <strong>${esc(plan.departmentName || '—')}</strong></div>
      <div>Designation: <strong>${esc(plan.designationName || '—')}</strong></div>
      <div>Reporting manager: <strong>${esc(plan.managerName || '—')}</strong></div>
      <div>Plan period: <strong>${fmt(plan.startDate)} – ${fmt(plan.endDate)}</strong></div>
      <div>Duration: <strong>${esc(plan.durationDays)} days</strong></div>
    </div>

    <div class="subject">SUBJECT: PERFORMANCE IMPROVEMENT PLAN${plan.category ? ` — ${esc(plan.category).toUpperCase()}` : ''}</div>

    <p>Dear <strong>${esc(plan.employeeName)}</strong>,</p>
    <p>This letter sets out a Performance Improvement Plan (PIP) to help you meet the expectations of your role. Its purpose is to clearly define the areas that need improvement, the measurable goals you are expected to achieve, and how your progress will be reviewed.</p>

    <h3>Reason for this plan</h3>
    <p style="white-space: pre-wrap;">${esc(plan.reason)}</p>

    <h3>Improvement goals</h3>
    <table>
      <thead><tr><th style="width:28px;">#</th><th>Goal</th><th>Target / measure</th><th>Due by</th></tr></thead>
      <tbody>${goalRows}</tbody>
    </table>

    <h3>Review and support</h3>
    <ul>
      <li>Your manager will hold a check-in with you at least once a week to review progress against each goal.</li>
      <li>A short written review will be recorded each week, and a final review will be held at the end of the plan.</li>
      <li>You are encouraged to raise any obstacles, resource needs or support requests with your manager or HR at any time.</li>
    </ul>

    <h3>Outcome of the plan</h3>
    <p>At the end of the plan, your performance against the goals above will be assessed. If the goals are met, the plan will be closed as successful. If sufficient progress is shown but some goals are not fully met, the plan may be extended. If the goals are not met, further action may be taken in line with company policy, which may include termination of employment.</p>

    <p>Your signature below confirms that you have received and understood this plan. It does not necessarily indicate agreement with its contents; you may add written comments.</p>

    ${ack}

    <div class="sigs">
      <div class="sig"><strong>${esc(plan.employeeName)}</strong><br><span class="muted">Employee</span></div>
      <div class="sig"><strong>${esc(plan.managerName || 'Reporting Manager')}</strong><br><span class="muted">Reporting Manager</span></div>
      <div class="sig"><strong>${esc(settings.signatoryName)}</strong><br><span class="muted">${esc(settings.signatoryTitle)}</span></div>
    </div>

    <div class="footer">${esc(settings.customFooterText || 'Confidential — for the named employee, their reporting line and HR only.')}</div>
  </div>
</body>
</html>`;
}

/** Opens the letter in a new tab and starts the browser print dialog (Save as PDF). */
export function printPipLetter(plan: PerformanceImprovementPlan): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(generatePipLetterHtml(plan));
  win.document.close();
  win.focus();
  // Inline document with no external assets, so a short delay is enough for layout before printing
  win.setTimeout(() => win.print(), 300);
  return true;
}
