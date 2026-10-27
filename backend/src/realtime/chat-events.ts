import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Small lookup the gateway needs (kept here so realtime does not depend on the chat module). */
@Injectable()
export class ChatEvents {
  constructor(private readonly prisma: PrismaService) {}

  /** The other participants of a conversation, if `userId` is one of them. */
  async otherParticipants(userId: string, conversationId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { studentId: true, mentorId: true },
    });
    if (!c) return [];
    const members = [c.studentId, c.mentorId].filter((x): x is string =>
      Boolean(x),
    );
    return members.includes(userId) ? members.filter((m) => m !== userId) : [];
  }
}
