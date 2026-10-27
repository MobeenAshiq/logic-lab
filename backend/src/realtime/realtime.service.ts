import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

export const userRoom = (userId: string) => `user:${userId}`;
export const LEADERBOARD_ROOM = 'leaderboard';

/**
 * Emits realtime events. The gateway registers the Socket.IO server here;
 * until then (e.g. in scripts) emits are silently skipped.
 *
 * Note: with more than one API instance, add the Socket.IO Redis adapter so
 * events reach users connected to another instance.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  toUsers(userIds: Iterable<string>, event: string, payload: unknown) {
    const rooms = [...new Set(userIds)].map(userRoom);
    if (rooms.length) this.server?.to(rooms).emit(event, payload);
  }

  toRoom(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }

  /** Coalesces bursts (e.g. many points at once) into one event per room. */
  private readonly pending = new Map<string, NodeJS.Timeout>();
  debounced(room: string, event: string, payload: unknown, ms = 1500) {
    const key = `${room}:${event}`;
    if (this.pending.has(key)) return;
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.toRoom(room, event, payload);
      }, ms),
    );
  }

  onModuleDestroy() {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    this.logger.debug('Realtime timers cleared');
  }
}
