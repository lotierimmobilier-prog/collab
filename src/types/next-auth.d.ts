import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      prenom: string;
      nom: string;
      roleId: string;
      accessOverrides?: unknown;
      impersonatorId?: string | null;   // admin qui a « pris la main », le cas échéant
      impersonatorName?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    prenom?: unknown;
    nom?: unknown;
    roleId?: unknown;
    impersonatorId?: string | null;
    impersonatorName?: string | null;
  }
}
