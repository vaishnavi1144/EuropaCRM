export type RecordRow = {
  id: string;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
};

export type FieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'relation' | 'file' | 'checkbox';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  section?: string;
  relationResource?: string;
  relationValueKey?: string;
  relationLabelKey?: string;
  relationSubtitleKey?: string;
  autofill?: Record<string, string>;
  readOnly?: boolean;
  visibleWhen?: { key: string; equals: string };
  relationStatusKey?: string;
  relationAllowedStatuses?: string[];
  relationFilterSourceKey?: string;
  relationFilterTargetKey?: string;
};

export type ColumnConfig = {
  key: string;
  label: string;
  width?: string;
  render?: 'person' | 'badge' | 'rating' | 'probability' | 'currency' | 'titleSubtitle' | 'account' | 'dateTime' | 'schedule';
  subtitleKey?: string;
  badgeTone?: 'auto' | 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'gray';
  sortable?: boolean;
};

export type KpiConfig = {
  label: string;
  value: string;
  trend: string;
  icon: string;
  negative?: boolean;
};

export type ChartDatum = { name: string; value: number; color?: string; detail?: string };

export type ModuleConfig = {
  resource: string;
  breadcrumb: string;
  title: string;
  subtitle: string;
  singular: string;
  searchPlaceholder: string;
  primaryLabel: string;
  importLabel: string;
  stats: KpiConfig[];
  filters: string[];
  columns: ColumnConfig[];
  fields: FieldConfig[];
  rows: RecordRow[];
  donutTitle: string;
  donutData: ChartDatum[];
  barTitle: string;
  barData: ChartDatum[];
  quickFilters: { label: string; value: string }[];
};
