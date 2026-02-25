const { PrismaClient } = require('@prisma/client');

/**
 * Build the datasource URL with minimal, essential parameters only.
 * Less is more — extra params can confuse Supabase's pooler.
 */
function getDatasourceUrl() {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;

    // Strip accidental quotes from Render dashboard copy-paste
    url = url.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

    try {
        const parsedUrl = new URL(url);

        // Single connection — minimizes resource usage on free tier
        parsedUrl.searchParams.set('connection_limit', '1');

        // If using Transaction Pooler (port 6543), pgbouncer mode is required
        if (parsedUrl.port === '6543') {
            parsedUrl.searchParams.set('pgbouncer', 'true');
        }

        const finalUrl = parsedUrl.toString();
        console.log('🔗 Prisma URL configured (port:', parsedUrl.port + ')');
        return finalUrl;
    } catch (e) {
        console.warn('⚠️ Could not parse DATABASE_URL:', e.message);
        return url;
    }
}

/**
 * Create a fresh PrismaClient instance.
 */
function createPrismaClient() {
    return new PrismaClient({
        datasources: {
            db: { url: getDatasourceUrl() },
        },
    });
}

let activePrisma = createPrismaClient();
let isRecreating = false;

/**
 * Proxy forwards all property access to the current activePrisma.
 * This lets us hot-swap the client without breaking imports.
 */
const prismaProxy = new Proxy({}, {
    get(target, prop) {
        const value = activePrisma[prop];
        if (typeof value === 'function') {
            return value.bind(activePrisma);
        }
        return value;
    }
});

/**
 * Destroy the current client and create a fresh one.
 * Uses a mutex to prevent concurrent recreations.
 */
async function recreatePrismaClient() {
    if (isRecreating) {
        while (isRecreating) {
            await new Promise(r => setTimeout(r, 300));
        }
        return;
    }

    isRecreating = true;
    console.warn('🔄 Recreating Prisma Client...');

    try { await activePrisma.$disconnect(); } catch (_) { /* ignore */ }

    activePrisma = createPrismaClient();

    // Don't call $connect() here — let the next query connect lazily.
    // This avoids the 60-second timeout if the pooler is temporarily down.
    console.log('🔗 New Prisma Client ready (lazy connect on next query)');

    isRecreating = false;
}

/**
 * Connect with retry — used only at server startup.
 * If this fails, the server starts anyway and queries will connect lazily.
 */
async function connectWithRetry(maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await activePrisma.$connect();
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            const delay = Math.min(2000 * attempt, 10000);
            console.warn(`⚠️  DB connect attempt ${attempt}/${maxRetries} failed: ${error.message.split('\n')[0]}`);
            if (attempt < maxRetries) {
                console.log(`   Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.warn('⚠️  Could not pre-connect to DB — will connect lazily on first query');
    return false;
}

/**
 * Wrap a Prisma query with retry + client recreation on network errors.
 */
async function withRetry(queryFn, maxRetries = 5) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;

            const tag = error.code ? `[${error.code}]` : '';
            console.warn(`⚠️  Query failed ${tag} (${attempt}/${maxRetries}): ${error.message.split('\n')[0]}`);

            const isNetworkError =
                error.code === 'P1001' ||
                error.code === 'P2024' ||
                error.message.includes("Can't reach database") ||
                error.message.includes('Timed out fetching') ||
                error.message.includes('connection pool');

            if (!isNetworkError || attempt >= maxRetries) {
                throw error;
            }

            // Recreate client on hard network errors, wait on pool issues
            if (error.code === 'P1001' || error.message.includes("Can't reach database")) {
                await recreatePrismaClient();
                // Small pause to let DNS/network stabilize
                await new Promise(r => setTimeout(r, 1000 * attempt));
            } else {
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }
    }
    throw lastError;
}

module.exports = { prisma: prismaProxy, connectWithRetry, withRetry };
