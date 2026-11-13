import { Router, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { getDbCollection } from '../db.js';
import { getConfig } from '../config.js';
import { authenticateToken, requireRoles, recordAuditLog, AuthenticatedRequest } from '../auth.js';
import { validateBody, TalentRecordUpdateSchema } from '../validation.js';
import {
  TalentRecord,
  AiReviewSynthesisRequest,
  AiReviewSynthesisResult,
  AiTalentInsightsRequest,
  AiTalentInsightsResult,
} from '../../src/types/index.js';

export const aiAndFeedbackRouter = Router();
aiAndFeedbackRouter.use(authenticateToken);
aiAndFeedbackRouter.use(
  '/gemini',
  requireRoles('SUPER_ADMIN', 'HR', 'HOD', 'MANAGER', 'REPORTING_MANAGER', 'EMPLOYEE')
);

/**
 * Sent when no AI provider is configured or every configured model failed.
 * We never substitute canned text: a fabricated performance narrative is worse than none.
 */
const AI_UNAVAILABLE = {
  error: 'AI_UNAVAILABLE',
  message: 'The AI assistant is unavailable right now. Please try again later or write the summary manually.',
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getConfig().GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

/** Tries each configured model, retrying once on transient (429/503) errors. */
async function safeGenerateContent(
  ai: GoogleGenAI,
  config: { contents: string; responseSchema?: any }
): Promise<{ text: string; modelUsed: string } | null> {
  for (const modelName of getConfig().GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: config.contents,
          config: { responseMimeType: 'application/json', responseSchema: config.responseSchema },
        });
        if (response?.text) return { text: response.text, modelUsed: modelName };
        break;
      } catch (err: any) {
        const msg = String(err?.message || '');
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('demand');
        if (isTransient && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        console.error(`[Gemini AI] Model "${modelName}" failed:`, msg);
        break;
      }
    }
  }
  return null;
}

async function generateJson<T>(prompt: string, responseSchema: any): Promise<{ data: T; engine: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  const result = await safeGenerateContent(ai, { contents: prompt, responseSchema });
  if (!result) return null;
  try {
    return { data: JSON.parse(result.text) as T, engine: result.modelUsed };
  } catch {
    console.error('[Gemini AI] Model returned non-JSON output');
    return null;
  }
}

// -------------------------------------------------------------
// Request schemas: the AI only ever sees data the caller actually has
// -------------------------------------------------------------
const score = z.number().min(0).max(5);
const ReviewSynthesisSchema = z.object({
  employeeName: z.string().trim().min(1).max(150),
  designation: z.string().trim().max(150).optional().default(''),
  department: z.string().trim().max(150).optional().default(''),
  quarterlyScores: z
    .array(z.object({ quarter: z.string().trim().min(1).max(60), score, reviewNotes: z.string().max(4000).optional() }))
    .min(1, 'At least one scored review is required'),
  annualScore: score,
  kraSummary: z
    .array(z.object({ title: z.string().trim().min(1).max(300), weightage: z.number().min(0).max(100), target: z.string().max(1000).optional().default('') }))
    .max(50),
  perspective: z.enum(['manager', 'self', 'executive']),
});

const count = z.number().int().min(0);
const TalentInsightsSchema = z.object({
  department: z.string().trim().max(150).optional(),
  cycleName: z.string().trim().max(150).optional(),
  talentPoolSummary: z.object({
    totalEmployees: count,
    highPerformersCount: count,
    coreCount: count,
    underperformersCount: count,
    highRiskAttritionCount: count,
  }),
});

// -------------------------------------------------------------
// AI ENDPOINT 1: Performance Review Narrative
// -------------------------------------------------------------
aiAndFeedbackRouter.post(
  '/gemini/generate-review-narrative',
  validateBody(ReviewSynthesisSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = req.body as AiReviewSynthesisRequest;

      const prompt = `You are an experienced HR appraisal consultant. Write a balanced, evidence-based performance review assessment.
Use ONLY the facts below. Do not invent achievements, metrics, projects, peer feedback or names that are not stated.
Where the evidence is thin, say so plainly.

Employee: ${payload.employeeName}
Designation: ${payload.designation || 'Not specified'}
Department: ${payload.department || 'Not specified'}
Overall score: ${payload.annualScore} / 5.00
Scored reviews:
${payload.quarterlyScores.map((q) => `- ${q.quarter}: ${q.score}/5.00${q.reviewNotes ? ` | Notes: "${q.reviewNotes}"` : ''}`).join('\n')}

KRAs and weights:
${payload.kraSummary.length ? payload.kraSummary.map((k) => `- ${k.title} (${k.weightage}%)${k.target ? `: target "${k.target}"` : ''}`).join('\n') : '- None recorded'}

Perspective: ${payload.perspective.toUpperCase()}`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          executiveSummary: { type: Type.STRING },
          topStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          growthAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedManagerNarrative: { type: Type.STRING },
          suggestedSelfAppraisalDraft: { type: Type.STRING },
          keyAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedDevelopmentGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'executiveSummary',
          'topStrengths',
          'growthAreas',
          'suggestedManagerNarrative',
          'suggestedSelfAppraisalDraft',
          'keyAchievements',
          'recommendedDevelopmentGoals',
        ],
      };

      const result = await generateJson<AiReviewSynthesisResult>(prompt, responseSchema);
      if (!result) return res.status(503).json(AI_UNAVAILABLE);
      return res.json({ success: true, data: result.data, engine: result.engine });
    } catch (err: any) {
      console.error('[Gemini AI] Review narrative failed:', err);
      res.status(500).json({ error: 'Failed to synthesize review' });
    }
  }
);

