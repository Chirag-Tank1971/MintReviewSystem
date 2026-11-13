import dotenv from 'dotenv';
dotenv.config({ override: true });
import { initDatabase } from './server/db.js';
import { startBackgroundScheduler } from './server/jobs/scheduler.js';
import { createApp } from './server/app.js';
import { assertProductionConfig, getConfig } from './server/config.js';

// In production, silence non-critical development logs (console.log, console.info, console.warn)
// to optimize performance and protect data privacy. Errors (console.error) remain fully active.
// Override via ENABLE_PROD_LOGS=true if debugging in production.
const isProd = process.env.NODE_ENV === 'production' && process.env.ENABLE_PROD_LOGS !== 'true';
const bootLog = console.log;

if (isProd) {
  const noop = () => { };
  console.log = noop;
  console.info = noop;
  console.warn = noop;
}

async function startServer() {
  // Refuse to start with an unsafe production configuration
  assertProductionConfig();

  const PORT = Number(process.env.PORT) || 3000;

  // Initialize Database (MongoDB / Document Collections Engine)
  await initDatabase();

  // Start background cron jobs (review reminders, overdue escalations, appraisal cohorts)
  startBackgroundScheduler();

  const app = createApp({ log: bootLog });

  app.listen(PORT, '0.0.0.0', () => {
    bootLog(`[Applet] Server running on http://0.0.0.0:${PORT} [mode: ${getConfig().NODE_ENV}]`);
  });
}

startServer().catch((err) => {
  console.error('[Applet] Fatal error starting server:', err);
  process.exit(1);
});
