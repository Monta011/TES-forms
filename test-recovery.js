const { prisma, withRetry } = require('./prismaClient');

async function testRecovery() {
    console.log("1. Initial connect...");
    try {
        await prisma.$connect();
        console.log("Connected.");

        console.log("2. Running query...");
        const res = await withRetry(() => prisma.$queryRaw`SELECT 1`);
        console.log("Result:", res);

        console.log("3. Forcing disconnect to simulate dropped connection...");
        await prisma.$disconnect();

        console.log("4. Attempting query after disconnect (Prisma should auto-reconnect)...");
        const res2 = await withRetry(() => prisma.$queryRaw`SELECT 2`);
        console.log("Result 2:", res2);

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testRecovery();
