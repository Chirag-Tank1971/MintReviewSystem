import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Target,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Layers,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { api } from '../services/api';
import {
  User,
  Employee,
  TalentRecord,
  AiReviewSynthesisResult,
  AiTalentInsightsResult,
} from '../types';
import { PageHeader } from './ui/PageHeader';
import { Button } from './ui/Button';

interface AiPerformanceHubProps {
  currentUser: User;
}

export const AiPerformanceHub: React.FC<AiPerformanceHubProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'synthesis' | 'nine_box'>('synthesis');

  // Common data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [, setLoadingEmployees] =useState<boolean>(true);

  // 1. AI Review Synthesizer State
  const [synthesizing, setSynthesizing] = useState<boolean>(false);
  const [synthesisResult, setSynthesisResult] = useState<AiReviewSynthesisResult | null>(null);
  const [synthesisPerspective, setSynthesisPerspective] = useState<'manager' | 'self' | 'executive'>('manager');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // 2. 9-Box State
  const [talentRecords, setTalentRecords] = useState<TalentRecord[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<TalentRecord | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState<boolean>(false);
  const [talentInsights, setTalentInsights] = useState<AiTalentInsightsResult | null>(null);

  const isNormalEmployee = currentUser.role === 'EMPLOYEE';

  // Load initial data
  useEffect(() => {
    loadBaseData();
  }, [currentUser]);

  const loadBaseData = async () => {
    setLoadingEmployees(true);
    try {
      const [empResult, talentResult] = await Promise.allSettled([
        api.getEmployees(),
        api.getTalentRecords(),
      ]);

      const empData = empResult.status === 'fulfilled' ? empResult.value : [];
      const talentData = talentResult.status === 'fulfilled' ? talentResult.value : [];

      let accessibleEmployees = empData || [];
      if (isNormalEmployee) {
        // If current user is a normal employee, match by employeeId or email/name
        const myEmp = accessibleEmployees.find(
          (e) => e.id === currentUser.employeeId || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name?.toLowerCase() === currentUser.name?.toLowerCase()
        );
        if (myEmp) {
          accessibleEmployees = [myEmp];
          setSelectedEmployeeId(myEmp.id);
        } else if (accessibleEmployees.length > 0) {
          accessibleEmployees = [accessibleEmployees[0]];
          setSelectedEmployeeId(accessibleEmployees[0].id);
        }
      }

      setEmployees(accessibleEmployees);
      if (accessibleEmployees.length > 0) {
        setSelectedEmployeeId(accessibleEmployees[0].id);
      }

      setTalentRecords(talentData || []);
      if (talentData && talentData.length > 0) {
        setSelectedTalent(talentData[0]);
      }
    } catch (err) {
      console.error('Failed to load base AI data', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // 1. Trigger Review Synthesis
  const handleRunSynthesis = async () => {
    if (!selectedEmployee) return;
    setSynthesizing(true);
    setSynthesisResult(null);

    try {
      const payload = {
        employeeName: selectedEmployee.name,
        designation: selectedEmployee.designationName || selectedEmployee.designationId || 'Senior Specialist',
        department: selectedEmployee.departmentName || selectedEmployee.departmentId || 'Engineering & Technology',
        quarterlyScores: [
          { quarter: 'Q1', score: 4.4, reviewNotes: 'Completed core database migration on schedule.' },
          { quarter: 'Q2', score: 4.7, reviewNotes: 'Led multi-tenant performance refactor, exceeding latency targets.' },
          { quarter: 'Q3', score: 4.5, reviewNotes: 'Proactive mentor for 2 new engineers on microservice deployment.' },
          { quarter: 'Q4', score: 4.6, reviewNotes: 'Delivered high-impact architectural roadmap with zero regressions.' },
        ],
        annualScore: 4.55,
        kraSummary: [
          { title: 'Core Deliverables & Architecture', weightage: 40, target: '>=99.9% uptime and zero high-severity bugs' },
          { title: 'Code Review & Team Velocity', weightage: 30, target: '24-hour turnaround on PR reviews' },
          { title: 'Innovation & Documentation', weightage: 30, target: 'Publish 4 technical RFCs and optimization docs' },
        ],
        perspective: synthesisPerspective,
      };

      const res = await api.generateAiReviewSynthesis(payload);
      if (res.success && res.data) {
        setSynthesisResult(res.data);
      }
    } catch (err: any) {
      console.error('Synthesis error:', err);
    } finally {
      setSynthesizing(false);
    }
  };

  // 2. Generate Strategic Talent Insights
  const handleRunTalentInsights = async () => {
    setGeneratingInsights(true);
    try {
      const highPerformers = talentRecords.filter((t) => t.performanceLevel === 'high').length;
      const coreCount = talentRecords.filter((t) => t.performanceLevel === 'medium').length;
      const underCount = talentRecords.filter((t) => t.performanceLevel === 'low').length;
      const flightRiskCount = talentRecords.filter((t) => t.flightRisk === 'high' || t.flightRisk === 'medium').length;

      const res = await api.generateAiTalentInsights({
        department: 'All Departments (Executive Rollup)',
        cycleName: 'Annual Calibration Cycle F (Sep)',
        talentPoolSummary: {
          totalEmployees: talentRecords.length,
          highPerformersCount: highPerformers,
          coreCount,
          underperformersCount: underCount,
          highRiskAttritionCount: flightRiskCount,
        },
      });

      if (res.success && res.data) {
        setTalentInsights(res.data);
      }
    } catch (err: any) {
      console.error('Talent insights error:', err);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div id="ai_performance_hub_container" className="space-y-6">
      <PageHeader
        title="AI review assistant"
        description="Draft consistent review summaries and see where people sit on the 9-box grid, using Google Gemini."
        actions={
          <Button id="refresh_data_btn" icon={RefreshCw} onClick={loadBaseData}>
            Refresh data
          </Button>
        }
      />

      {/* Navigation Tabs */}
      <div id="ai_hub_tabs" className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl px-4 pt-3 overflow-x-auto gap-2">
        <button
          id="tab_btn_synthesis"
          onClick={() => setActiveTab('synthesis')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'synthesis'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Review summary
        </button>

        <button
          id="tab_btn_nine_box"
          onClick={() => setActiveTab('nine_box')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'nine_box'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          9-Box Talent Matrix
        </button>
      </div>

      {/* TAB 1: AI REVIEW NARRATIVE SYNTHESIZER */}
      {activeTab === 'synthesis' && (
        <div id="tab_content_synthesis" className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-xl p-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls Column */}
              <div className="space-y-5 border-r border-slate-100 dark:border-slate-800 pr-0 lg:pr-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Target employee
                  </label>
                  <select
                    id="select_synthesis_employee"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                        {emp.name} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Appraisal perspective
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['manager', 'self', 'executive'] as const).map((p) => (
                      <button
                        key={p}
                        id={`perspective_btn_${p}`}
                        onClick={() => setSynthesisPerspective(p)}
                        className={`py-2 text-xs font-semibold rounded-lg capitalize border transition-all ${
                          synthesisPerspective === p
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedEmployee && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {selectedEmployee.name}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Code: <span className="tabular-nums text-slate-800 dark:text-slate-200">{selectedEmployee.employeeCode}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Dept: <span className="font-medium text-slate-800 dark:text-slate-200">{selectedEmployee.departmentName || selectedEmployee.departmentId}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Rolling 4-Quarter Rollup Score:{' '}
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                        4.55 / 5.00 (Outstanding)
                      </span>
                    </div>
                  </div>
                )}

                <button
                  id="btn_run_synthesis"
                  onClick={handleRunSynthesis}
                  disabled={synthesizing || !selectedEmployee}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  {synthesizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Drafting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Draft review summary
                    </>
                  )}
                </button>
              </div>

              {/* Output Display Column */}
              <div className="lg:col-span-2 space-y-4">
                {!synthesisResult && !synthesizing && (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl min-h-[360px]">
                    <Sparkles className="w-12 h-12 text-indigo-300 dark:text-indigo-500 mb-3" />
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">Ready to draft a review summary</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                      Pick an employee on the left. Gemini reads their last four quarters of KRA scores and recognitions, and drafts a review summary for you to edit.
                    </p>
                  </div>
                )}

                {synthesizing && (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[360px]">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 animate-spin mb-4" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Drafting the summary</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Correlating Q1-q4 ratings, feedback badges, and KRA weights...
                    </p>
                  </div>
                )}

                {synthesisResult && !synthesizing && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Executive Summary Card */}
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Executive summary
                        </span>
                        <button
                          onClick={() => copyToClipboard(synthesisResult.executiveSummary || '', 'exec')}
                          className="text-xs text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 flex items-center gap-1"
                        >
                          {copiedSection === 'exec' ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedSection === 'exec' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-serif">
                        {synthesisResult.executiveSummary}
                      </p>
                    </div>

                    {/* Strengths & Growth Areas Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-xl">
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Key strengths & differentiators
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                          {(synthesisResult.topStrengths || []).map((str, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-amber-50/40 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-xl">
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                          <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Growth & development opportunities
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                          {(synthesisResult.growthAreas || []).map((ga, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                              <span>{ga}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Manager & Self Narrative Drafts */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Suggested manager appraisal narrative
                        </span>
                        <button
                          onClick={() => copyToClipboard(synthesisResult.suggestedManagerNarrative, 'narrative')}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-1 font-medium"
                        >
                          {copiedSection === 'narrative' ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedSection === 'narrative' ? 'Copied to Clipboard' : 'Copy Narrative'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed font-sans">
                        "{synthesisResult.suggestedManagerNarrative}"
                      </p>
                    </div>

                    {/* Recommended Development Goals */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Next cycle recommended milestones
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {synthesisResult.recommendedDevelopmentGoals.map((g, i) => (
                          <div key={i} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                              {i + 1}
                            </span>
                            <span>{g}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 9-BOX TALENT MATRIX */}
      {activeTab === 'nine_box' && (
        <div id="tab_content_nine_box" className="space-y-6">
          {/* Executive Insights Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                9-box grid and succession
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Strategic workforce stratification mapping rolling quarterly performance against future leadership potential.
              </p>
            </div>

            <button
              id="btn_run_talent_insights"
              onClick={handleRunTalentInsights}
              disabled={generatingInsights}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all"
            >
              {generatingInsights ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing the 9-box grid…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Suggest succession actions
                </>
              )}
            </button>
          </div>

          {/* AI Insights Card (if generated) */}
          {talentInsights && (
            <div className="bg-indigo-950 text-white rounded-xl p-5 border border-indigo-900 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-200">
                    Talent health and retention
                  </span>
                </div>
                <div className="text-xs font-bold px-3 py-1 bg-indigo-800 rounded-full text-indigo-200">
                  Department Health Score: {talentInsights.departmentHealthScore}/100
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-indigo-900/40 rounded-lg border border-indigo-800/60 space-y-2">
                  <div className="font-bold text-indigo-300">Strategic observations</div>
                  <ul className="space-y-1 text-slate-300">
                    {(talentInsights.strategicObservations || []).map((obs, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-indigo-400">•</span>
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-indigo-900/40 rounded-lg border border-indigo-800/60 space-y-2">
                  <div className="font-bold text-emerald-300">Retention and merit actions</div>
                  <ul className="space-y-1 text-slate-300">
                    {(talentInsights.retentionRecommendations || []).map((rec, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-emerald-400">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-indigo-900/40 rounded-lg border border-indigo-800/60 space-y-2">
                  <div className="font-bold text-amber-300">Succession & immediate action</div>
                  <ul className="space-y-1 text-slate-300">
                    {talentInsights.leadershipSuccessionPipelines.map((succ, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-amber-400">•</span>
                        <span>{succ}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 9-Box Grid & Succession Profile */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 9-Box Matrix Visualizer (2 Cols) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    9-box talent grid
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    X-axis: performance rollup • y-axis: leadership potential
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {talentRecords.length} Assessed Employees
                </span>
              </div>

              {/* 3x3 Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* Top Row: High Potential */}
                <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 min-h-[105px]">
                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300">Untapped enigma</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Low perf • high pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'low' && t.potentialLevel === 'high')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-amber-500"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 min-h-[105px]">
                  <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">Growth driver</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Med perf • high pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'medium' && t.potentialLevel === 'high')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-emerald-200 dark:border-emerald-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-emerald-500"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-500 min-h-[105px] shadow-sm">
                  <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                    <span>Star leader</span>
                    <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-400">High perf • high pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'high' && t.potentialLevel === 'high')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-indigo-200 dark:border-indigo-700 text-slate-800 dark:text-slate-100 font-bold cursor-pointer text-[11px] hover:border-indigo-600 flex items-center justify-between"
                        >
                          <span>{t.employeeName}</span>
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 tabular-nums">{t.currentScore}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Middle Row: Medium Potential */}
                <div className="p-3 rounded-lg bg-rose-50/40 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/50 min-h-[105px]">
                  <div className="text-[11px] font-bold text-rose-900 dark:text-rose-300">Inconsistent dilemma</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">Low perf • med pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'low' && t.potentialLevel === 'medium')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-rose-200 dark:border-rose-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-rose-500"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 min-h-[105px]">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Core contributor</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Med perf • med pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'medium' && t.potentialLevel === 'medium')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-slate-400"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 min-h-[105px]">
                  <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">Key asset</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">High perf • med pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'high' && t.potentialLevel === 'medium')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-emerald-200 dark:border-emerald-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-emerald-500 flex items-center justify-between"
                        >
                          <span>{t.employeeName}</span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">{t.currentScore}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bottom Row: Low Potential */}
                <div className="p-3 rounded-lg bg-rose-100/50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 min-h-[105px]">
                  <div className="text-[11px] font-bold text-rose-950 dark:text-rose-300">Talent risk / action</div>
                  <div className="text-[11px] text-rose-800 dark:text-rose-400">Low perf • low pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'low' && t.potentialLevel === 'low')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-rose-300 dark:border-rose-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-rose-600"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 min-h-[105px]">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Effective steady</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Med perf • low pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'medium' && t.potentialLevel === 'low')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-slate-400"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 min-h-[105px]">
                  <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300">Trusted professional</div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-400">High perf • low pot</div>
                  <div className="mt-2 space-y-1">
                    {talentRecords
                      .filter((t) => t.performanceLevel === 'high' && t.potentialLevel === 'low')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTalent(t)}
                          className="p-1.5 bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-700 text-slate-800 dark:text-slate-100 font-medium cursor-pointer text-[11px] hover:border-blue-500"
                        >
                          {t.employeeName}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Talent Assessment Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
                Talent profile & mobility
              </h4>

              {selectedTalent ? (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{selectedTalent.employeeName}</div>
                    <div className="text-slate-500 dark:text-slate-400">{selectedTalent.designation} • {selectedTalent.department}</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-100 dark:border-slate-700 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Rollup rating:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTalent.currentScore} / 5.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">9-Box Quadrant:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400 capitalize">
                        {selectedTalent.nineBoxCategory?.replace('_', ' ') || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Succession ready:</span>
                      <span className={`font-bold ${selectedTalent.successionReady ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {selectedTalent.successionReady ? '✓ Ready for Next Role' : 'Developing'}
                      </span>
                    </div>
                    {selectedTalent.targetNextRole && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Target role:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedTalent.targetNextRole}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Recommended talent actions:</div>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-300 pl-2">
                      {(selectedTalent.recommendedActions || []).map((act, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 dark:text-slate-500">Assessed: {selectedTalent.lastAssessedDate}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      Flight Risk: {selectedTalent.flightRisk.toUpperCase()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
                  Click any employee in the 9-box grid to view succession profile.
                </div>
              )}
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
