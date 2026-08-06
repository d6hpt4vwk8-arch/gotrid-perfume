const LINKS = [
  {
    href: "https://www.instagram.com/gotrid_perfume/",
    label: "Instagram",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </>
    ),
  },
  {
    href: "https://www.facebook.com/Gotrid.perfume/",
    label: "Facebook",
    icon: (
      <path
        d="M13.6 21v-7.6h2.5l.4-3H13.6V8.4c0-.9.2-1.5 1.5-1.5H16.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.5V21h3.1Z"
        fill="currentColor"
      />
    ),
  },
  {
    href: "https://www.tiktok.com/@gotrid_perfume",
    label: "TikTok",
    icon: (
      <path
        d="M14.5 3h2.3c.3 1.9 1.5 3.3 3.5 3.5v2.4c-1.3 0-2.5-.4-3.5-1.1v6.6a5.2 5.2 0 1 1-5.2-5.2c.3 0 .5 0 .8.1v2.4a2.8 2.8 0 1 0 2 2.7V3Z"
        fill="currentColor"
      />
    ),
  },
  {
    href: "https://www.linkedin.com/in/pavel-hrytsan-99471b196/",
    label: "LinkedIn",
    icon: (
      <>
        <rect x="3.2" y="9.2" width="3" height="11.6" fill="currentColor" />
        <circle cx="4.7" cy="4.8" r="1.9" fill="currentColor" />
        <path
          d="M10 9.2h2.9v1.6c.6-1.1 1.9-1.9 3.4-1.9 2.8 0 4 1.9 4 5.1v6.8h-3v-6.1c0-1.6-.6-2.6-2-2.6-1.1 0-1.8.7-2.1 1.5-.1.3-.1.6-.1 1v6.2h-3V9.2Z"
          fill="currentColor"
        />
      </>
    ),
  },
];

export function SocialLinks() {
  return (
    <ul className="flex items-center gap-3">
      {LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            className="flex h-7 w-7 items-center justify-center text-white/65 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              {link.icon}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
