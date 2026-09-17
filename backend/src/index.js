import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhooks.js';
import channelRoutes from './routes/channels.js';
import { startAutoEvaluator } from './jobs/autoEvaluate.js';
import { startZaloTokenCron } from './jobs/zaloAutoRefresh.js';

import uploadRoutes from './routes/upload.js';
import automationRoutes from './routes/automation.js';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Start Background Jobs
startAutoEvaluator();
startZaloTokenCron();

app.use(cors());
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Hỗ trợ cả môi trường Dev và cPanel (cPanel có thể nhồi url gốc /api vào req)
const apiRouter = express.Router();
apiRouter.use('/channels', channelRoutes);
apiRouter.use('/webhooks', webhookRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/automation', automationRoutes);

// Mount
app.use('/api/api', apiRouter); // Fix for VITE_BACKEND_URL trailing /api
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health check hỗ trợ nhiều pattern
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
