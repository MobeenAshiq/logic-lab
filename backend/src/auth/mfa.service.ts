import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app-exception';
import { decrypt, encrypt } from '../common/crypto';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, PRIVILEGED_ROLES } from './auth.types';
import { requireRole } from './require-role';
import { SessionsService } from './sessions.service';

// Accept the previous/next 30s step to tolerate small clock drift on phones.
authenticator.options = { window: 1 };

/** TOTP two-factor auth (Google Authenticator, Authy, ...). Required for mentors and admins. */
@Injectable()
export class MfaService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.encryptionKey = config.get('ENCRYPTION_KEY', { infer: true });
  }

  /** Creates a new (not yet active) secret and returns it as a QR code. */
  async setup(auth: AuthUser) {
    requireRole(auth, PRIVILEGED_ROLES);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
    });
    if (user.totpEnabledAt) {
      throw new AppException(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED');
    }

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: encrypt(secret, this.encryptionKey) },
    });
    const otpauthUrl = authenticator.keyuri(user.email, 'LogicLab', secret);
    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl: await toDataURL(otpauthUrl),
    };
  }

  /** Confirms the first code from the app and turns 2FA on. */
  async enable(auth: AuthUser, code: string, ip: string | null) {
    requireRole(auth, PRIVILEGED_ROLES);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
    });
    if (user.totpEnabledAt) {
      throw new AppException(HttpStatus.CONFLICT, 'MFA_ALREADY_ENABLED');
    }
    if (!user.totpSecret) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MFA_NOT_SET_UP');
    }
    this.assertCode(user.totpSecret, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date() },
    });
    await this.sessions.markMfaVerified(auth.sessionId);
    await this.audit.log({
      actorId: auth.id,
      action: 'mfa.enabled',
      targetType: 'user',
      targetId: auth.id,
      ip,
    });
  }

  /** Second step of login for users who already have 2FA. */
  async verify(auth: AuthUser, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
    });
    if (!user.totpEnabledAt || !user.totpSecret) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MFA_NOT_SET_UP');
    }
    this.assertCode(user.totpSecret, code);
    await this.sessions.markMfaVerified(auth.sessionId);
  }

  private assertCode(encryptedSecret: string, code: string) {
    const secret = decrypt(encryptedSecret, this.encryptionKey);
    if (!authenticator.verify({ token: code, secret })) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_CODE');
    }
  }
}
