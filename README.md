# 🏢 QReview — Enterprise Performance Management & Annual Appraisal System

A modern, full-stack enterprise performance management and annual appraisal platform built with **React 19**, **Express.js**, **TypeScript**, and **MongoDB**. Supports multi-cohort review cycles, 4-quarter rolling performance appraisals, automated Performance Improvement Plans (PIP) with a 2-step fast-flow, 9-box talent matrix calibration, bell-curve budget normalization, and digital appraisal letter workflows.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Repository Structure](#-repository-structure)
- [Core Features & Modules](#-core-features--modules)
  - [Role-Based Access Control (RBAC)](#1-role-based-access-control-rbac)
  - [Quarterly Review Lifecycle](#2-quarterly-review-lifecycle)
  - [Automated Performance Improvement Plan (PIP) Engine](#3-automated-performance-improvement-plan-pip-engine)
  - [Annual Appraisal & Salary Increments](#4-annual-appraisal--salary-increments)
  - [Executive & Department Dashboards](#5-executive--department-dashboards)
  - [AI Performance Narrative Synthesis](#6-ai-performance-narrative-synthesis)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [API Route Catalog](#-api-route-catalog)
- [Design System & Aesthetics](#-design-system--aesthetics)

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client["Frontend (React 19 + Vite + Tailwind v4)<br/>Port: 5173"] -->|"REST API / Bearer JWT"| Server["Backend API (Express + TypeScript)<br/>Port: 3000"]
    Server --> DB[("MongoDB / Embedded Store<br/>review_appraisal_db")]
    Server --> Cron["Background Scheduler (node-cron)<br/>PIP Reviews, SLA Sweeps, Reminders"]
    Server --> AI["Google Gemini API (@google/genai)<br/>Narrative Synthesis & Feedback"]
    Server --> Mail["Email Service (Resend API)<br/>Workflow Notifications & Letters"]
```

- **Frontend:** React 19, Vite 6, Tailwind CSS v4, Lucide Icons, Recharts, Framer Motion, jsPDF & html2canvas.
- **Backend:** Node.js, Express 4, TypeScript 5.8, MongoDB Driver 7.6 (with zero-dependency fallback store), Vitest 3.
- **AI Engine:** Google Gemini (`@google/genai` on `gemini-2.5-flash`).
- **Security:** JWT authentication, Bcrypt password hashing, route-level RBAC middleware, strict request rate-limiting, and ISO-compliant audit logging.

---

## 📂 Repository Structure

```text
Review_system/
├── Qreview_backend/                 # Node.js + Express + TypeScript Backend
│   ├── server.ts                    # Server bootstrap, CORS & rate limit configuration
│   ├── server/
│   │   ├── db.ts                    # Database abstraction (MongoDB + persistence layer)
│   │   ├── auth.ts                  # JWT token verify, RBAC checks & audit log logger
│   │   ├── syncHelpers.ts           # Master data sync & cascade helpers
│   │   ├── jobs/
│   │   │   └── scheduler.ts         # Automated cron jobs (daily PIP review engine, SLA sweeps)
│   │   ├── services/
│   │   │   ├── appraisalScoring.ts  # 4-quarter rolling averages & bell curve matrix
│   │   │   ├── pipReviewService.ts  # 7-day PIP review generator & overlap protection
│   │   │   ├── pipService.ts        # PIP milestone tracking & status transitions
│   │   │   ├── workflowService.ts   # Review state machine transitions
│   │   │   ├── reviewReturnService.ts # HOD/HR return workflows & SLA timeouts
│   │   │   └── dashboardInsights.ts # Analytics rollup & reviewer backlog computation
│   │   └── routes/
│   │       ├── authRoutes.ts        # Authentication, login, fast role switching
│   │       ├── reviewRoutes.ts      # Quarterly scoring, self-assessments, 2-step PIP fast flow
│   │       ├── pipRoutes.ts         # PIP CRUD, check-ins, extensions, review triggers
│   │       ├── appraisalRoutes.ts   # Cohort rollups, increments, digital letter release
│   │       ├── dashboardRoutes.ts   # Role-tailored dashboards (Employee, Manager, HOD, HR, Admin)
│   │       ├── managementRoutes.ts  # Executive-level workforce trends & risk analysis
│   │       ├── kraRoutes.ts         # KRA template builder & scorecard mappings
│   │       ├── mastersRoutes.ts     # Employees, departments, designations, review periods
│   │       ├── reportRoutes.ts      # Tabular report generators & exports
│   │       ├── auditRoutes.ts       # Compliance & audit trail explorer
│   │       └── aiAndFeedbackRoutes.ts # Gemini AI narrative generator & 360 kudos
│   ├── src/types/                   # Shared TypeScript domain contracts
│   ├── package.json
│   └── tsconfig.json
│
├── Qreview_frontend/                # React 19 + Vite Frontend Application
│   ├── src/
│   │   ├── App.tsx                  # Root application router and shell
│   │   ├── components/
│   │   │   ├── QuarterlyReviewView.tsx      # Reviews table, KRA scoring modals, PIP filters
│   │   │   ├── AppraisalManagementView.tsx  # Appraisal matrix, increments, letter signing
│   │   │   ├── PerformanceImprovementPlansView.tsx # PIP tracking, milestones, check-ins
│   │   │   ├── ManagementDashboardView.tsx  # C-suite analytics, department comparisons
│   │   │   ├── EmployeeDirectory.tsx        # Employee profiles & organizational hierarchy
│   │   │   ├── ReviewScoringModal.tsx       # 2-step fast-flow and 4-step governance evaluation
│   │   │   ├── PipDetailModal.tsx           # PIP plan viewer & check-in logger
│   │   │   ├── AppraisalLetterModal.tsx     # Letter release, digital signing & PDF download
│   │   │   └── dashboard/
│   │   │       ├── RoleDashboards.tsx       # Role-specific dashboard layouts
│   │   │       ├── DashboardKit.tsx         # Reusable stat cards, PeopleCard with PIP alerts
│   │   │       └── InsightCards.tsx         # Calibration, reviewer backlog & coverage cards
│   │   ├── context/                         # AuthContext, ToastContext
│   │   ├── services/
│   │   │   └── api.ts                       # Typed HTTP client with token refresh & error handling
│   │   └── types/                           # Frontend domain models & view state types
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── README.md                        # Master repository documentation
```

---

## 🌟 Core Features & Modules

### 1. Role-Based Access Control (RBAC)
The system supports six distinct enterprise roles with strict server-side authorization:
- **`EMPLOYEE`**: Self-service dashboard, self-assessments, view assigned KRAs, acknowledge appraisals, view PIP milestones.
- **`MANAGER` / `REPORTING_MANAGER`**: Direct report evaluations, increment proposals, PIP creation and weekly 2-step check-in reviews.
- **`HOD` (Head of Department)**: Department-wide calibration, scorecard approvals, reviewing returned manager scores, department PIP oversight.
- **`HR` / `SUPER_ADMIN`**: Full administrative governance, review period creation, annual appraisal finalization, letter release, and audit compliance.
- **`MANAGEMENT`**: Executive dashboard, bell-curve compliance, workforce attrition risk analysis, and department benchmarking.
- **Persona Switcher (Dev Mode)**: Fast switching between test users to validate multi-tier workflow handoffs seamlessly.

---

### 2. Quarterly Review Lifecycle
Evaluations run on structured quarterly review periods (Q1 to Q4):
1. **Self-Assessment (`EMPLOYEE`)**: Employees score their assigned KRAs, document deliverables, and submit.
2. **Manager Scoring (`MANAGER`)**: Reporting managers score performance, add qualitative remarks, and submit.
3. **HOD Calibration (`HOD`)**: HOD verifies manager scores, adjusts if necessary, or returns individual KRAs with feedback.
4. **HR Final Approval (`HR`)**: HR signs off to close the review and lock the final score.
- **Return with SLA Sweep**: Reviews returned for revision have configurable SLA timeouts. If a reviewer misses the SLA, automated reminders trigger or auto-escalate.

---

### 3. Automated Performance Improvement Plan (PIP) Engine
Comprehensive lifecycle management for employees requiring structured performance support:

- **Automated Review Generation (`pipReviewService.ts`)**:
  - Automatically runs every 7 days via background cron or manual trigger.
  - Converts assigned PIP goals directly into immutable `kraSnapshot` scorecard items with balanced weights totalling 100%.
  - Overlap protection ensures a new weekly review is never stacked on top of an uncompleted one.
- **2-Step Fast Flow (Weekly Reviews)**:
  - **Step 1**: Employee completes self-assessment on their PIP goals.
  - **Step 2**: Manager evaluates and submits scores $\rightarrow$ The review immediately transitions to `CLOSED`.
  - Bypasses HOD and HR sign-offs to eliminate recurring weekly administrative fatigue.
  - **Auto Check-in Sync**: Submitting the review automatically appends a completed check-in record directly into `performanceImprovementPlans.checkIns` with goal ratings and manager feedback.
- **PIP Final Review**:
  - Triggered at the end of the PIP duration (`now >= pip.endDate`).
  - Follows the complete 4-step governance flow (**Employee** $\rightarrow$ **Manager** $\rightarrow$ **HOD** $\rightarrow$ **HR**) to ensure formal closure and decision alignment.
- **Appraisal Isolation Safeguard**:
  - Weekly PIP scores and final reviews are isolated from annual appraisal calculations, ensuring rolling 4-quarter averages and salary increment brackets remain strictly uncorrupted.
- **Manager & HOD Dashboard Highlights**:
  - **`TeamPipHighlightCard`**: Calm amber banner at the top of Manager and HOD dashboards displaying active plans, elapsed time progress bar, days left, and quick action links.
  - **`PeopleCard` Highlighting**: Team members on PIP display a pulsing amber **`On PIP`** badge, subtle amber background tint, left border accent, and are sorted to the top of the list.

---

### 4. Annual Appraisal & Salary Increments
- **Rolling 4-Quarter Rollup**: Averages the employee's last four manager-evaluated quarterly review scores.
- **Performance Rating Matrix**:
  - **Outstanding** ($\ge 4.5$ score): Recommended 15% – 20% increment.
  - **Exceeds Expectations** ($\ge 3.8$ score): Recommended 10% – 14% increment.
  - **Meets Expectations** ($\ge 2.8$ score): Recommended 5% – 9% increment.
  - **Needs Improvement** ($< 2.8$ score): Recommended 0% – 4% increment.
- **Bell Curve & Budget Pool**:
  - Normalizes ratings against organizational targets (10% Outstanding, 25% Exceeds, 45% Meets, 20% Needs Improvement).
  - Department budget tracker shows proposed increments vs allocated department payroll budget.
- **Digital Appraisal Letters**:
  - Generates branded increment letters with current CTC, revised CTC, increment percentage, and effective date.
  - Supports digital signatures, employee acknowledgment, and client-side PDF export.

---

### 5. Executive & Department Dashboards
- **Tailored Role Dashboards**: Separate views customized for Employee, Manager, HOD, HR, and Admin.
- **Executive Analytics (`ManagementDashboardView.tsx`)**:
  - Real-time department completion rates and average score heatmaps.
  - Top performers and employees requiring attention.
  - Workforce attrition risk indicators and KRA template coverage rates.

---

### 6. AI Performance Narrative Synthesis
- Integrated with Google Gemini (`gemini-2.5-flash`) via `@google/genai`.
- Synthesizes quarterly scores, employee comments, and manager feedback into clear, objective performance summaries and constructive growth recommendations.

---

## 💻 Prerequisites

Ensure you have the following installed:
- **Node.js**: `v18.x`, `v20.x`, or `v22.x` (LTS recommended)
- **npm**: `v9.x` or `v10.x`
- **MongoDB** *(Optional)*: MongoDB Compass or Atlas connection. If omitted, the backend automatically runs its built-in zero-dependency persistent JSON store (`.local_database_store.json`).

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd Qreview_backend

# Install dependencies
npm install

# Configure environment variables
# Copy or edit .env (see Environment Variables section below)

# Run backend development server
npm run dev
```

The backend API will start on:
👉 **`http://localhost:3000`**

To verify:
```bash
curl http://localhost:3000/api/health
```

---

### 2. Frontend Setup

In a new terminal window:

```bash
# Navigate to the frontend directory
cd Qreview_frontend

# Install dependencies
npm install

# Run frontend development server
npm run dev
```

The frontend client will start on:
👉 **`http://localhost:5173`** (or next available port)

Open your browser and navigate to `http://localhost:5173` to access the application.

---

## ⚙️ Environment Variables

### Backend (`Qreview_backend/.env`)

```env
# Server Port (Default: 3000)
PORT=3000

# Node Environment ('development' | 'production')
NODE_ENV=development

# JWT Secret Key for token generation and verification
JWT_SECRET=quarterly_review_appraisal_jwt_secret_key_2026

# Allowed CORS Origins (comma-separated or single domain)
ALLOWED_ORIGINS=http://localhost:5173,https://qreview-frontend.vercel.app

# Optional: MongoDB URI (falls back to local embedded store if not reachable)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/review_appraisal_db?retryWrites=true&w=majority

# Optional: Google Gemini API Key for AI synthesis features
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Resend API Key for automated email notifications
RESEND_API_KEY=your_resend_api_key_here
```

### Frontend (`Qreview_frontend/.env`)

```env
# Optional: Backend API Base URL (defaults to http://localhost:3000 in dev)
VITE_API_BASE_URL=http://localhost:3000
```

---

## 📜 Available Scripts

### Backend (`Qreview_backend`)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts backend development server with hot-reloading via `tsx watch` |
| `npm run build` | Bundles backend into single-file CommonJS distribution using `esbuild` |
| `npm start` | Runs the compiled production bundle (`dist/server.cjs`) |
| `npm test` | Executes the Vitest test suite (`vitest run --passWithNoTests`) |
| `npm run typecheck` | Validates TypeScript types across the backend codebase (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint checks on backend files |

### Frontend (`Qreview_frontend`)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server with Fast Refresh |
| `npm run build` | Compiles and optimizes client bundle for production (`dist/`) |
| `npm run preview` | Serves the production build locally for verification |
| `npm run typecheck` | Validates TypeScript types across all React components (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint checks on frontend files |

---

## 📡 API Route Catalog

| Route Prefix | Category | Description & Capabilities |
| :--- | :--- | :--- |
| `POST /api/auth/login` | Authentication | Authenticates user credentials and returns JWT bearer token |
| `GET /api/auth/me` | Authentication | Retrieves authenticated user profile, permissions, and active role |
| `POST /api/auth/switch-role` | Auth (Dev Mode) | Rapid persona switching for testing workflows across roles |
| `GET /api/dashboard` | Dashboard | Returns aggregated role-specific dashboard data, tasks, and alerts |
| `GET /api/reviews` | Reviews | Lists reviews filtered by period, department, status, or review type |
| `PUT /api/reviews/:id` | Reviews | Scores KRAs; executes **2-step fast-flow** for weekly PIP reviews |
| `POST /api/reviews/:id/return` | Reviews | Returns review to manager/HOD with remarks and SLA deadline |
| `GET /api/pips` | PIP Management | Lists Performance Improvement Plans with status and check-ins |
| `POST /api/pips` | PIP Management | Creates a new PIP with target goals and review cadence |
| `POST /api/pips/:id/generate-review` | PIP Management | Generates next due 7-day weekly review or PIP final review |
| `POST /api/pips/:id/checkins` | PIP Management | Manually logs milestone check-in and goal ratings on a PIP |
| `GET /api/appraisals` | Appraisals | Lists employee appraisals with rolling 4-quarter scores |
| `POST /api/appraisals/:id/recommend` | Appraisals | Submits manager salary increment recommendation |
| `POST /api/appraisals/:id/calibrate` | Appraisals | Submits HOD calibrated final rating and increment |
| `POST /api/appraisals/:id/lock` | Appraisals | HR final approval; locks appraisal and releases digital letter |
| `GET /api/kras/templates` | KRAs | Fetches organization and department KRA scorecard templates |
| `GET /api/masters/employees` | Master Data | Retrieves active employee directory and organizational chart |
| `GET /api/management/dashboard` | Executive | Returns C-level department KPIs, workforce risk, and trends |
| `POST /api/ai/synthesize-review` | AI Synthesis | Generates Gemini AI performance summaries and feedback |
| `GET /api/audit` | Compliance | Queries immutable ISO-compliant audit trail records |

---

## 🎨 Design System & Aesthetics

- **Color Palette:**
  - Neutral Base: Slate tones (`slate-900` / `slate-50`) with full Light/Dark mode support.
  - Primary Brand: Deep Indigo (`indigo-600` / `indigo-500`).
  - Status Indicators: Emerald (Completed/Met), Amber (PIP / In Progress / Attention), Rose (Failed/Overdue), Sky (HR Actions).
  - PIP Accent: Calm amber palette (`border-amber-200`, `bg-amber-50`, `text-amber-800`) designed to maintain constructive clarity without alarmism.
- **Typography:** Modern sans-serif system font stack with tabular numeric figures (`tabular-nums`) for all score calculations and percentages.
- **Accessibility:** High-contrast text compliance, distinct focus rings, clear badge icons, and semantic HTML structure throughout.

---

## 🛡️ License

This project is proprietary software designed for internal corporate performance management and appraisal operations. All rights reserved.
