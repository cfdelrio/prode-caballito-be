"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const config_1 = require("../config");
class Database {
    pool;
    constructor() {
        this.pool = new pg_1.Pool({
            host: config_1.config.database.host,
            port: config_1.config.database.port,
            database: config_1.config.database.name,
            user: config_1.config.database.user,
            password: config_1.config.database.password,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ssl: {
                rejectUnauthorized: false,
            },
        });
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }
    async query(text, params) {
        const start = Date.now();
        const res = await this.pool.query(text, params);
        const duration = Date.now() - start;
        if (config_1.config.nodeEnv === 'development') {
            console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
        }
        return res;
    }
    async getClient() {
        return this.pool.connect();
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
}
exports.db = new Database();
//# sourceMappingURL=connection.js.map