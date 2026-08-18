// ============================================================
// RBAC — Role-Based Access Control for Homeino.
//
// Roles: customer | vendor | admin | support
// Backend will enforce these authoritatively; this module
// provides the frontend contract + UI guards.
// ============================================================

export type Role = "customer" | "vendor" | "admin" | "support";

export type Permission =
  | "view:public"           // anyone (including guests)
  | "view:account"          // own account
  | "view:vendor"           // own vendor dashboard
  | "view:admin"            // admin panel
  | "manage:own_store"      // vendor manages their store
  | "manage:all_stores"     // admin manages all stores
  | "manage:products"       // own products (vendor) or all (admin)
  | "manage:orders"         // own orders (vendor) or all (admin)
  | "manage:users"          // admin only
  | "manage:ai_config"      // admin only
  | "manage:support_tickets" // admin + support
  | "ai:generate"           // any logged-in user
  | "credits:purchase"      // any logged-in user;

// ---- Role → Permissions mapping ----
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: ["view:public", "view:account", "ai:generate", "credits:purchase"],
  vendor: ["view:public", "view:account", "view:vendor", "manage:own_store", "manage:products", "manage:orders", "ai:generate", "credits:purchase"],
  admin: [
    "view:public", "view:account", "view:vendor", "view:admin",
    "manage:all_stores", "manage:products", "manage:orders", "manage:users", "manage:ai_config",
    "manage:support_tickets", "ai:generate", "credits:purchase",
  ],
  support: [
    "view:public", "view:account", "view:vendor",
    "manage:support_tickets",
  ],
};

export function hasPermission(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return perm === "view:public";
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function canAccessRoute(role: Role | undefined | null, path: string): boolean {
  if (path.startsWith("/admin")) return hasPermission(role, "view:admin");
  if (path.startsWith("/vendor")) return hasPermission(role, "view:vendor");
  if (path.startsWith("/account")) return hasPermission(role, "view:account");
  return true; // public routes
}

// ---- Route group → minimum role ----
export function minRoleForPath(path: string): Role | null {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/vendor")) return "vendor";
  if (path.startsWith("/account")) return "customer";
  return null;
}
