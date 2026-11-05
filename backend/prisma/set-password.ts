/**
 * Sets a new password for any user (e.g. an admin who is locked out).
 * Usage: npm run set-password -- <email> <new-password>
 * Signs the user out on all devices; their 2FA stays as it is.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

async function main() {
  const [rawEmail, password] = process.argv.slice(2);
  if (!rawEmail || !password) {
    throw new Error('Usage: npm run set-password -- <email> <new-password>');
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Password needs 8+ characters with a letter and a number.');
  }
  const email = rawEmail.trim().toLowerCase();

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user) throw new Error(`No user with email ${email}`);

    const passwordHash = await hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          action: 'user.password_set_by_script',
          targetType: 'user',
          targetId: user.id,
        },
      }),
    ]);
    console.log(`Password updated for ${email} (${user.profile?.role ?? 'user'}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
