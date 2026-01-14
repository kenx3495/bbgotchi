// Placeholder asset generator for terrarium items
// Replace with actual image imports when assets are ready

import { TerrariumItem } from '../types';

// Color palette for placeholder shapes by category
const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  plant: { bg: '#4ade80', accent: '#166534' },      // green
  decoration: { bg: '#a78bfa', accent: '#5b21b6' }, // purple
  creature: { bg: '#fbbf24', accent: '#b45309' },   // amber
  special: { bg: '#f472b6', accent: '#be185d' },    // pink
};

// Generate a simple SVG placeholder for an item
export function getPlaceholderSvg(item: TerrariumItem): string {
  const colors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.decoration;

  // Different shapes for different categories
  let shape: string;
  switch (item.category) {
    case 'plant':
      // Leaf/plant shape
      shape = `
        <ellipse cx="25" cy="35" rx="15" ry="20" fill="${colors.bg}" />
        <line x1="25" y1="55" x2="25" y2="35" stroke="${colors.accent}" stroke-width="3" />
      `;
      break;
    case 'creature':
      // Circle with eyes
      shape = `
        <circle cx="25" cy="25" r="18" fill="${colors.bg}" />
        <circle cx="19" cy="22" r="3" fill="${colors.accent}" />
        <circle cx="31" cy="22" r="3" fill="${colors.accent}" />
        <path d="M 18 32 Q 25 38 32 32" stroke="${colors.accent}" stroke-width="2" fill="none" />
      `;
      break;
    case 'special':
      // Star shape
      shape = `
        <polygon points="25,5 30,20 45,20 33,30 38,45 25,35 12,45 17,30 5,20 20,20" fill="${colors.bg}" stroke="${colors.accent}" stroke-width="1" />
      `;
      break;
    default:
      // Diamond/crystal shape
      shape = `
        <polygon points="25,5 40,25 25,45 10,25" fill="${colors.bg}" stroke="${colors.accent}" stroke-width="2" />
      `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
      ${shape}
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

// Get asset URL - returns placeholder if real asset doesn't exist
export function getTerrariumAsset(item: TerrariumItem): string {
  // Try to use actual asset first
  // In production, this would be: `/assets/terrarium/${item.asset}`
  // For now, return placeholder
  return getPlaceholderSvg(item);
}

// Generate a Japanese garden background SVG
export function getGardenBackgroundSvg(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">
      <defs>
        <!-- Sky gradient -->
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#e0f2fe" />
          <stop offset="60%" style="stop-color:#bae6fd" />
          <stop offset="100%" style="stop-color:#7dd3fc" />
        </linearGradient>
        <!-- Ground gradient -->
        <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#86efac" />
          <stop offset="100%" style="stop-color:#4ade80" />
        </linearGradient>
        <!-- Zen sand pattern -->
        <pattern id="zenPattern" x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M 0 5 Q 5 0 10 5 Q 15 10 20 5" stroke="#d4d4d4" stroke-width="0.5" fill="none" opacity="0.5"/>
        </pattern>
        <!-- Wood border -->
        <linearGradient id="woodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#a16207" />
          <stop offset="50%" style="stop-color:#854d0e" />
          <stop offset="100%" style="stop-color:#713f12" />
        </linearGradient>
      </defs>

      <!-- Sky background -->
      <rect x="0" y="0" width="400" height="180" fill="url(#skyGrad)" />

      <!-- Distant hills -->
      <ellipse cx="100" cy="180" rx="120" ry="40" fill="#86efac" opacity="0.5" />
      <ellipse cx="300" cy="180" rx="150" ry="50" fill="#86efac" opacity="0.4" />

      <!-- Main ground area -->
      <rect x="0" y="160" width="400" height="140" fill="url(#groundGrad)" />

      <!-- Zen sand area -->
      <ellipse cx="200" cy="240" rx="160" ry="50" fill="#f5f5f4" />
      <ellipse cx="200" cy="240" rx="160" ry="50" fill="url(#zenPattern)" />

      <!-- Pond hint -->
      <ellipse cx="320" cy="260" rx="60" ry="25" fill="#7dd3fc" opacity="0.6" />

      <!-- Wooden frame border -->
      <rect x="0" y="0" width="400" height="8" fill="url(#woodGrad)" />
      <rect x="0" y="292" width="400" height="8" fill="url(#woodGrad)" />
      <rect x="0" y="0" width="8" height="300" fill="url(#woodGrad)" />
      <rect x="392" y="0" width="8" height="300" fill="url(#woodGrad)" />
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

// Legacy alias for compatibility
export function getTerrariumContainerSvg(): string {
  return getGardenBackgroundSvg();
}
