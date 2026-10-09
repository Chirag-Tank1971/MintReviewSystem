import * as XLSX from 'xlsx';
import { AuditLogEntry } from '../types';

/**
 * Exports Audit Logs directly to Microsoft Excel format (.xlsx)
 */
export function exportAuditLogsToExcel(logs: AuditLogEntry[]): void {
  const dataRows = logs.map((log) => ({
    'Log ID': log.id,
    'Timestamp': log.timestamp,
    'Module': log.module,
    'Action Type': log.actionType,
    'Actor ID': log.actorId,
    'Actor Name': log.actorName,
    'Actor Role': log.actorRole,
    'Target Employee': log.targetEmployeeName || log.targetEmployeeId || 'N/A',
    'Department': log.targetDepartment || 'N/A',
    'Cycle': log.cycleName || 'N/A',
    'Severity': log.severity,
    'Description': log.description,
    'Diff Summary': log.diffSummary || (typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue || '')),
    'Flagged Compliance': log.isFlaggedCompliance ? 'YES' : 'NO',
    'IP Address': log.ipAddress || '127.0.0.1',
    'User Agent': log.userAgent || 'Web Browser',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Ledger');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Appraisal_Audit_Ledger_${today}.xlsx`);
}

/**
 * Exports Audit Logs directly to CSV format
 */
export function exportAuditLogsToCsv(logs: AuditLogEntry[]): void {
  const headers = [
    'Log ID',
    'Timestamp',
    'Module',
    'Action Type',
    'Actor ID',
    'Actor Name',
    'Actor Role',
    'Target Employee',
    'Department',
    'Cycle',
    'Severity',
    'Description',
    'Diff Summary',
    'Flagged Compliance',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    `"${log.id}"`,
    `"${log.timestamp}"`,
    `"${log.module}"`,
    `"${log.actionType}"`,
    `"${log.actorId}"`,
    `"${log.actorName}"`,
    `"${log.actorRole}"`,
    `"${(log.targetEmployeeName || log.targetEmployeeId || '').replace(/"/g, '""')}"`,
    `"${(log.targetDepartment || '').replace(/"/g, '""')}"`,
    `"${(log.cycleName || '').replace(/"/g, '""')}"`,
    `"${log.severity}"`,
    `"${(log.description || '').replace(/"/g, '""')}"`,
    `"${(log.diffSummary || '').replace(/"/g, '""')}"`,
    log.isFlaggedCompliance ? 'YES' : 'NO',
    `"${log.ipAddress || '127.0.0.1'}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `Appraisal_Audit_Ledger_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
