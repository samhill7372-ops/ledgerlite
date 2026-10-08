const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateRecoveryCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const chars = Array.from(random(20)).map((b) => ALPHABET[b % 32]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

/** Strip separators/case so "abcd-efgh" and "ABCDEFGH" derive the same key. */
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
