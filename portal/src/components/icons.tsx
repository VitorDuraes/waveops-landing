// WaveOps Portal - conjunto de icones (porte do icons.js do prototipo).
// Icones de UI usam stroke currentColor. Marca, WhatsApp, PIX e Discord
// sao especiais. Discord substitui o Slack.
import * as React from "react";

type SvgProps = React.SVGProps<SVGSVGElement>;

// Helper para icones de tracado (viewBox 24, fill none, currentColor).
function stroke(children: React.ReactNode, w = 1.9) {
  const C = (props: SvgProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
  return C;
}

const ICONS = {
  // marca (sine nodes) em chip violeta
  mark: (props: SvgProps) => (
    <svg viewBox="0 0 100 100" fill="none" {...props}>
      <rect x="2" y="2" width="96" height="96" rx="24" fill="#7c3aed" />
      <g stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18,50 Q30,33 41,50" />
        <path d="M59,50 Q70,67 82,50" />
      </g>
      <circle cx="50" cy="50" r="9" fill="none" stroke="#fff" strokeWidth="5" />
      <circle cx="18" cy="50" r="7.5" fill="#fff" />
      <circle cx="82" cy="50" r="7.5" fill="#fff" />
    </svg>
  ),
  grid: stroke(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  plan: stroke(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h6" />
    </>
  ),
  invoice: stroke(
    <>
      <path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </>
  ),
  card: stroke(
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  support: stroke(
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  users: stroke(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bell: stroke(
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  settings: stroke(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  flow: stroke(
    <>
      <circle cx="5" cy="6" r="2.4" />
      <circle cx="5" cy="18" r="2.4" />
      <circle cx="18" cy="12" r="2.4" />
      <path d="M7 7l9 4M7 17l9-4" />
    </>
  ),
  money: stroke(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.5-2.5 1.5-2.5 2.5s2.5 1 2.5 2.5a2.5 2 0 0 1-5 0" />
    </>
  ),
  alert: stroke(
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  pause: stroke(
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  check: stroke(<path d="M20 6 9 17l-5-5" />, 2.4),
  checkCircle: stroke(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  clock: stroke(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: stroke(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  sun: stroke(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: stroke(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  menu: stroke(<path d="M4 7h16M4 12h16M4 17h16" />),
  close: stroke(<path d="M6 6l12 12M18 6 6 18" />),
  arrowRight: stroke(<path d="M5 12h14M13 6l6 6-6 6" />, 2.2),
  chevronRight: stroke(<path d="m9 6 6 6-6 6" />),
  chevronLeft: stroke(<path d="m15 6-6 6 6 6" />),
  chevronDown: stroke(<path d="m6 9 6 6 6-6" />),
  whatsapp: (props: SvgProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 0 0-8.7 15L2 22l5.2-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.4-.2-2.6.7.7-2.5-.2-.4A8 8 0 0 1 12 4zm-2.7 4c-.2 0-.5 0-.7.4-.2.4-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.5 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.6-.3c-.3-.2-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.3-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4c0-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4z" />
    </svg>
  ),
  pix: stroke(
    <>
      <path d="M12 3 4 12l8 9 8-9-8-9zM4 12h16" />
    </>
  ),
  barcode: stroke(<path d="M4 6v12M8 6v12M11 6v12M14 6v12M17 6v12M20 6v12" />),
  mail: stroke(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7L22 6" />
    </>
  ),
  // Discord (substitui o Slack) - alertas internos
  discord: (props: SvgProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.3 5.3A17 17 0 0 0 15.1 4l-.2.4a13 13 0 0 1 3.7 1.8 13.7 13.7 0 0 0-11.2 0A12.9 12.9 0 0 1 11.1 4.4L10.9 4A17 17 0 0 0 6.7 5.3 18.6 18.6 0 0 0 3.5 17.9a17 17 0 0 0 5.2 2.6c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.7-.8l.4-.3a9.8 9.8 0 0 0 8.4 0l.4.3c-.5.3-1.1.6-1.7.8.3.7.7 1.3 1.1 1.9a17 17 0 0 0 5.2-2.6 18.6 18.6 0 0 0-3.2-12.6zM9.4 15.3c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1zm5.2 0c-1 0-1.8-.9-1.8-2.1 0-1.1.8-2.1 1.8-2.1s1.9 1 1.8 2.1c0 1.2-.8 2.1-1.8 2.1z" />
    </svg>
  ),
  refresh: stroke(
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  ),
  download: stroke(<path d="M12 3v12M7 11l5 5 5-5M5 21h14" />),
  lock: stroke(
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  copy: stroke(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  eye: stroke(
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  edit: stroke(
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    </>
  ),
  plus: stroke(<path d="M12 5v14M5 12h14" />, 2.2),
  logout: stroke(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />),
  trend: stroke(
    <>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  inbox: stroke(
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.5z" />
    </>
  ),
  file: stroke(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  building: stroke(
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  layers: stroke(<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />),
  phone: stroke(
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & SvgProps) {
  const C = ICONS[name];
  return C ? C(props) : null;
}

// Marca branca em chip violeta, para sidebar/nav/auth (usa o icone "mark").
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }}>
      <Icon name="mark" style={{ width: "100%", height: "100%", display: "block" }} />
    </span>
  );
}
