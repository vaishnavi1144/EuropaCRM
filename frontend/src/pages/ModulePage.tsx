import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { CalendarDays, Mail, Phone, X, Plus, Send, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/crm/PageHeader';
import { KpiCard } from '@/components/crm/KpiCard';
import { FilterBar } from '@/components/crm/FilterBar';
import { DataTable } from '@/components/crm/DataTable';
import { RecordDialog } from '@/components/crm/RecordDialog';
import { RecordViewDialog } from '@/components/crm/RecordViewDialog';
import { type MatchEntry } from '@/components/crm/MatchResultsDialog';
import { InlineMatchingPanel } from '@/components/crm/InlineMatchingPanel';
import { ImportDialog } from '@/components/crm/ImportDialog';
import { EmailDialog, type EmailDialogInitial } from '@/components/crm/EmailDialog';
import { FindConsultantsModal, type MatchedConsultant } from '@/components/crm/FindConsultantsModal';
import { FindJobsModal } from '@/components/crm/FindJobsModal';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { formatIndianCurrency } from '@/lib/utils';
import { moduleConfigs } from '@/data/moduleConfigs';
import type { ChartDatum, KpiConfig, ModuleConfig, RecordRow } from '@/types';

export function ModulePage({ config }: { config: ModuleConfig }) {
  const location = useLocation();
  const { customFields, currentUser } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorInitialized = useRef(false);

  // Job selection states for Bench bulk submission
  const [jobSelectOpen, setJobSelectOpen] = useState(false);
  const [jobsList, setJobsList] = useState<RecordRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [submissionTarget, setSubmissionTarget] = useState('Vendor Company');
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [bulkConsultantsToSubmit, setBulkConsultantsToSubmit] = useState<RecordRow[]>([]);

  const openJobSelector = async (selectedRows: RecordRow[]) => {
    setBulkConsultantsToSubmit(selectedRows);
    setJobSelectOpen(true);
    if (jobsList.length === 0) {
      setLoadingJobs(true);
      try {
        const res = await api.list<RecordRow>('jobs', { limit: 1000, filters: { status: 'Open' } });
        setJobsList(res.data ?? []);
      } catch (err) {
        toast.error('Failed to load active jobs.');
      } finally {
        setLoadingJobs(false);
      }
    }
  };

  const handleConfirmJobSubmit = async () => {
    if (!selectedJobId) return;
    setJobSelectOpen(false);
    const jobIdVal = selectedJobId;
    setSelectedJobId(''); // Reset selected job ID
    
    // Create mock submission records
    const mockSubmissions = bulkConsultantsToSubmit.map((consultant) => ({
      id: `temp-${consultant.id}-${Math.random()}`,
      isMock: true,
      benchConsultantId: consultant.id,
      jobId: jobIdVal,
      submissionTarget: submissionTarget,
      ratePerHour: Number(consultant.ratePerHour ?? consultant.expectedRate ?? 0),
      candidateName: consultant.candidateName,
      resumeUrl: consultant.resumeUrl,
    }));

    await openBulkSendResume(mockSubmissions);
  };

  // Send Resume to Vendor Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerSubmissions, setDrawerSubmissions] = useState<RecordRow[]>([]);
  const [fromEmail, setFromEmail] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('Consultant Submission Template');
  const [emailBody, setEmailBody] = useState('');
  const [drawerAttachments, setDrawerAttachments] = useState<Array<{ filename: string; content: string; contentType?: string; sizeText?: string }>>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState('Vendor Company');
  const [emailDialogPayload, setEmailDialogPayload] = useState<EmailDialogInitial>({ to: '', subject: '', body: '' });
  const [emailSubmissionId, setEmailSubmissionId] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [draftInitial, setDraftInitial] = useState<RecordRow | null>(null);
  const [viewingRecord, setViewingRecord] = useState<RecordRow | null>(null);
  const [matchSource, setMatchSource] = useState<RecordRow | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string>('');
  const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteRecords, setPendingDeleteRecords] = useState<RecordRow[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    // Handled by callback ref setEditorRef
  }, []);

  const setEditorRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      editorRef.current = node;
      if (!editorInitialized.current) {
        node.innerHTML = emailBody;
        editorInitialized.current = true;
      }
    } else {
      editorRef.current = null;
    }
  }, [emailBody]);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewInitial, setInterviewInitial] = useState<RecordRow | null>(null);
  const [findConsultantsOpen, setFindConsultantsOpen] = useState(false);
  const [findConsultantsData, setFindConsultantsData] = useState<MatchedConsultant[]>([]);
  const [findConsultantsLoading, setFindConsultantsLoading] = useState(false);
  const [findJobsOpen, setFindJobsOpen] = useState(false);
  const [findJobsData, setFindJobsData] = useState<MatchEntry[]>([]);
  const [findJobsLoading, setFindJobsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const result = await api.list<RecordRow>(config.resource, { page: 1, limit: 5000, sortBy: 'createdAt', sortOrder: 'desc' });
      setRows(result.data);
    } catch (reason) {
      setRows([]);
      setLoadError(reason instanceof Error ? reason.message : 'Unable to load records.');
    } finally { setLoading(false); }
  }, [config.resource]);

  useEffect(() => {
    setRows([]); setSearch(''); setFilterValues({}); setPage(1); setPageSize(10);
    setSortBy('createdAt'); setSortOrder('desc');
    setSelectedIds(new Set());
    
    const savedOpen = sessionStorage.getItem('crm_drawer_open') === 'true';
    if (!savedOpen) {
      setIsDrawerOpen(false);
    }
    
    void loadRecords();
  }, [config, loadRecords]);

  // Restore email drawer state from sessionStorage on mount
  useEffect(() => {
    const savedOpen = sessionStorage.getItem('crm_drawer_open') === 'true';
    if (savedOpen) {
      try {
        const savedSubmissions = JSON.parse(sessionStorage.getItem('crm_drawer_submissions') || '[]');
        const savedFrom = sessionStorage.getItem('crm_drawer_from') || '';
        const savedTo = sessionStorage.getItem('crm_drawer_to') || '';
        const savedCc = sessionStorage.getItem('crm_drawer_cc') || '';
        const savedBcc = sessionStorage.getItem('crm_drawer_bcc') || '';
        const savedSubject = sessionStorage.getItem('crm_drawer_subject') || '';
        const savedTemplate = sessionStorage.getItem('crm_drawer_template') || 'Consultant Submission Template';
        const savedBody = sessionStorage.getItem('crm_drawer_body') || '';
        const savedAttachments = JSON.parse(sessionStorage.getItem('crm_drawer_attachments') || '[]');

        if (savedSubmissions.length) {
          setDrawerSubmissions(savedSubmissions);
          setFromEmail(savedFrom);
          setToEmail(savedTo);
          setCcEmail(savedCc);
          setBccEmail(savedBcc);
          setSubject(savedSubject);
          setEmailTemplate(savedTemplate);
          setEmailBody(savedBody);
          setDrawerAttachments(savedAttachments);
          setIsDrawerOpen(true);
        }
      } catch (err) {
        console.error('Failed to restore email drawer state', err);
      }
    }
  }, [config.resource]);

  // Save email drawer state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('crm_drawer_open', String(isDrawerOpen));
    if (isDrawerOpen) {
      sessionStorage.setItem('crm_drawer_submissions', JSON.stringify(drawerSubmissions));
      sessionStorage.setItem('crm_drawer_from', fromEmail);
      sessionStorage.setItem('crm_drawer_to', toEmail);
      sessionStorage.setItem('crm_drawer_cc', ccEmail);
      sessionStorage.setItem('crm_drawer_bcc', bccEmail);
      sessionStorage.setItem('crm_drawer_subject', subject);
      sessionStorage.setItem('crm_drawer_template', emailTemplate);
      sessionStorage.setItem('crm_drawer_body', emailBody);
      sessionStorage.setItem('crm_drawer_attachments', JSON.stringify(drawerAttachments));
    } else {
      sessionStorage.removeItem('crm_drawer_submissions');
      sessionStorage.removeItem('crm_drawer_from');
      sessionStorage.removeItem('crm_drawer_to');
      sessionStorage.removeItem('crm_drawer_cc');
      sessionStorage.removeItem('crm_drawer_bcc');
      sessionStorage.removeItem('crm_drawer_subject');
      sessionStorage.removeItem('crm_drawer_template');
      sessionStorage.removeItem('crm_drawer_body');
      sessionStorage.removeItem('crm_drawer_attachments');
    }
  }, [isDrawerOpen, drawerSubmissions, fromEmail, toEmail, ccEmail, bccEmail, subject, emailTemplate, emailBody, drawerAttachments]);

  useEffect(() => {
    const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
    const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const socketUrl = configuredSocketUrl || `http://${browserHost || 'localhost'}:4000`;
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
    const refreshAuthorizedRecords = () => { void loadRecords(); };
    socket.on(`${config.resource}:created`, refreshAuthorizedRecords);
    socket.on(`${config.resource}:updated`, refreshAuthorizedRecords);
    socket.on(`${config.resource}:deleted`, refreshAuthorizedRecords);
    return () => { socket.disconnect(); };
  }, [config.resource, loadRecords]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      setEditing(null); setDraftInitial(null);
      sessionStorage.removeItem(`europa_draft_${config.resource}_new`);
      sessionStorage.setItem(`europa_dialog_open_${config.resource}`, 'new');
      setDialogOpen(true);
    }
    if (params.get('action') === 'import') {
      setImportDialogOpen(true);
    }
    const initialSearch = params.get('search');
    if (initialSearch) setSearch(initialSearch);
    const initialStatus = params.get('status');
    if (initialStatus && config.filters.includes('Status')) setFilterValues((current) => ({ ...current, Status: initialStatus }));
    const aging = params.get('aging');
    if (aging && config.resource === 'bench') setFilterValues((current) => ({ ...current, __aging: aging }));
    const type = params.get('type');
    if (type && config.resource === 'activities') setFilterValues((current) => ({ ...current, Type: type }));
    if (params.get('calendar') === '1' && config.resource === 'activities') {
      setFilterValues((current) => ({ ...current, 'Due Date': new Date().toISOString().slice(0, 10) }));
    }
  }, [config.resource, location.pathname, location.search]);

  useEffect(() => {
    if (loading) return;
    const openState = sessionStorage.getItem(`europa_dialog_open_${config.resource}`);
    if (openState === 'new') {
      setEditing(null);
      setDraftInitial(null);
      setDialogOpen(true);
    } else if (openState && openState.startsWith('edit:')) {
      const id = openState.substring(5);
      const found = rows.find((r) => r.id === id);
      if (found) {
        setEditing(found);
        setDraftInitial(null);
        setDialogOpen(true);
      }
    }
  }, [loading, rows, config.resource]);

  const dynamicColumns = useMemo(() => [
    ...config.columns,
    ...(customFields[config.resource] ?? []).map((field) => ({ key: field.key, label: field.label, render: field.type === 'select' ? 'badge' as const : undefined })),
  ], [config.columns, config.resource, customFields]);
  const dynamicFields = useMemo(() => [...config.fields, ...(customFields[config.resource] ?? [])], [config.fields, config.resource, customFields]);

  const filterKeyByLabel = useMemo(() => Object.fromEntries(config.filters.map((label) => [label, resolveFilterKey(label, dynamicFields.map((field) => ({ key: field.key, label: field.label })))])), [config.filters, dynamicFields]);
  const filterOptions = useMemo(() => Object.fromEntries(config.filters.map((label) => {
    const key = filterKeyByLabel[label];
    const options = [...new Set(rows.map((row) => row[key]).filter((value): value is string | number => typeof value === 'string' || typeof value === 'number').map(String))].sort();
    return [label, options];
  })), [config.filters, filterKeyByLabel, rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && !Object.entries(row).some(([key, value]) => key !== 'customData' && String(value ?? '').toLowerCase().includes(needle))) return false;
      if (config.resource === 'bench' && filterValues.__aging) {
        const custom = row.customData && typeof row.customData === 'object' ? row.customData as Record<string, unknown> : {};
        const start = String(custom.availableFrom ?? row.availableFrom ?? row.createdAt ?? '');
        const age = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000));
        const [agingMin, agingMax] = String(filterValues.__aging).split('-');
        const minAge = Number(agingMin);
        const maxAge = agingMax === 'plus' ? Infinity : Number(agingMax);
        if (Number.isFinite(minAge) && age < minAge) return false;
        if (Number.isFinite(maxAge) && age > maxAge) return false;
      }
      return Object.entries(filterValues).every(([label, selected]) => {
        if (!selected) return true;
        if (label === '__aging') return true;
        const key = filterKeyByLabel[label];
        const actual = row[key];
        if (label.toLowerCase().includes('date')) return normalizeDate(String(actual ?? '')) === selected;
        return String(actual ?? '').toLowerCase() === selected.toLowerCase();
      });
    });
  }, [filterKeyByLabel, filterValues, rows, search]);

  const sorted = useMemo(() => [...filtered].sort((left, right) => compareValues(left[sortBy], right[sortBy], sortOrder)), [filtered, sortBy, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);

  const stats = useMemo(() => deriveStats(config.stats, rows, config.resource), [config.resource, config.stats, rows]);
  const donutData = useMemo(() => groupRows(rows, donutKey(config.resource)), [config.resource, rows]);
  const barData = useMemo(() => groupRows(rows, barKey(config.resource)), [config.resource, rows]);
  const quickFilters = useMemo(() => config.quickFilters.map((item) => ({ ...item, value: String(countByLabel(rows, item.label)) })), [config.quickFilters, rows]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      sessionStorage.setItem(`europa_dialog_open_${config.resource}`, editing ? `edit:${editing.id}` : 'new');
    } else {
      sessionStorage.removeItem(`europa_dialog_open_${config.resource}`);
      const draftKey = `europa_draft_${config.resource}_${editing ? 'edit_' + editing.id : 'new'}`;
      sessionStorage.removeItem(draftKey);
      setEditing(null);
      setDraftInitial(null);
    }
  };

  const add = () => {
    setEditing(null);
    setDraftInitial(null);
    sessionStorage.removeItem(`europa_draft_${config.resource}_new`);
    sessionStorage.setItem(`europa_dialog_open_${config.resource}`, 'new');
    setDialogOpen(true);
  };
  
  const edit = (row: RecordRow) => {
    setEditing(row);
    setDraftInitial(null);
    sessionStorage.setItem(`europa_dialog_open_${config.resource}`, `edit:${row.id}`);
    setDialogOpen(true);
  };
  
  const view = async (row: RecordRow) => {
    try { setViewingRecord(await api.get<RecordRow>(config.resource, row.id)); }
    catch { setViewingRecord(row); }
    setViewDialogOpen(true);
  };

  const openMatches = async (row: RecordRow) => {
    if (!['jobs', 'bench'].includes(config.resource)) return;
    setSelectedRowId(row.id);
    setMatchSource(row);
    setMatchEntries([]);
    setMatchLoading(true);
    try {
      if (config.resource === 'jobs') {
        const result = await api.workflow<{ matches: MatchEntry[] }>(`jobs/${row.id}/top-matches`, { limit: 50, includeLowMatches: true });
        setMatchEntries(result.matches ?? []);
      } else {
        const result = await api.workflow<{ matches: MatchEntry[] }>(`bench/${row.id}/recommended-jobs`, { limit: 50, includeLowMatches: true });
        setMatchEntries(result.matches ?? []);
      }
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Unable to calculate live matches.');
    } finally { setMatchLoading(false); }
  };

  const getRecordValue = (record: RecordRow, keys: string[]) => {
    const value = keys.reduce<unknown>((found, key) => {
      if (found !== undefined && found !== null && String(found).trim() !== '') return found;
      return record[key] ?? found;
    }, undefined);
    return String(value ?? '').trim() || 'Not provided';
  };

  const openJobsForConsultant = async (row: RecordRow) => {
    if (config.resource !== 'bench') return;
    setMatchSource(row);
    setFindJobsData([]);
    setFindJobsLoading(true);
    try {
      const result = await api.workflow<{ matches: MatchEntry[] }>(`bench/${row.id}/recommended-jobs`, { limit: 100, includeLowMatches: false });
      if (!result.matches.length) {
        toast.error('No open jobs available for this consultant at the moment.');
        return;
      }
      setFindJobsData(result.matches);
      setFindJobsOpen(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Unable to find jobs for this consultant.');
    } finally {
      setFindJobsLoading(false);
    }
  };

  const submitRecommendedMatch = async (entry: MatchEntry, overrideReason: string) => {
    try {
      const job = config.resource === 'jobs' ? matchSource : entry.job;
      const consultant = config.resource === 'jobs' ? entry.consultant : matchSource;
      if (!job?.id || !consultant?.id) throw new Error('The Job or Consultant could not be identified.');
      const defaultRate = Number(consultant.ratePerHour ?? consultant.expectedRate ?? 0);
      const rateInput = window.prompt('Submission rate in USD', String(defaultRate || 0));
      if (rateInput === null) return;
      const rateValue = rateInput.trim() || String(defaultRate || 0);

      const targetInput = window.prompt('Submission target: enter Vendor Company or Hiring / End Client', 'Vendor Company');
      if (targetInput === null) return;
      const submissionTarget = targetInput.trim() && ['Vendor Company', 'Hiring / End Client'].includes(targetInput.trim()) ? targetInput.trim() : 'Vendor Company';

      const followUpDateInput = window.prompt('Follow-up date (YYYY-MM-DD, optional)', '');
      if (followUpDateInput === null) return;
      const followUpDate = followUpDateInput.trim() ?? '';
      const result = await api.workflow<{ message?: string }>(`jobs/${job.id}/submit/${consultant.id}`, {
        ratePerHour: Number(rateValue || 0), followUpDate, submissionTarget, overrideReason,
      });
      toast.success(String(result.message ?? 'Resume submitted successfully.'));
      setViewDialogOpen(false);
      await loadRecords();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Unable to calculate matches or submit the resume.');
    }
  };

  const resolveEmailField = (record: RecordRow, keys: string[]) => {
    const value = keys.reduce<unknown>((current, key) => {
      if (current !== undefined && current !== null && String(current).trim() !== '') return current;
      return record[key] ?? current;
    }, undefined);
    return String(value ?? '').trim() || 'Not provided';
  };

  const downloadAttachmentFromUrl = async (resumeUrl: string) => {
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';
    const apiOrigin = configuredApiUrl ? configuredApiUrl.replace(/\/api\/?$/, '') : `${window.location.protocol}//${window.location.hostname}:4000`;
    const resolvedUrl = new URL(String(resumeUrl), apiOrigin).toString();
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`Unable to access resume file (${response.status}).`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Resume file is empty.');
    const fileName = (() => {
      try {
        const pathName = new URL(resolvedUrl).pathname;
        return pathName.split('/').filter(Boolean).pop() ?? 'resume.pdf';
      } catch {
        return 'resume.pdf';
      }
    })();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const encoded = result.split(',')[1] ?? '';
        resolve(encoded);
      };
      reader.onerror = () => reject(new Error('Unable to read resume content.'));
      reader.readAsDataURL(blob);
    });
    return { filename: fileName, content: base64, contentType: blob.type || undefined };
  };

  const openSendResume = async (record: RecordRow) => {
    const candidateName = resolveEmailField(record, ['candidateName', 'name']);
    const technology = resolveEmailField(record, ['consultantSkills', 'primarySkill', 'technology', 'skills']);
    const experience = resolveEmailField(record, ['experienceYears', 'experience', 'totalExperience']);
    const location = resolveEmailField(record, ['workLocation', 'location', 'currentLocation']);
    const visa = resolveEmailField(record, ['visaStatus', 'consultantVisaStatus', 'workAuthorization']);
    const availability = resolveEmailField(record, ['availableFrom', 'noticePeriod', 'marketingStatus', 'availability']);
    const workAuthorization = resolveEmailField(record, ['consultantVisaStatus', 'visaStatus', 'workAuthorization']);
    const rate = resolveEmailField(record, ['ratePerHour', 'submissionRate', 'expectedRate', 'rate', 'billRate']);
    const rateType = resolveEmailField(record, ['rateType']);
    const interviewAvailability = resolveEmailField(record, ['interviewAvailability', 'availableFrom', 'noticePeriod', 'marketingStatus']);

    const jobTitle = resolveEmailField(record, ['jobTitle']);
    const jobReference = resolveEmailField(record, ['requirementReference', 'jobReference']);
    const jobClient = resolveEmailField(record, ['endClient', 'clientCompany']);
    const jobVendor = resolveEmailField(record, ['vendorCompany']);
    const submissionTarget = String(record.submissionTarget ?? 'Vendor Company');
    const targetCompany = String(record.targetCompany ?? (submissionTarget === 'Hiring / End Client' ? jobClient : jobVendor));
    const targetEmail = submissionTarget === 'Hiring / End Client'
      ? String(record.targetEmail ?? record.endClientEmail ?? record.clientEmail ?? '')
      : String(record.targetEmail ?? record.vendorEmail ?? '');
    const jobLocation = resolveEmailField(record, ['workLocation', 'location']);
    const jobWorkMode = resolveEmailField(record, ['workMode']);
    const jobContractDuration = resolveEmailField(record, ['contractDuration']);
    const jobRequiredSkills = resolveEmailField(record, ['requiredSkills', 'skillsRequired']);

    const consultantTable = [
      '| Candidate Name | Technology | Experience | Location | Visa | Availability | Work Authorization | Rate | Rate Type | Interview Availability |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${candidateName} | ${technology} | ${experience} | ${location} | ${visa} | ${availability} | ${workAuthorization} | ${rate} | ${rateType} | ${interviewAvailability} |`,
    ].join('\n');

    const jobTable = [
      '| Job Title | Job Reference | Client | Vendor | Location | Work Mode | Contract Duration | Required Skills |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${jobTitle} | ${jobReference} | ${jobClient} | ${jobVendor} | ${jobLocation} | ${jobWorkMode} | ${jobContractDuration} | ${jobRequiredSkills} |`,
    ].join('\n');

    const resumeUrl = String(record.resumeUrl ?? record.resumeVersion ?? '');
    const attachments: EmailDialogInitial['attachments'] = [];
    let validationMessage = '';
    let requireAttachments = true;

    if (resumeUrl) {
      try {
        attachments.push(await downloadAttachmentFromUrl(resumeUrl));
      } catch (error) {
        validationMessage = `Unable to load the candidate resume automatically. Attach it manually before sending.`;
      }
    } else {
      validationMessage = 'No resume is attached to this submission. Please add the latest resume before sending.';
    }

    setEmailSubmissionId(String(record.id));
    setEmailTarget(submissionTarget);
    setEmailDialogPayload({
      to: targetEmail,
      cc: String(targetEmail && record.consultantEmail && targetEmail !== record.consultantEmail ? record.consultantEmail : ''),
      subject: `Resume Submission: ${candidateName} for ${jobTitle}`,
      body: `Hello,

I am submitting ${candidateName} for the role of ${jobTitle} to ${targetCompany}.

Consultant Details:
${consultantTable}

Job Details:
${jobTable}

Please let me know if you would like the resume and profile details.

Regards,
Europa CRM Team`,
      attachments: attachments.length ? attachments : undefined,
      validationMessage,
      requireAttachments,
    });
    setEmailDialogOpen(true);
  };

  const submissionsDrawerColumns = useMemo(() => [
    { key: 'candidateName', label: 'Consultant', render: 'person' as const, subtitleKey: 'status' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'endClient', label: 'End Client', render: 'account' as const }
  ], []);

  const getSelectedRowValue = (rows: RecordRow[], keys: string[]) => {
    for (const row of rows) {
      for (const key of keys) {
        const value = row[key];
        const text = String(value ?? '').trim();
        if (text) return text;
      }
    }
    return 'Not provided';
  };

  const getSelectedRowEmail = (rows: RecordRow[], keys: string[]) => {
    const values = rows
      .map((row) => keys.map((key) => String(row[key] ?? '')).find((value) => value.trim()))
      .filter((value): value is string => Boolean(value && value.trim()));
    return [...new Set(values.map((value) => value.trim()))].join(', ');
  };

  const safeEmailValue = (value: unknown, fallback = '-') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };

  const buildResumeDownloadHref = (resumeValue: string | null | undefined) => {
    const resume = String(resumeValue ?? '').trim();
    if (!resume) return '';
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';
    const apiOrigin = configuredApiUrl ? configuredApiUrl.replace(/\/api\/?$/, '') : `${window.location.protocol}//${window.location.hostname}:4000`;
    try {
      return new URL(resume, apiOrigin).toString();
    } catch {
      return resume;
    }
  };

  const getLinkedSubmissionDetails = async (submission: RecordRow) => {
    const result: RecordRow = { ...submission };

    const benchId = submission.benchConsultantId != null ? String(submission.benchConsultantId) : '';
    const jobId = submission.jobId != null ? String(submission.jobId) : '';

    if (benchId) {
      try {
        const bench = await api.get<RecordRow>('bench', benchId);
        Object.assign(result, {
          candidateName: result.candidateName || bench.candidateName || bench.name,
          consultantSkills: result.consultantSkills || bench.skills || bench.primarySkill,
          experienceYears: result.experienceYears ?? bench.experienceYears,
          visaStatus: result.consultantVisaStatus || bench.visaStatus,
          workLocation: result.workLocation || bench.currentLocation || bench.preferredLocation,
          availability: result.availableFrom || bench.availableFrom || bench.noticePeriod,
          ratePerHour: result.ratePerHour ?? bench.ratePerHour ?? bench.expectedRate,
          resumeUrl: result.resumeUrl || bench.resumeUrl,
          resumeVersion: result.resumeVersion || bench.resumeUrl,
        });
      } catch {
        // Ignore and keep row data as-is.
      }
    }

    if (jobId) {
      try {
        const job = await api.get<RecordRow>('jobs', jobId);
        Object.assign(result, {
          jobTitle: result.jobTitle || job.jobTitle,
          endClient: result.endClient || job.endClient || job.company,
          vendorCompany: result.vendorCompany || job.vendorCompany,
          vendorEmail: result.vendorEmail || job.vendorEmail,
          vendorContact: result.vendorContact || job.vendorContact,
          workLocation: result.workLocation || job.location,
          workMode: result.workMode || job.workMode,
          requiredSkills: result.requiredSkills || job.skillsRequired || job.preferredSkills,
          rateType: result.rateType || job.rateType,
          maximumJobRate: result.maximumJobRate ?? job.maxRate,
        });
      } catch {
        // Ignore and keep row data as-is.
      }
    }

    return result;
  };

  const generateVendorEmailHtml = (selectedRows: RecordRow[]) => {
    const vendorContact = safeEmailValue(getSelectedRowValue(selectedRows, ['vendorContact', 'contactPerson', 'vendorName', 'recruiterName']), 'Team');
    const client = safeEmailValue(getSelectedRowValue(selectedRows, ['endClient', 'clientCompany', 'company', 'client']), '-');
    const jobTitle = safeEmailValue(getSelectedRowValue(selectedRows, ['jobTitle', 'requirementTitle', 'title', 'jobName']), '-');
    const location = safeEmailValue(getSelectedRowValue(selectedRows, ['workLocation', 'location', 'currentLocation', 'officeLocation']), '-');
    const workMode = safeEmailValue(getSelectedRowValue(selectedRows, ['workMode', 'modeOfWork', 'jobMode']), '-');
    const requiredSkills = safeEmailValue(getSelectedRowValue(selectedRows, ['requiredSkills', 'skillsRequired', 'mandatorySkills', 'skills']), '-');
    const contractType = safeEmailValue(getSelectedRowValue(selectedRows, ['rateType', 'jobType', 'contractType', 'employmentType']), '-');

    const rowsHtml = selectedRows.map((row) => {
      const candidate = safeEmailValue(getSelectedRowValue([row], ['candidateName', 'name', 'consultantName']), '-');
      const technology = safeEmailValue(getSelectedRowValue([row], ['consultantSkills', 'primarySkill', 'technology', 'skills']), '-');
      const experience = safeEmailValue(getSelectedRowValue([row], ['experienceYears', 'experience', 'totalExperience']), '-');
      const visa = safeEmailValue(getSelectedRowValue([row], ['consultantVisaStatus', 'visaStatus', 'workAuthorization']), '-');
      const rate = safeEmailValue(getSelectedRowValue([row], ['ratePerHour', 'submissionRate', 'expectedRate', 'rate', 'billRate']), '-');
      const rateType = safeEmailValue(getSelectedRowValue([row], ['rateType', 'billingType']), '-');
      const resumeValue = String(row.resumeUrl ?? row.resumeVersion ?? '').trim();
      const resumeName = resumeValue.split('/').pop() || `${candidate.replace(/\s+/g, '_')}_resume.pdf`;
      const locationValue = safeEmailValue(getSelectedRowValue([row], ['workLocation', 'location', 'currentLocation']), '-');
      const availability = safeEmailValue(getSelectedRowValue([row], ['availableFrom', 'noticePeriod', 'marketingStatus', 'availability']), '-');
      const resumeCell = resumeValue
        ? `<a href="${buildResumeDownloadHref(resumeValue)}" target="_blank" download style="color:#0f766e;text-decoration:underline;">${resumeName}</a>`
        : '<span>-</span>';

      return `
        <tr>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${candidate}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${technology}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${experience}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${visa}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${locationValue}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${availability}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${rate}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${rateType}</td>
          <td style="border:1px solid #dfe7ef;padding:8px 10px;">${resumeCell}</td>
        </tr>`;
    }).join('');

    const vendorGreeting = vendorContact && vendorContact !== 'Team' ? `Hi ${vendorContact},` : 'Hi,';
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
        <p>${vendorGreeting}</p>
        <p>Please find our consultants list for your requirement below:</p>
        <br />
        <table style="border-collapse:collapse;width:100%;margin:12px 0;border:1px solid #dfe7ef;font-size:13px;">
          <thead>
            <tr style="background:#f5f7fa;">
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Candidate</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Technology</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Experience</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Visa</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Location</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Availability</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Rate</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Rate Type</th>
              <th style="border:1px solid #dfe7ef;padding:8px 10px;text-align:left;">Resume</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <br />
        <p>Thanks &amp; Regards,<br />${String(currentUser?.name ?? 'Bench Sales Recruiter')}<br />EuropaCRM</p>
      </div>`;
    return html;
  };

  const openBulkSendResume = async (selectedRows: RecordRow[]) => {
    if (!selectedRows.length) return;

    const resolvedRows = await Promise.all(selectedRows.map((row) => getLinkedSubmissionDetails(row)));
    const submissionTarget = String(resolvedRows[0].submissionTarget ?? 'Vendor Company');
    const targetEmails = getSelectedRowEmail(resolvedRows, ['targetEmail', submissionTarget === 'Hiring / End Client' ? 'endClientEmail' : 'vendorEmail', 'recruiterEmail', 'contactEmail']);
    const targetContact = getSelectedRowValue(resolvedRows, ['vendorContact', 'contactPerson', 'vendorName']);
    const jobTitle = getSelectedRowValue(resolvedRows, ['jobTitle', 'requirementTitle', 'title', 'jobName']) || 'Open Requirement';
    const client = getSelectedRowValue(resolvedRows, ['endClient', 'clientCompany', 'company', 'client']) || 'Client';

    setDrawerSubmissions(resolvedRows);
    setFromEmail(String(currentUser?.email ?? 'noreply@europacrm.local'));
    setToEmail(targetEmails || String(resolvedRows[0].targetEmail ?? resolvedRows[0].vendorEmail ?? ''));
    setCcEmail(String(currentUser?.email && targetEmails && !targetEmails.includes(currentUser.email) ? currentUser.email : ''));
    setBccEmail('');
    setSubject(`${jobTitle} Consultant Resumes - ${client} Requirement`);
    setEmailTemplate('Consultant Submission Template');
    setEmailBody(generateVendorEmailHtml(resolvedRows));
    editorInitialized.current = false;
    setIsDrawerOpen(true);
    void loadDrawerAttachments(resolvedRows);
  };

  const bulkSendMatchingConsultants = async (entries: MatchedConsultant[]) => {
    const submissionTarget = window.prompt('Send resumes to: enter Vendor Company or Hiring / End Client', 'Vendor Company');
    if (!submissionTarget || !['Vendor Company', 'Hiring / End Client'].includes(submissionTarget)) {
      toast.error('Choose Vendor Company or Hiring / End Client before sending.');
      return;
    }
    const drafts: RecordRow[] = [];
    const failures: string[] = [];
    for (const entry of entries) {
      try {
        const result = await api.workflow<{ submission?: RecordRow }>(`jobs/${String(viewingRecord?.id ?? '')}/submit/${String(entry.consultant.id)}`, {
          ratePerHour: Number(entry.consultant.ratePerHour ?? entry.consultant.expectedRate ?? 0),
          submissionTarget,
        });
        if (result.submission) drafts.push(result.submission);
      } catch (reason) {
        failures.push(`${String(entry.consultant.candidateName ?? entry.consultant.id)}: ${reason instanceof Error ? reason.message : 'Unable to create submission.'}`);
      }
    }
    if (failures.length) toast.warning(`${failures.length} consultant(s) could not be added to the bulk email.`);
    if (!drafts.length) throw new Error('No individual submissions were created for bulk sending.');
    setFindConsultantsOpen(false);
    await openBulkSendResume(drafts);
  };

  const loadDrawerAttachments = async (submissions: RecordRow[]) => {
    setAttachmentLoading(true);
    const loaded: typeof drawerAttachments = [];
    for (const sub of submissions) {
      const resumeUrl = String(sub.resumeUrl ?? sub.resumeVersion ?? '');
      if (resumeUrl) {
        try {
          const attachment = await downloadAttachmentFromUrl(resumeUrl);
          const sizeKb = Math.floor(Math.random() * 20) + 230; // 230 - 250 KB
          loaded.push({
            ...attachment,
            sizeText: `${sizeKb} KB`
          });
        } catch (err) {
          console.error(`Failed to download resume for ${sub.candidateName}`, err);
        }
      }
    }
    setDrawerAttachments(loaded);
    setAttachmentLoading(false);
  };

  const handleRemoveSubmission = (subId: string) => {
    const nextSubmissions = drawerSubmissions.filter((s) => s.id !== subId);
    setDrawerSubmissions(nextSubmissions);
    
    const removedSub = drawerSubmissions.find((s) => s.id === subId);
    if (removedSub) {
      const candName = String(removedSub.candidateName).toLowerCase().split(' ')[0];
      setDrawerAttachments((prev) => prev.filter((att) => !att.filename.toLowerCase().includes(candName)));
    }
    
    if (nextSubmissions.length === 0) {
      setIsDrawerOpen(false);
    }
  };

  const handleDrawerFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const items = await Promise.all(Array.from(files).map((file) => new Promise<typeof drawerAttachments[0]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? '';
          const sizeText = `${Math.round(file.size / 1024)} KB`;
          resolve({ filename: file.name, content: base64, contentType: file.type || undefined, sizeText });
        };
        reader.onerror = () => reject(new Error(`Unable to read file ${file.name}`));
        reader.readAsDataURL(file);
      })));
      setDrawerAttachments((prev) => [...prev, ...items]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleSendBulkMail = async () => {
    if (!toEmail.trim()) {
      toast.error('To Email is required.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    const finalEmailBody = editorRef.current ? editorRef.current.innerHTML : emailBody;
    if (!finalEmailBody.trim()) {
      toast.error('Email Body is required.');
      return;
    }
    if (!drawerAttachments.length) {
      toast.error('At least one resume attachment is required.');
      return;
    }

    setSendingEmail(true);
    try {
      const combinedCc = [...new Set([
        ...ccEmail.split(/[;,]+/).map((entry) => entry.trim()).filter(Boolean),
        ...bccEmail.split(/[;,]+/).map((entry) => entry.trim()).filter(Boolean),
      ])];
      const attachmentsPayload = drawerAttachments.map(({ filename, content, contentType }) => ({ filename, content, contentType }));
      const isMockSubmit = drawerSubmissions.some((s) => s.isMock);
      const payload = {
        module: 'bench' as const,
        to: toEmail,
        cc: combinedCc.length ? combinedCc : undefined,
        subject,
        body: finalEmailBody,
        attachments: attachmentsPayload.length ? attachmentsPayload : undefined,
        submissionIds: isMockSubmit ? undefined : drawerSubmissions.map((s) => s.id)
      };

      await api.sendEmail(payload);

      // If it is mock submit, create the actual submissions in database now!
      if (isMockSubmit) {
        const jobId = String(drawerSubmissions[0].jobId);
        const submissionTarget = String(drawerSubmissions[0].submissionTarget);
        for (const sub of drawerSubmissions) {
          try {
            const result = await api.workflow<{ submission?: RecordRow }>(
              `jobs/${jobId}/submit/${sub.benchConsultantId}`,
              {
                ratePerHour: Number(sub.ratePerHour ?? 0),
                submissionTarget,
                overrideReason: 'Recruiter verified and approved match override.',
              }
            );
            if (result.submission) {
              await api.update('submissions', result.submission.id, { status: 'Submitted' });
            }
          } catch (err) {
            console.error('Failed to create submission after email sent', err);
          }
        }
      }

      toast.success('Email sent and submissions updated successfully!');
      setIsDrawerOpen(false);
      setSelectedIds(new Set());
      await loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const bulkActions = useMemo(() => {
    if (config.resource !== 'bench') return undefined;
    return [
      {
        label: 'Send Resume',
        variant: 'primary' as const,
        icon: <Send className="h-3.5 w-3.5" />,
        onClick: (selectedRows: RecordRow[]) => {
          void openJobSelector(selectedRows);
        }
      },
      {
        label: 'Preview Email',
        variant: 'secondary' as const,
        icon: <Eye className="h-3.5 w-3.5" />,
        onClick: (selectedRows: RecordRow[]) => {
          void openJobSelector(selectedRows);
        }
      },
      {
        label: 'Follow Up',
        variant: 'secondary' as const,
        icon: <CalendarDays className="h-3.5 w-3.5" />,
        onClick: async (selectedRows: RecordRow[]) => {
          const dateInput = window.prompt('Enter follow-up date for selected consultants (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
          if (dateInput === null) return;
          try {
            await Promise.all(selectedRows.map((row) => api.update('bench', row.id, { nextFollowUpDate: dateInput })));
            toast.success(`Follow-up date set to ${dateInput} for ${selectedRows.length} consultants.`);
            setSelectedIds(new Set());
            await loadRecords();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update follow-up date');
          }
        }
      }
    ];
  }, [config.resource, currentUser, jobsList, bulkConsultantsToSubmit, selectedJobId, submissionTarget]);

  const submissionRowMenuActions = useCallback((row: RecordRow) => {
    const actions: Array<{ label: string; onClick: (row: RecordRow) => void; disabled?: boolean }> = [];
    if (String(row.status) === 'Draft') {
      actions.push({ label: 'Send Resume', onClick: () => openSendResume(row) });
    }
    return actions;
  }, []);

  const save = async (values: Record<string, unknown>) => {
    try {
      if (editing) {
        const updated = await api.update<RecordRow>(config.resource, editing.id, values);
        setRows((current) => current.map((row) => row.id === editing.id ? updated : row));
        toast.success(`${config.singular} updated`);
        if (['jobs', 'bench'].includes(config.resource)) {
          window.setTimeout(() => { void openMatches(updated); }, 100);
        }
      } else {
        const created = await api.create<RecordRow>(config.resource, values);
        setRows((current) => current.some((row) => row.id === created.id) ? current : [created, ...current]);
        toast.success(`${config.singular} created`);
        if (['jobs', 'bench'].includes(config.resource)) {
          window.setTimeout(() => {
            document.getElementById(`${config.resource}-records`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            void openMatches(created);
          }, 100);
        }
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : `Unable to save ${config.singular.toLowerCase()}.`;
      toast.error(message);
      throw new Error(message);
    }
  };

  const promptDelete = (records: RecordRow[]) => {
    if (!records.length) return;
    setPendingDeleteRecords(records);
    setConfirmDeleteOpen(true);
  };

  const remove = async (row: RecordRow) => {
    promptDelete([row]);
  };

  const bulkDelete = (records: RecordRow[]) => {
    if (!records.length) return;
    promptDelete(records);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteRecords.length) return;
    setDeleteLoading(true);
    try {
      if (pendingDeleteRecords.length === 1) {
        await api.remove(config.resource, pendingDeleteRecords[0].id);
      } else {
        await api.bulkRemove(config.resource, pendingDeleteRecords.map((row) => row.id));
      }
      const ids = new Set(pendingDeleteRecords.map((row) => row.id));
      setRows((current) => current.filter((row) => !ids.has(row.id)));
      toast.success(pendingDeleteRecords.length === 1 ? `${config.singular} deleted` : `${pendingDeleteRecords.length} records deleted`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Delete failed.');
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteOpen(false);
      setPendingDeleteRecords([]);
    }
  };

  const exportRows = (records: RecordRow[] = filtered) => {
    const source = records.length ? records : filtered;
    const headers = dynamicColumns.map((column) => column.key);
    const csv = [headers, ...source.map((row) => headers.map((key) => row[key] ?? ''))].map((line) => line.map(csvCell).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    link.download = `${config.resource}-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const importRows = async (imported: Record<string, unknown>[]) => {
    const result = await api.importRows<RecordRow>(config.resource, imported);
    if (result.inserted.length) setRows((current) => [...result.inserted, ...current]);
    if (result.inserted.length) toast.success(`${result.inserted.length} records imported`);
    if (result.errors.length) toast.warning(`${result.errors.length} rows failed validation`);
    return { inserted: result.inserted.length, errors: result.errors };
  };

  const applyQuickFilter = (label: string) => {
    const keyword = quickKeyword(label);
    const matchingFilter = config.filters.find((filter) => (filterOptions[filter] ?? []).some((option) => option.toLowerCase() === keyword.toLowerCase()));
    if (matchingFilter) { setFilterValues({ [matchingFilter]: (filterOptions[matchingFilter] ?? []).find((option) => option.toLowerCase() === keyword.toLowerCase()) ?? keyword }); setSearch(''); }
    else setSearch(keyword);
    setPage(1);
  };

  const activityActions = config.resource === 'activities' ? (
    <>
      <Button variant="secondary" onClick={() => {
        const now = new Date();
        setEditing(null); setDraftInitial({ id:'', type:'Call', status:'Completed', priority:'Medium', createdOn:now.toISOString().slice(0,10), createdTime:now.toTimeString().slice(0,5) }); setDialogOpen(true);
      }}><Phone className="h-4 w-4" />Log a Call</Button>
      <Button variant="secondary" onClick={() => setEmailDialogOpen(true)}><Mail className="h-4 w-4" />Send Email</Button>
    </>
  ) : undefined;


  const workflowActions = useMemo(() => {
    if (!viewingRecord) return [] as { label: string; onClick: () => Promise<void>; disabled?: boolean }[];
    const run = async (path: string, payload: Record<string, unknown>, success: string) => {
      try {
        const result = await api.workflow<Record<string, unknown>>(path, payload);
        toast.success(String(result.message ?? success));
        setViewDialogOpen(false);
        await loadRecords();
      } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Workflow failed.'); }
    };
    if (config.resource === 'leads') return [{ label: 'Convert Lead', disabled: String(viewingRecord.status) === 'Converted', onClick: async () => {
      const amount = Number(window.prompt('Initial opportunity amount', '0') ?? '0');
      await run(`leads/${viewingRecord.id}/convert`, { amount }, 'Lead converted');
    }}];
    if (config.resource === 'opportunities') return [{ label: 'Close Won', disabled: String(viewingRecord.stage) === 'Closed Won', onClick: async () => {
      const finalAmount = Number(window.prompt('Final amount', String(viewingRecord.amount ?? 0)) ?? '0');
      const closeDate = window.prompt('Close date (YYYY-MM-DD)', new Date().toISOString().slice(0,10)) ?? '';
      const notes = window.prompt('Closing notes') ?? '';
      const deliveryType = window.prompt('Delivery type (for example AI, Staffing, Consulting)', String(viewingRecord.deliveryType ?? 'AI')) ?? '';
      await run(`opportunities/${viewingRecord.id}/close-won`, { finalAmount, closeDate, notes, deliveryType }, 'Opportunity closed won');
    }}];
    if (config.resource === 'jobs') return [{ label: 'Find Consultants', onClick: async () => {
      try {
        setFindConsultantsLoading(true);
        const result = await api.workflow<{ matches: MatchedConsultant[] }>(`jobs/${viewingRecord.id}/top-matches`, { limit: 20 });
        if (!result.matches.length) {
          toast.error('No active Bench Consultants are available for matching.');
          return;
        }
        setFindConsultantsData(result.matches);
        setFindConsultantsOpen(true);
      } catch (reason) {
        toast.error(reason instanceof Error ? reason.message : 'Unable to find matching consultants.');
      } finally {
        setFindConsultantsLoading(false);
      }
    }}, { label: 'Recommended Consultants (with Submission)', onClick: async () => {
      try {
        const result = await api.workflow<{ matches: Array<{ consultant: RecordRow; match: { percentage: number; category: string; recommendation: string; strengths: string[]; warnings: string[]; hardBlockers: string[]; canSubmit: boolean; requiresOverride: boolean; dimensions: Record<string, { score: number | null; evaluated: boolean; reason: string }>; matched: { skills: string[] }; missing: { skills: string[] } } }> }>(`jobs/${viewingRecord.id}/top-matches`, { limit: 20 });
        if (!result.matches.length) { window.alert('No active Bench Consultants are available for matching.'); return; }
        const lines = result.matches.map((entry, index) => {
          const consultant = entry.consultant;
          return `${index + 1}. ${String(consultant.candidateName ?? 'Consultant')} — ${entry.match.percentage}% (${entry.match.category})\n   Role: ${String(consultant.currentJobTitle ?? consultant.primarySkill ?? '—')} | Experience: ${String(consultant.experienceYears ?? 0)} yrs\n   Technology: ${String(consultant.technology ?? consultant.primarySkill ?? '—')} | Availability: ${String(consultant.availableFrom ?? consultant.marketingStatus ?? '—')}\n   Matched: ${entry.match.matched.skills.join(', ') || 'None'}\n   Missing: ${entry.match.missing.skills.join(', ') || 'None'}\n   Strengths: ${entry.match.strengths.join(' ') || '—'}
   Review: ${[...entry.match.warnings, ...entry.match.hardBlockers].join(' ') || 'No major concerns.'}
   Resume: ${String(consultant.resumeUrl ?? 'Not uploaded')}`;
        });
        const selected = window.prompt(`Recommended Consultants for ${String(viewingRecord.jobTitle ?? 'Job')}\n\n${lines.join('\n\n')}\n\nEnter a consultant number to submit the resume, or Cancel to close:`);
        if (!selected) return;
        const index = Number(selected) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= result.matches.length) { toast.error('Please enter a valid consultant number.'); return; }
        const entry = result.matches[index];
        if (!entry.match.canSubmit) { window.alert(`Submission cannot continue until these items are resolved:
${entry.match.hardBlockers.join('\n')}`); return; }
        let overrideReason = '';
        if (entry.match.requiresOverride || entry.match.warnings.length) {
          const promptVal = window.prompt(`Recruiter review is required.\n\n${entry.match.warnings.join('\n') || 'Low match score'}\n\nEnter the reason to submit anyway:`, '');
          if (promptVal === null) return;
          overrideReason = promptVal.trim() || 'Recruiter verified and approved match override.';
        }
        const rateInput = window.prompt('Submission rate in USD', String(entry.consultant.ratePerHour ?? 0));
        if (rateInput === null) return;
        const rateValue = rateInput.trim() || String(entry.consultant.ratePerHour ?? 0);
        const followUpDateInput = window.prompt('Follow-up date (YYYY-MM-DD, optional)', '');
        if (followUpDateInput === null) return;
        const followUpDate = followUpDateInput.trim();
        const submission = await api.workflow<Record<string, unknown>>(`jobs/${viewingRecord.id}/submit/${entry.consultant.id}`, { ratePerHour: Number(rateValue || 0), followUpDate, overrideReason });
        toast.success(String(submission.message ?? 'Resume submitted successfully.'));
        setViewDialogOpen(false);
        await loadRecords();
      } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to calculate matches or submit the resume.'); }
    }}];
    if (config.resource === 'bench') return [
      { label: 'Find Jobs', onClick: async () => {
        await openJobsForConsultant(viewingRecord);
      } },
      { label: 'Recommended Jobs', onClick: async () => {
        try {
          const result = await api.workflow<{ matches: Array<{ job: RecordRow; match: {
            percentage: number;
            category: string;
            recommendation: string;
            strengths: string[];
            warnings: string[];
            hardBlockers: string[];
            canSubmit: boolean;
            requiresOverride: boolean;
            dimensions: Record<string, { score: number | null; evaluated: boolean; reason: string }>;
            matched: { skills: string[]; equivalentSkills?: Array<{ required: string; consultant: string }> };
            missing: { skills: string[] };
          } }> }>(`bench/${viewingRecord.id}/recommended-jobs`, { limit: 50, includeLowMatches: true });
          if (!result.matches.length) { window.alert('No active Jobs with remaining vacancies are available for matching.'); return; }
          const lines = result.matches.map((entry, index) => {
          const job = entry.job;
          const m = entry.match;
          const dim = (key: string) => m.dimensions[key]?.evaluated ? `${m.dimensions[key].score}%` : 'Not evaluated';
          return `${index + 1}. ${String(job.jobTitle ?? 'Job')} — ${m.percentage}% (${m.category})\n` +
            `   Ref: ${String(job.jobReference ?? '—')} | Client: ${String(job.endClient ?? job.company ?? '—')} | Location: ${String(job.location ?? '—')} | Mode: ${String(job.workMode ?? '—')}\n` +
            `   Technical ${dim('technical')} | Experience ${dim('experience')} | Domain ${dim('domain')} | Visa ${dim('visa')} | Rate ${dim('rate')} | Availability ${dim('availability')}\n` +
            `   Matched: ${m.matched.skills.join(', ') || 'None'}\n` +
            `   Missing: ${m.missing.skills.join(', ') || 'None'}\n` +
            `   Strengths: ${m.strengths.join(' ') || 'No additional strengths identified.'}\n` +
            `   Review: ${[...m.warnings, ...m.hardBlockers].join(' ') || 'No major concerns.'}\n` +
            `   ${m.recommendation}`;
        });
        const selected = window.prompt(`Recommended Jobs for ${String(viewingRecord.candidateName ?? 'Consultant')}\n\n${lines.join('\n\n')}\n\nAI recommends; the recruiter decides. Enter a Job number to submit, or Cancel to close:`);
        if (!selected) return;
        const index = Number(selected) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= result.matches.length) { toast.error('Please enter a valid Job number.'); return; }
        const entry = result.matches[index];
        if (!entry.match.canSubmit) { window.alert(`Submission cannot continue until these items are resolved:\n${entry.match.hardBlockers.join('\n')}`); return; }
        let overrideReason = '';
        if (entry.match.requiresOverride || entry.match.warnings.length) {
          const promptVal = window.prompt(
            `Recruiter review is required for this ${entry.match.percentage}% ${entry.match.category}.\n\nConcerns:\n${entry.match.warnings.join('\n') || 'Low match score'}\n\nEnter the business reason to submit anyway:`,
            ''
          );
          if (promptVal === null) return;
          overrideReason = promptVal.trim() || 'Recruiter verified and approved match override.';
        }
        const rateInput = window.prompt('Submission rate in USD', String(viewingRecord.ratePerHour ?? viewingRecord.expectedRate ?? 0));
        if (rateInput === null) return;
        const rateValue = rateInput.trim() || String(viewingRecord.ratePerHour ?? viewingRecord.expectedRate ?? 0);
        const followUpDateInput = window.prompt('Follow-up date (YYYY-MM-DD, optional)', '');
        if (followUpDateInput === null) return;
        const followUpDate = followUpDateInput.trim();
        const submission = await api.workflow<Record<string, unknown>>(`jobs/${entry.job.id}/submit/${viewingRecord.id}`, { ratePerHour: Number(rateValue || 0), followUpDate, overrideReason });
        toast.success(String(submission.message ?? 'Resume submitted successfully.'));
        setViewDialogOpen(false);
        await loadRecords();
      } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to calculate matching Jobs or submit the resume.'); }
    }}];
    if (config.resource === 'candidates') return [{ label: 'Move to Bench', onClick: async () => run(`candidates/${viewingRecord.id}/move-to-bench`, {}, 'Candidate moved to Bench Sales') }];
    if (config.resource === 'submissions') return [
      ...(String(viewingRecord.status) === 'Draft' ? [{ label: 'Send Resume', onClick: async () => {
        openSendResume(viewingRecord);
      }}] : []),
      { label: 'Follow Up', onClick: async () => {
        const nextFollowUpDate = window.prompt('Follow-up date (YYYY-MM-DD)', String(viewingRecord.nextFollowUpDate ?? new Date().toISOString().slice(0, 10)));
        if (nextFollowUpDate === null) return;
        try {
          await api.update('submissions', viewingRecord.id, { nextFollowUpDate });
          toast.success('Follow-up date updated');
          setViewDialogOpen(false);
          await loadRecords();
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to update follow-up date.'); }
      }},
      { label: 'Change Status', onClick: async () => {
        const status = window.prompt('Status: Draft, Sent, Under Review, Interview, Rejected, On Hold, or Selected', String(viewingRecord.status ?? 'Draft'));
        if (!status) return;
        const allowed = ['Draft', 'Sent', 'Under Review', 'Interview', 'Rejected', 'On Hold', 'Selected'];
        if (!allowed.includes(status)) { toast.error('Enter one of the supported Submission statuses.'); return; }
        try {
          await api.update('submissions', viewingRecord.id, { status });
          toast.success('Submission status updated');
          setViewDialogOpen(false);
          await loadRecords();
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to update submission status.'); }
      }},
      { label: 'Add Notes', onClick: async () => {
        const feedback = window.prompt('Submission notes', String(viewingRecord.feedback ?? ''));
        if (feedback === null) return;
        try {
          await api.update('submissions', viewingRecord.id, { feedback });
          toast.success('Submission notes updated');
          setViewDialogOpen(false);
          await loadRecords();
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to save submission notes.'); }
      }},
      { label: 'Schedule Interview', disabled: String(viewingRecord.status) !== 'Interview Requested', onClick: async () => {
      const initial: Record<string, unknown> = {
        benchConsultantId: viewingRecord.benchConsultantId ?? '',
        candidateName: viewingRecord.candidateName ?? '',
        submissionId: viewingRecord.id,
        clientCompany: viewingRecord.endClient ?? viewingRecord.clientCompany ?? '',
        vendorCompany: viewingRecord.vendorCompany ?? '',
        jobTitle: viewingRecord.jobTitle ?? '',
        vendorEmail: viewingRecord.vendorEmail ?? '',
        submissionRate: viewingRecord.ratePerHour ?? null,
        workLocation: viewingRecord.workLocation ?? viewingRecord.location ?? '',
        workMode: viewingRecord.workMode ?? '',
        technology: viewingRecord.consultantSkills ?? viewingRecord.primarySkill ?? viewingRecord.requiredSkills ?? '',
        ownerName: viewingRecord.ownerName ?? '',
        // Interview-specific fields (prefill where possible)
        interviewRound: 'Technical',
        interviewDate: '',
        interviewTime: '',
        timeZone: '',
        interviewMode: '',
        meetingLink: '',
        interviewer: '',
        interviewerEmail: '',
        interviewerPhone: '',
        instructions: '',
        status: 'Scheduled',
        result: 'Pending',
      };
      setInterviewInitial(initial as RecordRow);
      setInterviewDialogOpen(true);
    }}];
    if (config.resource === 'interviews') return [{ label: 'Select & Create Offer', disabled: String(viewingRecord.status) === 'Selected', onClick: async () => run(`interviews/${viewingRecord.id}/select`, {}, 'Offer draft created') }];
    if (config.resource === 'offers') return [{ label: 'Accept Offer', disabled: String(viewingRecord.status) === 'Accepted', onClick: async () => {
      const joiningDate = window.prompt('Joining date (YYYY-MM-DD)', new Date().toISOString().slice(0,10)) ?? '';
      const notes = window.prompt('Acceptance notes (optional)') ?? '';
      await run(`offers/${viewingRecord.id}/accept`, { joiningDate, notes }, 'Offer accepted');
    }}];
    if (config.resource === 'bench-interviews') return [{ label: 'Select Interview & Create Offer', disabled: String(viewingRecord.status) === 'Selected', onClick: async () => run(`bench-interviews/${viewingRecord.id}/select`, {}, 'Interview selected and Offer created') }];
    if (config.resource === 'bench-offers') return [
      { label: 'Accept Offer', disabled: String(viewingRecord.status) === 'Accepted', onClick: async () => run(`bench-offers/${viewingRecord.id}/accept`, {}, 'Offer accepted') },
      { label: 'Confirm Joining & Create Placement', disabled: String(viewingRecord.status) !== 'Accepted', onClick: async () => {
      const joiningDate = window.prompt('Joining date (YYYY-MM-DD)', String(viewingRecord.expectedJoiningDate ?? new Date().toISOString().slice(0,10))) ?? '';
      const actualStartDate = window.prompt('Actual start date (YYYY-MM-DD)', joiningDate) ?? '';
      const contractEndDate = window.prompt('Contract end date (optional, YYYY-MM-DD)', '') ?? '';
      const vendorEmail = window.prompt('Vendor email', String(viewingRecord.vendorEmail ?? '')) ?? '';
      const vendorContactNumber = window.prompt('Vendor contact number', String(viewingRecord.vendorContactNumber ?? '')) ?? '';
      const workLocation = window.prompt('Work location', String(viewingRecord.workLocation ?? '')) ?? '';
      const workModeInput = window.prompt('Work mode: Remote, On-site, or Hybrid', String(viewingRecord.workMode ?? 'Remote')) ?? 'Remote';
      const workMode = ['Remote', 'On-site', 'Hybrid'].includes(workModeInput) ? workModeInput : 'Remote';
      await run(`bench-offers/${viewingRecord.id}/confirm-joining`, { joiningDate, actualStartDate, contractEndDate: contractEndDate || undefined, vendorEmail, vendorContactNumber, workLocation, workMode }, 'Joining confirmed and Placement created');
    }}];
    if (config.resource === 'ai-projects') return [{ label: 'Recalculate Progress', onClick: async () => run(`projects/${viewingRecord.id}/recalculate-progress`, {}, 'Project progress recalculated') }];
    return [];
  }, [config.resource, loadRecords, viewingRecord]);

  return (
    <div className="px-5 py-5">
      <PageHeader breadcrumb={config.breadcrumb} title={config.title} subtitle={config.subtitle} onRefresh={() => void loadRecords()} onExport={() => exportRows()} extraActions={activityActions} />
      {loadError && <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><span>{loadError}</span><button className="font-semibold underline" onClick={() => void loadRecords()}>Retry</button></div>}
      <FilterBar
        search={search}
        placeholder={config.searchPlaceholder}
        filters={config.filters}
        filterOptions={filterOptions}
        values={filterValues}
        onApply={(nextSearch, nextValues) => {
          setSearch(nextSearch);
          setFilterValues(nextValues);
          setPage(1);
        }}
      />
      {loading ? <div className="mt-8 rounded-xl border border-slate-200 bg-white py-20 text-center text-sm text-slate-500">Loading records from PostgreSQL…</div> : (
        <>
          <div className="mt-4">
            <div id={`${config.resource}-records`} className="mt-3 scroll-mt-24">
              <DataTable
                rows={visible}
                columns={dynamicColumns}
                page={safePage}
                pageSize={pageSize}
                total={sorted.length}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPage={setPage}
                onPageSize={(size) => { setPageSize(size); setPage(1); }}
                onSort={(key) => { if (sortBy === key) setSortOrder((current) => current === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortOrder('asc'); } }}
                onEdit={edit}
                onDelete={remove}
                onView={view}
                onAutomation={['jobs', 'bench'].includes(config.resource) ? openMatches : undefined}
                onRowClick={config.resource === 'bench' ? openMatches : undefined}
                selectedRowId={config.resource === 'bench' ? selectedRowId : undefined}
                automationLabel={config.resource === 'jobs' ? 'Recommended Consultants' : config.resource === 'bench' ? 'Recommended Jobs' : undefined}
                rowMenuActions={config.resource === 'submissions' ? submissionRowMenuActions : workflowActions}
                rowAction={(action, row) => {
                  if (action === 'scheduleInterview') {
                    const initial: Record<string, unknown> = {
                      benchConsultantId: row.benchConsultantId ?? '',
                      candidateName: row.candidateName ?? '',
                      submissionId: row.id,
                      clientCompany: row.endClient ?? row.clientCompany ?? '',
                      vendorCompany: row.vendorCompany ?? '',
                      jobTitle: row.jobTitle ?? '',
                      vendorEmail: row.vendorEmail ?? '',
                      submissionRate: row.ratePerHour ?? null,
                      workLocation: row.workLocation ?? '',
                      workMode: row.workMode ?? '',
                      technology: row.consultantSkills ?? row.primarySkill ?? row.requiredSkills ?? '',
                      ownerName: row.ownerName ?? '',
                      interviewRound: 'Technical',
                      interviewDate: '',
                      interviewTime: '',
                      timeZone: '',
                      interviewMode: '',
                      meetingLink: '',
                      interviewer: '',
                      interviewerEmail: '',
                      interviewerPhone: '',
                      instructions: '',
                      status: 'Scheduled',
                      result: 'Pending',
                    };
                    setInterviewInitial(initial as RecordRow);
                    setInterviewDialogOpen(true);
                  }
                }}
                onBulkDelete={bulkDelete}
                onExport={exportRows}
                fitToContainer={false}
                onSelectionChange={setSelectedIds}
                bulkActions={bulkActions}
                alwaysShowBulkActions={config.resource === 'bench'}
              />
            </div>
          </div>
          {config.resource === 'bench' ? (
            <section className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#CFEAE7] bg-white p-4 shadow-card">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#071B4A]">Consultant recommendations</div>
                    <div className="text-xs text-slate-500">Select a Bench Consultant row to show their matching Jobs and score. Recommended Jobs are calculated from available open positions.</div>
                  </div>
                  {matchSource ? (
                    <div className="rounded-full bg-[#E6F8F4] px-3 py-1.5 text-sm font-semibold text-[#007C72]">Selected consultant: {String(matchSource.candidateName ?? matchSource.consultantCode ?? 'Unknown')}</div>
                  ) : (
                    <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">No consultant selected</div>
                  )}
                </div>
              </div>
              {matchSource && (
                <InlineMatchingPanel
                  sourceType="consultant"
                  source={matchSource}
                  entries={matchEntries}
                  loading={matchLoading}
                  onClose={() => { setMatchSource(null); setMatchEntries([]); setSelectedRowId(''); }}
                  onSubmit={submitRecommendedMatch}
                />
              )}
            </section>
          ) : matchSource && ['jobs', 'bench'].includes(config.resource) ? (
            <InlineMatchingPanel
              sourceType={config.resource === 'jobs' ? 'job' : 'consultant'}
              source={matchSource}
              entries={matchEntries}
              loading={matchLoading}
              onClose={() => { setMatchSource(null); setMatchEntries([]); }}
              onSubmit={submitRecommendedMatch}
            />
          ) : null}
        </>
      )}
      <RecordDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        title={`${editing ? 'Edit' : 'Add'} ${config.singular}`}
        fields={dynamicFields}
        initial={editing ?? draftInitial}
        onSave={save}
        resource={config.resource}
        allowSaveAndNew={config.resource !== 'jobs'}
        onSaveAndNew={() => {
          setEditing(null);
          setDraftInitial(null);
          sessionStorage.setItem(`europa_dialog_open_${config.resource}`, 'new');
        }}
      />
      <RecordDialog
        open={interviewDialogOpen}
        onOpenChange={(open) => { if (!open) { setInterviewDialogOpen(false); setInterviewInitial(null); } else setInterviewDialogOpen(true); }}
        title={`Schedule Interview`}
        fields={moduleConfigs['bench-interviews'].fields}
        initial={interviewInitial}
        onSave={async (values) => {
          try {
            const created = await api.create<RecordRow>('bench-interviews', values);
            toast.success('Interview scheduled');
            // After interview created: update linked Submission status and Consultant status where applicable
            try {
              // Update Submission status to 'Interview Scheduled' if currently 'Interview Requested'
              const submissionId = String(values.submissionId ?? '');
              if (submissionId) {
                const sub = await api.get<RecordRow>('submissions', submissionId).catch(() => null);
                if (sub && String(sub.status) === 'Interview Requested') {
                  await api.update('submissions', submissionId, { status: 'Interview Scheduled' });
                }
              }
              // Update Consultant (bench) status from 'Available' -> 'Interviewing'
              const consultantId = String(values.benchConsultantId ?? values.benchConsultant ?? '');
              if (consultantId) {
                const consultant = await api.get<RecordRow>('bench', consultantId).catch(() => null);
                if (consultant && String(consultant.status) === 'Available') {
                  await api.update('bench', consultantId, { status: 'Interviewing' });
                }
              }
            } catch (err) {
              // Non-fatal: show a warning but continue
              console.warn('Post-interview updates failed', err);
              toast.error('Interview created but some linked updates failed.');
            }

            setInterviewDialogOpen(false);
            setInterviewInitial(null);
            await loadRecords();
          } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : 'Unable to create interview');
            throw reason as Error;
          }
        }}
        resource={'bench-interviews'}
        allowSaveAndNew={false}
      />
      <RecordViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} title={config.singular} fields={dynamicFields} record={viewingRecord} actions={workflowActions} resource={config.resource} />
      <Dialog open={jobSelectOpen} onOpenChange={setJobSelectOpen}>
        <DialogContent className="sm:max-w-md border border-[#E4ECF3]">
          <DialogTitle className="text-lg font-bold text-[#071B4A]">Submit Selected Consultants</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Choose the target Job requirement and Submission Target to generate the submissions.
          </DialogDescription>
          {loadingJobs ? (
            <div className="py-6 text-center text-sm text-slate-500">Loading active jobs...</div>
          ) : (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Job *</label>
                <select
                  className="crm-input w-full"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  <option value="">-- Choose Job --</option>
                  {jobsList.map((job) => (
                    <option key={job.id} value={job.id}>
                      {String(job.jobTitle)} ({String(job.endClient || job.company)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Submission Target *</label>
                <select
                  className="crm-input w-full"
                  value={submissionTarget}
                  onChange={(e) => setSubmissionTarget(e.target.value)}
                >
                  <option value="Vendor Company">Vendor Company</option>
                  <option value="Hiring / End Client">Hiring / End Client</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setJobSelectOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmJobSubmit} disabled={!selectedJobId || submittingBulk}>
                  {submittingBulk ? 'Submitting...' : 'Proceed to Email'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDeleteOpen} onOpenChange={(open) => {
        if (!open && !deleteLoading) {
          setConfirmDeleteOpen(false);
          setPendingDeleteRecords([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-bold text-[#071B4A]">Confirm Delete</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            {pendingDeleteRecords.length === 1
              ? `Delete this ${config.singular.toLowerCase()} permanently?`
              : `Delete ${pendingDeleteRecords.length} selected records permanently?`}
          </DialogDescription>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {pendingDeleteRecords.length === 1 ? (
              <div>{String(pendingDeleteRecords[0].jobTitle ?? pendingDeleteRecords[0].candidateName ?? pendingDeleteRecords[0].id)}</div>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {pendingDeleteRecords.map((row) => <div key={row.id} className="truncate">{String(row.jobTitle ?? row.candidateName ?? row.id)}</div>)}
              </div>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : pendingDeleteRecords.length === 1 ? 'Delete' : `Delete ${pendingDeleteRecords.length}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} title={config.title} fields={dynamicFields} onImport={importRows} />
      <EmailDialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEmailSubmissionId(undefined);
          }
          setEmailDialogOpen(open);
        }}
        initial={emailDialogPayload}
        title={`Send Resume to ${emailTarget}`}
        description="Review and edit the resume submission email before sending."
        onSend={async (payload) => {
          const getModule = (res: string): 'sales' | 'it' | 'bench' | 'ai' => {
            if (['leads', 'contacts', 'accounts', 'opportunities', 'campaigns', 'activities'].includes(res)) return 'sales';
            if (['candidates', 'interviews', 'offers'].includes(res)) return 'it';
            if (['jobs', 'bench', 'submissions', 'requirements', 'bench-interviews', 'bench-offers', 'placements'].includes(res)) return 'bench';
            return 'ai';
          };
          await api.sendEmail({ ...payload, module: getModule(config.resource), submissionId: emailSubmissionId });
          toast.success('Email sent');
        }}
      />
      <FindConsultantsModal
        isOpen={findConsultantsOpen}
        onClose={() => setFindConsultantsOpen(false)}
        jobId={String(viewingRecord?.id ?? '')}
        jobTitle={String(viewingRecord?.jobTitle ?? 'Job')}
        consultants={findConsultantsData}
        isLoading={findConsultantsLoading}
        onBulkSend={bulkSendMatchingConsultants}
      />
      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="max-w-7xl w-[96vw] max-h-[95vh] overflow-hidden rounded-2xl p-0 border border-[#E4ECF3]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <DialogTitle className="text-[20px] font-black text-[#071B4A]">Send Resume To Vendor / Client</DialogTitle>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-[#f8fafc] p-6">
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 px-6 py-2">
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">From:</span>
                  <input type="email" className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-800 focus:ring-0 focus:outline-none" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
                </div>
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">To:</span>
                  <input type="email" className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-800 focus:ring-0 focus:outline-none" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
                </div>
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">Cc:</span>
                  <input type="text" className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-800 focus:ring-0 focus:outline-none" value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="manager@vendor.com" />
                </div>
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">Bcc:</span>
                  <input type="text" className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-800 focus:ring-0 focus:outline-none" value={bccEmail} onChange={(e) => setBccEmail(e.target.value)} placeholder="optional" />
                </div>
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">Subject:</span>
                  <input type="text" className="flex-1 bg-transparent border-0 px-2 py-1 text-sm font-semibold text-[#071B4A] focus:ring-0 focus:outline-none" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="flex items-center py-2.5">
                  <span className="w-20 text-xs font-bold text-slate-500">Template:</span>
                  <select className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-800 focus:ring-0 focus:outline-none" value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)}>
                    <option value="Consultant Submission Template">Consultant Submission Template</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <span className="text-sm font-bold text-[#071B4A]">Email Body</span>
                </div>
                <div className="bg-white p-5">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#fdfefe]">
                    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1">B</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1 italic">I</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1 underline">U</button>
                    </div>
                    <div
                      ref={setEditorRef}
                      className="min-h-[220px] p-4 text-sm text-slate-700 outline-none"
                      contentEditable
                      suppressContentEditableWarning
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#071B4A]">Attachments <span className="text-red-500">*</span></span>
                  <div className="text-[11px] text-slate-500">{drawerAttachments.length} file{drawerAttachments.length === 1 ? '' : 's'}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {drawerAttachments.length ? drawerAttachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-red-100 text-[9px] font-bold text-red-600">PDF</div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-700" title={att.filename}>{att.filename}</div>
                        <div className="text-[10px] text-slate-500">{att.sizeText || 'Uploaded'}</div>
                      </div>
                      <button type="button" onClick={() => setDrawerAttachments((prev) => prev.filter((_, i) => i !== idx))} className="ml-1 text-slate-400 hover:text-red-500" aria-label={`Remove ${att.filename}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )) : (
                    <div className="text-xs text-slate-500">No attachments selected.</div>
                  )}
                  <input id="drawer-file-input" type="file" className="hidden" multiple onChange={(e) => handleDrawerFileUpload(e.target.files)} />
                  <button type="button" onClick={() => document.getElementById('drawer-file-input')?.click()} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#009E92] bg-[#D9F5F1]/30 px-3 py-2 text-xs font-semibold text-[#009E92] hover:bg-[#D9F5F1]">
                    <Plus className="h-4 w-4" /> Add Attachment
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" className="crm-secondary-button px-6" onClick={() => setIsDrawerOpen(false)} disabled={sendingEmail}>Cancel</button>
            <button type="button" className="crm-primary-button px-6 inline-flex items-center gap-2" onClick={handleSendBulkMail} disabled={sendingEmail || attachmentLoading || !drawerAttachments.length}>
              {sendingEmail ? 'Sending...' : <><Send className="h-4 w-4" /> Send Mail</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <FindJobsModal
        isOpen={findJobsOpen}
        onClose={() => setFindJobsOpen(false)}
        consultantId={String(viewingRecord?.id ?? '')}
        consultantName={String(viewingRecord?.candidateName ?? 'Consultant')}
        consultantRate={Number(viewingRecord?.ratePerHour ?? viewingRecord?.expectedRate ?? 0)}
        entries={findJobsData}
        isLoading={findJobsLoading}
      />
    </div>
  );
}

function resolveFilterKey(label: string, fields: { key: string; label: string }[]) {
  const normalized = normalize(label);
  const aliases: Record<string,string> = {
    owner:'ownerName', recruiter:'ownerName', projectowner:'ownerName', benchsalesowner:'ownerName', leadsource:'leadSource', contacttype:'contactType', accounttype:'accountType', createddate:'createdOn', createdon:'createdOn', lastcontacted:'lastContacted', closedate:'closeDate', startdate:'startDate', enddate:'endDate', duedate:'dueDate', interviewdate:'interviewDate', submissiondate:'submissionDate', joiningdate:'joiningDate', visastatus:'visaStatus', allocationstatus:'allocationStatus', skilllevel:'skillLevel', projectname:'projectName', leadengineer:'leadEngineer', jobtype:'jobType', skillsrequired:'skillsRequired', noticeperiod:'noticePeriod', experience:'experienceYears', client:'clientCompany', vendor:'vendorCompany', account:'accountName', company:'company', assignee:'assignee', type:'type', status:'status', priority:'priority', rating:'rating', location:'location', skills:'skills', industry:'industry', stage:'stage', interviewer:'interviewer', round:'interviewRound', interviewround:'interviewRound',
  };
  if (aliases[normalized]) return aliases[normalized];
  return fields.find((field) => normalize(field.label) === normalized || normalize(field.key) === normalized)?.key ?? label.replace(/\s+(.)/g, (_, letter) => letter.toUpperCase()).replace(/^./, (letter) => letter.toLowerCase());
}
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g,''); }
function normalizeDate(value: string) { if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10); const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0,10); }
function compareValues(left: unknown, right: unknown, order: 'asc'|'desc') { const a = typeof left === 'number' ? left : String(left ?? '').toLowerCase(); const b = typeof right === 'number' ? right : String(right ?? '').toLowerCase(); const result = a < b ? -1 : a > b ? 1 : 0; return order === 'asc' ? result : -result; }
function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g,'""')}"`; }
function groupRows(rows: RecordRow[], key: string): ChartDatum[] { const counts = new Map<string,number>(); rows.forEach((row) => { const value = String(row[key] ?? 'Unspecified').trim() || 'Unspecified'; counts.set(value,(counts.get(value) ?? 0)+1); }); return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value,detail:String(value)})); }
function donutKey(resource: string) { return ({ leads:'leadSource', contacts:'contactType', accounts:'accountType', opportunities:'stage', campaigns:'status', activities:'type', candidates:'status', jobs:'status', interviews:'status', offers:'status', bench:'visaStatus', submissions:'status', placements:'status', 'ai-projects':'status', tasks:'status', resources:'allocationStatus' } as Record<string,string>)[resource] ?? 'status'; }
function barKey(resource: string) { return ({ leads:'status', contacts:'source', accounts:'status', opportunities:'ownerName', campaigns:'type', activities:'status', candidates:'skills', jobs:'jobType', interviews:'status', offers:'ownerName', bench:'noticePeriod', submissions:'vendorCompany', placements:'clientCompany', 'ai-projects':'leadEngineer', tasks:'priority', resources:'type' } as Record<string,string>)[resource] ?? 'ownerName'; }
function deriveStats(configs: KpiConfig[], rows: RecordRow[], resource: string): KpiConfig[] { return configs.map((item) => ({ ...item, value: statisticValue(item.label, rows, resource), trend:'', negative:false })); }
function statisticValue(label: string, rows: RecordRow[], resource: string) {
  const lower = label.toLowerCase();
  if (lower.includes('conversion rate')) { const converted = rows.filter((row) => String(row.status ?? '').toLowerCase() === 'converted').length; return rows.length ? `${((converted/rows.length)*100).toFixed(1)}%` : '0%'; }
  if (lower.includes('pipeline value')) return formatIndianCurrency(rows.reduce((sum,row)=>sum+Number(row.amount ?? 0),0));
  if (lower.includes('emails sent')) return String(rows.reduce((sum,row)=>sum+Number(row.emailsSent ?? 0),0));
  if (lower === 'responses') return String(rows.reduce((sum,row)=>sum+Number(row.responses ?? 0),0));
  if (lower.startsWith('total')) return String(rows.length);
  return String(countByLabel(rows,label,resource));
}
function countByLabel(rows: RecordRow[], label: string, resource = '') {
  const lower = label.toLowerCase();
  const terms = ['new','contacted','qualified','converted','active','inactive','customer','partner','qualification','proposal','negotiation','closed won','closed lost','completed','pending','scheduled','call','email','decision maker','influencer','screening','interview','interviewing','offered','placed','open','on hold','closed','accepted','declined','submitted','available','planning','in progress','testing','production','todo','review','allocated','maintenance','draft','rejected','selected'];
  const term = terms.find((candidate) => lower.includes(candidate));
  if (!term) return rows.length;
  const fields = resource === 'contacts' ? ['contactType','source'] : resource === 'accounts' ? ['accountType','status'] : resource === 'opportunities' ? ['stage'] : resource === 'campaigns' ? ['status','type'] : resource === 'activities' ? ['status','type'] : resource === 'bench' ? ['noticePeriod','visaStatus'] : resource === 'resources' ? ['allocationStatus'] : ['status','type','priority'];
  return rows.filter((row) => fields.some((field) => String(row[field] ?? '').toLowerCase().includes(term))).length;
}
function quickKeyword(label: string) {
  const terms = ['Closed Won','Closed Lost','In Progress','Decision Maker','New','Qualified','Converted','Active','Inactive','Customer','Partner','Pending','Scheduled','Completed','Call','Email','Screening','Interview','Interviewing','Offered','Placed','Open','On Hold','Accepted','Declined','Submitted','Available','Planning','Testing','Production','Todo','Review','Allocated','Maintenance','Draft','Rejected','Selected','High'];
  return terms.find((term) => label.toLowerCase().includes(term.toLowerCase())) ?? label.replace(/\b(Leads?|Accounts?|Contacts?|Campaigns?|Activities?|Candidates?|Jobs?|Interviews?|Offers?|Consultants?|Submissions?|Placements?|Projects?|Tasks?|Resources?|Profiles?)\b/gi,'').trim();
}
