import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { cameraRouter } from './routes/camera';
import { logger } from './utils/logger';

// Načti environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS konfigurace pro camera streaming
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://ovladani-brany-v2.vercel.app',
    'https://ovladani-brany-v2-git-dev-ivan-vondraceks-projects.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Rate limiting pro API endpointy (ne pro streaming)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 1000, // max 1000 requests per window
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Nepočítej streaming endpointy do rate limitu
    return req.path.includes('/stream') || req.path.includes('/snapshot');
  }
});

// Streaming limiter - více benevolentní
const streamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuta
  max: 50, // max 50 nových streamů per minutu
  message: 'Too many stream requests',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);
app.use('/api/camera/*/stream', streamLimiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Camera routes
app.use('/api/camera', cameraRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Vytvoř logs složku pokud neexistuje
import { promises as fs } from 'fs';
async function ensureLogsDirectory() {
  try {
    await fs.access('logs');
  } catch {
    await fs.mkdir('logs', { recursive: true });
    logger.info('Created logs directory');
  }
}

// Spusť server
async function startServer() {
  try {
    await ensureLogsDirectory();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Brana Camera Backend spuštěn na portu ${PORT}`);
      logger.info(`📹 Camera API dostupné na: http://localhost:${PORT}/api/camera`);
      logger.info(`🔍 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

export default app;