import { describe, expect, it } from 'vitest';
import { generateCalendarFeed, generateJobIcs } from '@/lib/calendar/ics-generator';

const baseOpts = {
  jobId: '550e8400-e29b-41d4-a716-446655440000',
  summary: "Pressure Washing — Will's PW",
  description: 'Driveway and walkway',
  location: '123 Main St, Vancouver, BC',
  startTime: new Date('2026-04-20T14:00:00Z'),
  organizerName: "Will's Pressure Washing",
  organizerEmail: 'noreply@heyhenry.io',
  attendeeEmail: 'customer@example.com',
  attendeeName: 'Jane Doe',
};

describe('generateJobIcs', () => {
  it('produces a valid iCalendar string', () => {
    const ics = generateJobIcs(baseOpts);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//HeyHenry//Jobs//EN');
  });

  it('uses METHOD:REQUEST for confirmed events', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('uses METHOD:CANCEL for cancelled events', () => {
    const ics = generateJobIcs({ ...baseOpts, status: 'CANCELLED' });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('formats the UID correctly', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('UID:550e8400-e29b-41d4-a716-446655440000@heyhenry.io');
  });

  it('formats DTSTART in UTC', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('DTSTART:20260420T140000Z');
  });

  it('defaults endTime to 2 hours after startTime', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('DTEND:20260420T160000Z');
  });

  it('uses explicit endTime when provided', () => {
    const ics = generateJobIcs({
      ...baseOpts,
      endTime: new Date('2026-04-20T17:00:00Z'),
    });
    expect(ics).toContain('DTEND:20260420T170000Z');
  });

  it('escapes special characters in summary', () => {
    const ics = generateJobIcs({
      ...baseOpts,
      summary: 'Wash, scrub; clean\\done',
    });
    expect(ics).toContain('SUMMARY:Wash\\, scrub\\; clean\\\\done');
  });

  it('escapes newlines in description', () => {
    const ics = generateJobIcs({
      ...baseOpts,
      description: 'Line 1\nLine 2',
    });
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2');
  });

  it('includes ORGANIZER and ATTENDEE', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain("ORGANIZER;CN=Will's Pressure Washing:mailto:noreply@heyhenry.io");
    expect(ics).toContain('ATTENDEE;CN=Jane Doe:mailto:customer@example.com');
  });

  it('includes LOCATION when provided', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('LOCATION:123 Main St\\, Vancouver\\, BC');
  });

  it('omits DESCRIPTION when not provided', () => {
    const { description: _, ...opts } = baseOpts;
    const ics = generateJobIcs(opts);
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('omits LOCATION when not provided', () => {
    const { location: _, ...opts } = baseOpts;
    const ics = generateJobIcs(opts);
    expect(ics).not.toContain('LOCATION:');
  });

  it('uses CRLF line endings', () => {
    const ics = generateJobIcs(baseOpts);
    expect(ics).toContain('\r\n');
    // Should not have bare LF (outside CRLF)
    const withoutCrlf = ics.replace(/\r\n/g, '');
    expect(withoutCrlf).not.toContain('\n');
  });
});

describe('generateCalendarFeed', () => {
  it('generates a multi-event feed', () => {
    const events = [
      { ...baseOpts, jobId: 'job-1' },
      { ...baseOpts, jobId: 'job-2', summary: 'Roof cleaning' },
    ];
    const feed = generateCalendarFeed(events, "Will's PW Calendar");

    expect(feed).toContain('METHOD:PUBLISH');
    expect(feed).toContain("X-WR-CALNAME:Will's PW Calendar");
    expect(feed).toContain('UID:job-1@heyhenry.io');
    expect(feed).toContain('UID:job-2@heyhenry.io');

    // Exactly one VCALENDAR wrapper
    const calStarts = feed.split('BEGIN:VCALENDAR').length - 1;
    expect(calStarts).toBe(1);

    // Two VEVENTs
    const eventStarts = feed.split('BEGIN:VEVENT').length - 1;
    expect(eventStarts).toBe(2);
  });

  it('generates a valid feed with zero events', () => {
    const feed = generateCalendarFeed([], 'Empty');
    expect(feed).toContain('BEGIN:VCALENDAR');
    expect(feed).toContain('END:VCALENDAR');
    expect(feed).not.toContain('BEGIN:VEVENT');
  });
});
