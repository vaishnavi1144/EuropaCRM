export type PermissionOption = { key: string; label: string; path?: string };
export type PermissionGroup = { title: string; permissions: PermissionOption[] };

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'General',
    permissions: [{ key: 'dashboard', label: 'Dashboard', path: '/' }],
  },
  {
    title: 'Sales / Marketing',
    permissions: [
      { key: 'leads', label: 'Leads', path: '/leads' },
      { key: 'contacts', label: 'Contacts', path: '/contacts' },
      { key: 'accounts', label: 'Accounts', path: '/accounts' },
      { key: 'opportunities', label: 'Opportunities', path: '/opportunities' },
      { key: 'campaigns', label: 'Campaigns', path: '/campaigns' },
      { key: 'activities', label: 'Activities & Email', path: '/activities' },
      { key: 'sales-reports', label: 'Sales Reports', path: '/reports' },
      { key: 'sales-mail-view', label: 'S-mail: View', path: '/s-mail' },
      { key: 'sales-mail-compose', label: 'S-mail: Compose' },
      { key: 'sales-mail-bulk', label: 'S-mail: Bulk Email' },
      { key: 'sales-mail-groups-view', label: 'S-mail: View Groups' },
      { key: 'sales-mail-groups-create', label: 'S-mail: Create Groups' },
      { key: 'sales-mail-groups-edit', label: 'S-mail: Edit Groups' },
      { key: 'sales-mail-groups-delete', label: 'S-mail: Delete Groups' },
    ],
  },
  {
    title: 'IT Recruitment',
    permissions: [
      { key: 'candidates', label: 'Candidates', path: '/candidates' },
      { key: 'interviews', label: 'Interviews', path: '/interviews' },
      { key: 'offers', label: 'Offers', path: '/offers' },
      { key: 'recruitment-reports', label: 'Recruitment Reports', path: '/recruitment-reports' },
      { key: 'recruitment-mail-view', label: 'IT-mail: View', path: '/it-mail' },
      { key: 'recruitment-mail-compose', label: 'IT-mail: Compose' },
      { key: 'recruitment-mail-bulk', label: 'IT-mail: Bulk Email' },
      { key: 'recruitment-mail-groups-view', label: 'IT-mail: View Groups' },
      { key: 'recruitment-mail-groups-create', label: 'IT-mail: Create Groups' },
      { key: 'recruitment-mail-groups-edit', label: 'IT-mail: Edit Groups' },
      { key: 'recruitment-mail-groups-delete', label: 'IT-mail: Delete Groups' },
    ],
  },
  {
    title: 'Bench Sales',
    permissions: [
      { key: 'jobs', label: 'Jobs', path: '/jobs' },
      { key: 'bench', label: 'Bench Consultants', path: '/bench' },
      { key: 'submissions', label: 'Submissions', path: '/submissions' },
      { key: 'placements', label: 'Placements', path: '/placements' },
      { key: 'bench-reports', label: 'Bench Reports', path: '/bench-reports' },
      { key: 'bench-mail-view', label: 'Bench-mail: View', path: '/bench-mail' },
      { key: 'bench-mail-compose', label: 'Bench-mail: Compose' },
      { key: 'bench-mail-bulk', label: 'Bench-mail: Bulk Email' },
      { key: 'bench-mail-groups-view', label: 'Bench-mail: View Groups' },
      { key: 'bench-mail-groups-create', label: 'Bench-mail: Create Groups' },
      { key: 'bench-mail-groups-edit', label: 'Bench-mail: Edit Groups' },
      { key: 'bench-mail-groups-delete', label: 'Bench-mail: Delete Groups' },
    ],
  },
  {
    title: 'AI Team',
    permissions: [
      { key: 'ai-projects', label: 'AI Projects', path: '/ai-projects' },
      { key: 'tasks', label: 'Tasks', path: '/tasks' },
      { key: 'resources', label: 'Resources', path: '/resources' },
      { key: 'ai-reports', label: 'AI Reports', path: '/ai-reports' },
      { key: 'ai-mail-view', label: 'AI-mail: View', path: '/ai-mail' },
      { key: 'ai-mail-compose', label: 'AI-mail: Compose' },
      { key: 'ai-mail-bulk', label: 'AI-mail: Bulk Email' },
      { key: 'ai-mail-groups-view', label: 'AI-mail: View Groups' },
      { key: 'ai-mail-groups-create', label: 'AI-mail: Create Groups' },
      { key: 'ai-mail-groups-edit', label: 'AI-mail: Edit Groups' },
      { key: 'ai-mail-groups-delete', label: 'AI-mail: Delete Groups' },
    ],
  },
  {
    title: 'Administration',
    permissions: [
      { key: 'users', label: 'Users & Access Management', path: '/users' },
      { key: 'settings', label: 'System Settings', path: '/settings' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key));

export const ROLE_PERMISSION_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSION_KEYS,
  SALES: ['dashboard', 'leads', 'contacts', 'accounts', 'opportunities', 'campaigns', 'activities', 'sales-reports', 'sales-mail-view', 'sales-mail-compose', 'sales-mail-bulk', 'sales-mail-groups-view', 'sales-mail-groups-create', 'sales-mail-groups-edit', 'sales-mail-groups-delete', 'settings'],
  RECRUITER: ['dashboard', 'candidates', 'jobs', 'interviews', 'offers', 'recruitment-reports', 'recruitment-mail-view', 'recruitment-mail-compose', 'recruitment-mail-bulk', 'recruitment-mail-groups-view', 'recruitment-mail-groups-create', 'recruitment-mail-groups-edit', 'recruitment-mail-groups-delete', 'settings'],
  BENCHSALES: ['dashboard', 'jobs', 'bench', 'submissions', 'placements', 'bench-reports', 'bench-mail-view', 'bench-mail-compose', 'bench-mail-bulk', 'bench-mail-groups-view', 'bench-mail-groups-create', 'bench-mail-groups-edit', 'bench-mail-groups-delete', 'settings'],
  AITEAM: ['dashboard', 'ai-projects', 'tasks', 'resources', 'ai-reports', 'ai-mail-view', 'ai-mail-compose', 'ai-mail-bulk', 'ai-mail-groups-view', 'ai-mail-groups-create', 'ai-mail-groups-edit', 'ai-mail-groups-delete', 'settings'],
};

