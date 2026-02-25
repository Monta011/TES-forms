/**
 * keep-alive.js
 *
 * Prevents two issues on free tiers:
 *  1. Render.com   → Spins down after 15 min of inactivity (cold start = ~60s)
 *                    Fix: self-ping every 14 min via HTTP GET to /health
 *
 *  2. Supabase     → Pauses the project after 7 days of inactivity
 *                    Fix: run a lightweight SELECT 1 query every 3 days
 */

const cron = require('node-cron');
const http = require('http');
const https = require('https');
const { prisma } = require('./prismaClient');

/**
 * Ping the app's own /health endpoint to prevent Render from sleeping.
 * @param {string} appUrl - The full URL of the app (e.g. https://tes-forms.onrender.com)
 */
function pingself(appUrl) {
    const url = `${appUrl}/health`;
    const client = url.startsWith('https') ? https : http;

    client
        .get(url, (res) => {
            console.log(`🏓 Keep-alive: self-ping → ${res.statusCode} ${res.statusMessage}`);
        })
        .on('error', (err) => {
            console.warn(`⚠️  Keep-alive: self-ping failed — ${err.message}`);
        });
}

/**
 * Run a lightweight query to keep the Supabase project active.
 * Supabase pauses free projects after 7 days of no DB activity.
 */
async function supabaseHeartbeat() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('💓 Keep-alive: Supabase heartbeat — database is active');
    } catch (err) {
        console.warn(`⚠️  Keep-alive: Supabase heartbeat failed — ${err.message}`);
    }
}

/**
 * Start all keep-alive jobs.
 * Only intended to be called in production (Render deployment).
 *
 * @param {string} appUrl - The full public URL of this app on Render
 */
function startKeepAlive(appUrl) {
    if (!appUrl) {
        console.warn('⚠️  Keep-alive: RENDER_APP_URL not set — self-ping disabled');
    }

    // ── Self-ping + DB heartbeat every 14 minutes ────────────────────────────
    // The self-ping prevents Render from sleeping.
    // The DB heartbeat prevents Supabase from dropping idle Prisma connections.
    cron.schedule('*/14 * * * *', () => {
        if (appUrl) pingself(appUrl);
        supabaseHeartbeat(); // keeps Prisma connection pool warm
    });

    // ── Extra Supabase heartbeat every 3 days (prevents full project pause) ──
    cron.schedule('0 0 1,4,7,10,13,16,19,22,25,28 * *', () => {
        supabaseHeartbeat();
    });

    console.log('✅ Keep-alive scheduler started');
    console.log(`   • Self-ping + DB heartbeat: every 14 minutes → ${appUrl || '(disabled)'}`);
    console.log('   • Supabase project pause prevention: every 3 days');
}

module.exports = { startKeepAlive };
