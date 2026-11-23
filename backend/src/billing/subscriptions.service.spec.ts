import { addDays } from './pricing';
import { SubscriptionsService } from './subscriptions.service';

function setup({
  paid = 0,
  enrolledDaysAgo,
}: {
  paid?: number;
  enrolledDaysAgo?: number;
}) {
  const enrollment =
    enrolledDaysAgo === undefined
      ? null
      : { createdAt: addDays(new Date(), -enrolledDaysAgo) };
  const prisma = {
    course: { findUnique: jest.fn(async () => ({ id: 'c1', trackId: 't1' })) },
    subscription: { count: jest.fn(async () => paid) },
    enrollment: {
      // A first visit creates the enrollment "now"; later visits keep the original date.
      upsert: jest.fn(async () => enrollment ?? { createdAt: new Date() }),
      findUnique: jest.fn(async () => enrollment),
    },
  };
  return { service: new SubscriptionsService(prisma as never), prisma };
}

describe('per-course access', () => {
  it('a paid plan for the course gives access without starting a free period', async () => {
    const { service, prisma } = setup({ paid: 1 });
    expect(await service.hasAccess('u1', 'c1')).toBe(true);
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('opening a course for the first time starts 14 free days', async () => {
    const { service, prisma } = setup({});
    expect(await service.hasAccess('u1', 'c1')).toBe(true);
    expect(prisma.enrollment.upsert).toHaveBeenCalled();
  });

  it('is still free on day 13 and locked after day 14', async () => {
    expect(
      await setup({ enrolledDaysAgo: 13 }).service.hasAccess('u1', 'c1'),
    ).toBe(true);
    expect(
      await setup({ enrolledDaysAgo: 15 }).service.hasAccess('u1', 'c1'),
    ).toBe(false);
  });

  it('listings only check and never start the clock', async () => {
    const { service, prisma } = setup({});
    expect(await service.hasAccess('u1', 'c1', { startFree: false })).toBe(
      true,
    );
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
    expect(
      await setup({ enrolledDaysAgo: 20 }).service.hasAccess('u1', 'c1', {
        startFree: false,
      }),
    ).toBe(false);
  });
});
