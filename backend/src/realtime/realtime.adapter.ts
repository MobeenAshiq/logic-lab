import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Socket.IO on the API's HTTP server, accepting connections from the frontend origin only. */
export class RealtimeAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origin, credentials: false },
    });
  }
}
