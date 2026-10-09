import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { Appraisal } from '../types';

export interface LetterSettings {
  companyName: string;
  divisionName: string;
  headquarters: string;
  signatoryName: string;
  signatoryTitle: string;
  includeBreakdown: boolean;
  includeQuarterlyHistory: boolean;
  customFooterText?: string;
}

export const DEFAULT_LETTER_SETTINGS: LetterSettings = {
  companyName: 'ENTERPRISE PERFORMANCE MANAGEMENT',
  divisionName: 'Human Resources & Compensation Calibration Division',
  headquarters: 'Global Headquarters • Technology & People Operations',
  signatoryName: 'Pooja Iyer',
  signatoryTitle: 'Head of Global People Operations & HR',
  includeBreakdown: true,
  includeQuarterlyHistory: true,
  customFooterText: 'This is a system-generated compensation revision document registered in the corporate audit registry.',
};

interface SalaryBreakdown {
  basic: number;
  hra: number;
  specialAllowance: number;
  pfEmployer: number;
  grossAnnual: number;
  grossMonthly: number;
}

export function calculateSalaryBreakdown(ctc: number): SalaryBreakdown {
  const annual = Math.max(0, ctc);
  const basic = Math.round(annual * 0.50); // 50% Basic
  const hra = Math.round(annual * 0.25); // 25% HRA
  const specialAllowance = Math.round(annual * 0.15); // 15% Special Allowance
  const pfEmployer = annual - (basic + hra + specialAllowance); // Remaining 10%
  const grossAnnual = annual;
  const grossMonthly = Math.round(annual / 12);

  return {
    basic,
    hra,
    specialAllowance,
    pfEmployer,
    grossAnnual,
    grossMonthly,
  };
}

