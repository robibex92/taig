/**
 * Role-based access control vocabulary and helpers.
 *
 * A user's access is a flat list of strings (`users.roles`):
 *   global:admin | global:moderator | global:activist | global:blocked
 *   parking:admin | cars:admin
 *   house:<number>:view | house:<number>:manage   (e.g. house:39:view, house:39/1:manage)
 *
 * House numbers are matched exactly, so `house:39:*` never grants access to `39/1`.
 */

export const GLOBAL_ROLES = {
  ADMIN: "global:admin",
  MODERATOR: "global:moderator",
  ACTIVIST: "global:activist",
  BLOCKED: "global:blocked",
};

export const SERVICE_ROLES = {
  PARKING_ADMIN: "parking:admin",
  CARS_ADMIN: "cars:admin",
};

export const HOUSE_ROLE_ACTIONS = {
  VIEW: "view",
  MANAGE: "manage",
};

export const houseRole = (house, action = HOUSE_ROLE_ACTIONS.VIEW) =>
  `house:${normalizeHouseKey(house)}:${action}`;

export const houseViewRole = (house) => houseRole(house, HOUSE_ROLE_ACTIONS.VIEW);
export const houseManageRole = (house) => houseRole(house, HOUSE_ROLE_ACTIONS.MANAGE);

const HOUSE_ROLE_RE = /^house:(.+):(view|manage)$/;

export const normalizeHouseKey = (house) => String(house ?? "").trim().replace(/\s+/g, "");

/**
 * Clean a role list: strings only, trimmed, de-duplicated.
 */
export const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) return [];

  const clean = new Set();
  roles.forEach((role) => {
    if (typeof role === "string" && role.trim()) clean.add(role.trim());
  });

  return [...clean];
};

const rolesOf = (user) => normalizeRoles(user?.roles ?? user);

export const hasRole = (user, role) => rolesOf(user).includes(role);

export const hasAnyRole = (user, roles = []) => {
  const list = rolesOf(user);
  return roles.some((role) => list.includes(role));
};

export const isBlocked = (user) => hasAnyRole(user, [GLOBAL_ROLES.BLOCKED]);

export const isAdmin = (user) => hasAnyRole(user, [GLOBAL_ROLES.ADMIN]);

export const isModerator = (user) => hasAnyRole(user, [GLOBAL_ROLES.ADMIN, GLOBAL_ROLES.MODERATOR]);

export const isActivist = (user) =>
  hasAnyRole(user, [GLOBAL_ROLES.ADMIN, GLOBAL_ROLES.MODERATOR, GLOBAL_ROLES.ACTIVIST]);

export const isParkingAdmin = (user) =>
  hasAnyRole(user, [GLOBAL_ROLES.ADMIN, SERVICE_ROLES.PARKING_ADMIN]);

export const isCarsAdmin = (user) =>
  hasAnyRole(user, [GLOBAL_ROLES.ADMIN, SERVICE_ROLES.CARS_ADMIN]);

const matchHouseRole = (user, house, action) => {
  const key = normalizeHouseKey(house);
  if (!key) return false;
  const list = rolesOf(user);
  if (list.includes(houseRole(key, action))) return true;
  // "manage" implies "view"
  if (action === HOUSE_ROLE_ACTIONS.VIEW) {
    return list.includes(houseRole(key, HOUSE_ROLE_ACTIONS.MANAGE));
  }
  return false;
};

export const canViewHouse = (user, house) =>
  isModerator(user) || matchHouseRole(user, house, HOUSE_ROLE_ACTIONS.VIEW);

export const canManageHouse = (user, house) =>
  isAdmin(user) || matchHouseRole(user, house, HOUSE_ROLE_ACTIONS.MANAGE);

/** Every `house:<n>:<action>` role the user holds, parsed for UI use. */
export const listHouseRoles = (user) =>
  rolesOf(user)
    .map((role) => {
      const match = role.match(HOUSE_ROLE_RE);
      return match ? { house: match[1], action: match[2] } : null;
    })
    .filter(Boolean);

const HOUSE_ROLE_VALID_RE = /^house:[^:\s]+:(view|manage)$/;

export const isValidRole = (role) =>
  Object.values(GLOBAL_ROLES).includes(role) ||
  Object.values(SERVICE_ROLES).includes(role) ||
  HOUSE_ROLE_VALID_RE.test(role);

/** Roles that grant more than ordinary resident access. */
export const PRIVILEGED_ROLES = [
  GLOBAL_ROLES.ADMIN,
  GLOBAL_ROLES.MODERATOR,
  GLOBAL_ROLES.ACTIVIST,
  GLOBAL_ROLES.BLOCKED,
  SERVICE_ROLES.PARKING_ADMIN,
  SERVICE_ROLES.CARS_ADMIN,
];

/** Admin panel options grouped for rendering. */
export const assignableRoles = (houses = []) => ({
  global: Object.values(GLOBAL_ROLES),
  services: Object.values(SERVICE_ROLES),
  houses: houses
    .map((house) => normalizeHouseKey(house))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }))
    .flatMap((house) => [houseViewRole(house), houseManageRole(house)]),
});
