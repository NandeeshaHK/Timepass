/**
 * High-Performance In-Memory Ephemeral Decryptor using native Web Crypto API
 * AES-GCM (256-bit) with PBKDF2 (100,000 iterations, SHA-256)
 * Caches derived CryptoKey in-memory so subsequent page turns take < 1ms instead of 300ms.
 */

// In-memory key cache keyed by saltHex + passphrase
const keyCache = new Map();

function bufferToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives an AES-GCM CryptoKey in-memory from the user passphrase and salt.
 * @param {string} passphrase 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt) {
  const cacheKey = `${bufferToHex(salt)}_${passphrase}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey);
  }

  const enc = new TextEncoder();
  const rawKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Decrypts an encrypted binary payload (.enc ArrayBuffer).
 * Format: [16 bytes salt][12 bytes IV][16 bytes authTag][ciphertext]
 * @param {ArrayBuffer} encryptedBuffer 
 * @param {string} passphrase 
 * @returns {Promise<string>} Plaintext string
 */
export async function decryptEncPayload(encryptedBuffer, passphrase) {
  const bytes = new Uint8Array(encryptedBuffer);

  if (bytes.byteLength < 44) {
    throw new Error('Invalid encrypted payload size');
  }

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const authTag = bytes.slice(28, 44);
  const ciphertext = bytes.slice(44);

  // Web Crypto expects ciphertext + authTag appended together
  const combinedCiphertext = new Uint8Array(ciphertext.length + authTag.length);
  combinedCiphertext.set(ciphertext, 0);
  combinedCiphertext.set(authTag, ciphertext.length);

  // Instant lookup for derived key after first derive
  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      combinedCiphertext
    );

    const decoder = new TextDecoder('utf-8');
    const plaintext = decoder.decode(decryptedBuffer);
    return plaintext;
  } catch (err) {
    throw new Error('Decryption failed. Incorrect passphrase or corrupted data.');
  }
}

/**
 * Verifies if a given passphrase can successfully decrypt the catalog.
 * @param {ArrayBuffer} catalogBuffer 
 * @param {string} passphrase 
 * @returns {Promise<Array>} Decrypted catalog array
 */
export async function verifyAndDecryptCatalog(catalogBuffer, passphrase) {
  const jsonStr = await decryptEncPayload(catalogBuffer, passphrase);
  return JSON.parse(jsonStr);
}
