# Red Clay Sangha website (prototype)

The public website, built with [Astro](https://astro.build). Events are read from Wild Apricot
when the site is built; registration, donations and membership stay on Wild Apricot.

## Run it

```
npm install
npm run dev        # http://localhost:4321
npm run build      # writes the finished site to dist/
```

A `.env` file in this folder must contain a read-only Wild Apricot API key:

```
WA_API_KEY=...
```

`.env` is ignored by git. Never commit the key: it can read the member list.

## Where things are

| What | Where |
|---|---|
| Events (from Wild Apricot) | `src/lib/events.ts` |
| Welcome text, address, links | `src/data/site.json` |
| Sunday talks: recordings (from YouTube) | `src/lib/talks.ts` |
| Sunday talks: upcoming, and playlists | `src/data/talks.json` |
| Page text (About, Programs, Engage, Resources…) | `src/content/pages/*.md` |
| Page addresses and section menus | `src/lib/nav.ts` |
| Documents (study guides, liturgy) | `public/documents/` |
| Colours and typography | `src/styles/global.css` |
| Editing screen | `public/admin/` (open `/admin/` in the browser) |

Event data is cached for 30 minutes in `.cache/`; delete that folder to force a fresh fetch.

## How events are grouped

By the tags already used in Wild Apricot: `retreat` and `study` → Retreats & Study,
`special` → Special Events, `weekly` → Weekly Programs. Anything else appears on the
calendar only. Events that are not public in Wild Apricot are never shown.

## What still lives on Wild Apricot

Event registration, the credit-card donation form, the new member form, the mailing-list
sign-up and member log in. The site links to each of these.

## How Sunday talk recordings appear

A video on the YouTube channel is listed as a Sunday talk when the first line of its
description reads `Sunday talk · Speaker Name · November 8, 2026`. Only the channel's 15
most recent uploads are checked, which is what YouTube's public feed provides.
