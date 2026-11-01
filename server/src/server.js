import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { router, seedDatabase } from './routes.js';
import { models } from './models.js';
import { HttpError } from './rules.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', router);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route not found')));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Internal server error' : err.message });
});

export { app };

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const PORT = process.env.PORT || 5000;
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/caretrack';
  mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
    .then(async () => {
      console.log(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
      if (!(await models.charter.countDocuments())) { await seedDatabase(); console.log('Database was empty: sample case-study data loaded'); }
      app.listen(PORT, () => console.log(`CareTrack API running on http://localhost:${PORT}/api`));
    })
    .catch((e) => {
      console.error('\nMongoDB connection failed:', e.message);
      const m = e.message;
      if (/authentication failed|bad auth/i.test(m)) console.error('Hint: username or password in MONGO_URI is wrong.');
      else if (/ENOTFOUND|querySrv|EBADNAME/i.test(m)) console.error('Hint: the cluster host in MONGO_URI is wrong (it looks like cluster0.xxxxx.mongodb.net).');
      else if (/Server selection timed out|whitelist|ECONNREFUSED|ETIMEDOUT/i.test(m)) console.error('Hint: in Atlas open Network Access and add your IP (or 0.0.0.0/0 for testing). For a local MongoDB, make sure the service is running.');
      process.exit(1);
    });
}
