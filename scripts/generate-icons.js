import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient: Deep Roasted Mocha -->
    <radialGradient id="bgGlow" cx="50%" cy="46%" r="65%" fx="48%" fy="42%">
      <stop offset="0%" stop-color="#3D2820"/>
      <stop offset="55%" stop-color="#241712"/>
      <stop offset="100%" stop-color="#150C09"/>
    </radialGradient>

    <!-- Warm Cup Gradient: Terracotta to Amber -->
    <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E89248"/>
      <stop offset="50%" stop-color="#D26D28"/>
      <stop offset="100%" stop-color="#9E4612"/>
    </linearGradient>

    <!-- Cup Highlight -->
    <linearGradient id="cupHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0"/>
    </linearGradient>

    <!-- Tea Liquid Gradient -->
    <linearGradient id="teaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7C2D12"/>
      <stop offset="40%" stop-color="#B45309"/>
      <stop offset="70%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#7C2D12"/>
    </linearGradient>

    <!-- Open Book Pages Gradient -->
    <linearGradient id="bookLeft" x1="0%" y1="0%" x2="100%" y2="10%">
      <stop offset="0%" stop-color="#E6DC CE"/>
      <stop offset="70%" stop-color="#F7F3EC"/>
      <stop offset="100%" stop-color="#D7CCC8"/>
    </linearGradient>

    <linearGradient id="bookRight" x1="100%" y1="0%" x2="0%" y2="10%">
      <stop offset="0%" stop-color="#E6DCCE"/>
      <stop offset="70%" stop-color="#F7F3EC"/>
      <stop offset="100%" stop-color="#D7CCC8"/>
    </linearGradient>

    <!-- Steam Gradient -->
    <linearGradient id="steamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#F5EFE6" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#F5EFE6" stop-opacity="0.25"/>
    </linearGradient>

    <!-- Gold Accent / Star -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>

    <!-- Drop Shadow Filter for central elements -->
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Solid Background for PWA Safe Zone & Masking -->
  <rect width="512" height="512" fill="url(#bgGlow)"/>

  <!-- Subtle Ambient Glow Behind Cup -->
  <circle cx="256" cy="250" r="140" fill="#E89248" opacity="0.12" filter="blur(28px)"/>

  <!-- Master Group with Soft Shadow -->
  <g filter="url(#softShadow)">

    <!-- 1. The Open Book Platform (Saucer) -->
    <!-- Book Base / Under Pages Shadow -->
    <path d="M 256 384 C 205 365, 155 368, 116 388 C 114 380, 116 372, 122 368 C 160 348, 210 345, 256 364 C 302 345, 352 348, 390 368 C 396 372, 398 380, 396 388 C 357 368, 307 365, 256 384 Z" fill="#8D6E63" opacity="0.7"/>

    <!-- Left Book Page -->
    <path d="M 256 374 C 212 355, 165 358, 124 378 C 120 365, 124 353, 134 348 C 172 330, 216 332, 256 352 Z" fill="url(#bookLeft)"/>

    <!-- Right Book Page -->
    <path d="M 256 374 C 300 355, 347 358, 388 378 C 392 365, 388 353, 378 348 C 340 330, 296 332, 256 352 Z" fill="url(#bookRight)"/>

    <!-- Book Spine Fold -->
    <path d="M 254 350 L 258 350 L 258 376 L 254 376 Z" fill="#BCAAA4"/>

    <!-- 2. The Tea Cup Handle -->
    <path d="M 334 242 C 382 242, 404 274, 388 306 C 374 334, 334 330, 314 322" 
          fill="none" 
          stroke="url(#cupGrad)" 
          stroke-width="18" 
          stroke-linecap="round"/>

    <!-- 3. The Tea Cup Body -->
    <path d="M 166 226 C 170 292, 194 340, 256 342 C 318 340, 342 292, 346 226 Z" 
          fill="url(#cupGrad)"/>

    <!-- Cup Highlight Layer (Inner shine) -->
    <path d="M 174 230 C 177 284, 197 328, 256 334 C 230 326, 192 284, 186 232 Z" 
          fill="url(#cupHighlight)"/>

    <!-- Cup Rim Outer -->
    <ellipse cx="256" cy="226" rx="90" ry="18" fill="#FDFBF7"/>

    <!-- Cup Rim Inner Wall -->
    <ellipse cx="256" cy="227" rx="84" ry="15" fill="#E89248"/>

    <!-- Steaming Tea Liquid -->
    <ellipse cx="256" cy="229" rx="80" ry="13" fill="url(#teaGrad)"/>

    <!-- 4. Graceful Rising Steam Trails -->
    <!-- Center Steam (Tallest) -->
    <path d="M 256 204 C 245 178, 267 154, 256 126 C 247 104, 257 84, 254 70" 
          fill="none" 
          stroke="url(#steamGrad)" 
          stroke-width="10" 
          stroke-linecap="round"/>

    <!-- Left Steam -->
    <path d="M 218 198 C 210 178, 226 158, 216 136 C 208 118, 218 102, 214 90" 
          fill="none" 
          stroke="url(#steamGrad)" 
          stroke-width="8" 
          stroke-linecap="round" 
          opacity="0.8"/>

    <!-- Right Steam -->
    <path d="M 294 198 C 302 178, 286 158, 296 136 C 304 118, 294 102, 298 90" 
          fill="none" 
          stroke="url(#steamGrad)" 
          stroke-width="8" 
          stroke-linecap="round" 
          opacity="0.8"/>

    <!-- 5. Story Magic Sparkle -->
    <path d="M 334 114 Q 334 126, 346 126 Q 334 126, 334 138 Q 334 126, 322 126 Q 334 126, 334 114 Z" 
          fill="url(#goldGrad)"/>
    <circle cx="202" cy="80" r="3.5" fill="#FDE68A" opacity="0.75"/>
  </g>
