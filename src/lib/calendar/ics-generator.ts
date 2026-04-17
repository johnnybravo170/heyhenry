/**
 * Generate RFC 5545 iCalendar (.ics) strings for job events.
 *
 * Pure functions with no side effects. Used for:
 * 1. Single-event .ics attachments sent to customers on booking
 * 2. Multi-event iCal feed for calendar subscriptions
 */

export type IcsEventOptions = {
  jobId: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime?: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail?: string;
  attendeeName?: string;
  status?: 'CONFIRMED' | 'CANCELLED';
};

/**
 * Escape special characters per RFC 5545 Section 3.3.11.
 * Backslash, semicolons, commas, and newlines need escaping.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Format a Date as an iCal UTC datetime string: `20260420T140000Z`
 */
function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generate a DTSTAMP for the current moment.
 */
function dtstamp(): string {
  return formatIcsDate(new Date());
}

/**
 * Generate a single VEVENT block.
 */
function buildVevent(opts: IcsEventOptions): string {
  const endTime = opts.endTime ?? new Date(opts.startTime.getTime() + 2 * 60 * 60 * 1000);
  const status = opts.status ?? 'CONFIRMED';

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${opts.jobId}@heyhenry.io`,
    `DTSTAMP:${dtstamp()}`,
    `DTSTART:${formatIcsDate(opts.startTime)}`,
    `DTEND:${formatIcsDate(endTime)}`,
    `SUMMARY:${escapeIcsText(opts.summary)}`,
  ];

  if (opts.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(opts.description)}`);
  }

  if (opts.location) {
    lines.push(`LOCATION:${escapeIcsText(opts.location)}`);
  }

  lines.push(`ORGANIZER;CN=${escapeIcsText(opts.organizerName)}:mailto:${opts.organizerEmail}`);

  if (opts.attendeeEmail) {
    const cn = opts.attendeeName ? escapeIcsText(opts.attendeeName) : opts.attendeeEmail;
    lines.push(`ATTENDEE;CN=${cn}:mailto:${opts.attendeeEmail}`);
  }

  lines.push(`STATUS:${status}`);
  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * Generate a complete .ics string for a single job event.
 * Suitable for email attachment.
 */
export function generateJobIcs(opts: IcsEventOptions): string {
  const method = opts.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeyHenry//Jobs//EN',
    `METHOD:${method}`,
    buildVevent(opts),
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Generate a multi-event .ics feed string.
 * Used for the iCal subscription endpoint.
 */
export function generateCalendarFeed(events: IcsEventOptions[], calendarName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeyHenry//Jobs//EN',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    lines.push(buildVevent(event));
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
