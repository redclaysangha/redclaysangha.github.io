// Sunday talks: recordings are picked up from the YouTube channel automatically, and
// merged with the hand-kept list in src/data/talks.json (used for upcoming talks).
//
// A video counts as a Sunday talk when the FIRST LINE of its YouTube description reads:
//     Sunday talk · Speaker Name · November 8, 2026
// The speaker and the date are optional; without a date, the upload date is used.
import site from '../data/site.json';
import talks from '../data/talks.json';

export interface Talk { date: string; speaker: string; title: string; url: string }

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const isoDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);

/** Reads "Sunday talk · Speaker · Date" from the first line of a description. */
export function parseMarker(description: string, uploaded: string): { speaker: string; date: string } | null {
  const first = description.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  if (!/^sunday talk\b/i.test(first)) return null;
  const parts = first.split(/\s*[·|•]\s*|\s+[–—-]\s+/).slice(1).map((p) => p.trim()).filter(Boolean);
  let speaker = '';
  let date = isoDate(new Date(uploaded));
  for (const part of parts) {
    // Noon UTC keeps "November 8, 2026" on the 8th in every time zone.
    const parsed = /\d{4}/.test(part) ? new Date(`${part} 12:00 UTC`) : new Date(NaN);
    if (!Number.isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
    else if (!speaker) speaker = part;
  }
  return { speaker, date };
}

export function parseFeed(xml: string): Talk[] {
  return [...xml.matchAll(/<entry>(.*?)<\/entry>/gs)].flatMap(([, entry]) => {
    const pick = (re: RegExp) => decode(entry.match(re)?.[1] ?? '');
    const marker = parseMarker(pick(/<media:description>(.*?)<\/media:description>/s), pick(/<published>(.*?)<\/published>/));
    const id = pick(/<yt:videoId>(.*?)<\/yt:videoId>/);
    if (!marker || !id) return [];
    return [{ ...marker, title: pick(/<title>(.*?)<\/title>/), url: `https://youtu.be/${id}` }];
  });
}

async function recordedTalks(): Promise<Talk[]> {
  if (!site.youtubeChannelId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${site.youtubeChannelId}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return parseFeed(await res.text());
  } catch (err) {
    // YouTube being unreachable should not stop the site from publishing: fall back to the hand-kept list.
    console.warn(`Could not read the YouTube feed (${err}); showing the hand-kept talks list only.`);
    return [];
  }
}

let memo: Promise<Talk[]> | undefined;

/** Recent and upcoming Sunday talks, newest first. One talk per date: a recording replaces
 *  an upcoming entry for the same Sunday, and a hand-entered recording link wins over YouTube's. */
export function getSundayTalks(): Promise<Talk[]> {
  memo ??= recordedTalks().then((recorded) => {
    const byDate = new Map<string, Talk>();
    for (const t of recorded) byDate.set(t.date, t);
    for (const t of talks.sundayTalks as Talk[]) {
      const auto = byDate.get(t.date);
      if (!auto || t.url) byDate.set(t.date, { ...t, speaker: t.speaker || auto?.speaker || '' });
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  });
  return memo;
}
