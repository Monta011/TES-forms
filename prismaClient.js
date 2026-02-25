const { PrismaClient } = require('@prisma/client');

/**
 * Helper to force optimal connection pooling parameters onto the DATABASE_URL.
 * This ensures even if the Render dashboard env var is missing these, Prisma
 * will still use them.
 *
 * connection_limit=20 : allows more parallel queries to queue up
 * pool_timeout=0      : infinite timeout so queries wait patiently for Supabase
 *                       to wake up from sleep instead of crashing at 60s.
 */
function getDatasourceUrl() {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;

    try {
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.set('connection_limit', '20');
        parsedUrl.searchParams.set('pool_timeout', '0');
        // If not already set, ensure pgbouncer is enabled (needed for Supabase pooling)
        if (!parsedUrl.searchParams.has('pgbouncer')) {
            parsedUrl.searchParams.set('pgbouncer', 'true');
        }
        return parsedUrl.toString();
    } catch (e) {
        console.warn('⚠️ Could not parse DATABASE_URL for query param injection');
        return url;
    }
}

// Single shared Prisma client instance configured with the optimized URL
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: getDatasourceUrl(),
        },
    },
});

// Track whether we have an active DB connection
let isConnected = false;

/**
 * Connect to the database with retry logic.
 * Supabase free tier can take 15-30s to wake up, so we retry
 * with exponential backoff to handle cold starts gracefully.
 *
 * @param {number} maxRetries - Maximum number of connection attempts
 * @returns {Promise<boolean>} - true if connected, false otherwise
 */
async function connectWithRetry(maxRetries = 8) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await prisma.$connect();
            isConnected = true;
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
            console.warn(
                `⚠️  Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}`
            );
            if (attempt < maxRetries) {
                console.log(`   Retrying in ${delay / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    console.error('❌ Database connection failed after all retries');
    return false;
}

/**
 * Wrap a Prisma query with automatic retry.
 * Handles the case where the DB is still waking up when the first
 * request arrives (before connectWithRetry has finished).
 *
 * @param {Function} queryFn - async function that runs a Prisma query
 * @param {number} maxRetries - how many times to retry
 * @returns {Promise<any>} - query result
 */
async function withRetry(queryFn, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;
            const isRetryable =
                error.message.includes("Can't reach database") ||
                error.message.includes('Timed out fetching') ||
                error.message.includes('connection pool') ||
                error.code === 'P2024';

            if (isRetryable && attempt < maxRetries) {
                const delay = 2000 * attempt; // 2s, 4s
                console.warn(`⚠️  Query failed (attempt ${attempt}/${maxRetries}), retrying in ${delay / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

module.exports = { prisma, connectWithRetry, withRetry };
