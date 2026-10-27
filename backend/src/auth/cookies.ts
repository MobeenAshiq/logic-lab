import { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'll_access';
export const REFRESH_COOKIE = 'll_refresh';
export const OAUTH_STATE_COOKIE = 'll_oauth_state';

// Path '/' because the frontend proxies the API under /api (the browser sees
// /api/auth/refresh, the API sees /auth/refresh). Both cookies are httpOnly.
const REFRESH_PATH = '/';

export interface CookieSettings {
  secure: boolean;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax' };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  s: CookieSettings,
) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(s.secure),
    path: '/',
    maxAge: s.accessTtlSeconds * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(s.secure),
    path: REFRESH_PATH,
    maxAge: s.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_PATH });
}
