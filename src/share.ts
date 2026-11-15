// User-controlled sharing. The user picks which items go into the pack.
// The pack is compressed, then encrypted with AES-256-GCM using a key derived
// from a 6-digit PIN (PBKDF2-SHA256, 210k iterations, random salt).
// It travels only in the URL fragment (#...), which browsers never send to a
// server, so Sanad has no server copy of anyone's reproductive data.
// The PIN is told to the clinician separately (spoken, or shown on screen).

export type SharePayload = {
  v: 1;
  exp: number; // epoch ms; clinician view refuses expired packs
  level: string;
  signals: string[];
  fields: Record<string, unknown>;
  prefs?: Record<string, unknown>;
  createdAt?: number;
  engine?: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 210_000;

function b64u(buf: Uint8Array) {
  let s = ''; buf.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function keyFrom(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function newPin() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

export async function packShare(p: SharePayload, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await pipe(enc.encode(JSON.stringify(p)), new CompressionStream('deflate-raw'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pin, salt), plain as BufferSource));
  const all = new Uint8Array(1 + 16 + 12 + ct.length);
  all[0] = 1; all.set(salt, 1); all.set(iv, 17); all.set(ct, 29);
  return b64u(all);
}

export async function openShare(token: string, pin: string): Promise<SharePayload> {
  const all = unb64u(token);
  if (all[0] !== 1) throw new Error('Unknown pack version');
  const salt = all.slice(1, 17), iv = all.slice(17, 29), ct = all.slice(29);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await keyFrom(pin, salt), ct);
  const json = await pipe(new Uint8Array(plain), new DecompressionStream('deflate-raw'));
  return JSON.parse(dec.decode(json));
}
