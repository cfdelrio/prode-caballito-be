"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
const middleware_1 = require("./middleware");
const rateLimit_1 = require("./middleware/rateLimit");
const routes_1 = require("./routes");
const { sendWhatsApp } = require('./services/whatsapp');
const { db } = require('./db/connection');
const { authMiddleware, requireAdmin } = require('./middleware/auth');
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use(middleware_1.securityMiddleware);
app.use(middleware_1.corsMiddleware);
app.use(middleware_1.compressionMiddleware);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', rateLimit_1.authLimiter, routes_1.authRoutes);
app.use('/api/users', rateLimit_1.authLimiter, routes_1.usersRoutes);
app.use('/api/matches', routes_1.matchesRoutes);
app.use('/api/bets', routes_1.betsRoutes);
app.use('/api/ranking', routes_1.rankingRoutes);
app.use('/api/comments', routes_1.commentsRoutes);
app.use('/api/notifications', routes_1.notificationsRoutes);
app.use('/api/planillas', routes_1.planillasRoutes);
app.use('/api/messages', routes_1.messagesRoutes);
app.use('/api/subscriptions', routes_1.subscriptionsRoutes);
app.use('/api/config', routes_1.configRoutes);
app.use('/api/theme', routes_1.themeRoutes);
app.use('/api/tournaments', routes_1.tournamentsRoutes);
app.use('/api/matchdays', routes_1.matchdaysRoutes);
app.use('/api/imagemail', routes_1.imagemailRoutes);
app.use('/api/push', routes_1.pushRoutes);
app.use('/api/admin', routes_1.adminRoutes);
app.post('/api/internal/broadcast-whatsapp', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Mensaje requerido' });
        }
        const result = await db.query(
            `SELECT whatsapp_number FROM users WHERE whatsapp_number IS NOT NULL AND whatsapp_consent = true`
        );
        const numbers = result.rows.map(r => r.whatsapp_number);
        let sent = 0;
        let failed = 0;
        for (const number of numbers) {
            try {
                await sendWhatsApp({ to: number, body: message });
                sent++;
            } catch (err) {
                console.error(`[broadcast-whatsapp] error enviando a ${number}:`, err.message);
                failed++;
            }
        }
        console.log(`[broadcast-whatsapp] total=${numbers.length} sent=${sent} failed=${failed}`);
        res.json({ success: true, data: { total: numbers.length, sent, failed } });
    } catch (error) {
        console.error('[broadcast-whatsapp] error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
    });
});
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});
const serverlessHandler = (0, serverless_http_1.default)(app, {
    basePath: '/prod',
});
const handler = async (event, context) => {
    // Internal async winner notification event
    if (event.source === 'winner-notification') {
        const { recalcMatchdayForMatch } = require('./routes/matchdays');
        const matchdays = require('./routes/matchdays');
        await matchdays.processWinnerNotification(event.winner, event.matchday, event.winnerEmail, event.allEmails || []);
        return { statusCode: 200 };
    }

    // Direct config upsert for winner image (called by n8n or manually)
    if (event.source === 'prode.set-winner') {
        const entry = {
            image_url: event.imageUrl,
            matchday_label: event.matchdayLabel || 'Ganador de la Fecha',
            updated_at: new Date().toISOString(),
        };
        // Upsert single latest winner
        await db.query(
            `INSERT INTO config (key, value, updated_at) VALUES ('ganador_fecha', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(entry)]
        );
        // Append to winners array
        const existingRes = await db.query(`SELECT value FROM config WHERE key = 'ganadores_fechas'`);
        let winners = [];
        if (existingRes.rows.length > 0) {
            try { winners = JSON.parse(existingRes.rows[0].value) } catch {}
        }
        winners.push(entry);
        await db.query(
            `INSERT INTO config (key, value, updated_at) VALUES ('ganadores_fechas', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(winners)]
        );
        console.log('[prode.set-winner] Winner image set:', event.matchdayLabel, '| total:', winners.length);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // EventBridge weekly summary trigger (nuevo diseño aprobado)
    // Rule cron: 0 12 ? * MON * (every Monday 12:00 UTC = 09:00 Argentina)
    if (event.source === 'prode.weekly' || event.source === 'weekly-digest' || event['detail-type'] === 'weekly-digest') {
        const { sendWeeklyEmailBatch } = require('./routes/admin');
        const testEmail = event.testEmail || null;
        const result = await sendWeeklyEmailBatch(testEmail);
        console.log('[prode.weekly] Weekly email batch result:', result);
        return { statusCode: 200, body: JSON.stringify(result) };
    }

    const response = await serverlessHandler(event, context);
    // Asegurarse de que los headers CORS estén presentes
    if (!response.headers) {
        response.headers = {};
    }
    // Solo agregar headers CORS si no están ya presentes
    // El middleware CORS ya los configura correctamente
    if (!response.headers['Access-Control-Allow-Origin'] && !response.headers['access-control-allow-origin']) {
        response.headers['Access-Control-Allow-Origin'] = event.headers?.origin || event.headers?.Origin || '*';
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        response.headers['Access-Control-Max-Age'] = '86400';
    }
    return response;
};
exports.handler = handler;
//# sourceMappingURL=lambda.js.map