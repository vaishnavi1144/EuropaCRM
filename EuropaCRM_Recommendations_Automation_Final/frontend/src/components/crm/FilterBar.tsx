import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, Search } from 'lucide-react';

export function FilterBar({ search, placeholder, filters, filterOptions, values, onApply }: {
  search: string;
  placeholder: string;
  filters: string[];
  filterOptions: Record<string, string[]>;
  values: Record<string, string>;
  onApply: (search: string, values: Record<string, string>) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [draftSearch, setDraftSearch] = useState(search);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(values);

  useEffect(() => setDraftSearch(search), [search]);
  useEffect(() => setDraftValues(values), [values]);

  const visibleFilters = showMore ? filters : [];
  const hasChanges = useMemo(
    () => draftSearch !== search || JSON.stringify(draftValues) !== JSON.stringify(values),
    [draftSearch, draftValues, search, values],
  );

  return (
    <div className="rounded-xl border border-[#E4ECF3] bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[360px] max-w-full shrink-0">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onApply(draftSearch.trim(), draftValues);
            }}
            className="crm-input pr-10 text-[11px]"
            placeholder={placeholder}
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>

        {visibleFilters.map((filter) => {
          const isDate = filter.toLowerCase().includes('date') || filter.toLowerCase().includes('available from');
          return isDate ? (
            <label key={filter} className="relative">
              <span className="sr-only">{filter}</span>
              <input
                title={filter}
                aria-label={filter}
                type="date"
                value={draftValues[filter] ?? ''}
                onChange={(event) => setDraftValues((current) => ({ ...current, [filter]: event.target.value }))}
                className="crm-select min-w-[155px] pr-8 text-[11px]"
              />
              <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>
          ) : (
            <select
              key={filter}
              aria-label={filter}
              title={filter}
              value={draftValues[filter] ?? ''}
              onChange={(event) => setDraftValues((current) => ({ ...current, [filter]: event.target.value }))}
              className="crm-select min-w-[135px] text-[11px]"
            >
              <option value="">All {filter}</option>
              {(filterOptions[filter] ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          );
        })}

        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore((current) => !current)}
            className={`crm-secondary-button h-10 px-4 text-[11px] ${showMore ? 'bg-[#D9F5F1]' : ''}`}
          >
            <Filter className="h-4 w-4" />{showMore ? 'Hide Filters' : 'Filters'}
          </button>
        )}

        <button
          type="button"
          onClick={() => onApply(draftSearch.trim(), draftValues)}
          className="crm-primary-button h-10 px-5 text-[11px]"
          title={hasChanges ? 'Apply the selected search and filters' : 'Refresh using the current filters'}
        >
          <Filter className="h-4 w-4" />Apply Filters
        </button>
      </div>
    </div>
  );
}
