import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@agrobridge.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMeAdmin1';
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'AgroBridge Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: UserRole.admin,
      passwordHash,
      displayName,
    },
    create: {
      email,
      role: UserRole.admin,
      passwordHash,
      displayName,
      locale: 'en',
    },
  });

  console.log(`Admin ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