// -------------------------------------------------------------
// AI ENDPOINT 2: Talent Matrix Insights
// -------------------------------------------------------------
aiAndFeedbackRouter.post(
  '/gemini/talent-insights-summary',
  validateBody(TalentInsightsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = req.body as AiTalentInsightsRequest;
      const s = payload.talentPoolSummary;

      const prompt = `You are a talent advisor. Using ONLY the aggregate counts below, give strategic observations and recommendations.
Do not name individuals and do not invent figures that are not given.

Scope: ${payload.department || 'Whole organization'}
Total assessed: ${s.totalEmployees}
High performers: ${s.highPerformersCount}
Core performers: ${s.coreCount}
Underperforming: ${s.underperformersCount}
Medium/high flight risk: ${s.highRiskAttritionCount}

Provide a health score (0-100) with its basis reflected in the observations, 3-4 strategic observations,
2-3 retention recommendations, 2 succession-pipeline considerations, and 2 immediate risk mitigations.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          departmentHealthScore: { type: Type.NUMBER },
          strategicObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
          retentionRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          leadershipSuccessionPipelines: { type: Type.ARRAY, items: { type: Type.STRING } },
          immediateRiskMitigations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'departmentHealthScore',
          'strategicObservations',
          'retentionRecommendations',
          'leadershipSuccessionPipelines',
          'immediateRiskMitigations',
        ],
      };

      const result = await generateJson<AiTalentInsightsResult>(prompt, responseSchema);
      if (!result) return res.status(503).json(AI_UNAVAILABLE);
      return res.json({ success: true, data: result.data, engine: result.engine });
    } catch (err: any) {
      console.error('[Gemini AI] Talent insights failed:', err);
      res.status(500).json({ error: 'Failed to generate talent insights' });
    }
  }
);

// -------------------------------------------------------------
// 9-BOX TALENT MATRIX ENDPOINTS
// -------------------------------------------------------------

// GET all talent records (employees only see their own)
aiAndFeedbackRouter.get('/talent-records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const talentCol = getDbCollection('talentRecords');
    let records: TalentRecord[] = await (await talentCol.find({})).toArray();
    if (req.userRole === 'EMPLOYEE' && req.user?.employeeId) {
      records = records.filter((r) => r.employeeId === req.user?.employeeId);
    }
    res.json(records);
  } catch (err: any) {
    console.error('[TalentRecords] List failed:', err);
    res.status(500).json({ error: 'Failed to load talent records.' });
  }
});

// PUT update a talent assessment: HR / Super Admin only, whitelisted fields only
aiAndFeedbackRouter.put(
  '/talent-records/:id',
  requireRoles('SUPER_ADMIN', 'HR'),
  validateBody(TalentRecordUpdateSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const talentCol = getDbCollection('talentRecords');
      const target: TalentRecord | null = await talentCol.findOne({ id });
      if (!target) {
        return res.status(404).json({ error: 'Talent record not found' });
      }

      const now = new Date().toISOString();
      const changes = { ...req.body, lastAssessedDate: now.split('T')[0], updatedAt: now };
      await talentCol.updateOne({ id }, { $set: changes });

      await recordAuditLog(
        req.user!.id,
        req.user!.name,
        req.user!.role,
        'TALENT',
        'TALENT_RECORD_UPDATED',
        id,
        JSON.stringify(Object.fromEntries(Object.keys(req.body).map((k) => [k, (target as any)[k]]))),
        JSON.stringify(req.body),
        `Talent assessment updated for ${target.employeeName || target.employeeId}`
      );

      res.json({ ...target, ...changes });
    } catch (err: any) {
      console.error('[TalentRecords] Update failed:', err);
      res.status(500).json({ error: 'Failed to update talent record.' });
    }
  }
);
