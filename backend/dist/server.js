"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const camera_1 = require("./routes/camera");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use((0, cors_1.default)({
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
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return req.path.includes('/stream') || req.path.includes('/snapshot');
    }
});
const streamLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 50,
    message: 'Too many stream requests',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', apiLimiter);
app.use('/api/camera/*/stream', streamLimiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    });
});
app.use('/api/camera', camera_1.cameraRouter);
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});
app.use((error, req, res, next) => {
    logger_1.logger.error('Unhandled error:', error);
    res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
});
const fs_1 = require("fs");
async function ensureLogsDirectory() {
    try {
        await fs_1.promises.access('logs');
    }
    catch {
        await fs_1.promises.mkdir('logs', { recursive: true });
        logger_1.logger.info('Created logs directory');
    }
}
async function startServer() {
    try {
        await ensureLogsDirectory();
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Brana Camera Backend spuštěn na portu ${PORT}`);
            logger_1.logger.info(`📹 Camera API dostupné na: http://localhost:${PORT}/api/camera`);
            logger_1.logger.info(`🔍 Health check: http://localhost:${PORT}/health`);
            logger_1.logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
process.on('SIGINT', () => {
    logger_1.logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=server.js.map