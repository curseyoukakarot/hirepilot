import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 128 bits for CBC
const SALT_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_SECRET;
  if (!key) {
    throw new Error('ENCRYPTION_SECRET environment variable is required');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
  }
  return key;
}

/**
 * Derive encryption key from master key and salt using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, 32, 'sha256');
}

/**
 * Encrypt a LinkedIn cookie using AES-256-CBC
 * @param plaintext - The li_at cookie value to encrypt
 * @returns Encrypted string with format: salt:iv:ciphertext (base64 encoded)
 */
export function encryptCookie(plaintext: string): string {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid plaintext provided for encryption');
    }

    const masterKey = getEncryptionKey();
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive encryption key
    const key = deriveKey(masterKey, salt);
    
    // Create cipher
    const cipher = crypto.createCipher(ALGORITHM, key);
    
    // Encrypt the plaintext
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    // Combine all components: salt:iv:ciphertext
    const encrypted = [
      salt.toString('base64'),
      iv.toString('base64'),
      ciphertext
    ].join(':');
    
    console.log('[Encryption] Cookie encrypted successfully');
    return encrypted;
    
  } catch (error: any) {
    console.error('[Encryption] Error encrypting cookie:', error.message);
    throw new Error(`Failed to encrypt cookie: ${error.message}`);
  }
}

/**
 * Decrypt a LinkedIn cookie using AES-256-CBC
 * @param encrypted - The encrypted string from encryptCookie
 * @returns Decrypted li_at cookie value
 */
export function decryptCookie(encrypted: string): string {
  try {
    if (!encrypted || typeof encrypted !== 'string') {
      throw new Error('Invalid encrypted data provided for decryption');
    }

    const masterKey = getEncryptionKey();
    
    // Split the encrypted string
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [saltB64, ivB64, ciphertext] = parts;
    
    // Decode components
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    
    // Derive the same encryption key
    const key = deriveKey(masterKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipher(ALGORITHM, key);
    
    // Decrypt the ciphertext
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    
    console.log('[Encryption] Cookie decrypted successfully');
    return plaintext;
    
  } catch (error: any) {
    console.error('[Encryption] Error decrypting cookie:', error.message);
    throw new Error(`Failed to decrypt cookie: ${error.message}`);
  }
}

/**
 * Create a SHA-256 hash of the cookie for validation purposes
 * @param cookie - The plain li_at cookie value
 * @returns SHA-256 hash as hex string
 */
export function hashCookie(cookie: string): string {
  try {
    if (!cookie || typeof cookie !== 'string') {
      throw new Error('Invalid cookie provided for hashing');
    }
    
    return crypto
      .createHash('sha256')
      .update(cookie)
      .digest('hex');
      
  } catch (error: any) {
    console.error('[Encryption] Error hashing cookie:', error.message);
    throw new Error(`Failed to hash cookie: ${error.message}`);
  }
}

/**
 * Validate that a cookie matches its stored hash
 * @param cookie - The plain cookie to validate
 * @param storedHash - The stored hash to compare against
 * @returns True if cookie matches hash
 */
export function validateCookieHash(cookie: string, storedHash: string): boolean {
  try {
    const computedHash = hashCookie(cookie);
    return computedHash === storedHash;
  } catch (error: any) {
    console.error('[Encryption] Error validating cookie hash:', error.message);
    return false;
  }
}

/**
 * Generate a secure random token for session validation
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Estimate LinkedIn cookie expiration time
 * LinkedIn cookies typically last 12-24 months
 * @returns Date object representing estimated expiration
 */
export function estimateCookieExpiration(): Date {
  const now = new Date();
  // Add 18 months as a conservative estimate
  now.setMonth(now.getMonth() + 18);
  return now;
} 