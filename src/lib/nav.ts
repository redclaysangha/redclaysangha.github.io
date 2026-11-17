// Where each page in src/content/pages/ lives on the site, and how pages are grouped
// into sections. To add a page: create the .md file, then add a line here.
export interface PageRef { file: string; path: string; label: string }
export interface Section { label: string; pages: PageRef[] }

export const sections: Section[] = [
  {
    label: 'About',
    pages: [
      { file: 'about', path: '/about/', label: 'About Us' },
      { file: 'programs', path: '/programs/', label: 'Programs' },
      { file: 'people', path: '/about/people/', label: 'People' },
    ],
  },
  {
    label: 'Engage',
    pages: [
      { file: 'engage', path: '/engage/', label: 'Engage' },
      { file: 'membership', path: '/engage/membership/', label: 'Membership' },
      { file: 'volunteer', path: '/engage/volunteer/', label: 'Volunteer' },
      { file: 'community-service', path: '/engage/community-service/', label: 'Community Service' },
      { file: 'receiving-the-precepts', path: '/engage/receiving-the-precepts/', label: 'Receiving the Precepts' },
    ],
  },
  {
    label: 'Resources',
    pages: [
      { file: 'resources', path: '/resources/', label: 'Resources' },
      { file: 'liturgy', path: '/resources/liturgy/', label: 'Liturgy' },
      { file: 'suggested-reading', path: '/resources/suggested-reading/', label: 'Suggested Reading' },
      { file: 'recordings-and-materials', path: '/resources/recordings-and-materials/', label: 'Recordings and Materials' },
    ],
  },
];

export const standalone: PageRef[] = [
  { file: 'contact', path: '/contact/', label: 'Contact Us' },
  { file: 'donate', path: '/donate/', label: 'Donate' },
];

export const allPages = [...sections.flatMap((s) => s.pages), ...standalone];
export const sectionOf = (file: string) => sections.find((s) => s.pages.some((p) => p.file === file));
