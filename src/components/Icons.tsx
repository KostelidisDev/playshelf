/* Icons from Google's Material Icons (Apache License 2.0), inlined as SVG
 * so they cost no extra requests. */

const icon = (path: string, className = "icon") => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d={path} />
  </svg>
);

export const GamepadIcon = () => icon(
  "M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66a2.545 2.545 0 004.31 2.16L9 16h6l2.27 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.38 2.51-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z",
  "icon brand-icon",
);

/* Not a Material icon: the logo while the Halloween easter egg is on
   (style.css swaps it in). Its eyes and nose are holes, cut by the
   even-odd fill rule. */
export const SkullIcon = () => icon(
  "M12 2C7.6 2 4 5.3 4 9.6c0 2.5 1.2 4.6 3 5.9V18c0 .6.4 1 1 1h1.5v-2H11v2h2v-2h1.5v2H16c.6 0 1-.4 1-1v-2.5c1.8-1.3 3-3.4 3-5.9C20 5.3 16.4 2 12 2zM8.8 8.2a2 2 0 100 4 2 2 0 000-4zM15.2 8.2a2 2 0 100 4 2 2 0 000-4zM12 12.6l-1.2 2.2h2.4z",
  "icon brand-icon skull-icon",
);

export const BackIcon = () => icon("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z", "icon back-icon");

export const InstallIcon = () => icon("M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z");

export const SearchIcon = () => icon(
  "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
);
