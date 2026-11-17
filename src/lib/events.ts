// Reads events from the Wild Apricot admin API at build time.
// The API key is read-only and never reaches the browser: this code only runs
// while the site is being built.
import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import site from '../data/site.json';
import { weekday } from './dates';

const API = 'https://api.wildapricot.org/v2.2';
const CACHE_FILE = path.resolve('.cache/wa-events.json');
const CACHE_MINUTES = 30;

export type Category = 'retreats' | 'special' | 'weekly' | 'other';
export const CATEGORY_LABELS: Record<Category, string> = {
  retreats: 'Retreats & Study',
  special: 'Special Events',
  weekly: 'Weekly Programs',
  other: 'Sangha Business',
};

export interface Occurrence { start: Date; end: Date | null; hasTime: boolean }
export interface RegType { name: string; price: number; membersOnly: boolean }
export interface SanghaEvent {
  id: number;
  name: string;
  category: Category;
  location: string;
  descriptionHtml: string;
  summary: string;
  /** Upcoming dates only. A one-off event has exactly one. */
  occurrences: Occurrence[];
  next: Occurrence;
  isSeries: boolean;
  /** e.g. "Sundays" for a weekly sit, "Monthly" for a monthly one, "" otherwise. */
  rhythm: string;
  registrationEnabled: boolean;
  regTypes: RegType[];
  detailsUrl: string;
  registerUrl: string;
}

function categoryFor(tags: string[]): Category {
  if (tags.includes('retreat') || tags.includes('study')) return 'retreats';
  if (tags.includes('special')) return 'special';
  if (tags.includes('weekly')) return 'weekly';
  return 'other';
}

const absolute = (url = '') => (url.startsWith('/') ? site.membersSite + url : url);

/** Wild Apricot's editor leaves font tags, inline colours and fixed sizes. Strip them
 *  so event descriptions pick up the site's own typography. */
