import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChampsSlab {
  amcTargetLacs: number;
  amcIncentiveLacs: number;
  gm2AchievementLacs: number;
  salesIncentiveLacs: number;
}

export interface ChampsReportData {
  employeeName: string;
  financialYear: string;        // e.g. "FY 2026-27"
  fyDateRange: string;          // e.g. "01.04.2026 – 31.03.2027"
  publishedDate: string;        // e.g. "1st April 2026"
  gm2TargetCr: string;          // e.g. "0.96 Cr"
  slabs: ChampsSlab[];          // exactly 4 rows
  mintValue?: string;           // e.g. "Strive for Excellence"
  incentiveSchemeName?: string; // optional subtitle like "(added Neeraj portion too)"
  rules?: Partial<ChampsRules>;
  customRuleText?: string;
}

export interface ChampsRules {
  collectionRiders: boolean;
  mintAiMultiplier: boolean;
  q1Qualifier: boolean;
  teamPerformanceLink: boolean;
  oemBackend: boolean;
  advanceWithdrawal: boolean;
  bdDeduction: boolean;
  schemeReview: boolean;
  repairContribution: boolean;
  miscMargin: boolean;
  collectionCycle: boolean;
  topLineDefinition: boolean;
  teamThreshold: boolean;
}

export const DEFAULT_CHAMPS_RULES: ChampsRules = {
  collectionRiders: true,
  mintAiMultiplier: true,
  q1Qualifier: true,
  teamPerformanceLink: true,
  oemBackend: true,
  advanceWithdrawal: true,
  bdDeduction: true,
  schemeReview: true,
  repairContribution: true,
  miscMargin: true,
  collectionCycle: true,
  topLineDefinition: true,
  teamThreshold: true,
};

/** Escapes text typed by HR so it can never become markup in the print window or PDF. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Indian financial year (April–March) containing `date`, in the formats the scheme document uses. */
export function financialYearFor(date = new Date()) {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    label: `FY ${start}-${String(start + 1).slice(-2)}`,
    range: `01.04.${start} – 31.03.${start + 1}`,
    published: `1st April ${start}`,
  };
}

/**
 * Terms & Conditions as HTML list items, split into the document's two columns. Shared by the
 * PDF/print template and the in-app employee view so both always show the same, HR-selected terms.
 * Every item is a fixed string except customRuleText, which is escaped.
 */
