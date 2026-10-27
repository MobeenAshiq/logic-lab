import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { Env } from '../../config/env';
import { GoogleIdentity } from '../auth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<Env, true>) {
    super({
      // Placeholders keep the app booting without Google keys; GoogleOAuthGuard
      // returns 503 in that case before this strategy is ever used.
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }) || 'unset',
      clientSecret:
        config.get('GOOGLE_CLIENT_SECRET', { infer: true }) || 'unset',
      callbackURL: `${config.get('API_URL', { infer: true })}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleIdentity {
    const email = profile.emails?.[0];
    return {
      googleId: profile.id,
      email: email?.value ?? '',
      // Google only returns verified emails for the `email` scope, but check anyway.
      emailVerified:
        Boolean(email?.value) &&
        (profile._json.email_verified === true || email?.verified === true),
      fullName: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