function clean(html = '') {
  const out = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4',
      'blockquote', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'],
    allowedAttributes: { a: ['href'], img: ['src', 'alt'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    transformTags: {
      h1: 'h2',
      a: (tagName, attribs) => ({ tagName, attribs: { href: absolute(attribs.href) } }),
      // Wild Apricot stores an embedded video as an image tag pointing at the video file.
      img: (tagName, attribs) => /\.(mp4|mov|webm)$/i.test(attribs.src ?? '')
        ? { tagName: 'a', attribs: { href: absolute(attribs.src) }, text: 'Watch the video' }
        : { tagName, attribs: { src: absolute(attribs.src), alt: attribs.alt ?? '' } },
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
  return out.replace(/&nbsp;/g, ' ').replace(/<(p|h[2-4]|li)>\s*(<br\s*\/?>\s*)*<\/\1>/g, '').trim();
}

/** Wild Apricot descriptions usually open with the event name as a heading; the page
 *  already shows it as the title, so remove that one repeat. */
function dropRepeatedTitle(html: string, name: string) {
  const norm = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const m = html.match(/^\s*<(h[2-4]|p)>(.*?)<\/\1>/s);
  if (!m) return html;
  const heading = norm(m[2]);
  const title = norm(name);
  const repeats = heading.length > 0 && (heading === title || heading === `a ${title}` || title.startsWith(heading) && heading.length > 12);
  return repeats ? html.slice(m[0].length).trim() : html;
}

function summarise(html: string) {
  const paragraphs = [...html.matchAll(/<p>(.*?)<\/p>/gs)]
    .map((m) => sanitizeHtml(m[1], { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
  const first = paragraphs.find((p) => p.length > 80) ?? '';
  if (first.length <= 220) return first;
  return first.slice(0, 220).replace(/\s+\S*$/, '') + '…';
}

function rhythmFor(sessions: Occurrence[], upcoming: Occurrence[]) {
  if (sessions.length < 3) return '';
  const gaps = sessions.slice(1).map((s, i) => (s.start.getTime() - sessions[i].start.getTime()) / 86400000).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 8) {
    // Use the most common weekday: the calendar occasionally has a stray session on the wrong day.
    const counts = new Map<string, number>();
    for (const o of upcoming) counts.set(weekday(o.start), (counts.get(weekday(o.start)) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]}s` : '';
  }
  if (median >= 20 && median <= 40) return 'Monthly';
  return '';
}

async function fetchRaw() {
  const key = import.meta.env.WA_API_KEY ?? process.env.WA_API_KEY;
  if (!key) throw new Error('WA_API_KEY is not set. Put it in a .env file in the project root.');
  const tokenRes = await fetch('https://oauth.wildapricot.org/auth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`APIKEY:${key}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=auto',
  });
  if (!tokenRes.ok) throw new Error(`Wild Apricot sign-in failed (${tokenRes.status})`);
  const token = await tokenRes.json();
  const accountId = token.Permissions[0].AccountId;
  const get = async (p: string) => {
    const res = await fetch(`${API}/accounts/${accountId}${p}`, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Wild Apricot request failed (${res.status}): ${p}`);
    return res.json();
  };
  // One request returns every upcoming event with its description, sessions and registration options.
  const list = await get(`/events?includeEventDetails=true&$filter=${encodeURIComponent('IsUpcoming eq true')}`);
  // Keep only public events, and only the fields the site shows, so the local cache holds
  // nothing private (the full response includes organiser contacts and payment totals).
  return list.Events.filter((e: any) => e.AccessLevel === 'Public').map((e: any) => ({
    Id: e.Id, Name: e.Name, Tags: e.Tags, Location: e.Location,
    StartDate: e.StartDate, EndDate: e.EndDate,
    StartTimeSpecified: e.StartTimeSpecified, EndTimeSpecified: e.EndTimeSpecified,
    RegistrationEnabled: e.RegistrationEnabled, HasEnabledRegistrationTypes: e.HasEnabledRegistrationTypes,
    Sessions: e.Sessions,
    Details: {
      DescriptionHtml: e.Details?.DescriptionHtml,
      RegistrationTypes: (e.Details?.RegistrationTypes ?? []).map((r: any) => ({
        Name: r.Name, IsEnabled: r.IsEnabled, BasePrice: r.BasePrice, Availability: r.Availability,
      })),
    },
  }));
}

async function loadRaw() {
  try {
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs < CACHE_MINUTES * 60000) return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch { /* no cache yet */ }
  const raw = await fetchRaw();
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(raw));
  return raw;
}

function toEvent(e: any, now: Date): SanghaEvent | null {
  // An end date with no end time is midnight; keep it only when it marks a later day.
  const endOf = (s: any) => {
    const end = new Date(s.EndDate);
    if (s.EndTimeSpecified !== false) return end;
    return end.getTime() - new Date(s.StartDate).getTime() > 86400000 ? end : null;
  };
  const occ = (s: any): Occurrence => ({
    start: new Date(s.StartDate),
    end: endOf(s),
    hasTime: s.StartTimeSpecified !== false,
  });
  const sessions: Occurrence[] = (e.Sessions ?? []).map(occ);
  const isSeries = sessions.length > 0;
  const cutoff = now.getTime() - 3 * 3600000; // keep events visible until a few hours after they start
  const all = isSeries ? sessions : [occ(e)];
  const occurrences = all.filter((o) => (o.end ?? o.start).getTime() >= cutoff && (isSeries ? o.start.getTime() >= cutoff : true));
  if (occurrences.length === 0) return null;
  const descriptionHtml = dropRepeatedTitle(clean(e.Details?.DescriptionHtml), e.Name);
  const category = categoryFor(e.Tags ?? []);
  return {
    id: e.Id,
    name: e.Name.trim(),
    category,
    location: (e.Location ?? '').trim(),
    descriptionHtml,
    summary: summarise(descriptionHtml),
    occurrences,
    next: occurrences[0],
    isSeries,
    rhythm: category === 'weekly' ? rhythmFor(sessions, occurrences) : '',
    registrationEnabled: Boolean(e.RegistrationEnabled && e.HasEnabledRegistrationTypes),
    regTypes: (e.Details?.RegistrationTypes ?? [])
      .filter((r: any) => r.IsEnabled !== false)
      .map((r: any) => ({ name: r.Name, price: r.BasePrice ?? 0, membersOnly: r.Availability === 'MembersOnly' })),
    detailsUrl: `${site.membersSite}/event-${e.Id}`,
    registerUrl: `${site.membersSite}/event-${e.Id}/registration`,
  };
}

let memo: Promise<SanghaEvent[]> | undefined;

/** Every public upcoming event, soonest first. */
export function getEvents(): Promise<SanghaEvent[]> {
  memo ??= loadRaw().then((raw) => {
    const now = new Date();
    return raw
      .map((e: any) => toEvent(e, now))
      .filter((e: SanghaEvent | null): e is SanghaEvent => e !== null)
      .sort((a: SanghaEvent, b: SanghaEvent) => a.next.start.getTime() - b.next.start.getTime());
  });
  return memo;
}

export const byCategory = (events: SanghaEvent[], c: Category) => events.filter((e) => e.category === c);

/** Weekly sits in Sunday-to-Saturday order, then the monthly ones. */
export function weeklySchedule(events: SanghaEvent[]) {
  const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const hour = (e: SanghaEvent) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(e.next.start));
  const weekly = byCategory(events, 'weekly');
  const regular = weekly.filter((e) => days.includes(e.rhythm))
    .sort((a, b) => days.indexOf(a.rhythm) - days.indexOf(b.rhythm) || hour(a) - hour(b));
  const others = weekly.filter((e) => !days.includes(e.rhythm));
  return { regular, others };
}
