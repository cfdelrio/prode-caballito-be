'use strict';

/**
 * Migration: Create polls tables
 * Defines schema for public_polls, poll_options, and poll_votes
 */

async function migrate(db) {
    console.log('  Creating public_polls table...');

    await db.query(`
        CREATE TABLE IF NOT EXISTS public_polls (
            id         SERIAL PRIMARY KEY,
            slug       VARCHAR(100) UNIQUE NOT NULL,
            title      VARCHAR(300) NOT NULL,
            subtitle   VARCHAR(300),
            active     BOOLEAN DEFAULT true,
            ended      BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    console.log('  Creating poll_options table...');

    await db.query(`
        CREATE TABLE IF NOT EXISTS poll_options (
            id            SERIAL PRIMARY KEY,
            poll_id       INTEGER NOT NULL REFERENCES public_polls(id) ON DELETE CASCADE,
            label         VARCHAR(100) NOT NULL,
            flag_emoji    VARCHAR(20),
            flag_code     VARCHAR(5),
            display_order INTEGER DEFAULT 0
        )
    `);

    console.log('  Creating poll_votes table...');

    await db.query(`
        CREATE TABLE IF NOT EXISTS poll_votes (
            id            SERIAL PRIMARY KEY,
            poll_id       INTEGER NOT NULL REFERENCES public_polls(id) ON DELETE CASCADE,
            option_id     INTEGER NOT NULL REFERENCES poll_options(id),
            user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
            ip_hash       VARCHAR(64) NOT NULL,
            session_token VARCHAR(64),
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    console.log('  Creating poll indices...');

    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_ip_poll   ON poll_votes(poll_id, ip_hash)`);
    await db.query(`CREATE INDEX        IF NOT EXISTS poll_votes_option_id ON poll_votes(option_id)`);
    await db.query(`CREATE INDEX        IF NOT EXISTS poll_votes_created   ON poll_votes(created_at DESC)`);

    console.log('  ✓ polls tables created');
}

module.exports = { migrate };
