import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended by NIST for GCM
const KEY_LENGTH = 32; // 256 bits

let cachedKey: Buffer | null = null;

/**
 * Retrieves or derives a stable 256-bit encryption key.
 * 1. Checks process.env.ENCRYPTION_KEY
 * 2. Checks data/.vault_key
 * 3. If neither exists, generates a fresh random key and persists to data/.vault_key and .env
 */
export function getVaultKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  // 1. Check process.env
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.trim()) {
    const trimmed = envKey.trim();
    if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      cachedKey = Buffer.from(trimmed, 'hex');
      return cachedKey;
    }
    // Derive 32 bytes from arbitrary passphrase
    cachedKey = crypto.scryptSync(trimmed, 'meridian-vault-salt', KEY_LENGTH);
    return cachedKey;
  }

  // 2. Check data/.vault_key
  const dataDir = path.resolve(process.cwd(), 'data');
  const vaultKeyPath = path.join(dataDir, '.vault_key');
  const envPath = path.resolve(process.cwd(), '.env');

  try {
    if (fs.existsSync(vaultKeyPath)) {
      const stored = fs.readFileSync(vaultKeyPath, 'utf-8').trim();
      if (stored.length === 64 && /^[0-9a-fA-F]+$/.test(stored)) {
        cachedKey = Buffer.from(stored, 'hex');
        process.env.ENCRYPTION_KEY = stored;
        return cachedKey;
      }
    }
  } catch (err) {
    console.warn('[Crypto] Could not read .vault_key:', err);
  }

  // 3. Generate fresh key
  const fresh = crypto.randomBytes(KEY_LENGTH);
  const freshHex = fresh.toString('hex');
  cachedKey = fresh;
  process.env.ENCRYPTION_KEY = freshHex;

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(vaultKeyPath, freshHex, 'utf-8');

    // Also persist to .env if possible
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (!envContent.includes('ENCRYPTION_KEY=')) {
        envContent += `\nENCRYPTION_KEY=${freshHex}\n`;
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }
    } else {
      fs.writeFileSync(envPath, `ENCRYPTION_KEY=${freshHex}\n`, 'utf-8');
    }
    console.log('[Crypto] Initialized fresh AES-256-GCM vault key and persisted securely.');
  } catch (err) {
    console.warn('[Crypto] Could not write vault key to disk:', err);
  }

  return cachedKey;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getVaultKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf-8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    ciphertext
  };
}

/**
 * Decrypts an EncryptedPayload back to plaintext string.
 */
export function decrypt(payload: EncryptedPayload): string {
  if (!payload || !payload.iv || !payload.authTag || !payload.ciphertext) {
    throw new Error('Invalid EncryptedPayload format');
  }

  const key = getVaultKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}

/**
 * Type guard for EncryptedPayload
 */
export function isEncryptedPayload(val: unknown): val is EncryptedPayload {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as any).iv === 'string' &&
    typeof (val as any).authTag === 'string' &&
    typeof (val as any).ciphertext === 'string'
  );
}
