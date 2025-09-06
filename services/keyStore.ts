// Simple client-side key storage with optional passphrase encryption.
// Uses Web Crypto AES-GCM and PBKDF2 to derive a key from a passphrase.

export type Provider = 'google' | 'openrouter';

const STORAGE_KEYS = {
  encrypted: 'aps.keys.encrypted',
  iv: 'aps.keys.iv',
  salt: 'aps.keys.salt',
  provider: 'aps.provider',
  appEnc: 'aps.app.encrypted',
  appIv: 'aps.app.iv',
  appSalt: 'aps.app.salt',
} as const;

export interface StoredKeys {
  google?: string;
  openrouter?: string;
}

let inMemoryKeys: StoredKeys | null = null;
let inMemoryApp: any | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function saveKeys(keys: StoredKeys, passphrase?: string): Promise<void> {
  if (!passphrase) {
    // No passphrase: keep only in memory for the session
    inMemoryKeys = keys;
    localStorage.removeItem(STORAGE_KEYS.encrypted);
    localStorage.removeItem(STORAGE_KEYS.iv);
    localStorage.removeItem(STORAGE_KEYS.salt);
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = JSON.stringify(keys);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plaintext))
  );
  localStorage.setItem(STORAGE_KEYS.encrypted, bufferToBase64(ciphertext));
  localStorage.setItem(STORAGE_KEYS.iv, bufferToBase64(iv));
  localStorage.setItem(STORAGE_KEYS.salt, bufferToBase64(salt));
  inMemoryKeys = keys; // keep in memory too for convenience
}

export async function loadKeys(passphrase?: string): Promise<StoredKeys | null> {
  if (!passphrase) {
    return inMemoryKeys;
  }
  const enc = localStorage.getItem(STORAGE_KEYS.encrypted);
  const ivb64 = localStorage.getItem(STORAGE_KEYS.iv);
  const saltb64 = localStorage.getItem(STORAGE_KEYS.salt);
  if (!enc || !ivb64 || !saltb64) return null;
  try {
    const iv = base64ToBuffer(ivb64);
    const salt = base64ToBuffer(saltb64);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBuffer(enc)
    );
    const text = textDecoder.decode(new Uint8Array(decrypted));
    const parsed: StoredKeys = JSON.parse(text);
    inMemoryKeys = parsed;
    return parsed;
  } catch {
    return null;
  }
}

// Generic encrypted app data (e.g., history, usage)
export async function saveAppData(data: any, passphrase?: string): Promise<void> {
  if (!passphrase) {
    inMemoryApp = data;
    localStorage.removeItem(STORAGE_KEYS.appEnc);
    localStorage.removeItem(STORAGE_KEYS.appIv);
    localStorage.removeItem(STORAGE_KEYS.appSalt);
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = JSON.stringify(data ?? {});
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plaintext))
  );
  localStorage.setItem(STORAGE_KEYS.appEnc, bufferToBase64(ciphertext));
  localStorage.setItem(STORAGE_KEYS.appIv, bufferToBase64(iv));
  localStorage.setItem(STORAGE_KEYS.appSalt, bufferToBase64(salt));
  inMemoryApp = data;
}

export async function loadAppData<T = any>(passphrase?: string): Promise<T | null> {
  if (!passphrase) return inMemoryApp;
  const enc = localStorage.getItem(STORAGE_KEYS.appEnc);
  const ivb64 = localStorage.getItem(STORAGE_KEYS.appIv);
  const saltb64 = localStorage.getItem(STORAGE_KEYS.appSalt);
  if (!enc || !ivb64 || !saltb64) return null;
  try {
    const iv = base64ToBuffer(ivb64);
    const salt = base64ToBuffer(saltb64);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBuffer(enc));
    const text = textDecoder.decode(new Uint8Array(decrypted));
    const parsed = JSON.parse(text) as T;
    inMemoryApp = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function getProvider(): Provider {
  const v = localStorage.getItem(STORAGE_KEYS.provider);
  return (v === 'openrouter' ? 'openrouter' : 'google');
}

export function setProvider(p: Provider) {
  localStorage.setItem(STORAGE_KEYS.provider, p);
}

function bufferToBase64(buf: Uint8Array): string {
  if (typeof window === 'undefined') return '';
  let binary = '';
  const bytes = buf;
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}
