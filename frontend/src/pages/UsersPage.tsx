import { useEffect, useMemo, useState } from 'react';
import { UserCheck, ShieldAlert, Plus, Edit3, Trash2, Mail, AtSign, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { ALL_PERMISSION_KEYS, effectivePermissions, PERMISSION_GROUPS, permissionLabel, ROLE_PERMISSION_DEFAULTS } from '@/lib/permissions';

type UserRow = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: string;
  permissions?: string[] | null;
  isActive?: boolean;
  avatarUrl?: string;
  passwordText?: string;
  createdAt?: string;
};

const roleOptions = [
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (Full Access)' },
  { value: 'SALES', label: 'SALES' },
  { value: 'RECRUITER', label: 'RECRUITER' },
  { value: 'BENCHSALES', label: 'BENCHSALES' },
  { value: 'AITEAM', label: 'AITEAM' },
];

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [managerId, setManagerId] = useState('');
  const [dashboardType, setDashboardType] = useState('BENCHSALES');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const fetchUsers = async () => {
    try {
      const response = await api.list<UserRow>('users');
      setUsers(response.data ?? []);
    } catch (error) {
      setUsers([]);
      toast.error(error instanceof Error ? error.message : 'Unable to load users');
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('');
    setPermissions([]);
    setIsActive(true);
    setManagerId('');
    setDashboardType('BENCHSALES');
    setSmtpHost('');
    setSmtpPort('');
    setSmtpUser('');
    setSmtpPass('');
    setSmtpFrom('');
    setDialogOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setName(user.name);
    setUsername(user.username ?? '');
    setEmail(user.email);
    setPassword(user.passwordText ?? '');
    setShowPassword(false);
    setRole(user.role);
    setPermissions(effectivePermissions(user.role, user.permissions));
    setIsActive(user.isActive !== false);
    setManagerId((user as any).managerId ?? '');
    setDashboardType((user as any).dashboardType ?? 'BENCHSALES');
    setSmtpHost((user as any).smtpHost ?? '');
    setSmtpPort((user as any).smtpPort ? String((user as any).smtpPort) : '');
    setSmtpUser((user as any).smtpUser ?? '');
    setSmtpPass((user as any).smtpPass ?? '');
    setSmtpFrom((user as any).smtpFrom ?? '');
    setDialogOpen(true);
  };

  const changeRole = (nextRole: string) => {
    setRole(nextRole);
    setPermissions([...(ROLE_PERMISSION_DEFAULTS[nextRole] ?? [])]);
  };

  const togglePermission = (key: string, checked: boolean) => {
    setPermissions((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
  };

  const toggleGroup = (keys: string[], checked: boolean) => {
    setPermissions((current) => checked
      ? [...new Set([...current, ...keys])]
      : current.filter((item) => !keys.includes(item)));
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (!role) throw new Error('Select an access role');
      const payload: Record<string, unknown> = {
        name,
        username,
        email,
        role,
        permissions: role === 'SUPER_ADMIN' ? ALL_PERMISSION_KEYS : permissions,
        isActive,
        managerId: managerId || null,
        dashboardType,
        smtpHost: smtpHost.trim() || null,
        smtpPort: smtpPort.trim() ? Number(smtpPort.trim()) : null,
        smtpUser: smtpUser.trim() || null,
        smtpPass: smtpPass.trim() || null,
        smtpFrom: smtpFrom.trim() || null,
      };
      if (password) payload.password = password;
      if (editing) {
        await api.update('users', editing.id, payload);
        toast.success('User login and access permissions updated');
      } else {
        if (!password) throw new Error('Password is required for a new user');
        await api.create('users', payload);
        toast.success('User login created with selected access permissions');
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save user');
    } finally { setLoading(false); }
  };

  const deleteUser = async (user: UserRow) => {
    if (!window.confirm(`Delete user login “${user.username || user.name}”?`)) return;
    try { await api.remove('users', user.id); toast.success('User deleted'); await fetchUsers(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to delete user'); }
  };

  const selectedPermissionCount = useMemo(() => role === 'SUPER_ADMIN' ? ALL_PERMISSION_KEYS.length : permissions.length, [role, permissions]);
  const potentialManagers = useMemo(() => users.filter((u) => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role) && u.id !== editing?.id), [users, editing]);

  return (
    <div className="px-6 py-6 lg:px-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#007c70]"><span>Administration</span><span>›</span><span className="font-extrabold text-slate-800">Users & Roles</span></div>
          <h1 className="text-[27px] font-extrabold text-slate-950">Users & Access Management</h1>
        </div>
        <Button onClick={openAdd} className="h-12 px-5 text-base"><Plus className="h-5 w-5" /> Add User</Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="crm-card flex items-center gap-3 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e3f7f3] text-[#007c70]"><UserCheck className="h-6 w-6" /></div><div><div className="text-xs font-extrabold uppercase text-slate-600">Active Users</div><div className="text-2xl font-extrabold text-slate-950">{users.filter((user) => user.isActive !== false).length}</div></div></div>
        <div className="crm-card flex items-center gap-3 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ShieldAlert className="h-6 w-6" /></div><div><div className="text-xs font-extrabold uppercase text-slate-600">Administrators</div><div className="text-2xl font-extrabold text-slate-950">{users.filter((user) => user.role.includes('ADMIN')).length}</div></div></div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[1050px] border-collapse">
          <thead className="border-b-2 border-slate-200 bg-[#f8fbfb]"><tr><th className="crm-table-head px-4 py-4">User</th><th className="crm-table-head px-4 py-4">Login</th><th className="crm-table-head px-4 py-4">Email</th><th className="crm-table-head px-4 py-4">Role</th><th className="crm-table-head px-4 py-4">Access Permissions</th><th className="crm-table-head px-4 py-4">Status</th><th className="crm-table-head w-32 px-4 py-4">Actions</th></tr></thead>
          <tbody>
            {users.length === 0 ? <tr><td colSpan={7} className="px-4 py-14 text-center text-base font-semibold text-slate-500">No users found. Use Add User to create a login.</td></tr> : users.map((user) => {
              const access = effectivePermissions(user.role, user.permissions);
              return (
                <tr key={user.id} className="border-b border-slate-200 transition last:border-0 hover:bg-[#f7fcfb]">
                  <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 text-sm font-extrabold text-slate-700">{user.name.split(' ').map((part) => part[0]).join('').slice(0,2)}</span><div className="font-extrabold text-slate-900">{user.name}</div></div></td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-700"><div className="flex items-center gap-2"><AtSign className="h-4 w-4 text-[#007c70]" />{user.username || 'Not assigned'}</div></td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{user.email}</div></td>
                  <td className="px-4 py-4"><span className="inline-flex rounded-full bg-[#e3f7f3] px-3 py-1 text-xs font-extrabold text-[#006b63]">{user.role}</span></td>
                  <td className="max-w-[300px] px-4 py-4"><div className="flex items-start gap-2 text-xs font-semibold text-slate-700"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#007c70]" /><span>{user.role === 'SUPER_ADMIN' ? 'Full system access' : access.length ? `${access.length} selected: ${access.slice(0, 3).map(permissionLabel).join(', ')}${access.length > 3 ? '…' : ''}` : 'No module access'}</span></div></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${user.isActive === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{user.isActive === false ? 'Inactive' : 'Active'}</span></td>
                  <td className="px-4 py-4"><div className="flex items-center gap-3"><button onClick={() => openEdit(user)} title="Edit login and permissions" className="rounded-lg p-2 text-slate-500 hover:bg-[#e3f7f3] hover:text-[#007c70]"><Edit3 className="h-5 w-5" /></button><button onClick={() => void deleteUser(user)} title="Delete login" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-5 w-5" /></button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle className="text-2xl font-extrabold text-slate-950">{editing ? 'Edit User Login' : 'Add User Login'}</DialogTitle>
          <DialogDescription className="mt-1 text-sm font-medium text-slate-600">Assign login credentials, a role template and exact module permissions.</DialogDescription>
          <form key={editing?.id ?? `new-${dialogOpen}`} onSubmit={saveUser} autoComplete="off" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name *"><input required name="europa-new-full-name" autoComplete="off" className="crm-input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Username *"><input required name="europa-new-username" autoComplete="off" pattern="[A-Za-z0-9._-]+" className="crm-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. john.smith" /></Field>
            <Field label="Email Address *"><input required name="europa-new-email" autoComplete="off" type="email" className="crm-input" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="Password">
              <div className="relative">
                <input
                  required={!editing}
                  name="europa-new-password"
                  autoComplete="new-password"
                  minLength={8}
                  type={showPassword ? 'text' : 'password'}
                  className="crm-input pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={editing ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>
            <Field label="Access Role *"><select required className="crm-input" value={role} onChange={(event) => changeRole(event.target.value)}><option value="">Select access role</option>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
            <Field label="Default Dashboard *">
              <select
                required
                className="crm-input"
                value={dashboardType}
                onChange={(event) => setDashboardType(event.target.value)}
              >
                <option value="BENCHSALES">Bench Sales Dashboard</option>
                <option value="SALES">Sales Dashboard</option>
                <option value="RECRUITER">Recruitment Dashboard</option>
                <option value="AITEAM">AI Team Dashboard</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 rounded-lg border border-[#E4ECF3] px-4 py-3 text-sm font-extrabold text-slate-800"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-5 w-5 accent-[#009E92]" /> Active login</label>

            <div className="col-span-full rounded-xl border border-[#E4ECF3] bg-slate-50/70 p-4">
              <h3 className="text-sm font-extrabold text-slate-900">Personal SMTP Server Setup</h3>
              <p className="mt-1 text-xs font-medium text-slate-600">Configure personal mail server credentials to send emails from your own account.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="SMTP Host"><input name="smtp-host" className="crm-input bg-white" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="e.g. smtp.gmail.com" /></Field>
                <Field label="SMTP Port"><input name="smtp-port" className="crm-input bg-white" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="e.g. 587" /></Field>
                <Field label="SMTP Username"><input name="smtp-user" className="crm-input bg-white" type="email" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="e.g. user@gmail.com" /></Field>
                <Field label="SMTP Password"><input name="smtp-pass" className="crm-input bg-white" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="Enter SMTP password" /></Field>
                <Field label="From Address"><input name="smtp-from" className="crm-input bg-white" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="e.g. Sender Name <user@gmail.com>" /></Field>
              </div>
            </div>

            <div className="col-span-full rounded-xl border border-[#E4ECF3] bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-extrabold text-slate-900">Access Permissions</h3><p className="mt-1 text-xs font-medium text-slate-600">Tick only the modules this user is allowed to open and use.</p></div>
                <span className="rounded-full bg-[#D9F5F1] px-3 py-1 text-xs font-extrabold text-[#009E92]">{selectedPermissionCount} selected</span>
              </div>
              {role === 'SUPER_ADMIN' && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Super Admin automatically has access to every module.</div>}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PERMISSION_GROUPS.map((group) => {
                  const keys = group.permissions.map((permission) => permission.key);
                  const groupChecked = role === 'SUPER_ADMIN' || keys.every((key) => permissions.includes(key));
                  return (
                    <section key={group.title} className="rounded-xl border border-[#E4ECF3] bg-white p-3">
                      <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-extrabold text-slate-900"><input type="checkbox" disabled={role === 'SUPER_ADMIN'} checked={groupChecked} onChange={(event) => toggleGroup(keys, event.target.checked)} className="h-4 w-4 accent-[#009E92]" />{group.title}</label>
                      <div className="mt-2 space-y-2">
                        {group.permissions.map((permission) => (
                          <label key={permission.key} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" disabled={role === 'SUPER_ADMIN'} checked={role === 'SUPER_ADMIN' || permissions.includes(permission.key)} onChange={(event) => togglePermission(permission.key, event.target.checked)} className="h-4 w-4 accent-[#009E92]" />{permission.label}</label>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="col-span-full mt-2 flex justify-end gap-3 border-t border-[#E4ECF3] pt-4"><Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save User'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-extrabold text-slate-800">{label}</span>{children}</label>;
}
