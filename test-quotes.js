const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Intentionally inject quotes into the env var
const urlWithQuotes = '"' + process.env.DATABASE_URL + '"';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: urlWithQuotes,
        },
    },
});

async function run() {
    try {
        console.log("Connecting to:", urlWithQuotes.substring(0, 30));
        await prisma.$connect();

        // Let's see if Prisma ACTUALLY connected, or if it just failed silently
        console.log("Connect command finished. Running query...");
        await prisma.$queryRaw`SELECT 1`;
        console.log("SUCCESS!");
    } catch (e) {
        console.log("FAILURE:", e.message);
    }
}
run();
