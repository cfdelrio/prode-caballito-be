"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerService = void 0;
const connection_1 = require("../db/connection");
const notificationService_1 = require("./notificationService");
const { pushToUser } = require('../services/push');
const { sendSMS } = require('../services/whatsapp');
exports.schedulerService = {
    async scheduleMatchJobs(match) {
        console.log(`Scheduling jobs for match ${match.id}: ${match.home_team} vs ${match.away_team}`);
        const kickoffTime = new Date(match.start_time);
        const secondHalfTime = new Date(kickoffTime.getTime() + 45 * 60 * 1000 + match.halftime_minutes * 60 * 1000);
        await connection_1.db.query(`
      INSERT INTO scheduled_jobs (match_id, job_type, scheduled_for, status)
      VALUES ($1, 'kickoff', $2, 'pending'),
             ($1, 'second_half', $3, 'pending')
      ON CONFLICT (match_id, job_type) DO UPDATE SET
        scheduled_for = CASE 
          WHEN EXCLUDED.scheduled_for != scheduled_jobs.scheduled_for THEN EXCLUDED.scheduled_for
          ELSE scheduled_jobs.scheduled_for
        END,
        status = 'pending'
    `, [match.id, kickoffTime, secondHalfTime]);
        console.log(`Jobs scheduled for match ${match.id}`);
        console.log(`  Kickoff: ${kickoffTime.toISOString()}`);
        console.log(`  Second half: ${secondHalfTime.toISOString()}`);
    },
    async getPendingJobs() {
        const result = await connection_1.db.query(`
      SELECT sj.*, m.home_team, m.away_team, m.start_time, m.halftime_minutes
      FROM scheduled_jobs sj
      JOIN matches m ON sj.match_id = m.id
      WHERE sj.status = 'pending' AND sj.scheduled_for <= NOW()
      ORDER BY sj.scheduled_for ASC
      LIMIT 100
    `);
        return result.rows.map((row) => ({
            matchId: row.match_id,
            homeTeam: row.home_team,
            awayTeam: row.away_team,
            startTime: row.start_time,
            halftimeMinutes: row.halftime_minutes,
            type: row.job_type === 'kickoff' ? 'kickoff' : 'second_half',
        }));
    },
    async markJobCompleted(matchId, jobType) {
        await connection_1.db.query(`
      UPDATE scheduled_jobs SET status = 'completed' 
      WHERE match_id = $1 AND job_type = $2
    `, [matchId, jobType]);
    },
    async processPendingJobs() {
        const jobs = await this.getPendingJobs();
        for (const job of jobs) {
            try {
                console.log(`Processing ${job.type} job for match ${job.matchId}`);
                // Notify all users who placed a bet on this match
                const betters = await connection_1.db.query(`
          SELECT DISTINCT u.id AS user_id, u.whatsapp_number, u.whatsapp_consent
          FROM users u
          JOIN planillas p ON p.user_id = u.id
          JOIN bets b ON b.planilla_id = p.id AND b.match_id = $1
        `, [job.matchId]);
                const label = job.type === 'kickoff' ? '¡Empieza!' : '¡Segundo tiempo!';
                const smsBody = `⚽ ${label} ${job.homeTeam} vs ${job.awayTeam} 👉 prodecaballito.com`;
                const pushPayload = {
                    title: label,
                    body: `${job.homeTeam} vs ${job.awayTeam}`,
                    url: '/apuestas',
                    icon: '/favicon.svg',
                };
                for (const user of betters.rows) {
                    // In-app notification
                    await (0, notificationService_1.generarNotificacionKickoff)(user.user_id, job.matchId, job.homeTeam, job.awayTeam, job.type, job.startTime)
                        .catch(err => console.error(`[scheduler] in-app failed user=${user.user_id}:`, err.message));
                    // Push notification
                    await pushToUser(user.user_id, pushPayload)
                        .catch(err => console.error(`[scheduler] push failed user=${user.user_id}:`, err.message));
                    // SMS if user consented
                    if (user.whatsapp_number && user.whatsapp_consent) {
                        await sendSMS({ to: user.whatsapp_number, body: smsBody })
                            .catch(err => console.error(`[scheduler] sms failed user=${user.user_id}:`, err.message));
                    }
                }
                await this.markJobCompleted(job.matchId, job.type);
                console.log(`[scheduler] Completed ${job.type} job for match ${job.matchId}: ${betters.rows.length} users notified`);
            }
            catch (error) {
                console.error(`Error processing job for match ${job.matchId}:`, error);
            }
        }
    },
};
//# sourceMappingURL=schedulerService.js.map