export function effectivePermissions(role?: string, permissions?: string[] | null): string[] {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'SUPER_ADMIN') return ALL_PERMISSION_KEYS;
  const defaults = ROLE_PERMISSION_DEFAULTS[normalizedRole] ?? [];
  if (!Array.isArray(permissions)) return defaults;

  // Bench Sales is intentionally isolated from Sales / Marketing permissions.
  // Older user records may contain stale Sales permissions, so scope them here.
  if (normalizedRole === 'BENCHSALES') {
    const scoped = permissions.filter((permission) => defaults.includes(permission));
    if (!scoped.includes('jobs')) scoped.unshift('jobs');
    return [...new Set(scoped)];
  }
  return [...new Set(permissions)];
}

export function normalizeRole(role?: string | null): string {
  const compact = String(role ?? '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (compact === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (compact === 'BENCHSALES') return 'BENCHSALES';
  if (compact === 'RECRUITER') return 'RECRUITER';
  if (compact === 'AITEAM') return 'AITEAM';
  return compact || 'SALES';
}

export function firstAllowedPath(role?: string, permissions?: string[] | null): string {
  const allowed = new Set(effectivePermissions(role, permissions));
  for (const group of PERMISSION_GROUPS) {
    for (const permission of group.permissions) {
      if (permission.path && allowed.has(permission.key)) return permission.path;
    }
  }
  return '/no-access';
}

export function permissionLabel(key: string): string {
  return PERMISSION_GROUPS.flatMap((group) => group.permissions).find((permission) => permission.key === key)?.label ?? key;
}
