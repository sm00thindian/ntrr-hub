/**
 * Lightweight phone helpers for Hub ↔ Reliant correlation.
 * Prefer E.164 (+1… for NANP). Not a full libphonenumber replacement.
 */

/** Normalize common US/CA input to E.164 when possible; otherwise return cleaned +null */
export function normalizeToE164(input: string, defaultCountry = "US"): string | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  // NANP: 10 digits or 11 with leading 1
  if (defaultCountry === "US" || defaultCountry === "CA") {
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) {
    return "";
  }
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (m) {
    return `(${m[1]}) ${m[2]}-${m[3]}`;
  }
  return e164;
}
