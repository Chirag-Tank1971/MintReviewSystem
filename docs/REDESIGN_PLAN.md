# MintReview UI Redesign Plan

**Direction:** Calm precision (the Linear / Stripe Dashboard / Notion school), light theme first with dark mode kept as an option.
**Constraint:** every phase ships on its own, never regresses performance, and leaves the app WCAG 2.1 AA compliant.
**Basis:** a code-level audit of `Qreview_frontend/src` across visual design, design system, motion/performance and accessibility/mobile. The counts below come from the source; nothing was rendered, so each phase includes a visual QA step.

---

## 1. Where we are

MintReview works, but it looks generic for four measurable reasons.

| Problem | Evidence |
|---|---|
| **One text size for everything** | `text-xs` ×1,193 and `text-[11px]` ×726 vs `text-sm` ×184. Weight carries all hierarchy: `font-bold` ×654, `font-semibold` ×721. Table cells and panel titles are both 11–12px. |
| **A design system nobody uses** | 410 raw `<button>`s vs 44 shared `<Button>`s. 29 files hand-roll their own modal overlay. 40 hand-built tables. 215 form controls, of which 29 use `formStyles`. 12 separate avatar-initials implementations. |
| **Dark mode written by hand** | 6,482 `dark:` classes, 115 hex literals (42 distinct), and two different dark palettes (`#121215`, `#18181d`, `#0c0c0e` next to the slate tokens). |
| **Effects that cost more than they give** | 37 `backdrop-blur`s (one on a sticky table header, repainting on every scroll frame), 30 `shadow-2xl`, 103 `transition-all`, a sidebar that animates `width`, and a page fade that runs exactly while heavy pages mount. This is the main reason the app "doesn't feel smooth". |

Also found:
- The No-Purple colour remap silently greyed out the **HOD stage**, **HR calibration** and **PIP Final** states. "With HOD" now looks identical to "Not started".
- About **29 dialogs** have no focus trap. One Escape closes **two** stacked modals and discards the inner one's unsaved work.
- `text-slate-400` is used for body text about 405 times at **2.6:1** contrast, below the 4.5:1 that WCAG AA requires.
- Every input is under 16px, so **iOS zooms in on every field**.

**Already right, so keep:**
- the login page (the strongest screen);
- `RatingScale` (a proper radiogroup with arrow keys);
- `SegmentedControl` and `StatusBadge`;
- the single indigo accent;
- IBM Plex Sans with tabular figures;
- the side-rail scoring layout.

---

## 2. Design principles

1. **Hierarchy through size and space, not boldness.** Three weights (400/500/600) and a real type scale.
2. **One sheet, not a pile of cards.** Group content on a single surface divided by hairlines; reserve cards for things that are actually separate.
3. **The accent means "act" or "you are here".** Use it only on primary actions, the current location, focus and selection. Facts stay in ink.
4. **Status is a word plus a quiet tint.** Never colour alone, never a solid block.
5. **Flat at rest, lifted only when floating.** Shadows belong to popovers and modals only. No blur.
6. **Motion confirms, it never decorates.** 120–260ms, transform and opacity only, nothing on keyboard-driven actions.
7. **Every component is accessible by construction.** Focus trap, labels, 44px touch targets and contrast are baked into the primitives, not left to each screen.

---

## 3. Visual language

### 3.1 Colour roles (semantic tokens)

Components use **role** utilities (`bg-surface`, `text-fg-muted`, `border-line`), never raw palette pairs. Dark mode is then a second set of values, which retires most of the 6,482 `dark:` classes.

| Role | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F8FAFC` | `#0B1020` | App canvas |
| `surface` | `#FFFFFF` | `#111827` | Sheets, tables, panels |
| `surface-sunken` | `#F1F5F9` | `#0D1424` | Toolbars, segmented tracks, table headers |
| `surface-raised` | `#FFFFFF` | `#172033` | Popovers, modals (with shadow) |
| `line` | `#E2E8F0` | `#243044` | Dividers, card borders (decorative only) |
| `line-input` | `#7D8CA3` | `#475569` | Input borders: ≥3:1, as WCAG 1.4.11 requires |
| `fg` | `#0F172A` | `#E2E8F0` | Primary text |
| `fg-muted` | `#475569` | `#94A3B8` | Secondary text |
| `fg-subtle` | `#5B6B82` | `#7C8798` | Meta text, placeholders (5.4:1). **Replaces `slate-400` for text.** |
| `accent` | `#3A3A8C` | `#5D62BD` | Primary action, current nav, focus ring, selection |
| `accent-subtle` | `#EEF0FA` | `#222253` | Selected rows, active filters |
| `success` / `-subtle` | `#047857` / `#ECFDF5` | `#34D399` / `#052E22` | Done, approved, met |
| `warning` / `-subtle` | `#A14400` / `#FFFBEB` | `#FBBF24` / `#2A1A05` | Attention, PIP, in progress |
| `danger` / `-subtle` | `#BE123C` / `#FFF1F2` | `#FB7185` / `#2D0A14` | Overdue, returned, destructive |
| `info` / `-subtle` | `#0369A1` / `#F0F9FF` | `#38BDF8` / `#082032` | HR-owned steps, neutral notices |
| `scrim` | `rgb(15 23 42 / .40)` | `rgb(2 6 23 / .60)` | Modal backdrop, flat, no blur |

