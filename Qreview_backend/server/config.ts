import { z } from 'zod';

/**
 * Central, validated runtime configuration.
 *
 * Read lazily (first call to getConfig) rather than at import time, because server.ts runs
 * dotenv.config() only after its imports have been evaluated.
 *
 * Risky features are fail-closed: they are OFF unless explicitly enabled, independent of NODE_ENV.
 */
const boolFlag = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim().toLowerCase() === 'true');

const positiveInt = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    });

const ConfigSchema = z.object({
  NODE_ENV: z.string().optional().transform((v) => v || 'development'),
  JWT_SECRET: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional().transform((v) => v || ''),
  APP_URL: z.string().optional().transform((v) => v || 'http://localhost:5173'),
  /** Staging/dev-only persona switcher. Never enable in production. */
  ENABLE_DEMO_PERSONAS: boolFlag,
  /** Per-user cap for authenticated API traffic, per 15-minute window. */
  RATE_LIMIT_AUTH_MAX: positiveInt(1500),
  /** Per-IP cap for unauthenticated API traffic, per 15-minute window. */
  RATE_LIMIT_ANON_MAX: positiveInt(300),
  GEMINI_API_KEY: z.string().optional(),
  /** Comma-separated Gemini model ids, tried in order. */
  GEMINI_MODELS: z
    .string()
    .optional()
    .transform((v) =>
      (v || 'gemini-3.8-flash,gemini-flash-latest')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
});

export type AppConfig = z.infer<typeof ConfigSchema> & { isProduction: boolean };

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = ConfigSchema.parse(process.env);
  const isProduction = parsed.NODE_ENV === 'production';
  cached = { ...parsed, isProduction };
  return cached;
}

/**
 * Fails fast at startup when production is misconfigured. Call once, before listening.
 */
export function assertProductionConfig(): void {
  const cfg = getConfig();
  if (!cfg.isProduction) return;
  const problems: string[] = [];
  if (!cfg.JWT_SECRET || cfg.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (!cfg.ALLOWED_ORIGINS) {
    console.error('[Config] ALLOWED_ORIGINS is not set; only the built-in Vercel origin pattern will be accepted.');
  }
  if (cfg.ENABLE_DEMO_PERSONAS) problems.push('ENABLE_DEMO_PERSONAS must not be enabled in production');
  if (problems.length) {
    throw new Error(`[Fatal] Invalid production configuration:\n - ${problems.join('\n - ')}`);
  }
}

/** Test helper: forget the cached config so a test can change process.env. */
export function resetConfigForTests(): void {
  cached = null;
}
