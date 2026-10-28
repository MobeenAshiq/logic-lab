import { type NextRequest, NextResponse } from "next/server";
import type { Role, SessionResponse } from "@/types/api";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const PORTALS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/student", roles: ["student"] },
  { prefix: "/mentor", roles: ["mentor"] },
  { prefix: "/admin", roles: ["admin", "super_admin"] },
  // Shared by everyone, but you must be logged in (and past 2FA).
  { prefix: "/community", roles: ["student", "mentor", "admin", "super_admin"] },
];

function home(role: Role) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "mentor") return "/mentor";
  return "/student";
}

function fetchMe(cookie: string) {
  return fetch(`${API_URL}/me`, { headers: { cookie }, cache: "no-store" });
}

/** Applies Set-Cookie headers to a Cookie header, so a retried request uses the new tokens. */
function mergeCookies(cookieHeader: string, setCookies: string[]) {
  const jar = new Map<string, string>();
  for (const part of cookieHeader.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return [...jar]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function withCookies(res: NextResponse, setCookies: string[]) {
  for (const c of setCookies) res.headers.append("set-cookie", c);
  return res;
}

/**
 * Route protection (first of three role checks; the API guard and the DB rules
 * are the others). Asks the API who the user is, refreshing an expired access
 * token on the way, then enforces portal roles and 2FA.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const portal = PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  const isMfaPage = pathname === "/mfa";
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (!portal && !isMfaPage && !isAuthPage) return NextResponse.next();

  const redirect = (path: string, setCookies: string[] = []) =>
    withCookies(NextResponse.redirect(new URL(path, req.url)), setCookies);
  const toLogin = (reason?: string, setCookies: string[] = []) => {
    const params = new URLSearchParams({ next: pathname + search });
    if (reason) params.set("reason", reason);
    return redirect(`/login?${params.toString()}`, setCookies);
  };

  if (!req.cookies.has("ll_access") && !req.cookies.has("ll_refresh")) {
    if (isAuthPage) return NextResponse.next();
    return toLogin();
  }

  let cookie = req.headers.get("cookie") ?? "";
  let setCookies: string[] = [];
  let res = await fetchMe(cookie);

  if (res.status === 401 && req.cookies.has("ll_refresh")) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { cookie },
      cache: "no-store",
    });
    setCookies = refreshed.headers.getSetCookie();
    if (refreshed.ok) {
      cookie = mergeCookies(cookie, setCookies);
      res = await fetchMe(cookie);
    }
  }

  if (!res.ok) {
    if (isAuthPage) return withCookies(NextResponse.next(), setCookies);
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    return toLogin(body.code, setCookies);
  }

  const { user, mfa } = (await res.json()) as SessionResponse;

  if (isAuthPage) {
    const next = req.nextUrl.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const target = safeNext || home(user.role);
    return redirect(target, setCookies);
  }

  if (isMfaPage) {
    return mfa === "none"
      ? redirect(home(user.role), setCookies)
      : withCookies(NextResponse.next(), setCookies);
  }
  if (mfa !== "none") {
    return redirect(`/mfa?next=${encodeURIComponent(pathname + search)}`, setCookies);
  }
  if (!portal!.roles.includes(user.role)) {
    return redirect(home(user.role), setCookies);
  }
  return withCookies(NextResponse.next(), setCookies);
}

export const config = {
  matcher: [
    "/student/:path*",
    "/mentor/:path*",
    "/admin/:path*",
    "/community/:path*",
    "/community",
    "/mfa",
    "/login",
    "/signup",
  ],
};