Rules:
- **`danger` is the only red.** The 101 `red-*` uses fold into rose.
- **`slate-300` is for decorative dividers only.**
- **No text lighter than `fg-subtle` on light backgrounds.**

**Review stage replaces stage colours.** Stage is shown as a **4-step progress mark plus a label** (Self → Manager → HOD → HR), neutral by default. Colour appears only for a state that needs action:
- `warning` for returned or due soon;
- `danger` for overdue;
- `success` for closed.

This fixes the lost-violet bug without adding a hue, and removes the duplicate Stage and Status chips from every row.

**Data visualisation:**
- One hue (the logo steel blue `#4A86B4`) with opacity steps.
- Direct labels instead of legends, 1px gridlines in `#EEF0F3`.
- Bars and sparklines over donuts, with `isAnimationActive={false}`.
- Rating bands keep their fixed mapping in `src/config/chartColors.ts`.

### 3.2 Typography (IBM Plex Sans, tabular figures for all numbers)

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 28 / 32 | 600, tracking −0.01em | Hero metrics (one per page) |
| `title-1` | 20 / 28 | 600 | Page title |
| `title-2` | 15 / 22 | 600 | Section / panel title |
| `body` | 13 / 20 | 400 | **Default UI text and table cells** |
| `body-strong` | 13 / 20 | 500 | Names, labels, emphasised cells |
| `caption` | 12 / 16 | 400–500 | Meta, secondary lines |
| `micro` | 11 / 16 | 500 | Badge text only |

- **No `font-bold`, no 10px text,** and 11px only inside badges.
- **Inputs are 16px on phones** (`text-base sm:text-sm`) so iOS doesn't zoom.

### 3.3 Space, shape, elevation

- **Spacing:** 4px grid, steps 4 · 8 · 12 · 16 · 24 · 32 · 48. Drop the half-steps (`px-2.5`, `gap-3.5`).
- **Layout:**
  - Page gutter 32px both sides, content max-width 1280px (wide tables may go full-bleed).
  - Sections 32px apart, panel padding 16–20px.
  - Table rows 40px, or 36px in a compact density toggle.
- **Radius:** 6px controls · 8px cards/sheets · 12px modals and popovers · full only for avatars and dots.
- **Elevation:**
  - Flat at rest (1px `line` border).
  - `shadow-popover`: `0 4px 12px -2px rgb(15 23 42/.08), 0 0 0 1px rgb(15 23 42/.06)`.
  - `shadow-modal`: `0 16px 40px -8px rgb(15 23 42/.18), 0 0 0 1px rgb(15 23 42/.06)`.
  - That's all. **No `backdrop-blur` anywhere.**
- **Icons:** lucide at 16px with 1.5 stroke, `fg-subtle`. Use them in navigation and leading button slots only, not decoratively inside chips.

### 3.4 Motion tokens

| Token | Value | Used for |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Anything entering; exits too |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen movement |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets, drawers |
| `--dur-press` | 120ms | Press feedback |
| `--dur-fast` | 150ms | Hover, popovers, menus |
| `--dur-base` | 200ms | Modals, toasts, accordions |
| `--dur-drawer` | 260ms | Drawers, sheets |
| spring | `{ type: 'spring', duration: 0.3, bounce: 0 }` | The only framer spring (delete `springBouncy`) |

Exits run at 0.75× the enter duration. Full spec in §6.

---

## 4. App shell and information architecture

**Sidebar (240px, collapsible to 56px):**
- The logo and "MintReview" move here from the header.
- Nav groups stay: Work / People / Configuration / System.
- The active item is a 2px accent rail plus `fg` text, not a filled wash.
- Collapse is **instant**. Today it animates `width`, which re-lays out every table on each frame.

