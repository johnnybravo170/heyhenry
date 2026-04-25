const TZ = 'America/Vancouver';

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  // Bare YYYY-MM-DD: render as-is, don't TZ-shift.
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-');
    return `${y}-${m}-${day}`;
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—';
  // Bare YYYY-MM-DD: render as-is, don't TZ-shift.
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [, m, day] = d.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-CA', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const formatted = date.toLocaleString('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatted} PT`;
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-CA', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtAgo(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(date);
}
