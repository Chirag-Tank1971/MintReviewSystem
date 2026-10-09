import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
  Users,
  Target,
  History,
  Filter,
  Check,
  AlertCircle,
  ArrowRight,
  Database,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from '../context/ToastContext';
import {
  BulkDatasetType,
  BulkTemplateColumn,
  BulkValidationReport,
  BulkImportResult,
  Cycle,
  Department,
} from '../types';
import { PageHeader } from './ui/PageHeader';
import { SegmentedControl } from './ui/SegmentedControl';

interface BulkImportExportManagerProps {
  onDataImported?: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB upload guardrail
const MAX_BATCH_ROWS = 3000; // 3,000 records recommended per batch
const MAX_FILES = 50; // Real-world KRA scorecards arrive as one workbook per employee — allow selecting/dropping up to 50 at once
const PREVIEW_PAGE_SIZE = 20; // 20 rows per page to prevent DOM memory ballooning

export const BulkImportExportManager: React.FC<BulkImportExportManagerProps> = ({
  onDataImported,
}) => {
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT' | 'HISTORY'>('IMPORT');
  const [selectedDataset, setSelectedDataset] = useState<BulkDatasetType>('employees');

  // Import State
  const [templateColumns, setTemplateColumns] = useState<BulkTemplateColumn[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [skippedFiles, setSkippedFiles] = useState<{ name: string; reason: string }[]>([]);
  const [validationReport, setValidationReport] = useState<BulkValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [allowUpdateExisting, setAllowUpdateExisting] = useState(true);
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [dragActive, setDragActive] = useState(false);

  // Export State
  const [exportCycleId, setExportCycleId] = useState<string>('ALL');
  const [exportDeptId, setExportDeptId] = useState<string>('ALL');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Reference Masters for Filters
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Template Schema when dataset changes
  useEffect(() => {
    loadTemplateSchema(selectedDataset);
  }, [selectedDataset]);

  // Load masters for filters and history
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [cList, dList] = await Promise.all([
          api.getCycles(),
          api.getDepartments(),
        ]);
        setCycles(cList || []);
        setDepartments(dList || []);
      } catch (err) {
        console.error('Failed to load masters:', err);
      }
    };
    fetchMasters();
  }, []);

  const loadTemplateSchema = async (type: BulkDatasetType) => {
    try {
      const res = await api.getBulkTemplate(type);
      setTemplateColumns(res.columns || []);
      setSampleData(res.sampleData || []);
      // Reset current file preview if dataset changes
      setParsedRows([]);
      setValidationReport(null);
      setFileName('');
      setFileNames([]);
      setSkippedFiles([]);
      setImportResult(null);
    } catch (err) {
      console.error('Failed to load template:', err);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const logs = await api.getBulkImportHistory();
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeTab]);

  // ==========================================
  // File Parsing & Handling
  // ==========================================
  // Parses a single file (csv or xlsx/xls) into normalized rows. Isolated per-file so one
  // corrupt/unreadable file in a multi-file batch can be skipped without losing the rest.
  const parseSingleFile = (file: File): Promise<any[]> => {
    const isCsv = file.name.endsWith('.csv');
    if (isCsv) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              resolve(normalizeParsedData(results.data));
            } catch (err) {
              reject(err);
            }
          },
          error: (err) => reject(err),
        });
      });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          if (selectedDataset === 'kras') {
            resolve(parseCustomOrStandardKraWorkbook(workbook));
          } else {
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            resolve(normalizeParsedData(json));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file from disk.'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Handles one or many files in a single batch. Real-world KRA scorecards commonly arrive
  // as one workbook per employee (e.g. "Harsh Tyagi.xlsx"), so HR needs to select/drop up to
  // MAX_FILES of them at once and have every employee's rows merged into one validation pass —
  // not upload them one at a time.
  const handleFilesUpload = (files: File[]) => {
    if (!files || files.length === 0) return;

    if (files.length > MAX_FILES) {
      toast.error(
        `You selected ${files.length} files. A maximum of ${MAX_FILES} files can be uploaded in a single batch. Please split them into smaller groups.`,
        'Too Many Files'
      );
      return;
    }

    // 1. File Size Guardrail (Pre-Read Check) — oversized files are skipped, not fatal to the batch
    const validFiles: File[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push({
          name: file.name,
          reason: `Exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB size limit`,
        });
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      toast.error('All selected files were too large to process.', 'File Too Large');
      setSkippedFiles(rejected);
      return;
    }

    setFileNames(validFiles.map((f) => f.name));
    setFileName(validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} files selected`);
    setImportResult(null);
    setIsParsing(true);
    setPreviewPage(1);
    setSkippedFiles(rejected);

    // Yield control to the browser event loop so React can render the loading state before parsing
    setTimeout(async () => {
      const allRows: any[] = [];
      const parseFailures: { name: string; reason: string }[] = [...rejected];

      const parsedPerFile = await Promise.allSettled(validFiles.map((f) => parseSingleFile(f)));
      parsedPerFile.forEach((result, idx) => {
        const file = validFiles[idx];
        if (result.status === 'fulfilled') {
          allRows.push(...result.value);
        } else {
          parseFailures.push({ name: file.name, reason: result.reason?.message || 'Could not be parsed' });
        }
      });

      setIsParsing(false);
      setSkippedFiles(parseFailures);

      const successfullyParsedCount = files.length - parseFailures.length;
      if (parseFailures.length > 0) {
        toast.warning(
          `${parseFailures.length} of ${files.length} file(s) could not be read and were skipped. The remaining ${successfullyParsedCount} file(s) were parsed successfully.`,
          'Some Files Skipped'
        );
      }

      if (allRows.length === 0) {
        toast.error('No valid rows could be parsed from the selected file(s).', 'Parsing Failed');
        return;
      }

      // Batch Row Count Cap across the combined set of files
      if (allRows.length > MAX_BATCH_ROWS) {
        toast.warning(
          `The selected files contain ${allRows.length} records combined. The maximum recommended batch size is ${MAX_BATCH_ROWS} rows. Please upload fewer files at a time.`,
          'Batch Limit Exceeded'
        );
        return;
      }

      setParsedRows(allRows);
      validateData(selectedDataset, allRows);
    }, 60);
  };

  // Canonical column aliases for human-friendly Excel headers
  const HEADER_ALIASES: Record<string, string> = {
    empcode: 'employeeCode',
    employeecode: 'employeeCode',
    empid: 'employeeCode',
    fullname: 'fullName',
    name: 'fullName',
    employeename: 'fullName',
    officialemail: 'email',
    corporateemail: 'email',
    workemail: 'email',
    emailaddress: 'email',
    joiningdate: 'joiningDate',
    dateofjoining: 'joiningDate',
    doj: 'joiningDate',
    confirmationdate: 'confirmationDate',
    dateofconfirmation: 'confirmationDate',
    doc: 'confirmationDate',
    status: 'status',
    gender: 'gender',
    employmenttype: 'employmentType',
    probationperiodindays: 'probationPeriodDays',
    probationperioddays: 'probationPeriodDays',
    probationperiod: 'probationPeriodDays',
    company: 'companyName',
    companyname: 'companyName',
    location: 'location',
    department: 'department',
    designation: 'designation',
    reportingmanager: 'managerCode',
    reportingmanagerempcode: 'managerCode',
    managercode: 'managerCode',
    manager: 'managerCode',
    hod: 'hodCode',
    hodcode: 'hodCode',
    headofdepartment: 'hodCode',
    ctctotal: 'baseSalary',
    ctc: 'baseSalary',
    annualctc: 'baseSalary',
    baseannualctc: 'baseSalary',
    basesalary: 'baseSalary',
    salary: 'baseSalary',
    cyclecode: 'cycleCode',
    reviewcyclecode: 'cycleCode',
    cycle: 'cycleCode',
    systemrole: 'role',
    role: 'role',
    systemrolecode: 'role',
    accessrole: 'role',
    userrole: 'role',
    employmentstatus: 'status',
    // KRA Aliases
    keyresultarea: 'kraTitle',
    keyresultareas: 'kraTitle',
    kratitle: 'kraTitle',
    kra: 'kraTitle',
    kras: 'kraTitle',
    weightage: 'weightage',
    weight: 'weightage',
    weightpercent: 'weightage',
    weightagepercent: 'weightage',
    target: 'targetDescription',
    targetdescription: 'targetDescription',
    targetmeasures: 'targetDescription',
    targetsmeasures: 'targetDescription',
    objective: 'targetDescription',
    measurementunit: 'measurementUnit',
    unit: 'measurementUnit',
    targetvalue: 'targetValue',
    templatetitle: 'templateTitle',
    templatename: 'templateTitle',
    scoringrubric: 'measurementCriteria',
    measurementcriteria: 'measurementCriteria',
    criteria: 'measurementCriteria',
  };

  const formatExcelCellValue = (canonicalKey: string, val: any): any => {
    if (val === undefined || val === null) return '';
    // Convert serial numbers for date fields
    if (['joiningDate', 'confirmationDate', 'relievingDate'].includes(canonicalKey)) {
      if (typeof val === 'number') {
        if (val > 25000 && val < 75000) {
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{5}$/.test(trimmed)) {
          const num = Number(trimmed);
          const date = new Date(Math.round((num - 25569) * 86400 * 1000));
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
        return trimmed;
      }
    }
    return typeof val === 'string' ? val.trim() : val;
  };

  // Map header names (human friendly or key) to canonical schema keys
  const normalizeParsedData = (rawList: any[]) => {
    return rawList.map((row) => {
      const normalized: Record<string, any> = {};
      Object.entries(row).forEach(([rawKey, val]) => {
        const cleanKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        let targetKey = rawKey;

        // 1. Check known aliases
        if (HEADER_ALIASES[cleanKey]) {
          targetKey = HEADER_ALIASES[cleanKey];
        } else {
          // 2. Match against template columns
          const colMatch = templateColumns.find(
            (c) =>
              c.key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey ||
              c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey
          );
          if (colMatch) {
            targetKey = colMatch.key;
          }
        }

        normalized[targetKey] = formatExcelCellValue(targetKey, val);
      });

      // Clean manager / HOD codes if formatted as "CODE - Name"
      if (normalized.managerCode && typeof normalized.managerCode === 'string' && normalized.managerCode.includes(' - ')) {
        const parts = normalized.managerCode.split(' - ');
        normalized.managerCode = parts[0].trim();
        if (!normalized.managerName && parts[1]) {
          normalized.managerName = parts.slice(1).join(' - ').trim();
        }
      }
      if (normalized.hodCode && typeof normalized.hodCode === 'string' && normalized.hodCode.includes(' - ')) {
        const parts = normalized.hodCode.split(' - ');
        normalized.hodCode = parts[0].trim();
        if (!normalized.hodName && parts[1]) {
          normalized.hodName = parts.slice(1).join(' - ').trim();
        }
      }

      return normalized;
    });
  };

  const parseCustomOrStandardKraWorkbook = (workbook: XLSX.WorkBook) => {
    const allParsedRows: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (!rawRows || rawRows.length === 0) continue;

      let empCode = '';
      let empName = '';
      let designation = '';
      let department = '';
      let headerRowIdx = -1;
      let kraColIdx = -1;
      let weightColIdx = -1;

      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] || '').trim().toLowerCase();
          if (cell === 'emp id' || cell === 'emp code' || cell === 'employee id' || cell === 'employee code') {
            const nextVal = row.slice(c + 1).find((v) => v !== undefined && String(v).trim() !== '');
            if (nextVal) empCode = String(nextVal).trim();
          } else if (cell === 'name' || cell === 'employee name') {
            const nextVal = row.slice(c + 1).find((v) => v !== undefined && String(v).trim() !== '');
            if (nextVal) empName = String(nextVal).trim();
          } else if (cell === 'designation') {
            const nextVal = row.slice(c + 1).find((v) => v !== undefined && String(v).trim() !== '');
            if (nextVal) designation = String(nextVal).trim();
          } else if (cell === 'department') {
            const nextVal = row.slice(c + 1).find((v) => v !== undefined && String(v).trim() !== '');
            if (nextVal) department = String(nextVal).trim();
          }

          if (cell.includes('key result area') || cell === 'kra') {
            kraColIdx = c;
            headerRowIdx = r;
          }
          if ((cell.includes('weightage') || cell === 'weight') && headerRowIdx === r) {
            if (weightColIdx === -1) weightColIdx = c;
          }
        }
        if (headerRowIdx !== -1 && kraColIdx !== -1 && weightColIdx !== -1) break;
      }

      if (headerRowIdx !== -1 && kraColIdx !== -1 && weightColIdx !== -1) {
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row) continue;
          const kraTitle = String(row[kraColIdx] || '').trim();
          const weightVal = Number(row[weightColIdx]);
          if (kraTitle && !isNaN(weightVal) && weightVal > 0) {
            allParsedRows.push({
              employeeCode: empCode,
              employeeName: empName || sheetName,
              designation,
              department,
              templateTitle: (empName || sheetName) ? `${empName || sheetName} - Scorecard` : 'Employee Scorecard',
              kraTitle,
              weightage: weightVal,
              targetDescription: `Target for ${kraTitle}`,
              measurementUnit: 'PERCENTAGE',
              targetValue: '100',
            });
          }
        }
      }
    }

    if (allParsedRows.length > 0) {
      return allParsedRows;
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return normalizeParsedData(json);
  };

  const validateData = async (type: BulkDatasetType, rows: any[]) => {
    if (rows.length === 0) return;
    setIsValidating(true);
    try {
      const report = await api.validateBulkRows(type, rows, allowUpdateExisting);
      setValidationReport(report);
      if (report.errorCount > 0) {
        toast.warning(`Validated with ${report.errorCount} errors and ${report.validCount} valid rows.`, 'Validation Results');
      } else {
        toast.success(`All ${report.totalRows} rows validated successfully!`, 'Validation Passed');
      }
    } catch (err: any) {
      toast.error(`Validation error: ${err.message}`, 'Validation Error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadSample = (format: 'xlsx' | 'csv') => {
    if (sampleData.length === 0) return;

    // Build human-friendly headers from template columns
    const exportData = sampleData.map((row) => {
      const mapped: Record<string, any> = {};
      templateColumns.forEach((c) => {
        mapped[c.label] = row[c.key] !== undefined ? row[c.key] : c.example;
      });
      return mapped;
    });

    const baseName = `PMS_Template_${selectedDataset.toUpperCase()}`;

    if (format === 'csv') {
      const csvStr = Papa.unparse(exportData);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${baseName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    }
    toast.info(`Downloaded ${baseName} sample template.`, 'Sample Downloaded');
  };

  const handleExecuteImport = async () => {
    if (!validationReport || validationReport.validCount === 0) return;
    setIsImporting(true);
    try {
      const rowsToImport = validationReport.results
        .filter((r) => (skipInvalidRows ? r.isValid : true))
        .map((r) => r.data);

      const result = await api.executeBulkImport(selectedDataset, rowsToImport, {
        skipInvalid: skipInvalidRows,
        allowUpdateExisting,
        fileName: fileName || `${selectedDataset}_batch_import.xlsx`,
      });

      setImportResult(result);
      toast.success(`Imported ${result.successCount} ${selectedDataset} records successfully!`, 'Import Completed');
      if (onDataImported) onDataImported();
    } catch (err: any) {
      toast.error(`Import Failed: ${err.message}`, 'Import Error');
    } finally {
      setIsImporting(false);
    }
  };

  // ==========================================
  // Live Export Generation
  // ==========================================
  const handleExportData = async (type: BulkDatasetType) => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      const res = await api.getBulkExportData(type, {
        cycleId: exportCycleId,
        departmentId: exportDeptId,
      });

      const records = res.data || [];
      if (records.length === 0) {
        toast.warning('No matching records found for the selected filters.', 'No Records');
        setIsExporting(false);
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `PMS_Export_${type.toUpperCase()}_${timestamp}`;

      if (exportFormat === 'json') {
        const jsonStr = JSON.stringify(records, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'csv') {
        const csvStr = Papa.unparse(records);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, type);
        XLSX.writeFile(wb, `${filename}.xlsx`);
      }

      const msg = `Successfully generated & downloaded ${records.length} records!`;
      setExportSuccessMsg(msg);
      toast.success(msg, 'Export Successful');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err: any) {
      toast.error(`Export Failed: ${err.message}`, 'Export Error');
    } finally {
      setIsExporting(false);
    }
  };

  const DATASET_CARDS: Array<{
    id: BulkDatasetType;
    title: string;
    description: string;
    icon: any;
    color: string;
    badge: string;
  }> = [
    {
      id: 'employees',
      title: 'Employee Master Directory',
      description: 'Bulk create/update employees, appraisal cycle assignments, base CTC, and reporting managers.',
      icon: Users,
      color: 'indigo',
      badge: 'Core Foundation',
    },
    {
      id: 'kras',
      title: 'KRA & KPI Template Library',
      description: 'Upload weighted performance key result areas (100% total), targets, units, and role templates.',
      icon: Target,
      color: 'teal',
      badge: 'Scoring Weights',
    },
  ];

  const filteredResults =
    validationReport?.results.filter((r) => {
      if (statusFilter === 'ALL') return true;
      return r.status === statusFilter;
    }) || [];

  const totalPages = Math.ceil(filteredResults.length / PREVIEW_PAGE_SIZE) || 1;
  const paginatedResults = filteredResults.slice(
    (previewPage - 1) * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import and export"
        description="Bring master data in from Excel or CSV, export it, and see past imports."
        actions={
          <SegmentedControl
            ariaLabel="Section"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'IMPORT', label: 'Import', icon: Upload },
              { value: 'EXPORT', label: 'Export', icon: Download },
              { value: 'HISTORY', label: 'History', icon: History },
            ]}
          />
        }
      />

      {/* ========================================================================= */}
      {/* TAB 1: BULK IMPORTER */}
      {/* ========================================================================= */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-6">
          {/* Dataset Selector Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Select ingestion dataset
              </h2>
              <span className="text-xs text-slate-400 font-medium">Step 1 of 3</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {DATASET_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isSelected = selectedDataset === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedDataset(card.id)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white dark:bg-slate-850 border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {card.badge}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{card.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {isSelected ? 'Active Dataset' : 'Select'}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 font-bold" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload & Template Downloader Zone */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Drag & Drop Zone */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Upload spreadsheet data file
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Supports Microsoft Excel (<code className="text-indigo-600 dark:text-indigo-400 tabular-nums">.xlsx</code>, <code className="text-indigo-600 dark:text-indigo-400 tabular-nums">.xls</code>) or standard comma-separated (<code className="text-indigo-600 dark:text-indigo-400 tabular-nums">.csv</code>).
                  </p>
                </div>
              </div>

              {/* Drag Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesUpload(Array.from(e.dataTransfer.files));
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]'
                    : fileName
                    ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesUpload(Array.from(e.target.files));
                    }
                    // Allow re-selecting the same file(s) after a change of dataset/reset
                    e.target.value = '';
                  }}
                />

                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>

                {isParsing ? (
                  <div className="py-2">
                    <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="font-bold text-slate-900 dark:text-white text-base">Reading & parsing spreadsheet...</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Decompressing records and mapping columns. Please wait a moment.
                    </p>
                  </div>
                ) : fileName ? (
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {fileNames.length > 1 ? `${fileNames.length} Files Loaded` : 'File Loaded'}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-base">{fileName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {parsedRows.length} rows detected across {fileNames.length || 1} file{fileNames.length !== 1 ? 's' : ''} • Click to choose different file(s)
                    </p>
                    {fileNames.length > 1 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 truncate max-w-md mx-auto" title={fileNames.join(', ')}>
                        {fileNames.slice(0, 4).join(', ')}
                        {fileNames.length > 4 ? ` +${fileNames.length - 4} more` : ''}
                      </p>
                    )}
                    {skippedFiles.length > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                        {skippedFiles.length} file{skippedFiles.length !== 1 ? 's' : ''} skipped: {skippedFiles.map((f) => f.name).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      Drag & drop Excel or CSV file(s) here, or <span className="text-indigo-600 dark:text-indigo-400 underline">Browse files</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                      {selectedDataset === 'kras'
                        ? `Select up to ${MAX_FILES} files at once (e.g. one workbook per employee) • Max 10 MB each`
                        : `Up to ${MAX_FILES} files at once`}
                      {' '}• Recommended up to {MAX_BATCH_ROWS.toLocaleString()} rows per batch
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Options Checklist */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowUpdateExisting}
                    onChange={(e) => {
                      setAllowUpdateExisting(e.target.checked);
                      if (parsedRows.length > 0) validateData(selectedDataset, parsedRows);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Upsert mode: update existing records if matching key exists
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipInvalidRows}
                    onChange={(e) => setSkipInvalidRows(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Fault tolerance: skip invalid rows and import remaining valid entries
                  </span>
                </label>
              </div>
            </div>

            {/* Right: Template Schema & Downloader */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Template specifications
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {templateColumns.length} Columns
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Download pre-formatted sample templates with pre-configured header columns and dummy rows for instant population.
                </p>

                {/* Column chips preview */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {templateColumns.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750 text-xs"
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{col.label}</span>
                        {col.required && (
                          <span className="text-[11px] text-rose-500 dark:text-rose-400 font-bold shrink-0">*Req</span>
                        )}
                      </div>
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  onClick={() => handleDownloadSample('xlsx')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Download Excel template (.xlsx)
                </button>
                <button
                  onClick={() => handleDownloadSample('csv')}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Download CSV template (.csv)
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* Step 3: Interactive Pre-Commit Validation & Data Table */}
          {/* ================================================================= */}
          {isValidating && (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-2" />
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Validating records against PMS constraints...</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Checking joining cycle dates, manager relationships, email unicity, and rating ranges.
              </p>
            </div>
          )}

          {validationReport && !isValidating && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {/* Validation Summary Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-850/50">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Validation report:
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md">
                      {validationReport.totalRows} Total Rows
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {validationReport.validCount || 0} Valid
                    </span>
                    {(validationReport.warningCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {validationReport.warningCount} Warnings
                      </span>
                    )}
                    {(validationReport.errorCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-md">
                        <XCircle className="w-3.5 h-3.5" />
                        {validationReport.errorCount} Errors
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter and Commit Action */}
                <div className="flex items-center gap-3">
                  {/* Status Filter */}
                  <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1 text-xs font-semibold">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        statusFilter === 'ALL' ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      All ({validationReport.totalRows})
                    </button>
                    <button
                      onClick={() => setStatusFilter('VALID')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        statusFilter === 'VALID' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Valid ({validationReport.validCount || 0})
                    </button>
                    {(validationReport.errorCount || 0) > 0 && (
                      <button
                        onClick={() => setStatusFilter('ERROR')}
                        className={`px-2.5 py-1 rounded-md cursor-pointer ${
                          statusFilter === 'ERROR' ? 'bg-rose-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Errors ({validationReport.errorCount})
                      </button>
                    )}
                  </div>

                  {/* Primary Commit Button */}
                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || validationReport.validCount === 0}
                    className="flex items-center gap-2 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Committing {validationReport.validCount} Records...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Commit & Sync {validationReport.validCount} Records
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-14">#</th>
                      <th className="py-2.5 px-3 w-28">Status</th>
                      <th className="py-2.5 px-3 w-24">Action</th>
                      {templateColumns.slice(0, 6).map((c) => (
                        <th key={c.key} className="py-2.5 px-3">
                          {c.label}
                        </th>
                      ))}
                      <th className="py-2.5 px-3">Validation details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {paginatedResults.map((res) => {
                      const isError = res.status === 'ERROR';
                      const isWarning = res.status === 'WARNING';
                      return (
                        <tr
                          key={res.rowNumber}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isError ? 'bg-rose-50/20 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 tabular-nums text-slate-400 dark:text-slate-500 font-bold">{res.rowNumber}</td>
                          <td className="py-2.5 px-3">
                            {res.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                            {res.status === 'WARNING' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                <AlertTriangle className="w-3 h-3" /> Notice
                              </span>
                            )}
                            {res.status === 'ERROR' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md">
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                res.action === 'INSERT'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                  : res.action === 'UPDATE'
                                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {res.action}
                            </span>
                          </td>
                          {templateColumns.slice(0, 6).map((c) => (
                            <td key={c.key} className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                              {String(res.data[c.key] ?? '-')}
                            </td>
                          ))}
                          <td className="py-2.5 px-3">
                            {res.errors.length > 0 && (
                              <div className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {res.errors.join(' • ')}
                              </div>
                            )}
                            {res.warnings.length > 0 && (
                              <div className="text-amber-600 dark:text-amber-400 font-medium text-[11px] flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {res.warnings.join(' • ')}
                              </div>
                            )}
                            {res.isValid && res.warnings.length === 0 && (
                              <span className="text-slate-400 dark:text-slate-500 text-[11px]">All criteria verified</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredResults.length > PREVIEW_PAGE_SIZE && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Showing <strong className="text-slate-800 dark:text-slate-200">{(previewPage - 1) * PREVIEW_PAGE_SIZE + 1}</strong> to{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{Math.min(previewPage * PREVIEW_PAGE_SIZE, filteredResults.length)}</strong> of{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{filteredResults.length}</strong> records
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={previewPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                      Page {previewPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      disabled={previewPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Result Feedback Banner */}
          {importResult && (() => {
            const failedCount = importResult.failedCount || 0;
            const skippedCount = importResult.skippedCount || 0;
            const hasFailures = failedCount > 0;
            return (
              <div
                className={`p-5 rounded-xl border shadow-sm ${
                  hasFailures
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${
                        hasFailures ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      {hasFailures ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4
                        className={`font-bold text-base ${
                          hasFailures ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'
                        }`}
                      >
                        {hasFailures ? 'Bulk Ingestion Completed With Errors' : 'Bulk Ingestion Successfully Committed!'}
                      </h4>
                      <p
                        className={`text-xs mt-0.5 ${
                          hasFailures ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {importResult.message}
                      </p>
                      <div
                        className={`flex items-center gap-4 mt-2 text-xs font-semibold flex-wrap ${
                          hasFailures ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        <span>✓ {importResult.insertedCount} Records Inserted</span>
                        <span>• {importResult.updatedCount} Records Updated</span>
                        {skippedCount > 0 && <span>• {skippedCount} Skipped</span>}
                        {hasFailures && <span>• {failedCount} Failed</span>}
                        <span>• Batch ID: <code className="tabular-nums">{importResult.batchId}</code></span>
                      </div>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <ul className="mt-2.5 space-y-1 text-[11px] text-amber-800 dark:text-amber-300 list-disc list-inside">
                          {importResult.errors.map((e, idx) => (
                            <li key={idx}>Row {e.row}: {e.reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setImportResult(null)}
                    className={`text-xs font-bold bg-white dark:bg-slate-800 border px-3 py-1.5 rounded-lg cursor-pointer ${
                      hasFailures
                        ? 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 border-amber-200 dark:border-amber-700'
                        : 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 border-emerald-200 dark:border-emerald-700'
                    }`}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER DATA EXPORTER */}
      {/* ========================================================================= */}
      {activeTab === 'EXPORT' && (
        <div className="space-y-6">
          {/* Global Filter Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Export filters:
              </div>

              {/* Cycle Filter */}
              <select
                value={exportCycleId}
                onChange={(e) => setExportCycleId(e.target.value)}
                className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All appraisal cycles</option>
                {cycles.filter((c) => c.active !== false).map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Department Filter */}
              <select
                value={exportDeptId}
                onChange={(e) => setExportDeptId(e.target.value)}
                className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Format Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs font-bold">
                <button
                  onClick={() => setExportFormat('xlsx')}
                  className={`px-3 py-1 rounded-md cursor-pointer ${
                    exportFormat === 'xlsx' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`px-3 py-1 rounded-md cursor-pointer ${
                    exportFormat === 'csv' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  CSV (.csv)
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`px-3 py-1 rounded-md cursor-pointer ${
                    exportFormat === 'json' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  JSON (.json)
                </button>
              </div>
            </div>

            {exportSuccessMsg && (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {exportSuccessMsg}
              </span>
            )}
          </div>

          {/* Export Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DATASET_CARDS.map((card) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={card.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <IconComponent className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {card.badge}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{card.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {card.description} Includes real-time joins with master relationships and audit metadata.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      Target format: <strong className="text-slate-700 dark:text-slate-300 tabular-nums">{exportFormat}</strong>
                    </span>
                    <button
                      onClick={() => handleExportData(card.id)}
                      disabled={isExporting}
                      className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Download live dataset
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BATCH IMPORT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Bulk ingestion & exchange audit log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete traceability of batch imports, user sessions, file identifiers, and commit statistics.
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Action type</th>
                  <th className="py-3 px-4">Executed by</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Execution summary</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {historyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      No bulk import batches recorded in audit trail yet.
                    </td>
                  </tr>
                ) : (
                  historyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 tabular-nums font-bold text-indigo-600 dark:text-indigo-400">{log.batchId}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{log.importedBy}</td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {log.userRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md text-slate-600 dark:text-slate-300">{log.details}</td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
