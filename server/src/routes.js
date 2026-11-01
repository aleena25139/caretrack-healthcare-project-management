import { Router } from 'express';
import { COLLECTIONS, models } from './models.js';
import { HttpError, rules } from './rules.js';
import { buildSchedule, computeEVM, integrity, today } from './lib/calc.js';
import { makeSeed } from './lib/seed.js';

export const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const out = (d) => (d ? { ...d, id: d._id } : d);
const clean = (body) => { const { id, _id, createdAt, updatedAt, ...rest } = body || {}; return rest; };

export async function seedDatabase() {
  const seed = makeSeed();
  await Promise.all(COLLECTIONS.map(async (c) => {
    await models[c].deleteMany({});
    await models[c].insertMany((seed[c] || []).map(({ id, ...d }) => ({ ...d, _id: id })));
  }));
}

router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

router.post('/reset', wrap(async (_req, res) => { await seedDatabase(); res.json({ ok: true }); }));

// Server-side schedule + earned value calculation (same engine as the UI).
router.get('/summary', wrap(async (req, res) => {
  const statusDate = req.query.statusDate || today();
  const get = (c) => models[c].find().lean().then((l) => l.map(out));
  const [charter, plan, activities, expenses, requirements, wbs, changes, defects] = await Promise.all(['charter', 'plan', 'activities', 'expenses', 'requirements', 'wbs', 'changes', 'defects'].map(get));
  if (!charter[0]) throw new HttpError(404, 'No project found. Run npm run seed.');
  const sched = buildSchedule(activities, statusDate);
  const evm = computeEVM(sched, expenses, statusDate, charter[0], plan[0]);
  res.json({
    statusDate, project: charter[0].name, budget: charter[0].budget, deadline: charter[0].deadline,
    evm: { BAC: evm.BAC, PV: evm.PV, EV: evm.EV, AC: evm.AC, CPI: evm.CPI, SPI: evm.SPI, CV: evm.CV, SV: evm.SV, EAC: evm.EAC, ETC: evm.ETC, VAC: evm.VAC, warnings: evm.warnings },
    schedule: { baselineFinish: sched.baselineFinish, forecastFinish: sched.finish, delayed: sched.rows.filter((r) => r.status === 'delayed').map((r) => ({ id: r.id, name: r.name, delayDays: r.delay })), impacted: sched.rows.filter((r) => r.status === 'impacted').map((r) => ({ id: r.id, name: r.name, delayDays: r.delay })) },
    pendingChangeRequests: changes.filter((c) => c.status === 'pending').length,
    openCriticalDefects: defects.filter((d) => d.severity === 'critical' && !['resolved', 'closed'].includes(d.status)).length,
    integrity: integrity({ requirements, wbs, activities, expenses, changes, defects }, sched, charter[0]),
  });
}));

router.param('c', (req, res, next, c) => (models[c] ? next() : next(new HttpError(404, `Unknown collection "${c}"`))));

router.get('/:c', wrap(async (req, res) => res.json((await models[req.params.c].find().sort({ createdAt: 1 }).lean()).map(out))));

router.get('/:c/:id', wrap(async (req, res) => {
  const d = await models[req.params.c].findById(req.params.id).lean();
  if (!d) throw new HttpError(404, 'Not found');
  res.json(out(d));
}));

router.post('/:c', wrap(async (req, res) => {
  const c = req.params.c;
  const doc = new models[c](clean(req.body));
  const plain = doc.toObject();
  await rules[c]?.save?.(plain, undefined);
  await doc.save();
  res.status(201).json(out(doc.toObject()));
}));

router.patch('/:c/:id', wrap(async (req, res) => {
  const c = req.params.c;
  const ex = await models[c].findById(req.params.id).lean();
  if (!ex) throw new HttpError(404, 'Not found');
  const patch = clean(req.body);
  await rules[c]?.save?.({ ...ex, ...patch }, ex);
  const updated = await models[c].findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, lean: true, strict: false });
  res.json(out(updated));
}));

router.delete('/:c/:id', wrap(async (req, res) => {
  const c = req.params.c;
  const ex = await models[c].findById(req.params.id).lean();
  if (!ex) throw new HttpError(404, 'Not found');
  if (['charter', 'plan', 'closure'].includes(c)) throw new HttpError(409, `The ${c} record cannot be deleted`);
  await rules[c]?.remove?.(ex);
  await models[c].deleteOne({ _id: req.params.id });
  res.status(204).end();
}));
