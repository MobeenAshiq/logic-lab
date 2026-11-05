/**
 * Turns off 2FA for a user who lost their authenticator app. Their next login
 * shows a fresh QR code to scan (2FA is still required for mentors and admins).
 * Usage: npm run reset-2fa -- <email>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run reset-2fa -- <email>');

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No user with email ${email}`);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: null, totpEnabledAt: null },
      }),
      prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'mfa_reset' },
      }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          action: 'user.mfa_reset_by_script',
          targetType: 'user',
          targetId: user.id,
        },
      }),
    ]);
    console.log(`2FA reset for ${email}. Log in again to scan a new QR code.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
