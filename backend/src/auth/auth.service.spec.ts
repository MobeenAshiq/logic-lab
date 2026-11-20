import { compare, hash } from 'bcryptjs';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';

describe('AuthService.changePassword', () => {
  const user = { id: 'u1', sessionId: 's1' } as AuthUser;

  async function setup(currentPassword: string) {
    const tx = {
      user: { update: jest.fn() },
      userSession: { updateMany: jest.fn() },
    };
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          passwordHash: await hash(currentPassword, 4),
        }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const config = { get: () => 'http://localhost' };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      config as never,
    );
    return { service, tx };
  }

  it('rejects a wrong current password and changes nothing', async () => {
    const { service, tx } = await setup('oldpass123');
    await expect(
      service.changePassword(user, {
        currentPassword: 'wrong',
        newPassword: 'newpass123',
      }),
    ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('saves the new password and logs out only other devices', async () => {
    const { service, tx } = await setup('oldpass123');
    await service.changePassword(user, {
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });

    const saved = tx.user.update.mock.calls[0][0].data.passwordHash;
    expect(await compare('newpass123', saved)).toBe(true);
    expect(tx.userSession.updateMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      revokedAt: null,
      id: { not: 's1' },
    });
  });
});