**Top bar (48px):**
- Breadcrumb · ⌘K search · notifications · avatar.
- The role switcher, theme toggle and sign-out move into the avatar menu (built on Radix DropdownMenu, with `aria-expanded`).
- The bell drops its ping and its 1.1s ring. It becomes one 400ms, 3-swing ring.

**Content area:**
- Symmetric 32px gutters. Today it's `pl-2 … pr-8`, so content hugs the sidebar.
- A "Skip to content" link.
- Sticky page header (title + one-line description + actions) on long pages.

**Command palette (⌘K, optional, Phase 6):**
- Jump to a page, an employee or a review.
- Quick actions ("Start review for…", "Open my pending").
- Opens instantly, with no animation (keyboard-driven UI shouldn't animate).

**Mobile:**
- `h-dvh` instead of `h-screen` (`App.tsx:203`, `LoginPage.tsx:148`, and about 27 `max-h-[…vh]`).
- Safe-area padding on fixed UI, `viewport-fit=cover`, a `theme-color` per scheme.
- 44px touch targets on coarse pointers.
- Every wide table switches to stacked rows below `sm`.

---

## 5. Screen-by-screen

### Dashboard (all roles)
- Replace "Good morning, X" with the period and time left: **"Q3 2026 · 12 days left"** and one progress figure (`display`).
- **"Your queue"** is the primary block: one full-width list sorted by urgency (overdue → due soon → rest), each row with one clear action.
- **One row of 3–4 inline KPIs**, borderless and divided by hairlines, in ink rather than accent.
- Secondary insights (coverage, calibration, reviewers behind) sit in a quieter two-column band below.
- **Delete empty cards.** Admin currently renders an empty `DatesCard events={[]}`.
- The skeleton must match the real layout. Today's dark banner flashes in light mode and shifts the layout.

### Reviews list (`QuarterlyReviewView`)
- **One toolbar row:** period select · search · quick views as a `SegmentedControl` with counts · a "Filters" popover for department, manager, status and type.
- **Row anatomy:**
  - neutral initial avatar (not the cycle colour);
  - name and code;
  - the 4-step stage mark plus label;
  - right-aligned tabular score and "KRAs rated 6/9";
  - **actions appear on hover or focus**, with no filled primary button repeated on every row.
- The KPI strip becomes a plain inline stat row in ink (no accent tint).
- The insight charts collapse into one "Insights" disclosure, lazily loaded with Recharts.
- Batch actions use a bottom bar that slides up (200ms) when rows are selected.

### Review scoring workspace (`ReviewScoringModal`)
- **Becomes a full route** (`/reviews/:id`), like an issue page in Linear:
  - deep-linkable;
  - browser Back works;
  - full height on every screen;
  - no modal-in-modal stacking.

  The side rail stays: a plain stepper (number, label, ✓ or score), then the score card, reviewers, audit trail and actions.
- **Below `md`:** the rail collapses into a step header plus a bottom action bar. The KRA area gets the full screen; today the rail caps it at about 50% of the height.
- **Status banners collapse into one callout.** Returned, inactive and errors combine into a single amber or rose callout with a "Details" disclosure.
- **RatingScale:** 44px segments with 13px labels. Keep the sliding `layoutId` selection pill (spring, 0.25s, no bounce).
- **Typing performance:** each KRA card holds its own draft state and commits on blur or after a 300ms debounce. Cards are `memo`'d. Today every keystroke re-renders every KRA card.

### Appraisals
- The same toolbar and table pattern as Reviews.
- Currency columns are right-aligned with `formatMoney` (`Intl.NumberFormat('en-IN')`). There are 55 bare `toLocaleString()` calls today.
- The increment guide moves into column-header tooltips and a one-line legend.
- The financial-year list comes from data, not hard-coded values (`AppraisalManagementView.tsx:544-546`).

### Employees and Departments
- Directory as a table with sticky first column; cards below `sm`.
- Every truncated name and email gets a tooltip.
- **No placeholder words.** The literal word "Designation" is shown today when the field is empty.
- The hierarchy view keeps its structure. It moves to the new tokens, and the edit action becomes a Menu.

### Reports, Sales Champs, PIPs, Audit, Notifications
- All of these move to the shared `Table`, `Card`/`Stat`, `Badge` and `Tabs` components.
- **Reports:** one chart style (§3.1) and direct labels.
- **Sales Champs:** the HR list is already on the shared components. The scheme document keeps its letterhead look.
- **Audit:** server-side pagination. It is the one list that grows without limit.
- **Notifications:** grouped by day, read and unread shown by weight rather than colour, and the existing filters as `Tabs`.

### Login
Already the strongest screen. Lighten the brand panel from solid indigo-900 to the canvas colour with an accent rule, and use 40px, 15–16px inputs.

### Empty, loading and error states
- **Empty:** `EmptyState` inline in the table body (no bordered box), with one sentence and one action.
- **Loading:** skeleton rows at the real row height, with a static opacity pulse (0.6↔1) instead of the shimmer gradient.
- **Errors:** inline, next to the field or block that failed, with a retry.

---

## 6. Interaction and motion spec

| Interaction | Motion |
|---|---|
| Button / clickable row press | `scale(0.98)`, 120ms. Today `Button` has no press state. |
| Hover | Colour only, 150ms, on hover-capable devices only |
| Popover / menu | `scale(0.97→1)` + opacity from the trigger origin, 150ms `--ease-out`; exit 110ms |
| Modal / dialog | Opacity + `scale(0.97→1)`, 200ms; scrim opacity only |
| Drawer / sheet | `translateX(100%→0)`, 260ms `--ease-drawer`, no fade |
| Toast | CSS transitions with `@starting-style` (so they can retarget), 200ms, same edge in and out |
| Progress bars | `transform: scaleX()` with `origin-left`, 300ms ease-out. Never animate `width`. |
| Score change | Number cross-fades with 4px y, 150ms |
| Optimistic submit/approve | Label and status update instantly, roll back with an error toast on failure |
| Page navigation | **None.** `PageTransition` is removed. It fades while the next view mounts, which causes dropped frames and a blank-looking page. |
| Charts, sidebar collapse, ⌘K | **None** |

**Reduced motion:**
- Translate and scale become a 150ms opacity fade; shimmer is off.
- **Never** a global `transform: none !important`. Today's rule (`index.css:418`) breaks toggle knobs, chevrons and centred popovers.

**Remove:**
- `animate-ping` on the bell and `animate-pulse` on the overdue dot.
- `scroll-smooth` on the main scroller.
- The `body` background transition.
- All 103 `transition-all`.
- Every `width`/`height` animation.

---

## 7. Component library (`src/components/ui/`)

Built in this order. Each one replaces specific hand-rolled code and bakes in its accessibility.

| # | Component | API sketch | Replaces | Built-in requirements |
|---|---|---|---|---|
| 1 | **Dialog** | `<Dialog open onClose title size footer>` | 29 overlay files, 24 Escape handlers | Native `<dialog>.showModal()` or Radix: focus trap, initial focus, focus restore, only the top dialog handles Escape, scroll lock, `aria-labelledby` |
| 2 | **Sheet / Drawer** | `<Sheet side="right" …>` | `AuditTrailDrawer`, drawer keyframes, mobile scoring layout | Same as Dialog |
| 3 | **Field + Input / Select / Textarea** | `<Field label hint error required><Input/></Field>` | 215 raw controls, `formStyles.ts` | `useId` labels, `aria-invalid`, `aria-describedby`, "(required)" text, 16px on mobile, ≥3:1 borders |
| 4 | **Button / IconButton** (extended) | `variant: primary\|secondary\|ghost\|danger`, `loading`, `size` | 410 raw buttons | Press state, `focus-visible` ring (2px accent, offset 2); `IconButton` *requires* `aria-label`; 44px hit area on coarse pointers |
| 5 | **Table** | `<Table columns rows density stickyHeader empty loading>` plus composable parts | 40 tables | Sortable headers with `aria-sort`, row-as-link pattern (never `tr onClick`), stacked rows below `sm` |
| 6 | **Card / Stat** | `<Card title actions>`, `<Stat label value delta>` | Dashboard tiles, most `rounded-xl` | Clickable variant renders a real link (stretched-link) |
| 7 | **Badge** | `<Badge tone>` (`StatusBadge` maps onto it) | 244 ad-hoc `rounded-full` pills | Text label always present |
| 8 | **StageMark** | `<StageMark stage returned overdue>` | Stage + Status chip pairs | Text label plus `aria-label` describing the step |
| 9 | **Tabs** | `<Tabs value onChange items>` | Ad-hoc tab rows (0 `role="tab"` today) | Roving tabindex, arrow keys |
| 10 | **Menu / Select / Combobox** | Radix-based | Custom dropdowns, 3-dot menus, the location picker | `aria-expanded`, typeahead, full keyboard |
| 11 | **Avatar** | `<Avatar name src size>` | 12 initials implementations | Grapheme-safe initials, neutral colour |
| 12 | **Skeleton** | `<Skeleton className>` | 59 ad-hoc pulses | Respects reduced motion |
| 13 | **Toast tones** | success / error / info on `ToastContext` | — | Success and info toasts are `role="status"` (polite); errors are `alert` |
| 14 | **Command palette** | `<CommandPalette>` | — | Optional, last |

**Data helpers:**
- `formatMoney` (en-IN), `formatDate`;
- grapheme-safe `initials()`;
- one truncate-with-tooltip pattern;
- a shared `useDeferredSearch`.

**Dependencies:** none new. Radix is already installed (Tooltip), and native `<dialog>` and `popover` cover the rest.

---

## 8. Performance plan

**Budgets** (checked in CI or on each release):
- Lighthouse Performance ≥ 90 on the production build.
- INP < 200ms.
- Total Blocking Time < 200ms.
- Main bundle ≤ 470 KB raw (today 548 KB / 163 KB gzip).
- No long task > 100ms while typing.

Render work, in order:
1. **Remove `PageTransition`** and the double fade (skeleton plus page).
2. **`QuarterlyReviewView`** (2,400+ lines). Split it into:
   - `ReviewsSearchBox` (local state, deferred value upward);
   - a memoised `ReviewInsights` (lazy-loaded Recharts);
   - memoised `ReviewRow` / `ReviewCard` with stable callbacks.

   Also point the page-reset effect at the deferred search.
3. **Scoring workspace:** per-KRA local draft state plus `memo` (see §5). Apply the same pattern to `EmployeeModal` (2,289 lines).
4. **Employee pickers** (`AssignKraModal`, `InitiateReviewModal`, `BatchLetterExportModal`, `AuditComplianceExplorer`): deferred search plus a 50-row cap. Virtualise only above about 200 rows. Main tables page at 10–50 rows and don't need it.
5. **Effects:**
   - no blur;
   - `shadow-2xl` → tokens;
   - `transition-all` → `transition-colors`/`transform`;
   - progress bars via `scaleX`;
   - the sidebar collapse made instant.
6. **Prefetch** each page's lazy chunk on sidebar `pointerenter`.
7. **Memoise context values** (`NotificationsContext`, `AuthContext`).

The API side was handled separately (database-side filtering, compression, indexes, lighter notification polling). Remaining work there: server-side pagination for the Audit Trail page and the Management dashboard routes.

---

## 9. Accessibility and mobile requirements

These go into the primitives (§7) so screens get them for free. Ship-blockers are marked **(AA)**.

- [ ] **(AA)** Every dialog traps and restores focus, and only the top dialog handles Escape.
- [ ] **(AA)** No `div`/`tr` with `onClick`. Clickable cards and rows render a real button or link.
- [ ] **(AA)** Icon-only buttons have `aria-label`. About 40 are missing today, including most modal close buttons.
- [ ] **(AA)** Labels are programmatically tied to inputs. Today: 215 controls, 14 `htmlFor`.
- [ ] **(AA)** Field errors are announced: `aria-invalid`, `aria-describedby`, and focus moves to the first invalid field.
- [ ] **(AA)** Text contrast ≥ 4.5:1 and UI boundaries ≥ 3:1. Token values are in §3.1.
- [ ] **(AA)** A visible focus ring on every control. Six places currently remove it with nothing in its place.
- [ ] **(AA)** Reduced motion never strips `transform`.
- [ ] Menus expose `aria-expanded` / `aria-haspopup`.
- [ ] Success toasts are polite. Add a skip link and landmarks.
- [ ] 16px inputs on phones, `dvh` units, safe-area insets, 44px targets, `touch-action: manipulation`, `overscroll-behavior: contain` in modal scroll areas.
- [ ] **Worst-case data handled:**
  - long names and emails (truncate with tooltip, `overflow-wrap`);
  - empty fields (no placeholder words);
  - Indian number grouping;
  - null-safe numbers (no `NaN`).

---

## 10. Roadmap

Each phase is one or more PRs that ship independently. Estimates assume one frontend developer.

### Phase 0: Quick wins (1–2 days, no visual redesign)
1. Remove `PageTransition`; keep the instant view swap.
2. Delete `transform: none !important` from the reduced-motion rule.
3. Remove all `backdrop-blur` (scrims become flat `scrim`), and change `shadow-2xl` to `shadow-xl` as a stopgap.
4. Make the sidebar collapse instant. Replace `transition-all` in the hot spots (`QuarterlyReviewView`, `ReportCharts`, `NotificationsCenterView`).
5. Restore the HOD, HR-calibration and PIP-Final states lost to the purple remap (temporarily `info`/`warning` tones until StageMark lands).
6. `h-dvh`, 16px mobile inputs, viewport meta, toast roles, skip link.
7. `aria-label` on the icon-only buttons; fix the 6 removed focus outlines.

**Outcome:** visibly smoother, the main AA blockers in the shell are gone, and nothing looks different yet.

### Phase 1: Foundations (3–4 days)
1. Add the semantic tokens (§3) next to the current palette, with no visual change.
2. Codemods with no visual change:
   - `text-[11px]` → `text-2xs`;
   - `red-*` → `rose-*`;
   - violet/purple uses → explicit slate;
   - then remove the remap.
3. Codemod the ~20 most common light/dark pairs to role classes, **one folder per PR**, with before/after screenshots in both themes.
4. Recreate `DESIGN.md` and `PRODUCT.md`, now missing from the repo, from this plan.
5. **CI ratchet:** commit today's counts as a baseline and fail the build if any rise:
   - raw `<button className`;
   - `fixed inset-0` outside `ui/`;
   - `transition-all`;
   - hex in `.tsx`;
   - `text-[`;
   - `backdrop-blur`.

### Phase 2: Core components (1–1.5 weeks)
Dialog → Sheet → Field/Input/Select/Textarea → Button/IconButton → Table → Badge/StageMark → Card/Stat → Tabs → Menu → Avatar → Skeleton → Toast tones.
- Each component lands with a short usage example and is adopted in **one** screen in the same PR.
- **Start with the five modals that stack** (the Escape bug).

### Phase 3: Shell and dashboards (1 week)
New sidebar and top bar, avatar menu, the queue-first dashboard for every role, real-layout skeletons, prefetch on hover. **Switch the look:** apply the type scale (13px body) and radii. This is the moment the app visibly changes, so it needs a visual QA pass in both themes before release.

### Phase 4: Reviews and scoring workspace (1–1.5 weeks)
- The reviews list toolbar and row anatomy, plus the `QuarterlyReviewView` split (§8.2).
- The scoring modal becomes the `/reviews/:id` workspace: route, mobile layout, per-KRA draft state, single callout.

### Phase 5: Remaining screens (1.5–2 weeks)
Appraisals, Employees/Departments, PIPs, Reports, Sales Champs, Audit (with server-side pagination), Notifications, Masters, Bulk import. Each moves onto the shared components and must bring its ratchet counts down.

### Phase 6: Signature polish (3–5 days)
Optimistic submit/approve, score cross-fade, batch bar, popover origins, ⌘K command palette (optional), a final Lighthouse/INP pass against the budgets in §8.

**Total:** roughly 6–8 weeks for one developer. Phases 0–1 alone fix most of the "not smooth" complaint and the main accessibility blockers.

---

## 11. How we'll know it worked

| Measure | Today | Target |
|---|---|---|
| Raw `<button>` / hand-rolled overlays / tables | 410 / 29 / 40 | ~0 outside `ui/` |
| `dark:` classes | 6,482 | < 500 |
| `text-[11px]` + `text-[10px]` | 740 | 0 (badges use `micro`) |
| Text below 4.5:1 contrast | ~400 uses | 0 |
| Lighthouse Performance (prod) | 58 | ≥ 90 |
| Total Blocking Time | 1,500ms | < 200ms |
| Dialogs with focus trap | 0 / 29 | all |

---

## 12. Decisions and risks

**Decisions to confirm:**
1. **The scoring modal becomes a full route.** This changes how users navigate: Back now returns to the list. Recommended.
2. **13px body text.** It's denser than many consumer apps and right for a desktop work tool. Confirm with a few real users in Phase 3.
3. **The ⌘K command palette** is optional and can be dropped.

**Risks:**
- **The look switch in Phase 3 touches every screen.** Mitigation: role tokens first (Phase 1), so the switch is a few token edits, plus a screenshot review in both themes.
- **Codemods across 80 files.** Mitigation: one folder per PR, a visual diff, and no behaviour changes mixed in.
- **Nothing in this plan was rendered.** Every phase includes a QA pass in the browser at desktop and phone widths, in both themes, plus a keyboard-only and screen-reader check of the new primitives.
