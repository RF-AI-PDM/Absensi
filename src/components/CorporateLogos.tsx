import React from 'react';

interface LogoProps {
  className?: string;
}

/**
 * Vector SVG component for the official PLN Indonesia Power logo
 */
export const PlnIndonesiaPowerLogo: React.FC<LogoProps> = ({ className = 'h-10 w-auto' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 360 110"
    className={className}
    role="img"
    aria-label="Logo PLN Indonesia Power"
  >
    <rect x="8" y="13" width="84" height="84" fill="#FFF100" rx="2" />
    <path
      d="M 16 43 Q 23 36, 30 43 T 44 43 T 58 43 T 72 43 T 84 43"
      fill="none"
      stroke="#0093D0"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <path
      d="M 16 58 Q 23 51, 30 58 T 44 58 T 58 58 T 72 58 T 84 58"
      fill="none"
      stroke="#0093D0"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <path
      d="M 16 73 Q 23 66, 30 73 T 44 73 T 58 73 T 72 73 T 84 73"
      fill="none"
      stroke="#0093D0"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <polygon
      points="48,20 33,59 50,55 43,82 38,80 43,92 53,83 48,83 61,48 44,52 58,20"
      fill="#E11D2E"
    />
    <text
      x="108"
      y="57"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="46"
      fontWeight="800"
      letterSpacing="2"
      fill="#0093D0"
    >
      PLN
    </text>
    <text
      x="108"
      y="90"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="32"
      fontWeight="400"
      letterSpacing="0.2"
      fill="#0093D0"
    >
      Indonesia Power
    </text>
  </svg>
);

/**
 * Vector SVG component for the official Danantara Indonesia logo
 */
export const DanantaraIndonesiaLogo: React.FC<LogoProps> = ({ className = 'h-10 w-auto' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 380 110"
    className={className}
    role="img"
    aria-label="Logo Danantara Indonesia"
  >
    <path
      d="M 12 14 H 52 C 78 14, 96 32, 96 55 C 96 78, 78 96, 52 96 H 12 Z"
      fill="#000000"
    />
    <path
      d="M 19 48 C 36 33, 64 31, 82 44 C 85 46, 86 50, 84 52 C 74 44, 52 46, 33 61 Z"
      fill="#D91C24"
    />
    <path
      d="M 34 62 C 52 47, 73 45, 84 53 C 86 56, 84 61, 80 61 C 74 56, 59 61, 48 77 Z"
      fill="#FFFFFF"
    />
    <text
      x="112"
      y="52"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="42"
      fontWeight="800"
      letterSpacing="-0.5"
      fill="#000000"
    >
      Danantara
    </text>
    <text
      x="112"
      y="91"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="42"
      fontWeight="800"
      letterSpacing="-0.5"
      fill="#000000"
    >
      Indonesia
    </text>
  </svg>
);

/**
 * Synchronously generates a high-resolution PNG Data URL for the PLN Indonesia Power logo
 * suitable for embedding directly into jsPDF documents via doc.addImage().
 */
export function getPlnIndonesiaPowerLogoDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(2, 2);

  // Yellow square
  ctx.fillStyle = '#FFF100';
  ctx.fillRect(8, 13, 84, 84);

  // 3 Cyan wavy lines
  ctx.strokeStyle = '#0093D0';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  const waveY = [43, 58, 73];
  for (const y of waveY) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    for (let x = 16; x < 82; x += 14) {
      ctx.quadraticCurveTo(x + 3.5, y - 6, x + 7, y);
      ctx.quadraticCurveTo(x + 10.5, y + 6, x + 14, y);
    }
    ctx.stroke();
  }

  // Red lightning bolt
  ctx.fillStyle = '#E11D2E';
  ctx.beginPath();
  ctx.moveTo(48, 20);
  ctx.lineTo(33, 59);
  ctx.lineTo(50, 55);
  ctx.lineTo(43, 82);
  ctx.lineTo(38, 80);
  ctx.lineTo(43, 92);
  ctx.lineTo(53, 83);
  ctx.lineTo(48, 83);
  ctx.lineTo(61, 48);
  ctx.lineTo(44, 52);
  ctx.lineTo(58, 20);
  ctx.closePath();
  ctx.fill();

  // PLN text
  ctx.fillStyle = '#0093D0';
  ctx.font = '800 46px Arial, Helvetica, sans-serif';
  ctx.fillText('PLN', 108, 57);

  // Indonesia Power text
  ctx.font = '300 32px Arial, Helvetica, sans-serif';
  ctx.fillText('Indonesia Power', 108, 90);

  return canvas.toDataURL('image/png');
}

/**
 * Synchronously generates a high-resolution PNG Data URL for the Danantara Indonesia logo
 * suitable for embedding directly into jsPDF documents via doc.addImage().
 */
export function getDanantaraIndonesiaLogoDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(2, 2);

  // Black D Shield
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(12, 14);
  ctx.lineTo(52, 14);
  ctx.bezierCurveTo(78, 14, 96, 32, 96, 55);
  ctx.bezierCurveTo(96, 78, 78, 96, 52, 96);
  ctx.lineTo(12, 96);
  ctx.closePath();
  ctx.fill();

  // Red upper wing
  ctx.fillStyle = '#D91C24';
  ctx.beginPath();
  ctx.moveTo(19, 48);
  ctx.bezierCurveTo(36, 33, 64, 31, 82, 44);
  ctx.bezierCurveTo(85, 46, 86, 50, 84, 52);
  ctx.bezierCurveTo(74, 44, 52, 46, 33, 61);
  ctx.closePath();
  ctx.fill();

  // White lower wing
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(34, 62);
  ctx.bezierCurveTo(52, 47, 73, 45, 84, 53);
  ctx.bezierCurveTo(86, 56, 84, 61, 80, 61);
  ctx.bezierCurveTo(74, 56, 59, 61, 48, 77);
  ctx.closePath();
  ctx.fill();

  // Danantara Indonesia text
  ctx.fillStyle = '#000000';
  ctx.font = '800 42px Arial, Helvetica, sans-serif';
  ctx.fillText('Danantara', 112, 52);
  ctx.fillText('Indonesia', 112, 91);

  return canvas.toDataURL('image/png');
}
