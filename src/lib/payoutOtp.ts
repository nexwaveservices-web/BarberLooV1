import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.PAYOUT_OTP_SECRET
  ? crypto.createHash('sha256').update(process.env.PAYOUT_OTP_SECRET).digest()
  : crypto.createHash('sha256').update('barberloo-otp-secure-key-2026-payout-vault').digest();

const ALGORITHM = 'aes-256-gcm';

/**
 * Generates a cryptographically secure 6-digit OTP, salt, HMAC-SHA256 hash, and encrypted cipher.
 */
export function generateSecureCompletionOtp(expiresInHours = 48) {
  // 1. Generate unpredictable 6-digit numeric OTP (100000 - 999999)
  const numericOtp = crypto.randomInt(100000, 1000000).toString();

  // 2. Cryptographic Salt (16 bytes random)
  const salt = crypto.randomBytes(16).toString('hex');

  // 3. HMAC-SHA256 Hash for tamper-proof verification
  const hash = crypto.createHmac('sha256', salt).update(numericOtp).digest('hex');

  // 4. AES-256-GCM Cipher for customer-only authenticated retrieval
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(numericOtp, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Format: iv:tag:encrypted
  const cipherPayload = `${iv.toString('hex')}:${tag}:${encrypted}`;

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  return {
    rawOtp: numericOtp,
    salt,
    hash,
    cipher: cipherPayload,
    expiresAt,
    maxAttempts: 5,
  };
}

/**
 * Decrypts the OTP cipher strictly for the authenticated customer.
 */
export function decryptCompletionOtp(cipherPayload: string): string | null {
  try {
    if (!cipherPayload || !cipherPayload.includes(':')) return null;
    const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return null;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[OTP Decryption Error]', err);
    return null;
  }
}

/**
 * Verifies the submitted OTP against the stored salt and hash using timing-safe comparison.
 */
export function verifyCompletionOtp(submittedOtp: string, salt: string, expectedHash: string): boolean {
  if (!submittedOtp || !salt || !expectedHash) return false;
  const cleanSubmitted = String(submittedOtp).trim();
  if (!/^\d{6}$/.test(cleanSubmitted)) return false;

  const computedHash = crypto.createHmac('sha256', salt).update(cleanSubmitted).digest('hex');

  try {
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
