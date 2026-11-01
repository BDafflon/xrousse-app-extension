// Parses a free-form date string selected on a web page into the naive
// ISO 8601 format the backend expects (NaiveDatetime, e.g.
// "2026-11-15T19:00:00" — no timezone offset). Returns null if the text
// doesn't match any supported format, letting the caller show an error
// instead of sending garbage to the API.

const MONTHS_FR = {
  janvier: 1, jan: 1, 'janv.': 1, janv: 1,
  février: 2, fevrier: 2, fév: 2, fev: 2, 'févr.': 2, fevr: 2,
  mars: 3,
  avril: 4, avr: 4, 'avr.': 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7, 'juil.': 7,
  août: 8, aout: 8,
  septembre: 9, sept: 9, 'sept.': 9,
  octobre: 10, oct: 10, 'oct.': 10,
  novembre: 11, nov: 11, 'nov.': 11,
  décembre: 12, decembre: 12, déc: 12, dec: 12, 'déc.': 12,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIso(year, month, day, hour, minute, second) {
  const date = new Date(year, month - 1, day, hour, minute, second);
  // New Date() silently rolls over out-of-range fields (e.g. day=32 becomes
  // next month) instead of failing, so re-check the parsed parts match what
  // was actually requested before trusting the result.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

function parseTimePart(text) {
  if (!text) return { hour: 0, minute: 0, second: 0 };
  // "19h30", "19h", "19:30", "19:30:00", optionally preceded by "à "/"a "
  const match = text.trim().match(/^(?:à|a)?\s*(\d{1,2})\s*[h:]\s*(\d{1,2})?\s*(?::\s*(\d{1,2}))?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] !== undefined ? Number(match[2]) : 0;
  const second = match[3] !== undefined ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function parseNumeric(text) {
  // ISO: 2026-11-15 or 2026-11-15T19:30[:00]
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, y, m, d, h, mi, s] = match;
    return toIso(Number(y), Number(m), Number(d), Number(h || 0), Number(mi || 0), Number(s || 0));
  }

  // JJ/MM/AAAA or JJ-MM-AAAA, optionally followed by a time part.
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT,]+(.+))?$/);
  if (match) {
    const [, d, m, y, timeText] = match;
    const time = parseTimePart(timeText);
    if (time === null) return null;
    return toIso(Number(y), Number(m), Number(d), time.hour, time.minute, time.second);
  }

  return null;
}

function parseFrenchMonth(text) {
  // "15 novembre 2026", "15 nov. 2026 à 19h30", "15 nov 2026 19h"
  const match = text.match(/^(\d{1,2})\s+([a-zéû.]+)\s+(\d{4})(?:[\s,]+(.+))?$/i);
  if (!match) return null;
  const [, dayText, monthText, yearText, timeText] = match;
  const month = MONTHS_FR[monthText.toLowerCase()];
  if (!month) return null;
  const time = parseTimePart(timeText);
  if (time === null) return null;
  return toIso(Number(yearText), month, Number(dayText), time.hour, time.minute, time.second);
}

function parseDateString(raw) {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  return parseNumeric(text) ?? parseFrenchMonth(text);
}
