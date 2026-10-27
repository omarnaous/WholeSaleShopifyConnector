import type { Style } from "@lumen/core";

/**
 * Demo-only product "photos": an SVG of the frame shape in the variant's frame and lens colours.
 * Real images are served by the worker (/img/* from R2) and are not available to the Vite dev server.
 */
const LENS: Record<Style, string> = {
  aviator: "M10 24c0-9 7-13 21-13s20 4 20 11c0 12-8 24-20 24C18 46 10 36 10 24z",
  wayfarer: "M8 14h44l-3 22c-1 6-5 9-11 9H22c-6 0-10-3-11-9L8 14z",
  round: "M30 10a17 17 0 1 1 0 34a17 17 0 1 1 0-34z",
  "cat-eye": "M6 14c14-4 34-6 48 0c-1 16-9 28-24 28C16 42 8 30 6 14z",
  shield: "M6 14h48c0 18-10 30-24 30S6 32 6 14z",
  square: "M10 12h40v26c0 4-3 7-7 7H17c-4 0-7-3-7-7V12z",
};

export function sunglassesSvg(style: Style, frame: string, lens: string): string {
  const shape = LENS[style];
  const single = style === "shield";
  const lenses = single
    ? `<path d="M22 22h116c0 26-26 44-58 44S22 48 22 22z" fill="url(#l)" stroke="${frame}" stroke-width="5"/>`
    : `<g transform="translate(14 14)"><path d="${shape}" fill="url(#l)" stroke="${frame}" stroke-width="4"/></g>
       <g transform="translate(146 14) scale(-1 1)"><path d="${shape}" fill="url(#l)" stroke="${frame}" stroke-width="4"/></g>
       <path d="M74 30c4-4 8-4 12 0" fill="none" stroke="${frame}" stroke-width="4" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f6f7"/><stop offset="1" stop-color="#e9e9ec"/></linearGradient>
      <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lens}" stop-opacity=".95"/><stop offset="1" stop-color="${lens}" stop-opacity=".7"/></linearGradient>
    </defs>
    <rect width="160" height="120" fill="url(#bg)"/>
    <ellipse cx="80" cy="96" rx="54" ry="5" fill="#000" opacity=".06"/>
    <g transform="translate(0 22)">
      <path d="M4 22l14 4M156 22l-14 4" stroke="${frame}" stroke-width="4" stroke-linecap="round"/>
      ${lenses}
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s{2,}/g, " "))}`;
}
