export type ApplicationStatus =
  | 'Bookmarked'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Rejected';

export interface JobApplication {
  id: string;
  company: string;
  title: string;
  url: string;
  portalUrl?: string; // Company candidate tracking portal URL (e.g. Workday Candidate Home, SmartRecruiters)
  appliedDate: string; // ISO 8601 string, e.g. "2026-09-13T16:50:00.000Z"
  status: ApplicationStatus;
  location?: string;
  salary?: string;
  notes?: string;
  updatedAt: string; // ISO 8601 string
}

export const APPLICATION_STATUS_COLORS: Record<
  ApplicationStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  Bookmarked: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Applied: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  Interviewing: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  Offer: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Rejected: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};
