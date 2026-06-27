// Super administrateur : gouverne la création/les droits des administrateurs.
// Le super admin d'origine est codé en dur (bootstrap) ; il est immuable et
// peut, lui seul, désigner d'autres super admins (flag user_extras.superAdmin).
export const SUPER_ADMIN_EMAIL = "jerome.bouba@lotier-immobilier.com";

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Rôles considérés comme « administrateur » pour la gouvernance.
export function isAdminRole(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "dirigeant";
}
