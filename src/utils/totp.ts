const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 16): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
}

function base32ToBytes(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

export async function computeTotpCode(
  secret: string,
  timestampMs: number = Date.now(),
  stepSeconds = 30
): Promise<string> {
  if (!secret) return '000000';
  const keyBytes = base32ToBytes(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export async function verifyTotpCode(
  secret: string,
  inputCode: string,
  windowSteps = 1
): Promise<boolean> {
  const cleanedCode = (inputCode || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanedCode) || !secret) return false;

  const now = Date.now();
  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const candidate = await computeTotpCode(secret, now + offset * 30000);
    if (candidate === cleanedCode) {
      return true;
    }
  }
  return false;
}

export function getRemainingTotpSeconds(stepSeconds = 30): number {
  const elapsed = Math.floor(Date.now() / 1000) % stepSeconds;
  return stepSeconds - elapsed;
}

export function buildOtpAuthUri(secret: string, email: string, issuer = 'HadirPro'): string {
  const safeEmail = encodeURIComponent(email || 'user@hadirpro.id');
  const safeIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${safeIssuer}:${safeEmail}?secret=${secret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates a deterministic 21x21 visual matrix from the otpauth URI for visual QR preview
 */
export function buildVisualMatrix(seedString: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seedString.length; i++) {
    hash ^= seedString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (Math.abs(hash) % 10) < 5;
    }
  }
  return grid;
}
