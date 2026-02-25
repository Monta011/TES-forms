const { PrismaClient } = require('@prisma/client');

// Single shared Prisma client instance
const prisma = new PrismaClient();

/**
 * Connect to the database with retry logic.
 * Supabase free tier can take 15-30s to wake up, so we retry
 * with exponential backoff to handle cold starts gracefully.
 *
 * @param {number} maxRetries - Maximum number of connection attempts
 * @returns {Promise<boolean>} - true if connected, false otherwise
 */
async function connectWithRetry(maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await prisma.$connect();
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            const delay = Math.min(3000 * Math.pow(2, attempt - 1), 48000);
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

module.exports = { prisma, connectWithRetry };
