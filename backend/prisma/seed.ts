/**
 * Idempotent seed. Usage: npm run seed
 * - Creates (or promotes) the first super_admin from env variables. The super
 *   admin must set up 2FA on first login before opening /admin.
 * - Creates the three tracks and the default landing-page content if missing
 *   (existing rows are never overwritten, so CMS edits are kept).
 */
import 'dotenv/config';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import {
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_KEYS,
} from '../src/content/site-content';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable ${name}`);
  return value;
}

const TRACKS = [
  {
    slug: 'logic-building',
    title: 'Logic Building',
    icon: 'Brain',
    description:
      'Problem solving, flowcharts and core programming concepts, from zero.',
  },
  {
    slug: 'web-development',
    title: 'Web Development',
    icon: 'globe',
    description: 'HTML, CSS, JavaScript, React and backend basics.',
  },
  {
    slug: 'ai-ml-data-science',
    title: 'AI/ML & Data Science',
    icon: 'sparkles',
    description: 'Python, data analysis with pandas, and machine learning.',
  },
];

async function seedContent() {
  for (const [i, track] of TRACKS.entries()) {
    await prisma.track.upsert({
      where: { slug: track.slug },
      create: { ...track, position: i + 1, isPublished: true },
      update: {},
    });
  }
  for (const key of SITE_CONTENT_KEYS) {
    await prisma.siteContent.upsert({
      where: { key },
      create: {
        key,
        data: SITE_CONTENT_DEFAULTS[key],
      },
      update: {},
    });
  }
  console.log(
    `tracks: ${TRACKS.length}, site content blocks: ${SITE_CONTENT_KEYS.length}`,
  );
}

async function seedSuperAdmin() {
  const email = required('SUPER_ADMIN_EMAIL').trim().toLowerCase();
  const password = required('SUPER_ADMIN_PASSWORD');
  const fullName = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';
  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');
  }

  await prisma.$transaction(async (tx) => {
    // Lets the profiles trigger accept the role change (see the phase1 migration).
    await tx.$queryRaw`SELECT set_config('app.actor_role', 'super_admin', true)`;

    const user =
      (await tx.user.findUnique({ where: { email } })) ??
      (await tx.user.create({
        data: {
          email,
          passwordHash: await hash(password, 12),
          emailVerifiedAt: new Date(),
        },
      }));

    await tx.profile.update({
      where: { id: user.id },
      data: { role: Role.super_admin, status: UserStatus.active, fullName },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'user.seeded_super_admin',
        targetType: 'user',
        targetId: user.id,
        metadata: { email },
      },
    });
    console.log(`super_admin ready: ${email} (${user.id})`);
  });
}

async function main() {
  await seedSuperAdmin();
  await seedContent();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
