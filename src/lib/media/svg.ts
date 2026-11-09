// Locally generated SVG logos and images (initials on a colored background). No external images.

const STOP_WORDS = new Set(["du", "de", "des", "la", "le", "les", "l'", "d'"]);

const PALETTE = [
  "#7c4dcc", "#1f7fc4", "#c97a12", "#1d8a4e", "#c62f2f", "#3b6ea8",
  "#a23b72", "#2a9d8f", "#8a5a44", "#5c6bc0", "#d2691e", "#4f7942",
];

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export function initials(name: string): string {
  const words = name
    .replace(/[’']/g, "' ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function colorFor(id: number): string {
  return PALETTE[(id * 7) % PALETTE.length];
}

export function logoSvg(id: number, name: string): string {
  const color = colorFor(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${escapeXml(name)}">
<rect width="128" height="128" rx="28" fill="${color}"/>
<text x="64" y="64" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#ffffff">${escapeXml(initials(name))}</text>
</svg>`;
}

export function imageSvg(id: number, name: string, category: string): string {
  const color = colorFor(id);
  const accent = colorFor(id + 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320" role="img" aria-label="${escapeXml(name)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
<rect width="640" height="320" fill="url(#g)"/>
<circle cx="560" cy="60" r="120" fill="#ffffff" fill-opacity="0.08"/>
<text x="40" y="180" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
<text x="40" y="226" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#ffffff" fill-opacity="0.85">${escapeXml(category)}</text>
</svg>`;
}
