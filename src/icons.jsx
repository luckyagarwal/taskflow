// icons.jsx — line icon set (Lucide-style). Exposes Icons
import React from 'react';

const S = ({ children, size = 20, sw = 1.75, fill = 'none', style, className, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    className={className} style={style} {...rest}>{children}</svg>
);

export const Icons = {
  inbox: (p) => <S {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></S>,
  today: (p) => <S {...p}><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M12 13.5v3.5M12 13.5l-2 1.2M12 13.5l2 1.2" strokeWidth="1.5"/></S>,
  star: (p) => <S {...p}><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3z"/></S>,
  upcoming: (p) => <S {...p}><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/></S>,
  filter: (p) => <S {...p}><path d="M3 5h18M6 12h12M10 19h4"/></S>,
  tag: (p) => <S {...p}><path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3.6 11.6A2 2 0 0 1 3 10.2V4a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></S>,
  search: (p) => <S {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></S>,
  plus: (p) => <S {...p}><path d="M12 5v14M5 12h14"/></S>,
  plusSm: (p) => <S {...p} sw={2.2}><path d="M12 6v12M6 12h12"/></S>,
  check: (p) => <S {...p} sw={2.4}><path d="M20 6 9 17l-5-5"/></S>,
  calendar: (p) => <S {...p}><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/></S>,
  logbook: (p) => <S {...p}><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></S>,
  flag: (p) => <S {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V4"/></S>,
  dots: (p) => <S {...p} sw={2}><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></S>,
  chevR: (p) => <S {...p}><path d="m9 6 6 6-6 6"/></S>,
  chevD: (p) => <S {...p}><path d="m6 9 6 6 6-6"/></S>,
  chevL: (p) => <S {...p}><path d="m15 6-6 6 6 6"/></S>,
  x: (p) => <S {...p}><path d="M18 6 6 18M6 6l12 12"/></S>,
  clock: (p) => <S {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></S>,
  note: (p) => <S {...p}><path d="M4 5h16M4 10h16M4 15h10"/></S>,
  sun: (p) => <S {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></S>,
  moon: (p) => <S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></S>,
  settings: (p) => <S {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></S>,
  hash: (p) => <S {...p}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></S>,
  bell: (p) => <S {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></S>,
  repeat: (p) => <S {...p}><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></S>,
  folder: (p) => <S {...p}><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z"/></S>,
  grid: (p) => <S {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></S>,
  list: (p) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></S>,
  sliders: (p) => <S {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></S>,
  menu: (p) => <S {...p}><path d="M3 6h18M3 12h18M3 18h18"/></S>,
  arrowR: (p) => <S {...p}><path d="M5 12h14M13 5l7 7-7 7"/></S>,
  trash: (p) => <S {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></S>,
  user: (p) => <S {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></S>,
  edit: (p) => <S {...p}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></S>,
  grip: (p) => <S {...p} sw={2}><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1.2" fill="currentColor" stroke="none"/></S>,
  keyboard: (p) => <S {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" /></S>,
};

export default Icons;
