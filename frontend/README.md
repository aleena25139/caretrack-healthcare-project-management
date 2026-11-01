# CareTrack – Healthcare Project Management System (React front-end)

Front-end for the CSE-494 mid-term case study (Smart Healthcare Project Management and Monitoring System).
React 18 + Vite, React Router, Recharts, lucide-react. No UI framework; the design system is in `src/index.css`.

## Run

    npm install
    npm run dev          # http://localhost:5173

With no configuration it runs in **demo mode**: all records are stored in `localStorage`
and seeded with the case-study data (8 weeks into a 16-week plan, so delays, a CPI/SPI warning,
two pending change requests and two critical defects are visible immediately).

## Connect to the MERN back-end

Copy `.env.example` to `.env` and set `VITE_API_URL=/api` (Vite proxies `/api` to `localhost:5000`).
`src/lib/api.js` then talks to a generic REST API. Create one Mongoose model per collection:

| Collection | Notes |
|---|---|
| charter, plan, closure | one document each |
| milestones, requirements, wbs, changes, activities, expenses, defects, checklists, risks | many |

Endpoints (same for every collection): `GET /api/:c`, `POST /api/:c`, `PATCH /api/:c/:id`, `DELETE /api/:c/:id`.
Optional `POST /api/reset` re-seeds. Mongo `_id` is mapped to `id` automatically. Field names follow `src/lib/seed.js`
(copy that file into your seed script). Server-side, repeat the key validations (see below) so the API is safe on its own.

## Where each exam module lives

| Module | Page | What it does |
|---|---|---|
| 1 Initiation and integration | Initiation and Plan | Charter (objectives, stakeholders, scope boundary, budget, deadline), management plan with EVM thresholds, milestones, team responsibilities, closure that is blocked until readiness checks pass |
| 2 Scope and WBS | Scope and WBS | Requirements register, hierarchical WBS with cost roll-up, change requests with impact preview |
| 3 Schedule and resources | Schedule | Activities with owner, duration, dependencies; forward-pass scheduling; Gantt with baseline vs forecast; delay and downstream impact |
| 4 Cost and EVM | Cost and EVM | PV, EV, AC, CPI, SPI, EAC, ETC, VAC, S-curve, expense log, threshold warnings |
| 5 Quality and risk | Quality and Risk | Defect tracker, inspection checklists, 5×5 prioritization matrix, PDPC |
| 6 Integration and reporting | Dashboard | Health, budget, delayed activities, pending CRs, open critical defects, consistency checks, print report |

All calculations are in `src/lib/calc.js` (pure functions, easy to unit-test and to port to the Node back-end).

## Rules the UI enforces

- Only **approved** requirements can be linked to a WBS work package. Requirements added after baseline are `proposed` and can only be approved through a change request.
- Approving a change request (Scope → Change requests → Review) adds the requirement to scope, creates a WBS package and activity, raises the budget and moves the deadline. The modal previews the before/after.
- Activities must belong to a WBS package; circular dependencies are rejected; expenses cannot be future-dated.
- A WBS element, requirement or activity that is still referenced elsewhere cannot be deleted.
- The project cannot be closed while activities, critical defects or change requests are open.

## Demo script (for the viva)

1. Dashboard: health banner, CPI 0.88 and SPI 0.79 warnings.
2. Schedule → Delay impact: patient records is 12 days late, which pushes billing and testing; forecast finish passes the deadline.
3. Scope → Change requests → CR-001 → Review → Approve. Watch the budget and deadline change; check the new WBS package and Gantt bar.
4. Cost: record an expense and watch AC and CPI change; change the status date to see PV move.
5. Quality: resolve DEF-001 and DEF-002 and watch the dashboard alert clear. Try an invalid form to show validation.

## Suggested test cases

| # | Action | Expected |
|---|---|---|
| 1 | Add WBS package with no requirement | Error: must trace to an approved requirement |
| 2 | Add activity A depends on B while B depends on A | Error: loop |
| 3 | Approve CR-001 | Budget +500,000; deadline +14 days; requirement becomes approved |
| 4 | Reject a CR | Requirement becomes rejected and stays out of scope |
| 5 | Record expense dated tomorrow | Error |
| 6 | Set charter budget below planned cost | Error |
| 7 | Delete a requirement used in the WBS | Blocked with message |
| 8 | Close project with open critical defects | Button disabled |
