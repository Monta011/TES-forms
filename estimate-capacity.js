const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function estimateCapacity() {
  try {
    const apps = await prisma.application.findMany();
    
    if (apps.length === 0) {
      console.log('\n📊 DATABASE CAPACITY ESTIMATE\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n📝 Per Application (estimated):');
      console.log('  • Form fields (text):      ~5-10 KB');
      console.log('  • 3 Signatures (JPEG):     ~90-150 KB');
      console.log('  • Metadata (id, dates):    ~1 KB');
      console.log('  ─────────────────────────────────────');
      console.log('  • TOTAL per application:   ~100-160 KB');
      console.log('');
      console.log('💾 Supabase Free Tier:       500 MB');
      console.log('');
      console.log('📈 Estimated Capacity:');
      console.log('  • Conservative (160 KB):   ~3,100 applications');
      console.log('  • Average (130 KB):        ~3,800 applications');
      console.log('  • Optimistic (100 KB):     ~5,000 applications');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      // Calculate actual sizes
      let totalSize = 0;
      let withSignatures = 0;
      let withoutSignatures = 0;
      
      apps.forEach(app => {
        const jsonSize = JSON.stringify(app.data).length;
        const metadataSize = JSON.stringify({
          id: app.id,
          type: app.type,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt
        }).length;
        
        const appSize = jsonSize + metadataSize;
        totalSize += appSize;
        
        // Check if has signatures
        const hasSignatures = app.data.employeeSignature || 
                             app.data.managerSignature || 
                             app.data.hrSignature;
        
        if (hasSignatures) {
          withSignatures++;
        } else {
          withoutSignatures++;
        }
      });
      
      const avgSize = totalSize / apps.length;
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      const avgSizeKB = (avgSize / 1024).toFixed(2);
      
      const supabaseLimitMB = 500;
      const remainingMB = supabaseLimitMB - parseFloat(totalSizeMB);
      const estimatedRemaining = Math.floor((remainingMB * 1024 * 1024) / avgSize);
      const estimatedTotal = apps.length + estimatedRemaining;
      
      console.log('\n📊 DATABASE CAPACITY ANALYSIS\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n📈 Current Status:');
      console.log(`  • Total applications:      ${apps.length}`);
      console.log(`  • With signatures:         ${withSignatures}`);
      console.log(`  • Without signatures:      ${withoutSignatures}`);
      console.log(`  • Total storage used:      ${totalSizeMB} MB`);
      console.log(`  • Average per app:         ${avgSizeKB} KB`);
      console.log('');
      console.log('💾 Supabase Free Tier:');
      console.log(`  • Total limit:             ${supabaseLimitMB} MB`);
      console.log(`  • Remaining:               ${remainingMB.toFixed(2)} MB`);
      console.log(`  • Used:                    ${((totalSizeMB / supabaseLimitMB) * 100).toFixed(1)}%`);
      console.log('');
      console.log('🎯 Estimated Capacity:');
      console.log(`  • Remaining capacity:      ~${estimatedRemaining.toLocaleString()} applications`);
      console.log(`  • Total capacity:          ~${estimatedTotal.toLocaleString()} applications`);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (parseFloat(totalSizeMB) > supabaseLimitMB * 0.8) {
        console.log('⚠️  WARNING: Using > 80% of storage!');
        console.log('   Consider upgrading to Supabase Pro ($25/mo = 8GB)\n');
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

estimateCapacity();
