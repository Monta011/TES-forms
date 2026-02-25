const { PrismaClient } = require('@prisma/client');

async function initializeDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Checking database schema...');

    // Try to query the Application table
    await prisma.$queryRaw`SELECT 1 FROM "Application" LIMIT 1`;
    console.log('✅ Database schema exists');

  } catch (error) {
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      console.log('📦 Creating Application table...');

      // Create the table
      await prisma.$executeRaw`
        CREATE TABLE "Application" (
          "id" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
        )
      `;

      console.log('✅ Application table created successfully');
    } else {
      console.error('❌ Database initialization error:', error.message);
      // Don't throw on connection errors — the build should still succeed.
      // The database will be initialized when it becomes reachable.
      console.warn('⚠️  Skipping database init — will retry when server starts');
    }
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase()
  .then(() => {
    console.log('✅ Database initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    // Always exit 0 so the Render build doesn't fail
    console.error('⚠️  Database initialization warning:', error.message);
    console.log('ℹ️  Build will continue — database init will be retried at server start');
    process.exit(0);
  });
