import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDatabase } from './routes.js';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/caretrack');
await seedDatabase();
console.log('Sample data loaded.');
await mongoose.disconnect();
