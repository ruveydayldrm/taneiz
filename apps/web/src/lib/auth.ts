import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@taneiz/shared";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/giris" },
  secret: process.env.NEXTAUTH_SECRET ?? "taneiz-demo-secret-degistirin",
  providers: [
    CredentialsProvider({
      name: "E-posta",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase().trim() } });
        if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** API rotalarında rol kontrolü. ADMIN her rolün yetkisine sahiptir. */
export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session?.user) throw new HttpError(401, "Giriş yapmanız gerekiyor.");
  if (session.user.role !== "ADMIN" && !roles.includes(session.user.role)) {
    throw new HttpError(403, "Bu işlem için yetkiniz yok.");
  }
  return session.user;
}
