const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simulate realistic signature sizes (base64 JPEG)
function generateSignature(complexity) {
  // Simulate different signature complexities
  const sizes = {
    simple: 5 * 1024,     // Simple signature: ~5 KB
    medium: 10 * 1024,    // Medium signature: ~10 KB
    complex: 20 * 1024    // Complex signature: ~20 KB
  };
  
  const size = sizes[complexity] || sizes.medium;
  // Generate base64-like string of that size
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let sig = 'data:image/jpeg;base64,';
  for (let i = 0; i < size; i++) {
    sig += chars[Math.floor(Math.random() * chars.length)];
  }
  return sig;
}

async function testCapacity() {
  try {
    console.log('\n🧪 COMPREHENSIVE CAPACITY TEST\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Get current actual data
    const apps = await prisma.application.findMany();
    
    if (apps.length > 0) {
      console.log('📊 ACTUAL DATA FROM YOUR DATABASE:\n');
      
      apps.forEach((app, index) => {
        const dataSize = JSON.stringify(app.data).length;
        const metaSize = JSON.stringify({
          id: app.id,
          type: app.type,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt
        }).length;
        
        const totalSize = dataSize + metaSize;
        const hasSignatures = !!(app.data.employeeSignature || 
                                  app.data.managerSignature || 
                                  app.data.hrSignature);
        
        console.log(`  Application #${index + 1} (${app.type}):`);
        console.log(`    • Form data size:      ${(dataSize / 1024).toFixed(2)} KB`);
        console.log(`    • Has signatures:      ${hasSignatures ? 'Yes' : 'No'}`);
        console.log(`    • Total size:          ${(totalSize / 1024).toFixed(2)} KB`);
        console.log('');
      });
      
      const totalSize = apps.reduce((sum, app) => {
        const dataSize = JSON.stringify(app.data).length;
        const metaSize = JSON.stringify({
          id: app.id,
          type: app.type,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt
        }).length;
        return sum + dataSize + metaSize;
      }, 0);
      
      const avgSize = totalSize / apps.length;
      console.log(`  Average size per app:  ${(avgSize / 1024).toFixed(2)} KB\n`);
    }
    
    // Simulate different scenarios
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 SCENARIO TESTING:\n');
    
    const scenarios = [
      {
        name: 'Best Case (Simple forms, simple signatures)',
        formSize: 3 * 1024,
        signatures: ['simple', 'simple', 'simple']
      },
      {
        name: 'Average Case (Normal forms, medium signatures)',
        formSize: 8 * 1024,
        signatures: ['medium', 'medium', 'medium']
      },
      {
        name: 'Heavy Case (Complex forms, complex signatures)',
        formSize: 15 * 1024,
        signatures: ['complex', 'complex', 'complex']
      },
      {
        name: 'Worst Case (Max data, max signatures)',
        formSize: 20 * 1024,
        signatures: ['complex', 'complex', 'complex']
      },
      {
        name: 'No Signatures (Form only)',
        formSize: 10 * 1024,
        signatures: []
      }
    ];
    
    scenarios.forEach(scenario => {
      // Simulate form data
      const formData = {
        employeeName: 'A'.repeat(scenario.formSize / 10),
        // ... other fields simulated
      };
      
      // Add signatures
      if (scenario.signatures.length > 0) {
        formData.employeeSignature = generateSignature(scenario.signatures[0]);
        formData.managerSignature = generateSignature(scenario.signatures[1]);
        formData.hrSignature = generateSignature(scenario.signatures[2]);
      }
      
      const dataSize = JSON.stringify(formData).length;
      const metaSize = 200; // Approximate overhead
      const totalSize = dataSize + metaSize;
      
      const capacity = Math.floor((500 * 1024 * 1024) / totalSize);
      
      console.log(`  ${scenario.name}:`);
      console.log(`    • Size per application: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log(`    • Estimated capacity:   ~${capacity.toLocaleString()} applications`);
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT NOTES:\n');
    console.log('  1. PostgreSQL has storage overhead (~10-20%)');
    console.log('  2. Indexes and metadata add extra space');
    console.log('  3. Signature size depends on drawing complexity');
    console.log('  4. JPEG compression (80% quality) is consistent');
    console.log('  5. These are ESTIMATES - actual may vary ±20%\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 REALISTIC ESTIMATE FOR YOUR USE:\n');
    console.log('  With typical forms + 3 medium signatures:\n');
    console.log('  📈 Capacity: 10,000 - 15,000 applications\n');
    console.log('  This assumes proper form data and realistic signatures.\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testCapacity();
