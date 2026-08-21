/**
 * SHA-256 PIN hashing using the browser's native Web Crypto API.
 * Salt includes the guard name so two guards with the same PIN
 * have different hashes in the database.
 */
export async function hashPin(pin, name) {
  const salt = `hsa_${name.toLowerCase().replace(/\s+/g, '_')}_v1`;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pin}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
