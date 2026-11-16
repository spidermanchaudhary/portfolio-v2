import type { ContactDetail, Section, Social } from "./types";

/** Identity, copy and SEO — reused verbatim from the previous site. */
export const site = {
  name: "Sujal Chaudhary",
  firstName: "Sujal",
  url: "https://sujal.info",
  role: "Full-stack developer",
  affiliation: "NSUT, New Delhi",
  location: "New Delhi, India",
  headline: "Sujal Chaudhary builds useful things for the web.",
  lede: "Tools that thousands of students actually use — built end to end, from database to deploy.",
  status: "open to work",
  ticker: [
    "Next.js",
    "MERN Stack",
    "PHP",
    "DevOps",
    "Curious",
    "Techie",
    "Innovative",
    "Problem Solver",
  ],
  /** Rotating figure captions from the old hero — now terminal easter eggs */
  quips: [
    "the developer",
    "probably debugging",
    "works on my machine",
    "one more commit, promise",
    "console.log('why')",
    "it's not a bug, it's a feature",
  ],
  contactIntro:
    "Always open to discussing product work, collaborations, or partnership opportunities. Drop a line — I usually reply within a day.",
  closing: "Got a problem worth solving? Write it down.",
  blog: "https://blog.sujal.info",
  contactEndpoint: "https://api.sujal.info/api/portfolio/contact",
  seo: {
    title: "Sujal Chaudhary — Full-stack developer, NSUT",
    description:
      "Portfolio of Sujal Chaudhary, a Full Stack Web Developer with expertise in HTML, CSS, JavaScript, React, PHP, Nextjs and more. From NSUT. Explore my projects and get in touch.",
    keywords: [
      "Sujal Chaudhary",
      "NSUT",
      "Full Stack Developer",
      "Web Developer",
      "Next.js",
      "React",
      "PHP",
      "HTML",
      "CSS",
      "JavaScript",
      "MERN Stack",
      "Developer",
      "Portfolio",
      "Projects",
      "Contact",
    ],
    // The previous favicon/OG image host (sdrive.blr1.cdn.digitaloceanspaces.com)
    // no longer resolves; both are now generated in-app (app/icon.svg,
    // app/opengraph-image.tsx).
  },
} as const;

export const sections: Section[] = [
  { id: "top", label: "Launchpad", hint: "Back to the start" },
  { id: "origin", label: "Origin", hint: "Where Sujal comes from" },
  { id: "toolbox", label: "Toolbox", hint: "The everyday stack" },
  { id: "work", label: "Work", hint: "Products shipped into the wild" },
  { id: "signals", label: "Signals", hint: "Notes from people" },
  { id: "launch", label: "Launch", hint: "Start a conversation" },
];

/** Short links resolve through the existing /[slug] redirect route. */
export const socials: Social[] = [
  { label: "GitHub", href: "https://sujal.info/github" },
  { label: "LinkedIn", href: "https://sujal.info/linkedin" },
  { label: "Instagram", href: "https://sujal.info/instagram" },
  { label: "WhatsApp", href: "https://sujal.info/whatsapp" },
  { label: "Telegram", href: "https://sujal.info/telegram" },
];

export const contactDetails: ContactDetail[] = [
  { label: "Location", value: "India", href: null, copy: null },
  {
    label: "Email",
    value: "me@sujal.info",
    href: "https://sujal.info/email",
    copy: "me@sujal.info",
  },
  {
    label: "Phone",
    value: "+91 96678 35044",
    href: "https://sujal.info/phone",
    copy: "+91 96678 35044",
  },
];
