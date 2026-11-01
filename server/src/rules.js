// Business rules enforced on the server so the API is safe even without the UI.
import { models } from './models.js';
import { buildSchedule, today } from './lib/calc.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => { throw new HttpError(400, msg); };
const conflict = (msg) => { throw new HttpError(409, msg); };
const all = (c) => models[c].find().lean();
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const need = (doc, ...keys) => keys.forEach((k) => blank(doc[k]) && bad(`${k} is required`));
const num = (doc, k, { min, max, int } = {}) => {
  const v = Number(doc[k]);
  if (Number.isNaN(v)) bad(`${k} must be a number`);
  if (min !== undefined && v < min) bad(`${k} must be at least ${min}`);
  if (max !== undefined && v > max) bad(`${k} must be at most ${max}`);
  if (int && !Number.isInteger(v)) bad(`${k} must be a whole number`);
};
const oneOf = (doc, k, list) => { if (!list.includes(doc[k])) bad(`${k} must be one of: ${list.join(', ')}`); };

async function readiness() {
  const [acts, defects, changes] = await Promise.all([all('activities'), all('defects'), all('changes')]);
  const problems = [];
  if (acts.some((a) => Number(a.percent) < 100)) problems.push('some activities are not 100% complete');
  if (defects.some((d) => d.severity === 'critical' && !['resolved', 'closed'].includes(d.status))) problems.push('critical defects are unresolved');
  if (changes.some((c) => c.status === 'pending')) problems.push('change requests are pending');
  return problems;
}

