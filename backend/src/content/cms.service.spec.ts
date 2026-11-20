import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CmsService } from './cms.service';

describe('CmsService.assertCanEdit', () => {
  const prisma = {
    lesson: {
      findUnique: jest.fn().mockResolvedValue({ module: { courseId: 'c1' } }),
    },
    module: { findUnique: jest.fn().mockResolvedValue({ courseId: 'c1' }) },
    courseMentor: {
      findUnique: jest.fn(
        ({ where }: { where: { courseId_mentorId: { mentorId: string } } }) =>
          where.courseId_mentorId.mentorId === 'assigned' ? { id: 'x' } : null,
      ),
    },
  };
  const cms = new CmsService(prisma as never, {} as never, {} as never);
  const user = (id: string, role: Role) => ({ id, role }) as AuthUser;

  it('lets admins edit any course', async () => {
    await expect(
      cms.assertCanEdit(user('a', Role.admin), { courseId: 'c1' }),
    ).resolves.toBeUndefined();
  });

  it('lets a mentor edit a lesson in an assigned course', async () => {
    await expect(
      cms.assertCanEdit(user('assigned', Role.mentor), { lessonId: 'l1' }),
    ).resolves.toBeUndefined();
  });

  it('blocks a mentor from a course they do not teach', async () => {
    await expect(
      cms.assertCanEdit(user('other', Role.mentor), { moduleId: 'm1' }),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_MENTOR' });
  });

  it('blocks students even if somehow linked', async () => {
    await expect(
      cms.assertCanEdit(user('assigned', Role.student), { courseId: 'c1' }),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_MENTOR' });
  });
});