export function champsTermsHtml(data: Pick<ChampsReportData, 'rules' | 'customRuleText'>): { left: string[]; right: string[] } {
  const rules: ChampsRules = { ...DEFAULT_CHAMPS_RULES, ...(data.rules || {}) };

  // Left T&C column
  const leftTCs: string[] = [];
  if (rules.collectionRiders) {
    leftTCs.push(`<li><strong>Collection riders</strong> (payment timing multipliers):
      <ul style="margin-top:3px;padding-left:14px;">
        <li>Within 15 days: Achievement = Achv &times; 1.20</li>
        <li>Within 21 days: Achievement = Achv &times; 1.10</li>
        <li>Within 22&ndash;30 days: No adjustment</li>
        <li>Within 31&ndash;45 days: Achievement = Achv &times; 0.85</li>
        <li>After 45 days: Achievement = Achv &times; 0.75</li>
        <li style="margin-top:2px;">Add 7 days for PUBLIC Undertakings and 15 days for other Govt (incl. NIC/NICSI).</li>
      </ul>
    </li>`);
  }
  if (rules.topLineDefinition) {
    leftTCs.push(`<li><strong>Top Line</strong> is billing price to client without GST.</li>`);
  }
  if (rules.repairContribution) {
    leftTCs.push(`<li><strong>All One-time Repair:</strong> Contribution = Gross Margin &times; 0.8</li>`);
  }
  if (rules.miscMargin) {
    leftTCs.push(`<li><strong>Misc / page-per-print etc.</strong> = margin after costing support.</li>`);
  }
  if (rules.teamPerformanceLink) {
    leftTCs.push(`<li>The <strong>team performance incentive</strong> is LINKED TO individual achievement incentive on a sliding ratio scale.</li>`);
  }
  if (rules.advanceWithdrawal) {
    leftTCs.push(`<li><strong>INCENTIVE OF AMC AND SALES IS INDEPENDENT OF EACH OTHER</strong> &mdash; You can withdraw &#8377;50,000/- per Qtr from your annual incentive.</li>`);
  }

  // Right T&C column
  const rightTCs: string[] = [];
  if (rules.mintAiMultiplier) {
    rightTCs.push(`<li><strong>MINT-AI&trade; Solutions:</strong> Orders featuring MINT-AI solutions carry a <strong>1.15&times; multiplier</strong> on GM2 for incentive calculation purposes.</li>`);
  }
  if (rules.q1Qualifier) {
    rightTCs.push(`<li><strong>Q1 Target:</strong> A minimum of 25% of annual GM2 target must be achieved by end of Q1 to qualify for Q1 advance.</li>`);
  }
  if (rules.oemBackend) {
    rightTCs.push(`<li><strong>50% of OEM back-end scheme</strong> to be also calculated in Contribution achievement.</li>`);
  }
  if (rules.teamThreshold) {
    rightTCs.push(`<li>If company total team achievement is <strong>less than &#8377;600 Lacs GM2</strong>, all incentive payouts will be reduced by 25%.</li>`);
  }
  if (rules.bdDeduction) {
    rightTCs.push(`<li>All cases where <strong>BD is beyond 10% of Net Margin</strong> will be treated at 2&times; for the entire BD amount deduction purpose.</li>`);
  }
  if (rules.collectionCycle) {
    rightTCs.push(`<li><strong>Achievement for incentive calculation:</strong> complete sales cycle including payment collection will be counted.</li>`);
  }
  if (rules.schemeReview) {
    rightTCs.push(`<li>The scheme will be <strong>formally reviewed</strong> and course correction will be made at the end of Q2.</li>`);
  }
  rightTCs.push(`<li>You are free to increase the target &amp; communicate an upward-revised plan for incentives <strong>latest by Q2.</strong></li>`);
  rightTCs.push(`<li>The incentive is applicable after completing work for the complete FY and meeting the above achievement, and collecting all outstanding dues for this financial year.</li>`);
  rightTCs.push(`<li>Scheme can be withdrawn at any stage; this is to incentivise the sales person and does not legally bind the company.</li>`);
  if (data.customRuleText) {
    rightTCs.push(`<li>${escapeHtml(data.customRuleText)}</li>`);
  }

  return { left: leftTCs, right: rightTCs };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HTML Generator — replicates the MINT Champs PDF template exactly
// ─────────────────────────────────────────────────────────────────────────────

export function generateChampsHtml(data: ChampsReportData): string {
  const mintValue = escapeHtml(data.mintValue || 'Strive for Excellence');
  const fy = escapeHtml(data.financialYear || financialYearFor().label);
  const name = escapeHtml(data.employeeName);
  const schemeName = data.incentiveSchemeName ? ` ( ${escapeHtml(data.incentiveSchemeName)} )` : '';
  // Date range and published date are optional; leave them out rather than show a wrong year
  const fyMeta = [
    `${fy}${data.fyDateRange ? ` (${escapeHtml(data.fyDateRange)})` : ''}`,
    `MINT-Internal Document${data.publishedDate ? ` &ndash; Published ${escapeHtml(data.publishedDate)}` : ''}`,
  ].join(' &nbsp;|&nbsp; ');
  const { left: leftTCs, right: rightTCs } = champsTermsHtml(data);

  const slabRows = (data.slabs || [])
    .map(
      (s, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td>${Number(s.amcTargetLacs) || 0}</td>
      <td>${(Number(s.amcIncentiveLacs) || 0).toFixed(2)}</td>
      <td>${Number(s.gm2AchievementLacs) || 0}</td>
      <td>${(Number(s.salesIncentiveLacs) || 0).toFixed(2)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name} &mdash; MINT Champs ${fy}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      margin: 0; padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-size: 10.5px;
      line-height: 1.5;
    }
    .page {
      width: 297mm;
      min-height: 210mm;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }

    /* HEADER */
    .header {
      background: #0d3b5e;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
    }
    .mint-logo-text {
      font-size: 26px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -1px;
      line-height: 1;
    }
    .mint-logo-text span { color: #34d399; }
    .mint-tagline {
      font-size: 9px;
      color: #94a3b8;
      font-style: italic;
      margin-top: 2px;
    }
    .header-right { text-align: right; }
    .header-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .header-sub {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 3px;
    }

    /* EMPLOYEE BANNER */
    .employee-banner {
      background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1d4ed8 100%);
      padding: 16px 28px;
      text-align: center;
    }
    .employee-name {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .employee-name .fy-accent { color: #34d399; }
    .employee-meta {
      font-size: 9px;
      color: #bfdbfe;
      margin-top: 4px;
    }

    /* BODY */
    .body {
      flex: 1;
      padding: 16px 28px 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* TARGET CARD */
    .target-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-left: 5px solid #0d3b5e;
      border-radius: 8px;
      padding: 10px 20px;
    }
    .target-label { font-size: 12px; font-weight: 700; color: #0f172a; }
    .target-value {
      background: linear-gradient(135deg, #b45309, #d97706);
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      padding: 6px 20px;
      border-radius: 6px;
      letter-spacing: -0.5px;
    }

    /* TABLE */
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #0d3b5e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
      font-size: 10.5px;
    }
    thead tr { background: #0d3b5e; color: #ffffff; }
    thead th {
      padding: 9px 12px;
      text-align: center;
      font-weight: 700;
      font-size: 10px;
      line-height: 1.3;
      border-right: 1px solid #1e4f7a;
    }
    thead th:last-child { border-right: none; }
    tbody td {
      padding: 8px 12px;
      text-align: center;
      border-right: 1px solid #e2e8f0;
      font-weight: 600;
    }
    tbody td:last-child { border-right: none; }
    .row-even { background: #f1f5f9; }
    .row-odd  { background: #ffffff; }

    /* T&C */
    .tc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 24px;
    }
    .tc-col ul {
      margin: 0;
      padding-left: 16px;
      list-style-type: disc;
    }
    .tc-col ul li {
      margin-bottom: 4px;
      color: #334155;
      font-size: 9.5px;
      line-height: 1.45;
    }
    .tc-col ul li ul {
      list-style-type: circle;
      margin-top: 2px;
    }

    /* FOOTER */
    .footer {
      background: #0d3b5e;
      padding: 10px 28px;
      margin-top: auto;
      text-align: center;
    }
    .footer-text { font-size: 9px; color: #94a3b8; }
    .footer-text strong { color: #34d399; }

    @media print {
      body { margin: 0; }
      .page { width: 100%; min-height: 100vh; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="mint-logo-text">M<span>INT</span></div>
      <div class="mint-tagline">MINT Value: ${mintValue}</div>
    </div>
    <div class="header-right">
      <div class="header-title">MINT Champs ${fy}</div>
      <div class="header-sub">M Intergraph Systems Pvt Ltd &nbsp;|&nbsp; ${fy} &nbsp;|&nbsp; MINT-Internal Document</div>
    </div>
  </div>

  <!-- EMPLOYEE BANNER -->
  <div class="employee-banner">
    <div class="employee-name">${name} &mdash; MINT Champs <span class="fy-accent">${fy}</span></div>
    <div class="employee-meta">
      M Intergraph Systems Pvt Ltd &nbsp;|&nbsp; ${fyMeta}
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- GM2 TARGET -->
    <div class="target-card">
      <div class="target-label">Bottom Line &ndash; Individual Target (GM2 Margin)</div>
      <div class="target-value">&#8377;${escapeHtml(data.gm2TargetCr)}</div>
    </div>

    <!-- INCENTIVE SLAB TABLE -->
    <div>
      <div class="section-title">Incentive Scheme${schemeName}</div>
      <table>
        <thead>
          <tr>
            <th>Total AMC Target<br>in Lacs</th>
            <th>Incentive for AMC<br>(in Lacs)</th>
            <th>GM2 Contribution Achievement<br>(in Lacs)</th>
            <th>Total Incentive in Lacs<br>(for Sales)</th>
          </tr>
        </thead>
        <tbody>
          ${slabRows}
        </tbody>
      </table>
    </div>

    <!-- TERMS & CONDITIONS -->
    <div>
      <div class="section-title">Terms &amp; Conditions</div>
      <div class="tc-grid">
        <div class="tc-col"><ul>${leftTCs.join('')}</ul></div>
        <div class="tc-col"><ul>${rightTCs.join('')}</ul></div>
      </div>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-text">
      <strong>MINT Value: ${mintValue}</strong> &nbsp;|&nbsp; solutions@mintergraph.com &nbsp;|&nbsp; www.mintergraph.com
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Print (popup window)
// ─────────────────────────────────────────────────────────────────────────────

export function printChampsReport(data: ChampsReportData): void {
  const html = generateChampsHtml(data);
  const win = window.open('', '_blank', 'width=1200,height=850');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 300);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PDF download (html2canvas + jsPDF, landscape A4)
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadChampsPdf(data: ChampsReportData): Promise<void> {
  const html = generateChampsHtml(data);

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1123px;background:#fff;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h);

    const safeName = data.employeeName.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');
    const fySlug = (data.financialYear || financialYearFor().label).replace(/[^a-zA-Z0-9-]/g, '');
    pdf.save(`MINT_Champs_${fySlug}_${safeName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
