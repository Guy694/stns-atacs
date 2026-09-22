import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "archive"
  | "arrow-down"
  | "audit"
  | "building"
  | "check"
  | "chevrons-left-right"
  | "clipboard-check"
  | "close"
  | "database"
  | "download"
  | "file-text"
  | "globe"
  | "home"
  | "key"
  | "layers"
  | "logout"
  | "map"
  | "menu"
  | "monitor"
  | "package"
  | "settings"
  | "shield"
  | "tag"
  | "users"
  | "wrench"
  | "repeat"
  | "printer";

type AppIconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

const PATHS: Record<IconName, ReactNode> = {
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  printer: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  activity: <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11h14V8" /><path d="M10 12h4" /></>,
  "arrow-down": <><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></>,
  audit: <><path d="M4 4h16v16H4z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
  building: <><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" /><path d="M8 7h1" /><path d="M12 7h1" /><path d="M8 11h1" /><path d="M12 11h1" /><path d="M8 15h1" /><path d="M12 15h1" /><path d="M3 21h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  "chevrons-left-right": <><path d="m7 7-5 5 5 5" /><path d="m17 7 5 5-5 5" /><path d="M2 12h20" /></>,
  "clipboard-check": <><path d="M9 3h6v4H9z" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><path d="m8 14 3 3 5-6" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21" /><path d="M12 3C9.5 5.7 8.2 8.7 8.2 12S9.5 18.3 12 21" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M9 21v-6h6v6" /></>,
  key: <><circle cx="7.5" cy="14.5" r="4.5" /><path d="M11 11 21 1" /><path d="m16 6 2 2" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  map: <><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3z" /><path d="M9 3v15" /><path d="M15 6v15" /></>,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>,
  package: <><path d="m12 2 9 5v10l-9 5-9-5V7z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .4l-.4.4h-4.6l-.4-.4a1.8 1.8 0 0 0-2-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2l-.2-.5L4 12l2.4-2.5.2-.5a1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2-.4l.4-.4h4.6l.4.4a1.8 1.8 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2l.2.5L22 12l-2.4 2.5z" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  tag: <><path d="M20 13 11 22 2 13V2h11z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
};

export function AppIcon({ name, size = 18, className = "", ...props }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
