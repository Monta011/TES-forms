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
      throw error;
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
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  });
