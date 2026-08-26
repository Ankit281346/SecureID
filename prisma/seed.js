const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('SecurePassword123!', salt);

  const demoUser = await prisma.user.upsert({
    where: { email: 'priya.sharma@example.com' },
    update: {
      passwordHash,
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: true,
      failedLoginAttempts: 0,
      lockedUntil: null
    },
    create: {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+919876543210',
      passwordHash,
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: true
    }
  });

  console.log('✅ Demo user seeded successfully:', demoUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
