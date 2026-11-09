import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './server/routes/auth';
import attendanceRoutes from './server/routes/attendance';
import leavesRoutes from './server/routes/leaves';
import studentsRoutes from './server/routes/students';
import hostelsRoutes from './server/routes/hostels';
import biometricRoutes from './server/routes/biometric';
import notificationsRoutes from './server/routes/notifications';
import schedulerRoutes from './server/routes/scheduler';
import reportsRoutes from './server/routes/reports';
import securityTestRoutes from './server/routes/securityTest';
import systemRoutes from './server/routes/system';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/hostels', hostelsRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/security-test', securityTestRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Hostel Attendance Management System API',
    timezone: 'Asia/Kolkata',
    cutoff: '19:00 IST',
    graceEnd: '21:00 IST',
    defaulterEvaluation: '21:00 IST'
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hostel Attendance System] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Hostel Attendance System] Failed to start server:', err);
  process.exit(1);
});
