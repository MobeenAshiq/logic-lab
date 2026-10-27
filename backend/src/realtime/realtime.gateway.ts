import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatEvents } from './chat-events';
import {
  LEADERBOARD_ROOM,
  RealtimeService,
  userRoom,
} from './realtime.service';
import { REALTIME_AUDIENCE, RealtimeTokenPayload } from './realtime.token';

interface SocketData {
  userId: string;
}

/**
 * Socket.IO endpoint. Clients connect with a 60-second token from
 * GET /realtime/token (auth: { token }). Each socket joins its user room, so
 * the server can push to a person on every device they have open.
 * Writes (sending messages, etc.) still go through the HTTP API.
 */
// CORS is set by RealtimeAdapter (main.ts) from the validated config.
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
    private readonly chat: ChatEvents,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket) {
    const token: unknown = client.handshake.auth?.token;
    try {
      if (typeof token !== 'string') throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<RealtimeTokenPayload>(token, {
        audience: REALTIME_AUDIENCE,
      });
      (client.data as SocketData).userId = payload.sub;
      await client.join(userRoom(payload.sub));
    } catch {
      client.emit('auth_error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  /** "X is typing…" relayed to the other people in the conversation. */
  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: unknown; isTyping?: unknown },
  ) {
    const userId = (client.data as SocketData).userId;
    if (!userId || typeof body?.conversationId !== 'string') return;
    try {
      const others = await this.chat.otherParticipants(
        userId,
        body.conversationId,
      );
      this.realtime.toUsers(others, 'typing', {
        conversationId: body.conversationId,
        userId,
        isTyping: body.isTyping === true,
      });
    } catch (err) {
      this.logger.debug(`typing ignored: ${String(err)}`);
    }
  }

  @SubscribeMessage('leaderboard:subscribe')
  async subscribeLeaderboard(@ConnectedSocket() client: Socket) {
    await client.join(LEADERBOARD_ROOM);
    return { ok: true };
  }

  @SubscribeMessage('leaderboard:unsubscribe')
  async unsubscribeLeaderboard(@ConnectedSocket() client: Socket) {
    await client.leave(LEADERBOARD_ROOM);
    return { ok: true };
  }
}
