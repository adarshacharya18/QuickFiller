import { JobApplication } from '../types/applications';

/**
 * Escapes a field according to RFC 4180 CSV specifications.
 * Wraps values containing commas, quotes, or newlines in quotes,
 * and doubles any existing double-quotes.
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '""';
  }
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Formats an array of JobApplication objects into a UTF-8 CSV string with BOM.
 */
export function generateApplicationsCsv(applications: JobApplication[]): string {
  const headers = [
    'Company',
    'Job Title',
    'Status',
    'Applied Date',
    'Location',
    'Salary',
    'Job URL',
    'Portal URL',
    'Notes',
  ];

  const headerRow = headers.map(escapeCsvField).join(',');

  const rows = applications.map((app) => {
    return [
      escapeCsvField(app.company),
      escapeCsvField(app.title),
      escapeCsvField(app.status),
      escapeCsvField(app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : ''),
      escapeCsvField(app.location || ''),
      escapeCsvField(app.salary || ''),
      escapeCsvField(app.url || ''),
      escapeCsvField(app.portalUrl || ''),
      escapeCsvField(app.notes || ''),
    ].join(',');
  });

  // Prepend UTF-8 Byte Order Mark (BOM) \uFEFF for proper encoding in Excel & Sheets
  return '\uFEFF' + [headerRow, ...rows].join('\r\n');
}

/**
 * Triggers a browser download of the generated CSV file.
 */
export function downloadApplicationsCsv(
  applications: JobApplication[],
  customFilename?: string
): void {
  const csvContent = generateApplicationsCsv(applications);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `quickfiller-job-applications-${dateStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