</svg>`;

// Also create a standalone transparent version of the logo for inline headers / favicons
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="90 50 332 360" width="332" height="360">
  <defs>
    <linearGradient id="lCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E89248"/>
      <stop offset="50%" stop-color="#D26D28"/>
      <stop offset="100%" stop-color="#9E4612"/>
    </linearGradient>

    <linearGradient id="lCupHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0"/>
    </linearGradient>

    <linearGradient id="lTeaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7C2D12"/>
      <stop offset="40%" stop-color="#B45309"/>
      <stop offset="70%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#7C2D12"/>
    </linearGradient>

    <linearGradient id="lBookLeft" x1="0%" y1="0%" x2="100%" y2="10%">
      <stop offset="0%" stop-color="#E6DCCE"/>
      <stop offset="70%" stop-color="#F7F3EC"/>
      <stop offset="100%" stop-color="#D7CCC8"/>
    </linearGradient>

    <linearGradient id="lBookRight" x1="100%" y1="0%" x2="0%" y2="10%">
      <stop offset="0%" stop-color="#E6DCCE"/>
      <stop offset="70%" stop-color="#F7F3EC"/>
      <stop offset="100%" stop-color="#D7CCC8"/>
    </linearGradient>

    <linearGradient id="lSteamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#D26D28" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#E89248" stop-opacity="0.2"/>
    </linearGradient>

    <linearGradient id="lGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>

    <filter id="lShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <g filter="url(#lShadow)">
    <path d="M 256 384 C 205 365, 155 368, 116 388 C 114 380, 116 372, 122 368 C 160 348, 210 345, 256 364 C 302 345, 352 348, 390 368 C 396 372, 398 380, 396 388 C 357 368, 307 365, 256 384 Z" fill="#8D6E63" opacity="0.6"/>
    <path d="M 256 374 C 212 355, 165 358, 124 378 C 120 365, 124 353, 134 348 C 172 330, 216 332, 256 352 Z" fill="url(#lBookLeft)"/>
    <path d="M 256 374 C 300 355, 347 358, 388 378 C 392 365, 388 353, 378 348 C 340 330, 296 332, 256 352 Z" fill="url(#lBookRight)"/>
    <path d="M 254 350 L 258 350 L 258 376 L 254 376 Z" fill="#BCAAA4"/>

    <path d="M 334 242 C 382 242, 404 274, 388 306 C 374 334, 334 330, 314 322" fill="none" stroke="url(#lCupGrad)" stroke-width="18" stroke-linecap="round"/>
    <path d="M 166 226 C 170 292, 194 340, 256 342 C 318 340, 342 292, 346 226 Z" fill="url(#lCupGrad)"/>
    <path d="M 174 230 C 177 284, 197 328, 256 334 C 230 326, 192 284, 186 232 Z" fill="url(#lCupHighlight)"/>
    <ellipse cx="256" cy="226" rx="90" ry="18" fill="#FDFBF7"/>
    <ellipse cx="256" cy="227" rx="84" ry="15" fill="#E89248"/>
    <ellipse cx="256" cy="229" rx="80" ry="13" fill="url(#lTeaGrad)"/>

    <path d="M 256 204 C 245 178, 267 154, 256 126 C 247 104, 257 84, 254 70" fill="none" stroke="url(#lSteamGrad)" stroke-width="10" stroke-linecap="round"/>
    <path d="M 218 198 C 210 178, 226 158, 216 136 C 208 118, 218 102, 214 90" fill="none" stroke="url(#lSteamGrad)" stroke-width="8" stroke-linecap="round" opacity="0.8"/>
    <path d="M 294 198 C 302 178, 286 158, 296 136 C 304 118, 294 102, 298 90" fill="none" stroke="url(#lSteamGrad)" stroke-width="8" stroke-linecap="round" opacity="0.8"/>

    <path d="M 334 114 Q 334 126, 346 126 Q 334 126, 334 138 Q 334 126, 322 126 Q 334 126, 334 114 Z" fill="url(#lGoldGrad)"/>
    <circle cx="202" cy="80" r="3.5" fill="#FDE68A" opacity="0.75"/>
  </g>
</svg>`;

async function generate() {
  const publicDir = path.resolve('public');
  const iconsDir = path.join(publicDir, 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Save SVGs
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterSvg);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), logoSvg);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), masterSvg);

  const svgBuffer = Buffer.from(masterSvg);

  // Generate 512x512 icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Generated icons/icon-512x512.png');

  // Generate 192x192 icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Generated icons/icon-192x192.png');

  // Generate 180x180 apple-touch-icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate 64x64 and 32x32 favicon pngs
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated favicon-32x32.png');

  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');

  // Generate simple favicon.ico format
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');

  console.log('All brand icons generated successfully!');
}

generate().catch(console.error);
