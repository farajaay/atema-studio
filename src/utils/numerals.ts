const E = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'] as const;

/** 5 → "٥",  400 → "٤٠٠" */
export function toEastern(n: number): string {
  return String(n).replace(/\d/g, d => E[+d]);
}

/** "٥ ساعات" → "5 ساعات"  (all Eastern digits replaced inline) */
export function westernize(s: string): string {
  return s.replace(/[٠-٩]/g, d => String(E.indexOf(d as typeof E[number])));
}

/** Parse an Eastern-or-Western digit string to a JS number. */
export function parseEastern(s: string): number {
  return Number(westernize(s));
}

/** Replace every Western digit in a string with its Eastern equivalent. */
export function easternize(s: string): string {
  return s.replace(/\d/g, d => E[+d]);
}
