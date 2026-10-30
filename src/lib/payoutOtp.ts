import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Ephemeral fallback key generated uniquely in-memory per process session (never hardcoded in source)
let ephemeralSessionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  const configuredSecret = process.env.PAYOUT_OTP_SECRET || process.env.AUTH_SECRET;

  if (configuredSecret && configuredSecret.trim()) {
    return crypto.createHash('sha256').update(configuredSecret.trim()).digest();
  }

  // In production, strictly enforce that a server secret must be configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Security Exception: PAYOUT_OTP_SECRET is required in production environment. Configure PAYOUT_OTP_SECRET in your server environment variables.'
    );
  }

  // In non-production environments, generate an ephemeral in-memory 256-bit random key
  if (!ephemeralSessionKey) {
    ephemeralSessionKey = crypto.randomBytes(32);
    console.warn(
      '[SECURITY NOTICE] PAYOUT_OTP_SECRET is not set in environment. Using ephemeral in-memory 256-bit key for this development session. Set PAYOUT_OTP_SECRET in your .env or server environment for persistent encryption.'
    );
  }

  return ephemeralSessionKey;
}

/**
 * Generates a cryptographically secure 6-digit OTP, salt, HMAC-SHA256 hash, and encrypted cipher.
 * Fails safely if required server-side encryption key cannot be derived.
 */
export function generateSecureCompletionOtp(expiresInHours = 48) {
  const encryptionKey = getEncryptionKey();

  // 1. Generate unpredictable 6-digit numeric OTP (100000 - 999999)
  const numericOtp = crypto.randomInt(100000, 1000000).toString();

  // 2. Cryptographic Salt (16 bytes random)
  const salt = crypto.randomBytes(16).toString('hex');

  // 3. HMAC-SHA256 Hash for tamper-proof verification
  const hash = crypto.createHmac('sha256', salt).update(numericOtp).digest('hex');

  // 4. AES-256-GCM Cipher for customer-only authenticated retrieval
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
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

function tryDecryptWithKey(cipherPayload: string, key: Buffer): string | null {
  if (!cipherPayload || !cipherPayload.includes(':')) return null;
  const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
  if (!ivHex || !tagHex || !encryptedHex) return null;

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Decrypts the OTP cipher strictly for the authenticated customer.
 * Never logs raw OTP or cipher payloads. Fails safely on missing key or tampered payload.
 */
export function decryptCompletionOtp(cipherPayload: string): string | null {
  try {
    const key = getEncryptionKey();
    return tryDecryptWithKey(cipherPayload, key);
  } catch {
    // Attempt fallback with legacy secret if configured for data migration compatibility
    if (process.env.LEGACY_OTP_SECRET) {
      try {
        const legacyKey = crypto.createHash('sha256').update(process.env.LEGACY_OTP_SECRET).digest();
        return tryDecryptWithKey(cipherPayload, legacyKey);
      } catch {
        return null;
      }
    }
    // Fail safely without logging sensitive cipher payloads or throwing unhandled errors
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
