// Parses a free-form price string selected on a web page into
// { prix_min, prix_max } (euros). Returns null if nothing recognizable, so the
// caller can show an error instead of sending garbage to the API.
//   "12 €" -> {12, null}      "gratuit" / "entrée libre" -> {0, null}
//   "5 à 10 €" / "5-10€" / "de 5 € à 10 €" -> {5, 10}   "12,50 euros" -> {12.5, null}

function toNumber(text) {
  return Number(text.replace(',', '.'));
}

function parsePriceString(raw) {
  const text = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  if (/\b(gratuit|gratuite|gratuitement|entrée libre|entree libre|free)\b/.test(text)) {
    return { prix_min: 0, prix_max: null };
  }
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) || []).map(toNumber);
  if (numbers.length === 0 || numbers.length > 2) return null;
  const [first, second] = numbers;
  if (second === undefined || second === first) return { prix_min: first, prix_max: null };
  return { prix_min: Math.min(first, second), prix_max: Math.max(first, second) };
}
