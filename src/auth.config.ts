import type { NextAuthConfig } from "next-auth";

// Config Edge-compatible pour le middleware (sans imports Node.js)
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