export function generateLetterHtml(
  appraisal: Appraisal,
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS,
  refNumber?: string
): string {
  const currency = appraisal.currency || '₹';
  const currentCtc = appraisal.currentCtc || 1800000;
  const incPercent = appraisal.approvedIncrementPercentage || appraisal.proposedIncrementPercentage || 12;
  const incAmount = appraisal.incrementAmount || Math.round((currentCtc * incPercent) / 100);
  const revisedCtc = appraisal.revisedCtc || (currentCtc + incAmount);

  const oldBreakdown = calculateSalaryBreakdown(currentCtc);
  const newBreakdown = calculateSalaryBreakdown(revisedCtc);

  const ref = refNumber || `HR/APP/${appraisal.appraisalYear || 2026}/${appraisal.employeeCode}`;
  const todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const effectiveDate = appraisal.effectiveDate || `${appraisal.appraisalYear || 2026}-10-01`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Appraisal Letter - ${appraisal.employeeName} (${appraisal.employeeCode})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 11.5px;
      line-height: 1.55;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #312e81;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 800;
      color: #1e1b4b;
      letter-spacing: -0.3px;
    }
    .brand-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 500;
    }
    .ref-block {
      text-align: right;
      font-size: 11px;
      color: #334155;
    }
    .confidential-tag {
      font-size: 9.5px;
      font-weight: 800;
      color: #dc2626;
      letter-spacing: 1.2px;
      margin-bottom: 3px;
    }
    .recipient-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #4f46e5;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .recipient-name {
      grid-column: span 2;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .recipient-detail {
      font-size: 11px;
      color: #475569;
    }
    .subject-line {
      font-weight: 800;
      color: #0f172a;
      font-size: 12px;
      margin: 12px 0 10px 0;
      padding-bottom: 4px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .highlight-pill {
      display: inline-block;
      background: #eef2ff;
      color: #3730a3;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #c7d2fe;
    }
    .promotion-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 10px 12px;
      margin: 12px 0;
      color: #92400e;
      font-size: 11px;
    }
    .table-container {
      margin: 14px 0;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      padding: 7px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .table-total {
      background: #f8fafc;
      font-weight: 700;
      border-top: 1.5px solid #cbd5e1;
      color: #0f172a;
    }
    .text-right {
      text-align: right;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .positive-inc {
      color: #059669;
      font-weight: 700;
    }
    .quarterly-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 12px 0;
    }
    .q-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
    }
    .q-period {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
    }
    .q-score {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 1px;
    }
    .signatures-section {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
    }
    .sig-name {
      font-weight: 700;
      color: #1e293b;
      font-size: 11px;
    }
    .sig-role {
      font-size: 9.5px;
      color: #64748b;
    }
    .sig-status {
      font-size: 8.5px;
      color: #059669;
      font-weight: 600;
      margin-top: 2px;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px;
      color: rgba(99, 102, 241, 0.03);
      font-weight: 900;
      pointer-events: none;
      z-index: 0;
    }
    .ack-box {
      margin-top: 14px;
      padding: 8px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      font-size: 10px;
      color: #166534;
    }
    .footer-note {
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      margin-top: 20px;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand-title">${settings.companyName}</div>
        <div class="brand-sub">${settings.divisionName}</div>
        <div class="brand-sub">${settings.headquarters}</div>
      </div>
      <div class="ref-block">
        <div class="confidential-tag">STRICTLY CONFIDENTIAL</div>
        <div style="font-weight: 700;">Ref: ${ref}</div>
        <div style="color: #64748b; margin-top: 1px;">Date: ${todayDate}</div>
      </div>
    </div>

    <div class="recipient-card">
      <div class="recipient-name">${appraisal.employeeName}</div>
      <div class="recipient-detail">Employee Code: <span class="font-mono" style="font-weight: 700;">${appraisal.employeeCode}</span></div>
      <div class="recipient-detail">Department: <strong>${appraisal.departmentName}</strong></div>
      <div class="recipient-detail">Current Designation: <strong>${appraisal.designationName}</strong></div>
      <div class="recipient-detail">Cohort Cycle: <strong>${appraisal.cycleName} (${appraisal.appraisalYear || 2026})</strong></div>
    </div>

    <div class="subject-line">
      SUBJECT: ANNUAL APPRAISAL & SALARY REVISION NOTIFICATION — FISCAL YEAR ${appraisal.appraisalYear || 2026}
    </div>

    <p style="margin: 8px 0;">Dear <strong>${appraisal.employeeName}</strong>,</p>

    <p style="margin: 8px 0;">
      We are pleased to inform you of the final outcome of your Annual Performance Appraisal for cycle year <strong>${appraisal.appraisalYear || 2026}</strong> under the <strong>${appraisal.cycleName}</strong> cohort. Following multi-tiered performance calibration across your four quarterly review milestones, the Executive Appraisal Board has ratified your composite performance band as <span class="highlight-pill">${(appraisal.finalRating || appraisal.recommendedRating || 'MEETS_EXPECTATIONS').replace(/_/g, ' ')}</span> with a rolling quarterly average of <strong>${appraisal.averageQuarterlyScore.toFixed(2)} / 5.00</strong>.
    </p>

    ${appraisal.promotionRecommended ? `
    <div class="promotion-box">
      <strong>🎉 Promotion Recognition:</strong> In recognition of your exemplary performance, technical ownership, and team leadership, you are promoted to <strong>${appraisal.promotionDesignationName || 'Lead Specialist'}</strong> effective <strong>${effectiveDate}</strong>.
    </div>
    ` : ''}

    <p style="margin: 8px 0;">
      In recognition of your performance and contributions, your compensation structure has been revised effective <strong>${effectiveDate}</strong> as detailed below:
    </p>

    ${settings.includeBreakdown ? `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Salary Component</th>
            <th class="text-right">Previous (Per Month)</th>
            <th class="text-right">Previous (Per Annum)</th>
            <th class="text-right" style="color: #312e81;">Revised (Per Month)</th>
            <th class="text-right" style="color: #312e81;">Revised (Per Annum)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary (50%)</td>
            <td class="text-right font-mono">${currency}${Math.round(oldBreakdown.basic / 12).toLocaleString()}</td>
            <td class="text-right font-mono">${currency}${oldBreakdown.basic.toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${Math.round(newBreakdown.basic / 12).toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${newBreakdown.basic.toLocaleString()}</td>
          </tr>
          <tr>
            <td>House Rent Allowance (HRA 25%)</td>
            <td class="text-right font-mono">${currency}${Math.round(oldBreakdown.hra / 12).toLocaleString()}</td>
            <td class="text-right font-mono">${currency}${oldBreakdown.hra.toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${Math.round(newBreakdown.hra / 12).toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${newBreakdown.hra.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Special Allowance (15%)</td>
            <td class="text-right font-mono">${currency}${Math.round(oldBreakdown.specialAllowance / 12).toLocaleString()}</td>
            <td class="text-right font-mono">${currency}${oldBreakdown.specialAllowance.toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${Math.round(newBreakdown.specialAllowance / 12).toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${newBreakdown.specialAllowance.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Employer PF & Retiral Benefits (10%)</td>
            <td class="text-right font-mono">${currency}${Math.round(oldBreakdown.pfEmployer / 12).toLocaleString()}</td>
            <td class="text-right font-mono">${currency}${oldBreakdown.pfEmployer.toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${Math.round(newBreakdown.pfEmployer / 12).toLocaleString()}</td>
            <td class="text-right font-mono" style="font-weight: 600;">${currency}${newBreakdown.pfEmployer.toLocaleString()}</td>
          </tr>
          <tr class="table-total">
            <td><strong>Total Fixed CTC (+${incPercent}%)</strong></td>
            <td class="text-right font-mono"><strong>${currency}${oldBreakdown.grossMonthly.toLocaleString()}</strong></td>
            <td class="text-right font-mono"><strong>${currency}${oldBreakdown.grossAnnual.toLocaleString()}</strong></td>
            <td class="text-right font-mono positive-inc"><strong>${currency}${newBreakdown.grossMonthly.toLocaleString()}</strong></td>
            <td class="text-right font-mono positive-inc"><strong>${currency}${newBreakdown.grossAnnual.toLocaleString()}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th class="text-right">Existing Structure</th>
            <th class="text-right">Increment Factor</th>
            <th class="text-right">Revised Structure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 600;">Annual Fixed CTC</td>
            <td class="text-right font-mono">${currency}${currentCtc.toLocaleString()}</td>
            <td class="text-right font-mono positive-inc">+${incPercent}% (+${currency}${incAmount.toLocaleString()})</td>
            <td class="text-right font-mono" style="font-weight: 700; color: #0f172a;">${currency}${revisedCtc.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Monthly Gross Equivalent</td>
            <td class="text-right font-mono">${currency}${Math.round(currentCtc / 12).toLocaleString()}</td>
            <td class="text-right font-mono positive-inc">+${currency}${Math.round(incAmount / 12).toLocaleString()} / mo</td>
            <td class="text-right font-mono" style="font-weight: 700; color: #0f172a;">${currency}${Math.round(revisedCtc / 12).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
    `}

    ${settings.includeQuarterlyHistory && appraisal.quarterlyHistory && appraisal.quarterlyHistory.length > 0 ? `
    <div style="font-weight: 700; font-size: 11px; margin-top: 10px; margin-bottom: 6px;">Consolidated 4-Quarter Evaluation Breakdown:</div>
    <div class="quarterly-grid">
      ${appraisal.quarterlyHistory.map(q => `
        <div class="q-card">
          <div class="q-period">${q.periodName}</div>
          <div class="q-score font-mono">${q.score.toFixed(2)} <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">/ 5.0</span></div>
          <div style="font-size: 9px; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${q.strengths || 'Milestones achieved'}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${appraisal.managerRecommendation?.justification ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-style: italic; color: #475569; font-size: 10.5px;">
      <strong>Manager Calibration Endorsement:</strong> "${appraisal.managerRecommendation.justification}"
    </div>
    ` : ''}

    <div class="signatures-section">
      <p style="font-size: 10px; color: #64748b; margin: 4px 0;">
        All other terms, policies, confidentiality protocols, and conditions of your employment contract remain unchanged and in full effect.
      </p>

      <div class="sig-grid">
        <div>
          <div class="sig-line">
            <div class="sig-name">${appraisal.managerName || 'Reporting Manager'}</div>
            <div class="sig-role">Reporting Manager</div>
            <div class="sig-status">✓ Digitally Calibrated</div>
          </div>
        </div>

        <div>
          <div class="sig-line">
            <div class="sig-name">${appraisal.hodName || 'Head of Department'}</div>
            <div class="sig-role">Head of Department</div>
            <div class="sig-status">✓ Budget Approved</div>
          </div>
        </div>

        <div>
          <div class="sig-line">
            <div class="sig-name">${appraisal.hrApproval?.approvedByName || settings.signatoryName}</div>
            <div class="sig-role">${settings.signatoryTitle}</div>
            <div class="sig-status" style="color: #4338ca;">✓ Digitally Certified & Released</div>
          </div>
        </div>
      </div>

      ${appraisal.employeeAcknowledgement?.acknowledged ? `
      <div class="ack-box">
        <div style="font-weight: 700;">✓ Digitally Acknowledged & Accepted by Employee</div>
        <div>Signed by <strong>${appraisal.employeeAcknowledgement.acknowledgedByName || appraisal.employeeName}</strong> on ${new Date(appraisal.employeeAcknowledgement.acknowledgedAt || '').toLocaleString()}</div>
        ${appraisal.employeeAcknowledgement.comments ? `<div style="font-style: italic; margin-top: 2px;">"${appraisal.employeeAcknowledgement.comments}"</div>` : ''}
      </div>
      ` : ''}
    </div>

    <div class="footer-note">
      ${settings.customFooterText || 'This document is authenticated by Corporate HR & Compensation Registry. Confidential & Proprietary.'}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generates and downloads an individual PDF file directly in the browser
 */
export async function downloadAppraisalPdf(
  appraisal: Appraisal,
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS,
  filename?: string
): Promise<void> {
  const htmlContent = generateLetterHtml(appraisal, settings);

  // Render HTML in hidden off-screen container for crisp html2canvas rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // Standard A4 pixel width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution (2x)
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
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
      `Appraisal_Letter_${appraisal.employeeCode}_${appraisal.employeeName.replace(/\s+/g, '_')}_${appraisal.appraisalYear || 2026}.pdf`;
    pdf.save(fname);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generates an array of individual PDF blobs for batch packaging into ZIP
 */
async function generateAppraisalPdfBlob(
  appraisal: Appraisal,
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS
): Promise<{ filename: string; blob: Blob }> {
  const htmlContent = generateLetterHtml(appraisal, settings);

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
      scale: 1.8,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

    const blob = pdf.output('blob');
    const filename = `Appraisal_Letter_${appraisal.employeeCode}_${appraisal.employeeName.replace(/\s+/g, '_')}_${appraisal.appraisalYear || 2026}.pdf`;

    return { filename, blob };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Batch exports multiple appraisals into a single .zip file
 */
export async function exportAppraisalsToZip(
  appraisals: Appraisal[],
  settings: LetterSettings = DEFAULT_LETTER_SETTINGS,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(`Appraisal_Letters_${appraisals[0]?.appraisalYear || 2026}`);

  for (let i = 0; i < appraisals.length; i++) {
    const appraisal = appraisals[i];
    if (onProgress) {
      onProgress(i + 1, appraisals.length);
    }
    const { filename, blob } = await generateAppraisalPdfBlob(appraisal, settings);
    folder?.file(filename, blob);
  }

  // Also include the payroll CSV summary inside the zip
  const csvContent = generatePayrollCsv(appraisals);
  folder?.file(`Payroll_Compensation_Increment_Summary_${appraisals[0]?.appraisalYear || 2026}.csv`, csvContent);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Appraisal_Letters_Batch_${appraisals.length}_Employees_${appraisals[0]?.appraisalYear || 2026}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports complete payroll reconciliation table as a downloadable CSV
 */
function generatePayrollCsv(appraisals: Appraisal[]): string {
  const headers = [
    'Employee Code',
    'Employee Name',
    'Department',
    'Designation',
    'Cohort Cycle',
    'Fiscal Year',
    '4-Quarter Rolling Score',
    'Performance Band',
    'Previous Annual CTC (INR)',
    'Previous Monthly Gross (INR)',
    'Approved Increment %',
    'Annual Increment Amount (INR)',
    'Revised Annual CTC (INR)',
    'Revised Monthly Gross (INR)',
    'Effective Date',
    'Promotion Recommended',
    'New Designation',
    'Workflow Status',
    'Employee Acknowledged',
    'Acknowledgement Date',
  ];

  const rows = appraisals.map((a) => {
    const currentCtc = a.currentCtc || 1800000;
    const incPct = a.approvedIncrementPercentage || a.proposedIncrementPercentage || 12;
    const incAmt = a.incrementAmount || Math.round((currentCtc * incPct) / 100);
    const revisedCtc = a.revisedCtc || currentCtc + incAmt;
    const oldMonthly = Math.round(currentCtc / 12);
    const newMonthly = Math.round(revisedCtc / 12);
    const ackDate = a.employeeAcknowledgement?.acknowledgedAt
      ? new Date(a.employeeAcknowledgement.acknowledgedAt).toISOString()
      : 'N/A';

    return [
      `"${a.employeeCode}"`,
      `"${a.employeeName}"`,
      `"${a.departmentName}"`,
      `"${a.designationName}"`,
      `"${a.cycleName}"`,
      `"${a.appraisalYear || 2026}"`,
      a.averageQuarterlyScore.toFixed(2),
      `"${(a.finalRating || a.recommendedRating || 'MEETS_EXPECTATIONS').replace(/_/g, ' ')}"`,
      currentCtc,
      oldMonthly,
      incPct,
      incAmt,
      revisedCtc,
      newMonthly,
      `"${a.effectiveDate || `${a.appraisalYear || 2026}-10-01`}"`,
      a.promotionRecommended ? 'YES' : 'NO',
      `"${a.promotionDesignationName || a.designationName}"`,
      `"${a.status}"`,
      a.employeeAcknowledgement?.acknowledged ? 'YES' : 'NO',
      `"${ackDate}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers instant download of the payroll reconciliation CSV
 */
export function downloadPayrollCsv(appraisals: Appraisal[], filename?: string): void {
  const csv = generatePayrollCsv(appraisals);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ||
    `Payroll_Compensation_Reconciliation_${appraisals.length}_Records_${appraisals[0]?.appraisalYear || 2026}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
