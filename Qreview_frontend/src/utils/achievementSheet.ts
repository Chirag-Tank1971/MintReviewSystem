/**
 * Sales Achievement sheet: one row per BDM with Target Achieved, Actual Target, Turnover and a
 * Percentage Achievement. Layout mirrors the "FINAL ACHIVEMENT SHEET" Excel template.
 */

export interface AchievementRow {
  employeeId: string;
  employeeName: string;
  targetAchieved: number;
  actualTarget: number;
  turnover: number;
  /** Percentage Achievement as typed in by the creator, in percent (85.5 = 85.5%). null = not set. */
  percentage?: number | null;
}

export interface AchievementReport {
  id?: string;
  financialYear: string;
  rows: AchievementRow[];
  status?: 'DRAFT' | 'FINAL' | 'LOCKED';
  createdByName?: string;
  updatedAt?: string;
}

/**
 * Percentage Achievement for one row, as a fraction (0.85 = 85%), or null when none was entered.
 *
 * The creator types it in for now. If it should be calculated from the other columns instead, this
 * is the ONE place to change: the modal, the table and the Excel export all call this function.
 */
export function percentAchievement(row: Pick<AchievementRow, 'percentage'>): number | null {
  const p = row.percentage;
  return typeof p === 'number' && Number.isFinite(p) ? p / 100 : null;
}

export function sheetTotals(rows: AchievementRow[]) {
  const sum = (f: 'targetAchieved' | 'actualTarget' | 'turnover') => rows.reduce((t, r) => t + (Number(r[f]) || 0), 0);
  const totals = { targetAchieved: sum('targetAchieved'), actualTarget: sum('actualTarget'), turnover: sum('turnover') };
  // Total percentage = the average of the percentages entered for the BDMs (rows left blank are skipped).
  // This is the ONE place to change if it should be worked out differently, e.g. total achieved / total target.
  const entered = rows.map((r) => percentAchievement(r)).filter((p): p is number => p !== null);
  const percent = entered.length ? entered.reduce((a, b) => a + b, 0) / entered.length : null;
  return { ...totals, percent };
}

export const formatAmount = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-IN');

export const formatPercent = (fraction: number | null) =>
  fraction === null || !Number.isFinite(fraction) ? '—' : `${(fraction * 100).toFixed(2)}%`;

/** "FINAL ACHIVEMENT SHEET 2024-2025" style title (keeps the template's wording, minus the typo). */
export function sheetTitle(financialYear: string): string {
  const m = String(financialYear).match(/(\d{4})\s*-\s*(\d{2,4})/);
  if (!m) return `FINAL ACHIEVEMENT SHEET ${financialYear}`.trim();
  const end = m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2];
  return `FINAL ACHIEVEMENT SHEET ${m[1]}-${end}`;
}

/**
 * Downloads the sheet as .xlsx, styled like the "FINAL ACHIVEMENT SHEET" template: three blank rows,
 * the bordered title on row 4, a tall bold header on row 5 (teal Percentage column), one row per BDM,
 * a spare bordered row, then the yellow Total Amount row with SUM formulas.
 * `includeTotals` is false for a BDM's own view, which has just their row.
 */
export async function downloadAchievementXlsx(report: AchievementReport, includeTotals = true): Promise<void> {
  // xlsx-js-style is SheetJS with cell styling; plain xlsx cannot write borders or fills
  const XLSX = (await import('xlsx-js-style')).default as any;

  const side = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: side, bottom: side, left: side, right: side };
  const bold = { name: 'Calibri', sz: 11, bold: true };
  const plain = { name: 'Calibri', sz: 11 };
  const YELLOW = { patternType: 'solid', fgColor: { rgb: 'FFFF00' } };
  const TEAL = { patternType: 'solid', fgColor: { rgb: 'A2C4C9' } };

  const rows = report.rows;
  const spare = includeTotals ? 1 : 0; // the template keeps one empty row above the total
  const first = 6;
  const last = first + rows.length + spare - 1;
  const totalRow = last + 1;

  const ws: Record<string, any> = {};
  const put = (addr: string, cell: any) => { ws[addr] = cell; };
  const text = (v: string, s: any) => ({ t: 's', v, s });
  const num = (v: number, s: any) => ({ t: 'n', v, s });
  const blank = (s: any) => ({ t: 's', v: '', s });

  // Title (row 4), merged across A:E
  put('A4', text(sheetTitle(report.financialYear), { font: bold, border, alignment: { horizontal: 'center', vertical: 'center' } }));
  for (const c of ['B', 'C', 'D', 'E']) put(`${c}4`, blank({ border }));

  // Header (row 5)
  const head = (v: string, horizontal: string, fill?: any) =>
    text(v, { font: bold, border, fill, alignment: { horizontal, vertical: 'bottom' } });
  put('A5', head('BDM', 'left'));
  put('B5', head('Target Achived', 'center'));
  put('C5', head('Actual Target', 'center'));
  put('D5', head('Turnover', 'left'));
  put('E5', head('Percentage Achievement', 'left', TEAL));

  // Data rows, plus the spare empty row
  const numStyle = { font: plain, border, numFmt: '#,##0' };
  const pctStyle = { font: plain, border, numFmt: '0.00%' };
  for (let i = 0; i <= last - first; i++) {
    const n = first + i;
    const r = rows[i];
    put(`A${n}`, r ? text(r.employeeName.toUpperCase(), { font: plain, border }) : blank({ font: plain, border }));
    put(`B${n}`, r ? num(r.targetAchieved, numStyle) : blank(numStyle));
    put(`C${n}`, r ? num(r.actualTarget, numStyle) : blank(numStyle));
    put(`D${n}`, r ? num(r.turnover, numStyle) : blank(numStyle));
    const pct = r ? percentAchievement(r) : null;
    put(`E${n}`, pct === null ? blank(pctStyle) : num(pct, pctStyle));
  }

  // Total row: yellow, SUM formulas (v is the cached value, so it shows even before Excel recalculates)
  let ref = `A1:E${last}`;
  if (includeTotals) {
    const totals = sheetTotals(rows);
    const tot = { font: bold, border, fill: YELLOW, numFmt: '#,##0' };
    put(`A${totalRow}`, text('Total Amount', { font: bold, border, fill: YELLOW }));
    put(`B${totalRow}`, { t: 'n', v: totals.targetAchieved, f: `SUM(B${first}:B${last})`, s: tot });
    put(`C${totalRow}`, { t: 'n', v: totals.actualTarget, f: `SUM(C${first}:C${last})`, s: tot });
    put(`D${totalRow}`, { t: 'n', v: totals.turnover, f: `SUM(D${first}:D${last})`, s: tot });
    // Same rule as on screen: the average of the entered percentages (empty when none were entered)
    put(`E${totalRow}`, totals.percent === null
      ? blank(pctStyle)
      : { t: 'n', v: totals.percent, f: `AVERAGE(E${first}:E${last})`, s: pctStyle });
    ref = `A1:E${totalRow}`;
  }

  ws['!ref'] = ref;
  ws['!merges'] = [{ s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }];
  ws['!cols'] = [{ wch: 17.2 }, { wch: 17.1 }, { wch: 30.4 }, { wch: 16.8 }, { wch: 40.6 }];
  ws['!rows'] = [];
  ws['!rows'][4] = { hpt: 56 }; // the template's tall header row

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const slug = String(report.financialYear).replace(/[^a-zA-Z0-9-]/g, '');
  XLSX.writeFile(wb, `Sales_Achievement_${slug}.xlsx`);
}
