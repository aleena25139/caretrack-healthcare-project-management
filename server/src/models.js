import mongoose from 'mongoose';

// Every collection uses a String _id so that references between documents
// (wbsId, deps, reqId ...) stay valid for both seeded and newly created records.
const newId = () => new mongoose.Types.ObjectId().toString();
const make = (name) => {
  const schema = new mongoose.Schema({ _id: { type: String, default: newId } }, { strict: false, versionKey: false, timestamps: true });
  return mongoose.models[name] || mongoose.model(name, schema, name);
};

export const COLLECTIONS = ['charter', 'plan', 'milestones', 'closure', 'requirements', 'wbs', 'changes', 'activities', 'expenses', 'defects', 'checklists', 'risks'];
export const models = Object.fromEntries(COLLECTIONS.map((c) => [c, make(c)]));
