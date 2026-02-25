const { PrismaClient } = require('@prisma/client');

/**
 * Helper to force optimal connection pooling parameters onto the DATABASE_URL.
 * This ensures even if the Render dashboard env var is missing these, Prisma
 * will still use them.
 */
function getDatasourceUrl() {
    let url = process.env.DATABASE_URL;
    if (!url) return undefined;

    // Strip accidental quotes from Render dashboard copy-paste
    url = url.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

    try {
        const parsedUrl = new URL(url);

        // Conservative connection limit — Supabase free tier caps ~10 pooler connections
        parsedUrl.searchParams.set('connection_limit', '5');
        // Infinite pool timeout: queries wait patiently instead of crashing
        parsedUrl.searchParams.set('pool_timeout', '0');
        // 60s TCP connect timeout — Supabase cold starts / cross-region latency
        parsedUrl.searchParams.set('connect_timeout', '60');
        // Supabase REQUIRES SSL from external servers (like Render)
        parsedUrl.searchParams.set('sslmode', 'require');

        // Only set pgbouncer=true if we're on the Transaction Pooler port (6543)
        if (parsedUrl.port === '6543') {
            parsedUrl.searchParams.set('pgbouncer', 'true');
        }

        const finalUrl = parsedUrl.toString();
        console.log('🔗 Prisma datasource URL configured (port:', parsedUrl.port + ')');
        return finalUrl;
    } catch (e) {
        console.warn('⚠️ Could not parse DATABASE_URL for query param injection:', e.message);
        return url;
    }
}

/**
 * Factory function to create a new PrismaClient.
 * We need this so we can trash dead clients and make new ones.
 */
function createPrismaClient() {
    return new PrismaClient({
        datasources: {
            db: {
                url: getDatasourceUrl(),
            },
        },
    });
}

// Global active instance
let activePrisma = createPrismaClient();

// Track whether we have an active DB connection
let isConnected = false;
let isRecreating = false;

/**
 * A Proxy object that forwards ALL property accesses and methods
 * (e.g., prisma.application.findMany) directly to the currently active
 * PrismaClient instance.
 * 
 * This allows us to hot-swap the underlying instance without breaking
 * other files that imported `const { prisma } = require('./prismaClient')`.
 */
const prismaProxy = new Proxy({}, {
    get: function (target, prop, receiver) {
        const value = activePrisma[prop];
        if (typeof value === 'function') {
            // Bind functions so `this` inside Prisma internals works correctly
            return value.bind(activePrisma);
        }
        return value;
    }
});

/**
 * Destroys the current Prisma instance (which might have a dead internal socket/DNS cache)
 * and completely replaces it with a brand new one.
 */
async function recreatePrismaClient() {
    if (isRecreating) {
        // Mutex: wait for the other concurrent request to finish reconstructing the client
        while (isRecreating) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return;
    }

    isRecreating = true;
    console.warn("🔄 Re-instantiating Prisma Client due to unrecoverable connection/routing error...");
    try {
        await activePrisma.$disconnect();
    } catch (e) {
        // We don't care if disconnect fails, the socket is already dead
        console.warn("   (Discarding old dead client)");
    }

    // Create entirely new engine, forcing DNS re-resolution and new sockets
    activePrisma = createPrismaClient();
    isConnected = false;

    // Test the new connection
    try {
        await activePrisma.$connect();
        isConnected = true;
        console.log("✅ Successfully replaced Prisma Client. Recovery complete.");
    } catch (e) {
        console.error("❌ Failed to connect new Prisma Client during recovery:", e.message);
    } finally {
        isRecreating = false;
    }
}

/**
 * Connect to the database with retry logic on startup.
 */
async function connectWithRetry(maxRetries = 8) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await activePrisma.$connect();
            isConnected = true;
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
            console.warn(
                `⚠️  Database startup connection attempt ${attempt}/${maxRetries} failed: ${error.message}`
            );
            if (attempt < maxRetries) {
                console.log(`   Retrying in ${delay / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    console.error('❌ Database startup connection failed after all retries');
    return false;
}

/**
 * Wrap a Prisma query with automatic retry AND instance hot-swapping.
 * Handled flawlessly for P1001 (DNS/Unreachable) and P2024 (Pool Exhausted).
 */
async function withRetry(queryFn, maxRetries = 5) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;

            // Log the error carefully
            const errorType = error.code ? `[${error.code}]` : 'Error';
            console.warn(`⚠️  Query failed ${errorType} (attempt ${attempt}/${maxRetries}): ${error.message.split('\n')[0]}`);

            // Is it a network dropout or pool starvation?
            const isRetryable =
                error.message.includes("Can't reach database") ||
                error.message.includes('Timed out fetching') ||
                error.message.includes('connection pool') ||
                error.code === 'P2024' ||
                error.code === 'P1001';

            if (isRetryable && attempt < maxRetries) {
                // If it's a hard unreachability error (like IP change or stale pool)
                // then waiting won't help. We must nuke the connection and rebuild Prisma.
                if (error.code === 'P1001' || error.message.includes("Can't reach database")) {
                    await recreatePrismaClient();
                    // Give the new client a moment to stabilize
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                } else {
                    // Just wait a few seconds and try the existing pool again
                    const delay = 2000 * attempt;
                    console.log(`   Retrying query in ${delay / 1000}s...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            } else {
                // Not a network error (e.g. invalid query syntax), throw immediately
                throw error;
            }
        }
    }
    throw lastError;
}

// Export the proxy as 'prisma' so requiring files don't notice anything changed
module.exports = { prisma: prismaProxy, connectWithRetry, withRetry };
