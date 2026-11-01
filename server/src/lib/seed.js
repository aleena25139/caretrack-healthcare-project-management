import { today, addDays } from './calc.js';

export const TEAM = [
  { name: 'Sara Malik', role: 'Project Manager' },
  { name: 'Hassan Raza', role: 'Backend Developer' },
  { name: 'Usman Tariq', role: 'Backend Developer' },
  { name: 'Ayesha Khan', role: 'Frontend Developer' },
  { name: 'Hira Noor', role: 'Frontend Developer' },
  { name: 'Zain Abbas', role: 'Database Developer' },
  { name: 'Maryam Iqbal', role: 'QA Engineer' },
];

// Demo data modelled on the Smart Healthcare case study.
// Project is 8 weeks into a 16-week plan, so EVM warnings and delays are visible immediately.
export function makeSeed() {
  const t = today();
  const start = addDays(t, -56);
  const d = (n) => addDays(start, n);

  const charter = [{
    id: 'charter-1',
    name: 'Smart Healthcare Project Management & Monitoring System',
    sponsor: 'Hospital Network Board (5 hospitals)',
    manager: 'Sara Malik',
    startDate: start,
    deadline: d(112),
    budget: 5000000,
    status: 'Executing',
    objectives: [
      'Deliver one platform for appointments, lab reports, doctor schedules, online consultations and billing',
      'Go live across all five hospitals within 16 weeks',
      'Stay within the approved budget of PKR 5,000,000',
      'Reduce appointment booking time for patients by 50%',
    ].join('\n'),
    inScope: 'Appointment booking\nDoctor schedule management\nLaboratory reports\nOnline consultations\nBilling and invoicing\nPatient record management',
    outScope: 'Pharmacy inventory\nHardware procurement\nIntegration with legacy radiology devices',
    stakeholders: [
      { name: 'Dr. Imran Sheikh', role: 'Executive sponsor, Medical Director', influence: 'High' },
      { name: 'Nadia Farooq', role: 'Hospital operations lead', influence: 'High' },
      { name: 'Finance Office', role: 'Budget approval and billing rules', influence: 'Medium' },
      { name: 'Patients and Front-desk staff', role: 'End users', influence: 'Medium' },
    ],
  }];

  const plan = [{
    id: 'plan-1',
    scope: 'Seven baseline capabilities delivered as web portals for patients, doctors and billing staff. Scope changes only enter through an approved change request.',
    schedule: '16-week plan in four phases: design (weeks 1–4), core modules (weeks 5–11), integration and testing (weeks 12–14), UAT and deployment (weeks 15–16).',
    cost: 'Bottom-up estimate by activity, PKR 4.85M planned against a PKR 5.0M approved budget (3% reserve). Earned value reviewed weekly.',
    quality: 'Every deliverable passes its checklist before sign-off. No release with open critical defects. Peer review for all backend merges.',
    thresholds: { cpi: 0.9, spi: 0.9 },
  }];

  const requirements = [
    ['Patient appointment booking across five hospitals', 'Must', 'approved', 'baseline'],
    ['Doctor schedule and availability management', 'Must', 'approved', 'baseline'],
    ['Laboratory report upload, review and sharing', 'Must', 'approved', 'baseline'],
    ['Online video consultation', 'Should', 'approved', 'baseline'],
    ['Hospital billing and invoicing', 'Must', 'approved', 'baseline'],
    ['Patient record management with audit trail', 'Must', 'approved', 'baseline'],
    ['Multi-hospital access control and platform architecture', 'Must', 'approved', 'baseline'],
    ['AI-based preliminary diagnosis module', 'Could', 'proposed', 'change'],
    ['Patient and doctor mobile application', 'Could', 'proposed', 'change'],
  ].map(([title, priority, status, origin], i) => ({ id: `req-${i + 1}`, code: `REQ-${String(i + 1).padStart(2, '0')}`, title, priority, status, origin, description: '' }));

  const wbs = [
    { id: 'w1', parentId: null, name: 'Smart Healthcare PM System', type: 'deliverable' },
    { id: 'w2', parentId: 'w1', name: 'Planning and Design', type: 'deliverable' },
    { id: 'w3', parentId: 'w2', name: 'Requirements and architecture', type: 'package', reqId: 'req-7' },
    { id: 'w4', parentId: 'w1', name: 'Core Modules', type: 'deliverable' },
    { id: 'w5', parentId: 'w4', name: 'Appointments and doctor schedules', type: 'package', reqId: 'req-1' },
    { id: 'w6', parentId: 'w4', name: 'Patient records', type: 'package', reqId: 'req-6' },
    { id: 'w7', parentId: 'w4', name: 'Laboratory reports', type: 'package', reqId: 'req-3' },
    { id: 'w8', parentId: 'w4', name: 'Billing', type: 'package', reqId: 'req-5' },
    { id: 'w9', parentId: 'w4', name: 'Online consultation', type: 'package', reqId: 'req-4' },
    { id: 'w10', parentId: 'w1', name: 'Client Interfaces', type: 'deliverable' },
    { id: 'w11', parentId: 'w10', name: 'Web portals', type: 'package', reqId: 'req-2' },
    { id: 'w12', parentId: 'w1', name: 'Verification and Release', type: 'deliverable' },
    { id: 'w13', parentId: 'w12', name: 'Integration and system testing', type: 'package', reqId: 'req-7' },
    { id: 'w14', parentId: 'w12', name: 'UAT and deployment', type: 'package', reqId: 'req-7' },
  ];

  const A = (n, name, wbsId, assignee, s, dur, cost, pct, deps = []) => ({ id: `act-${n}`, name, wbsId, assignee, start: d(s), duration: dur, plannedCost: cost, percent: pct, deps: deps.map((x) => `act-${x}`) });
  const activities = [
    A(1, 'Requirements analysis', 'w3', 'Sara Malik', 0, 14, 300000, 100),
    A(2, 'System architecture and database design', 'w3', 'Zain Abbas', 14, 14, 400000, 100, [1]),
    A(3, 'Appointment and schedule services', 'w5', 'Hassan Raza', 28, 28, 650000, 70, [2]),
    A(4, 'Patient record services', 'w6', 'Usman Tariq', 28, 28, 650000, 60, [2]),
    A(5, 'Lab report module', 'w7', 'Zain Abbas', 42, 21, 500000, 50, [2]),
    A(6, 'React web portals', 'w11', 'Ayesha Khan', 35, 35, 600000, 55, [2]),
    A(7, 'Billing module', 'w8', 'Hira Noor', 63, 21, 450000, 0, [3, 4]),
    A(8, 'Online consultation module', 'w9', 'Usman Tariq', 63, 21, 450000, 0, [5]),
    A(9, 'Integration and system testing', 'w13', 'Maryam Iqbal', 84, 14, 500000, 0, [6, 7, 8]),
    A(10, 'UAT and deployment', 'w14', 'Sara Malik', 98, 14, 350000, 0, [9]),
  ];

  const E = (n, activityId, daysAgo, amount, note, category = 'Labour') => ({ id: `exp-${n}`, activityId: `act-${activityId}`, date: addDays(t, -daysAgo), amount, note, category });
  const expenses = [
    E(1, 1, 45, 310000, 'Analysis workshops and documentation'),
    E(2, 2, 28, 420000, 'Architecture, ERD and DB design'),
    E(3, 3, 14, 260000, 'Sprint 1–2 backend labour'),
    E(4, 3, 3, 240000, 'Sprint 3 backend labour'),
    E(5, 4, 10, 470000, 'Patient record services, incl. rework'),
    E(6, 5, 7, 330000, 'Lab module and report storage'),
    E(7, 6, 5, 380000, 'Portal development and design licence', 'Tools'),
  ];

  const changes = [
    { id: 'cr-1', code: 'CR-001', title: 'Add AI-based preliminary diagnosis module', justification: 'Hospital management wants symptom triage to shorten waiting times for general outpatients.', requirementId: 'req-8', costImpact: 500000, scheduleImpact: 14, status: 'pending', requestedBy: 'Hospital Management', date: addDays(t, -9) },
    { id: 'cr-2', code: 'CR-002', title: 'Add patient and doctor mobile application', justification: 'Patients expect to book and view reports from their phones; doctors need on-call access.', requirementId: 'req-9', costImpact: 300000, scheduleImpact: 7, status: 'pending', requestedBy: 'Hospital Management', date: addDays(t, -8) },
  ];

  const milestones = [
    { id: 'm1', name: 'Requirements baselined', date: d(14), owner: 'Sara Malik', status: 'achieved' },
    { id: 'm2', name: 'Architecture and DB approved', date: d(28), owner: 'Zain Abbas', status: 'achieved' },
    { id: 'm3', name: 'Core modules feature-complete', date: d(63), owner: 'Hassan Raza', status: 'at-risk' },
    { id: 'm4', name: 'System testing signed off', date: d(98), owner: 'Maryam Iqbal', status: 'pending' },
    { id: 'm5', name: 'Go-live at five hospitals', date: d(112), owner: 'Sara Malik', status: 'pending' },
  ];

  const defects = [
    { id: 'def-1', code: 'DEF-001', title: 'Double booking: two patients get the same appointment slot', severity: 'critical', status: 'open', assignee: 'Hassan Raza', activityId: 'act-3', found: addDays(t, -6) },
    { id: 'def-2', code: 'DEF-002', title: 'Patient record overwritten when two staff edit at once', severity: 'critical', status: 'in-progress', assignee: 'Usman Tariq', activityId: 'act-4', found: addDays(t, -5) },
    { id: 'def-3', code: 'DEF-003', title: 'Doctor availability shown in the wrong time zone', severity: 'major', status: 'resolved', assignee: 'Hassan Raza', activityId: 'act-3', found: addDays(t, -12) },
    { id: 'def-4', code: 'DEF-004', title: 'Lab report PDF upload fails above 5 MB', severity: 'major', status: 'open', assignee: 'Zain Abbas', activityId: 'act-5', found: addDays(t, -3) },
    { id: 'def-5', code: 'DEF-005', title: 'Consultation fee rounds incorrectly on invoices', severity: 'minor', status: 'open', assignee: 'Hira Noor', activityId: '', found: addDays(t, -2) },
    { id: 'def-6', code: 'DEF-006', title: 'Long hospital names truncated in portal header', severity: 'minor', status: 'closed', assignee: 'Ayesha Khan', activityId: 'act-6', found: addDays(t, -15) },
  ];

  const I = (text, result = 'pending', inspector = '', date = '') => ({ id: Math.random().toString(36).slice(2, 8), text, result, inspector, date });
  const checklists = [
    { id: 'ck-1', deliverable: 'Appointment and schedule services', items: [
      I('Unit test coverage at least 80%', 'pass', 'Maryam Iqbal', addDays(t, -4)),
      I('No double booking under concurrent load', 'fail', 'Maryam Iqbal', addDays(t, -6)),
      I('API documented in OpenAPI', 'pass', 'Hassan Raza', addDays(t, -10)),
      I('Role based access verified for each hospital'),
    ] },
    { id: 'ck-2', deliverable: 'Patient record services', items: [
      I('Audit trail captures every edit', 'pass', 'Maryam Iqbal', addDays(t, -7)),
      I('Concurrent edit handling verified', 'fail', 'Maryam Iqbal', addDays(t, -5)),
      I('Personal data encrypted at rest'),
    ] },
    { id: 'ck-3', deliverable: 'Database design', items: [
      I('Schema normalised and reviewed', 'pass', 'Zain Abbas', addDays(t, -30)),
      I('Backup and restore tested', 'pass', 'Zain Abbas', addDays(t, -25)),
    ] },
  ];

  const R = (n, title, category, likelihood, impact, owner, problem, preventive, corrective, status = 'open') => ({ id: `risk-${n}`, title, category, likelihood, impact, owner, problem, preventive, corrective, status });
  const risks = [
    R(1, 'Further scope creep from hospital management', 'Scope', 5, 4, 'Sara Malik', 'More features requested after baseline, blowing budget and deadline', 'Freeze scope and route all asks through change requests', 'Negotiate trade-offs or a phase-two release'),
    R(2, 'Critical defects delay core modules', 'Quality', 4, 5, 'Maryam Iqbal', 'Double booking and record overwrite block UAT', 'Add concurrency tests to every pull request', 'Swarm both backend developers on fixes; re-run regression'),
    R(3, 'Cost overrun from rework', 'Cost', 4, 4, 'Sara Malik', 'AC keeps running ahead of EV (CPI below threshold)', 'Weekly EVM review and tighter definition of done', 'Request management reserve or reduce optional scope'),
    R(4, 'Developer unavailable', 'Resource', 2, 4, 'Sara Malik', 'Only two backend developers; one absence stalls progress', 'Pair programming and shared code ownership', 'Bring in a contractor on a short term'),
    R(5, 'Patient data privacy breach', 'Technical', 2, 5, 'Zain Abbas', 'Sensitive medical records exposed', 'Encryption, role based access and security review', 'Incident response plan and regulator notification'),
    R(6, 'Hospital staff resist new system', 'Stakeholder', 3, 3, 'Nadia Farooq', 'Low adoption after go-live', 'Involve front-desk staff in UAT and training', 'Extra training sessions and floor support in week one'),
    R(7, 'Video consultation bandwidth issues', 'Technical', 3, 2, 'Usman Tariq', 'Poor call quality in low-bandwidth areas', 'Use adaptive bitrate WebRTC provider', 'Fallback to audio-only or phone call'),
  ];

  const closure = [{ id: 'closure-1', status: 'open', deliverablesAccepted: '', lessons: '', handover: '', signedOffBy: '', closedOn: '' }];

  return { charter, plan, milestones, closure, requirements, wbs, changes, activities, expenses, defects, checklists, risks };
}
