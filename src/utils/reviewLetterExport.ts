import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EmployeeReview, ReviewKraSnapshot } from '../types';
import { LetterSettings, DEFAULT_LETTER_SETTINGS } from './letterExport';

function scoreBracket(score: number): { label: string; color: string } {
  if (!score || score === 0) return { label: 'Unscored', color: '#64748b' };
  if (score >= 4.5) return { label: 'Outstanding', color: '#059669' };
  if (score >= 3.5) return { label: 'Exceeds Expectations', color: '#4338ca' };
  if (score >= 2.5) return { label: 'Meets Expectations', color: '#1d4ed8' };
  return { label: 'Needs Improvement', color: '#be123c' };
}

function esc(val: any): string {
  return String(val ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

/**
 * Builds the full "all details in one" HTML letter for a finalized (CLOSED) quarterly
 * review — Manager's and HOD's independent scoring, the averaged final score, KRA-by-KRA
 * breakdown, and every growth/feedback field on the record. Used identically for the
 * on-screen preview (via an iframe), Print, Download PDF, and Download HTML.
 */
export function generateReviewLetterHtml(
  review: EmployeeReview,
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS,
  refNumber?: string
): string {
  const ref = refNumber || `HR/QR/${review.cycleCode || 'CYCLE'}/${review.employeeCode}`;
  const letterDate = review.completedAt
    ? new Date(review.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const finalScore = review.finalScore || 0;
  const bracket = scoreBracket(finalScore);
  const snapshot: ReviewKraSnapshot[] = review.kraSnapshot || [];

  const scoreCards = [
    { label: 'Self Score', value: review.selfScore, show: review.selfScore !== undefined && review.selfScore > 0 },
    { label: 'Manager Score', value: review.managerScore ?? review.finalScore, show: true },
    { label: 'HOD Score', value: review.hodScore, show: review.hodScore !== undefined && review.hodScore !== null },
    { label: 'Final Score', value: finalScore, show: true, isFinal: true },
  ].filter((c) => c.show);

  const kraRows = snapshot
    .map(
      (k, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>
            <div style="font-weight:700;color:#0f172a;">${esc(k.title || k.kraName)}</div>
            ${k.targetSnapshot ? `<div style="font-size:9.5px;color:#64748b;margin-top:1px;">${esc(k.targetSnapshot)}</div>` : ''}
          </td>
          <td class="text-right font-mono">${esc(k.weight)}%</td>
          <td class="text-right font-mono" style="font-weight:700;color:#1d4ed8;">${k.rating ? `${k.rating} ★` : '—'}</td>
          <td class="text-right font-mono" style="font-weight:700;color:#7c3aed;">${k.hodRating ? `${k.hodRating} ★` : '—'}</td>
        </tr>`
    )
    .join('');

  const feedbackNotes = snapshot
    .filter((k) => k.comments || k.hodComments || k.achievement || k.hodAchievement)
    .map(
      (k) => `
        <div style="margin-bottom:8px;">
          <div style="font-weight:700;font-size:10.5px;color:#0f172a;">${esc(k.title || k.kraName)}</div>
          ${k.achievement ? `<div style="font-size:10px;color:#334155;"><strong>Manager Deliverables:</strong> ${esc(k.achievement)}</div>` : ''}
          ${k.comments ? `<div style="font-size:10px;color:#334155;"><strong>Manager Feedback:</strong> ${esc(k.comments)}</div>` : ''}
          ${k.hodAchievement ? `<div style="font-size:10px;color:#4c1d95;"><strong>HOD Deliverables:</strong> ${esc(k.hodAchievement)}</div>` : ''}
          ${k.hodComments ? `<div style="font-size:10px;color:#4c1d95;"><strong>HOD Feedback:</strong> ${esc(k.hodComments)}</div>` : ''}
        </div>`
    )
    .join('');

  const growthBlock = (label: string, value?: string, color = '#0f172a') =>
    value
      ? `
        <div style="margin-bottom:10px;">
          <div style="font-weight:700;font-size:10.5px;color:${color};margin-bottom:2px;">${esc(label)}</div>
          <div style="font-size:10.5px;color:#334155;white-space:pre-wrap;">${esc(value)}</div>
        </div>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quarterly Review Letter - ${esc(review.employeeName)} (${esc(review.employeeCode)})</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 24px; font-size: 11.5px; line-height: 1.55; }
    .container { max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #312e81; padding-bottom: 12px; margin-bottom: 16px; }
    .brand-title { font-size: 16px; font-weight: 800; color: #1e1b4b; letter-spacing: -0.3px; }
    .brand-sub { font-size: 10.5px; color: #64748b; margin-top: 2px; font-weight: 500; }
    .ref-block { text-align: right; font-size: 11px; color: #334155; }
    .confidential-tag { font-size: 9.5px; font-weight: 800; color: #dc2626; letter-spacing: 1.2px; margin-bottom: 3px; }
    .recipient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .recipient-name { grid-column: span 2; font-size: 14px; font-weight: 800; color: #0f172a; }
    .recipient-detail { font-size: 11px; color: #475569; }
    .subject-line { font-weight: 800; color: #0f172a; font-size: 12px; margin: 12px 0 10px 0; padding-bottom: 4px; border-bottom: 1px dashed #cbd5e1; }
    .highlight-pill { display: inline-block; font-weight: 700; padding: 2px 7px; border-radius: 4px; border: 1px solid; }
    .score-grid { display: grid; grid-template-columns: repeat(${scoreCards.length}, 1fr); gap: 8px; margin: 14px 0; }
    .score-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
    .score-card.final { background: #eef2ff; border-color: #c7d2fe; }
    .score-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
    .score-value { font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .table-container { margin: 14px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f1f5f9; color: #1e293b; font-weight: 700; padding: 7px 10px; border-bottom: 1px solid #cbd5e1; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .section-title { font-weight: 800; font-size: 11.5px; color: #0f172a; margin: 16px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .signatures-section { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; text-align: center; }
    .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; }
    .sig-name { font-weight: 700; color: #1e293b; font-size: 11px; }
    .sig-role { font-size: 9.5px; color: #64748b; }
    .sig-status { font-size: 8.5px; color: #059669; font-weight: 600; margin-top: 2px; }
    .ack-box { margin-top: 14px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 10px; color: #166534; }
    .footer-note { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand-title">${esc(settings.companyName)}</div>
        <div class="brand-sub">${esc(settings.divisionName)}</div>
        <div class="brand-sub">${esc(settings.headquarters)}</div>
      </div>
      <div class="ref-block">
        <div class="confidential-tag">STRICTLY CONFIDENTIAL</div>
        <div style="font-weight: 700;">Ref: ${esc(ref)}</div>
        <div style="color: #64748b; margin-top: 1px;">Date: ${esc(letterDate)}</div>
      </div>
    </div>

    <div class="recipient-card">
      <div class="recipient-name">${esc(review.employeeName)}</div>
      <div class="recipient-detail">Employee Code: <span class="font-mono" style="font-weight: 700;">${esc(review.employeeCode)}</span></div>
      <div class="recipient-detail">Department: <strong>${esc(review.departmentName)}</strong></div>
      <div class="recipient-detail">Designation: <strong>${esc(review.designationName)}</strong></div>
      <div class="recipient-detail">Review Period: <strong>${esc(review.reviewPeriodName)} (Cycle ${esc(review.cycleCode)})</strong></div>
      <div class="recipient-detail">Reporting Manager: <strong>${esc(review.managerName)}</strong></div>
      ${review.hodName ? `<div class="recipient-detail">Head of Department: <strong>${esc(review.hodName)}</strong></div>` : ''}
    </div>

    <div class="subject-line">SUBJECT: QUARTERLY PERFORMANCE REVIEW OUTCOME — ${esc(review.reviewPeriodName)}</div>

    <p style="margin: 8px 0;">Dear <strong>${esc(review.employeeName)}</strong>,</p>
    <p style="margin: 8px 0;">
      Your quarterly performance review for <strong>${esc(review.reviewPeriodName)}</strong> has been evaluated by your Reporting Manager
      ${review.hodName ? ` and calibrated independently by your Head of Department` : ''}, and has been finalized and locked by HR.
      Your final weighted performance score is <strong>${finalScore.toFixed(2)} / 5.00</strong>, placing you in the
      <span class="highlight-pill" style="color:${bracket.color};border-color:${bracket.color};background:${bracket.color}14;">${esc(bracket.label)}</span> performance band.
    </p>

    <div class="score-grid">
      ${scoreCards
        .map(
          (c) => `
        <div class="score-card ${c.isFinal ? 'final' : ''}">
          <div class="score-label">${esc(c.label)}</div>
          <div class="score-value">${(c.value || 0).toFixed(2)}</div>
        </div>`
        )
        .join('')}
    </div>

    <div class="section-title">Key Result Area (KRA) Scorecard</div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Key Result Area</th>
            <th class="text-right">Weight</th>
            <th class="text-right">Manager</th>
            <th class="text-right">HOD</th>
          </tr>
        </thead>
        <tbody>${kraRows}</tbody>
      </table>
    </div>

    ${feedbackNotes ? `<div class="section-title">Detailed KRA Feedback</div>${feedbackNotes}` : ''}

    <div class="section-title">Growth & Overall Recommendations</div>
    ${growthBlock('Key Strengths & Core Contributions', review.strengths)}
    ${growthBlock('Development Areas & Growth Opportunities', review.improvements)}
    ${growthBlock('Manager Overall Summary', review.managerOverallComments, '#1d4ed8')}
    ${growthBlock('HOD Overall Comments', review.hodOverallComments, '#7c3aed')}
    ${growthBlock('HR Calibration Remarks', review.hrComments, '#0f172a')}

    <div class="signatures-section">
      <p style="font-size: 10px; color: #64748b; margin: 4px 0;">
        This record has been finalized and permanently locked by HR. All ratings, scores, and growth commentary above reflect the official quarterly outcome.
      </p>
      <div class="sig-grid">
        <div>
          <div class="sig-line">
            <div class="sig-name">${esc(review.managerName)}</div>
            <div class="sig-role">Reporting Manager</div>
            <div class="sig-status">✓ Digitally Scored</div>
          </div>
        </div>
        <div>
          <div class="sig-line">
            <div class="sig-name">${esc(review.hodName || 'Head of Department')}</div>
            <div class="sig-role">Head of Department</div>
            <div class="sig-status">${review.hodScore ? '✓ Digitally Calibrated' : '—'}</div>
          </div>
        </div>
        <div>
          <div class="sig-line">
            <div class="sig-name">${esc(settings.signatoryName)}</div>
            <div class="sig-role">${esc(settings.signatoryTitle)}</div>
            <div class="sig-status" style="color: #4338ca;">✓ Digitally Certified & Locked</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      ${esc(settings.customFooterText || 'This document is authenticated by Corporate HR & Performance Registry. Confidential & Proprietary.')}
    </div>
  </div>
</body>
</html>
`;
}

/** Generates and downloads a vector-quality PDF of the review letter directly in the browser. */
export async function downloadReviewLetterPdf(
  review: EmployeeReview,
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS,
  filename?: string
): Promise<void> {
  const htmlContent = generateReviewLetterHtml(review, settings);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fname =
      filename ||
      `Quarterly_Review_Letter_${review.employeeCode}_${review.employeeName.replace(/\s+/g, '_')}_${review.reviewPeriodName.replace(/\s+/g, '_')}.pdf`;
    pdf.save(fname);
  } finally {
    document.body.removeChild(container);
  }
}
