export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getDateDifference(plannedDate: string, actualDate: string | null): number {
  if (!actualDate) return 0;
  const planned = new Date(plannedDate);
  const actual = new Date(actualDate);
  const diffTime = actual.getTime() - planned.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDateColor(daysDiff: number): string {
  if (daysDiff === 0) return 'text-green-600';
  if (daysDiff <= 2) return 'text-yellow-600';
  if (daysDiff <= 5) return 'text-orange-600';
  return 'text-red-600';
}

export function getRowBackgroundColor(daysDiff: number): string {
  if (daysDiff === 0) return 'on-time';
  if (daysDiff <= 2) return 'slight-delay';
  if (daysDiff <= 5) return 'moderate-delay';
  return 'significant-delay';
}

