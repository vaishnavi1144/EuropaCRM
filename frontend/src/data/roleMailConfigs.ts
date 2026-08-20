import type { LucideIcon } from 'lucide-react';
import { Briefcase, Building2, CalendarCheck, ClipboardList, FileText, Layers, ListChecks, Megaphone, Target, UserCheck, Users, Wallet } from 'lucide-react';

export type RoleMailModule = 'sales' | 'it' | 'bench' | 'ai';

export type RoleMailConfig = {
  module: RoleMailModule;
  title: string;
  description: string;
  permissionView: string;
  permissionCompose: string;
  groupsPath: string;
  crmFolders: { key: string; label: string; icon: LucideIcon }[];
  crmLinkFields: { key: 'submissionId' | 'benchConsultantId' | 'jobId'; label: string; placeholder: string }[];
};

export const roleMailConfigs: Record<RoleMailModule, RoleMailConfig> = {
  bench: {
    module: 'bench',
    title: 'Bench-mail',
    description: 'Bench consultant email workspace.',
    permissionView: 'bench-mail-view',
    permissionCompose: 'bench-mail-compose',
    groupsPath: '/bench-mail/groups',
    crmFolders: [
      { key: 'clients', label: 'Clients', icon: Building2 },
      { key: 'vendors', label: 'Vendors', icon: Briefcase },
      { key: 'interviews', label: 'Interviews', icon: CalendarCheck },
      { key: 'offers', label: 'Offers', icon: Wallet },
      { key: 'follow-ups', label: 'Follow Ups', icon: ListChecks },
      { key: 'hr', label: 'HR', icon: Users },
    ],
    crmLinkFields: [
      { key: 'submissionId', label: 'Submission ID', placeholder: 'Submission record id' },
      { key: 'benchConsultantId', label: 'Consultant ID', placeholder: 'Bench consultant id' },
      { key: 'jobId', label: 'Job ID', placeholder: 'Job record id' },
    ],
  },
  sales: {
    module: 'sales',
    title: 'S-mail',
    description: 'Sales and marketing email workspace.',
    permissionView: 'sales-mail-view',
    permissionCompose: 'sales-mail-compose',
    groupsPath: '/s-mail/groups',
    crmFolders: [
      { key: 'leads', label: 'Leads', icon: Target },
      { key: 'accounts', label: 'Accounts', icon: Building2 },
      { key: 'opportunities', label: 'Opportunities', icon: Layers },
      { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
      { key: 'activities', label: 'Activities', icon: ListChecks },
    ],
    crmLinkFields: [
      { key: 'submissionId', label: 'Lead ID', placeholder: 'Lead record id' },
      { key: 'benchConsultantId', label: 'Account ID', placeholder: 'Account record id' },
      { key: 'jobId', label: 'Opportunity ID', placeholder: 'Opportunity record id' },
    ],
  },
  it: {
    module: 'it',
    title: 'IT-mail',
    description: 'IT recruitment email workspace.',
    permissionView: 'recruitment-mail-view',
    permissionCompose: 'recruitment-mail-compose',
    groupsPath: '/it-mail/groups',
    crmFolders: [
      { key: 'candidates', label: 'Candidates', icon: UserCheck },
      { key: 'jobs', label: 'Jobs', icon: Briefcase },
      { key: 'interviews', label: 'Interviews', icon: CalendarCheck },
      { key: 'applications', label: 'Applications', icon: FileText },
    ],
    crmLinkFields: [
      { key: 'submissionId', label: 'Candidate ID', placeholder: 'Candidate record id' },
      { key: 'benchConsultantId', label: 'Job ID', placeholder: 'Job record id' },
      { key: 'jobId', label: 'Interview ID', placeholder: 'Interview record id' },
    ],
  },
  ai: {
    module: 'ai',
    title: 'AI-mail',
    description: 'AI Team email workspace.',
    permissionView: 'ai-mail-view',
    permissionCompose: 'ai-mail-compose',
    groupsPath: '/ai-mail/groups',
    crmFolders: [
      { key: 'projects', label: 'Projects', icon: Layers },
      { key: 'tasks', label: 'Tasks', icon: ClipboardList },
      { key: 'resources', label: 'Resources', icon: Users },
    ],
    crmLinkFields: [
      { key: 'submissionId', label: 'Project ID', placeholder: 'AI project id' },
      { key: 'benchConsultantId', label: 'Task ID', placeholder: 'AI task id' },
    ],
  },
};
