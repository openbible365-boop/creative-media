import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // 预留 YouTube 发布所需的 scope，用户首次登录时即授权
          scope: [
            "openid",
            "email",
            "profile",
            // YouTube scope — Phase 2 启用引擎E时使用
            // "https://www.googleapis.com/auth/youtube.upload",
            // "https://www.googleapis.com/auth/youtube",
          ].join(" "),
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // 将用户 ID 和订阅信息注入 session
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            plan: true,
            audioMinutesUsed: true,
            audioMinutesLimit: true,
            storageUsed: true,
            storageLimit: true,
          },
        });
        if (dbUser) {
          session.user.plan = dbUser.plan;
          session.user.audioMinutesUsed = dbUser.audioMinutesUsed;
          session.user.audioMinutesLimit = dbUser.audioMinutesLimit;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
};
