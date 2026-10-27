import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Env } from './config/env';
import { RealtimeAdapter } from './realtime/realtime.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Number of proxies in front of the API (the Next.js /api proxy counts as one),
  // so req.ip is the real client IP for rate limiting. 0 = exposed directly.
  const proxies = config.get('TRUST_PROXY', { infer: true });
  if (proxies > 0) app.set('trust proxy', proxies);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });
  app.useWebSocketAdapter(
    new RealtimeAdapter(app, config.get('FRONTEND_URL', { infer: true })),
  );
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
