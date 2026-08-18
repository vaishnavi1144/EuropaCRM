export type PermissionUser = {
  role?: string | null;
  permissions?: unknown;
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  SALES: ['dashboard', 'leads', 'contacts', 'accounts', 'opportunities', 'campaigns', 'activities', 'sales-reports', 'sales-mail-view', 'sales-mail-compose', 'sales-mail-groups-view', 'sales-mail-groups-create', 'sales-mail-groups-edit', 'sales-mail-groups-delete', 'sales-mail-bulk', 'settings'],
  RECRUITER: ['dashboard', 'candidates', 'jobs', 'interviews', 'offers', 'recruitment-reports', 'recruitment-mail-view', 'recruitment-mail-compose', 'recruitment-mail-groups-view', 'recruitment-mail-groups-create', 'recruitment-mail-groups-edit', 'recruitment-mail-groups-delete', 'recruitment-mail-bulk', 'settings'],
  BENCHSALES: ['dashboard', 'jobs', 'bench', 'submissions', 'placements', 'bench-reports', 'bench-mail-view', 'bench-mail-compose', 'bench-mail-groups-view', 'bench-mail-groups-create', 'bench-mail-groups-edit', 'bench-mail-groups-delete', 'bench-mail-bulk', 'settings'],
  AITEAM: ['dashboard', 'ai-projects', 'tasks', 'resources', 'ai-reports', 'ai-mail-view', 'ai-mail-compose', 'ai-mail-groups-view', 'ai-mail-groups-create', 'ai-mail-groups-edit', 'ai-mail-groups-delete', 'ai-mail-bulk', 'settings'],
};

export function normalizePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
}

export function normalizeRole(role?: string | null): string {
  const compact = String(role ?? '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (compact === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (compact === 'BENCHSALES') return 'BENCHSALES';
  if (compact === 'RECRUITER') return 'RECRUITER';
  if (compact === 'AITEAM') return 'AITEAM';
  return compact || 'SALES';
}

export function sanitizePermissionsForRole(roleValue: unknown, value: unknown): string[] {
  const role = normalizeRole(String(roleValue ?? ''));
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
  const explicit = normalizePermissions(value);
  if (role === 'BENCHSALES') {
    const scoped = (explicit ?? defaults).filter((permission) => defaults.includes(permission));
    if (!scoped.includes('jobs')) scoped.unshift('jobs');
    return [...new Set(scoped)];
  }
  return explicit ?? defaults;
}

export function effectivePermissions(user: PermissionUser): string[] {
  const role = normalizeRole(user.role);
  if (role === 'SUPER_ADMIN') return ['*'];
  return sanitizePermissionsForRole(role, user.permissions);
}

export function hasPermission(user: PermissionUser, permission: string): boolean {
  const permissions = effectivePermissions(user);
  return permissions.includes('*') || permissions.includes(permission);
}
