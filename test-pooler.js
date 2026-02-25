const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function testConnection() {
    try {
        console.log("Testing connection...");
        console.log("Datasource URL environment:", process.env.DATABASE_URL.substring(0, 30) + '...');

        // Explicit test query instead of just connecting
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Success:', result);
    } catch (error) {
        console.error('❌ Failed to connect:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
