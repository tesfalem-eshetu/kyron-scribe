// Patient identity matching is done on normalized names + DOB (master plan 6.3/7.1).
// Normalization: trim, lowercase, collapse internal whitespace.
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Parses a "YYYY-MM-DD" date-of-birth string into a UTC-midnight Date so the
// value is stable for the unique (normFirst, normLast, dateOfBirth) match.
export function parseDateOfBirth(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
