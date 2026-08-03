/**
 * Upsert the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Safe to run on every API boot when ADMIN_PASSWORD is set.
 */
const { PrismaClient, UserRole, LocaleCode } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const displayName = (process.env.ADMIN_DISPLAY_NAME || 'AgroBridge Admin').trim();

  if (!email || !password) {
    console.log('Skipping admin ensure: ADMIN_EMAIL / ADMIN_PASSWORD not set');
    return;
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        role: UserRole.admin,
        displayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        blockedAt: null,
        blockedReason: null,
      },
      create: {
        email,
        role: UserRole.admin,
        displayName,
        locale: LocaleCode.en,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Admin ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to ensure admin account:', error);
  process.exit(1);
});
