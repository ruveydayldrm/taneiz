import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const ACCESS: [prefix: string, roles: string[]][] = [
  ["/panel", ["URETICI", "ADMIN"]],
  ["/depo", ["DEPO", "ADMIN"]],
  ["/alici", ["ALICI", "ADMIN"]],
  ["/demo", ["ADMIN"]],
];

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const rule = ACCESS.find(([p]) => req.nextUrl.pathname.startsWith(p));
    if (rule && (!role || !rule[1].includes(role))) {
      return NextResponse.redirect(new URL(`/giris?hata=yetki&callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/giris" },
    secret: process.env.NEXTAUTH_SECRET ?? "taneiz-demo-secret-degistirin",
  },
);

export const config = { matcher: ["/panel/:path*", "/depo/:path*", "/alici/:path*", "/demo/:path*"] };
