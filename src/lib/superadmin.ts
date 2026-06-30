// Super administrateur : gouverne la création/les droits des administrateurs.
// Le super admin d'origine est codé en dur (bootstrap) ; il est immuable et
// peut, lui seul, désigner d'autres super admins (flag user_extras.superAdmin).
export const SUPER_ADMIN_EMAIL = "jerome.bouba@lotier-immobilier.com";

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Domaine de l'agence (déduit de l'adresse du super admin). Tout expéditeur de
// ce domaine est considéré comme un courrier INTERNE de l'agence.
export const AGENCY_DOMAIN = SUPER_ADMIN_EMAIL.split("@")[1];

export function isAgencyEmail(email?: string | null): boolean {
  const d = (email ?? "").trim().toLowerCase().split("@")[1];
  return !!d && d === AGENCY_DOMAIN;
}

// Rôles considérés comme « administrateur » pour la gouvernance.
export function isAdminRole(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "dirigeant";
}