// Each rule receives (doc, existing). `existing` is undefined on create.
export const rules = {
  charter: {
    async save(doc) {
      need(doc, 'name', 'startDate', 'deadline');
      num(doc, 'budget', { min: 1 });
      if (doc.deadline <= doc.startDate) bad('deadline must be after the start date');
      if (doc.status === 'Closed') {
        const p = await readiness();
        if (p.length) conflict(`Project cannot be closed: ${p.join('; ')}`);
      }
    },
  },
  plan: {
    save(doc) {
      const t = doc.thresholds || {};
      if (!(t.cpi > 0 && t.cpi <= 1.5 && t.spi > 0 && t.spi <= 1.5)) bad('thresholds.cpi and thresholds.spi must be between 0 and 1.5');
    },
  },
  closure: {
    async save(doc) {
      if (doc.status === 'closed') {
        need(doc, 'deliverablesAccepted', 'signedOffBy', 'handover', 'lessons');
        const p = await readiness();
        if (p.length) conflict(`Project cannot be closed: ${p.join('; ')}`);
      }
    },
  },
  milestones: {
    async save(doc) {
      need(doc, 'name', 'date', 'owner');
      oneOf(doc, 'status', ['pending', 'achieved', 'at-risk']);
      const ch = await models.charter.findOne().lean();
      if (ch && (doc.date < ch.startDate || doc.date > ch.deadline)) bad('milestone date must fall between the project start and deadline');
    },
  },
  requirements: {
    async save(doc, ex) {
      need(doc, 'title', 'priority');
      if (String(doc.title).trim().length < 8) bad('title must be at least 8 characters');
      oneOf(doc, 'status', ['proposed', 'approved', 'rejected']);
      // Requirements raised after baseline can only enter scope through a change request.
      if (doc.origin === 'change' && doc.status === 'approved' && ex?.status !== 'approved') {
        const crs = await models.changes.find({ requirementId: doc._id, status: { $in: ['pending', 'approved'] } }).lean();
        if (!crs.length) conflict('This requirement was raised after baseline. Approve it through a change request.');
      }
    },
    async remove(ex) {
      if (await models.wbs.exists({ reqId: ex._id })) conflict('Requirement is used by the WBS');
      if (await models.changes.exists({ requirementId: ex._id })) conflict('A change request refers to this requirement');
    },
  },
  wbs: {
    async save(doc, ex) {
      need(doc, 'name');
      oneOf(doc, 'type', ['deliverable', 'package']);
      if (doc.parentId) {
        const p = await models.wbs.findById(doc.parentId).lean();
        if (!p) bad('parent does not exist');
        if (p.type !== 'deliverable') bad('parent must be a deliverable');
        if (ex && doc.parentId === ex._id) bad('an element cannot be its own parent');
      }
      if (doc.type === 'package') {
        if (!doc.reqId) bad('a work package must trace to an approved requirement');
        const r = await models.requirements.findById(doc.reqId).lean();
        if (!r) bad('requirement does not exist');
        if (r.status !== 'approved') conflict('Only approved requirements can be added to the WBS');
        if (ex && (await models.wbs.exists({ parentId: ex._id }))) bad('this element has children, so it must stay a deliverable');
      } else if (doc.reqId) bad('only work packages link to requirements');
    },
    async remove(ex) {
      if (await models.wbs.exists({ parentId: ex._id })) conflict('Delete the child elements first');
      if (await models.activities.exists({ wbsId: ex._id })) conflict('Activities are assigned to this package');
    },
  },
  changes: {
    async save(doc, ex) {
      need(doc, 'title', 'requirementId', 'justification', 'requestedBy');
      if (String(doc.justification).trim().length < 15) bad('justification must be at least 15 characters');
      num(doc, 'costImpact', { min: 0 }); num(doc, 'scheduleImpact', { min: 0 });
      oneOf(doc, 'status', ['pending', 'approved', 'rejected']);
      const r = await models.requirements.findById(doc.requirementId).lean();
      if (!r) bad('requirement does not exist');
      if (ex && ex.status !== 'pending' && doc.status !== ex.status) conflict(`${ex.code} was already ${ex.status} and cannot be decided again`);
      if (doc.status === 'approved' && r.status !== 'approved') conflict('Approve the linked requirement before approving the change request');
    },
  },
  activities: {
    async save(doc, ex) {
      need(doc, 'name', 'wbsId', 'assignee', 'start');
      num(doc, 'duration', { min: 1 }); num(doc, 'plannedCost', { min: 0 }); num(doc, 'percent', { min: 0, max: 100 });
      const pk = await models.wbs.findById(doc.wbsId).lean();
      if (!pk || pk.type !== 'package') bad('activity must belong to an existing WBS work package');
      const ch = await models.charter.findOne().lean();
      if (ch && doc.start < ch.startDate) bad('activity cannot start before the project start');
      const deps = doc.deps || [];
      if (!Array.isArray(deps)) bad('deps must be an array');
      const acts = await all('activities');
      const ids = new Set(acts.map((a) => a.id || a._id));
      deps.forEach((d) => { if (!ids.has(d)) bad('a dependency refers to an activity that does not exist'); if (ex && d === ex._id) bad('an activity cannot depend on itself'); });
      const cand = ex ? acts.map((a) => (a._id === ex._id ? { ...doc, id: ex._id } : { ...a, id: a._id })) : [...acts.map((a) => ({ ...a, id: a._id })), { ...doc, id: '__new' }];
      if (buildSchedule(cand, today()).cycle) bad('these dependencies create a loop');
    },
    async remove(ex) {
      if (await models.activities.exists({ deps: ex._id })) conflict('Other activities depend on this one');
      if (await models.expenses.exists({ activityId: ex._id })) conflict('Expenses are recorded against this activity');
    },
  },
  expenses: {
    async save(doc) {
      need(doc, 'activityId', 'date');
      num(doc, 'amount', { min: 0.01 });
      if (!(await models.activities.exists({ _id: doc.activityId }))) bad('activity does not exist');
      if (doc.date > today()) bad('expenses cannot be dated in the future');
    },
  },
  defects: {
    async save(doc) {
      need(doc, 'title', 'assignee');
      if (String(doc.title).trim().length < 10) bad('title must be at least 10 characters');
      oneOf(doc, 'severity', ['critical', 'major', 'minor']);
      oneOf(doc, 'status', ['open', 'in-progress', 'resolved', 'closed']);
      if (doc.activityId && !(await models.activities.exists({ _id: doc.activityId }))) bad('related activity does not exist');
    },
  },
  checklists: {
    save(doc) {
      need(doc, 'deliverable');
      (doc.items || []).forEach((i) => { if (!['pass', 'fail', 'pending'].includes(i.result)) bad('checklist result must be pass, fail or pending'); });
    },
  },
  risks: {
    save(doc) {
      need(doc, 'title', 'owner', 'problem', 'preventive', 'corrective');
      num(doc, 'likelihood', { min: 1, max: 5, int: true }); num(doc, 'impact', { min: 1, max: 5, int: true });
    },
  },
};
