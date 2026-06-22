// Studio session pricing — single source of truth (server-side, authoritative).
// $250 for the 2-hour minimum, +$125 for each additional hour, capped at 8 hours.
const BASE_PRICE = 250;       // 2-hour minimum
const HOURLY_ADD = 125;       // each hour after the first 2
const MIN_HOURS = 2;
const MAX_HOURS = 8;

function priceForHours(hoursRaw) {
  const hours = Number(hoursRaw);
  if (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    throw new Error(`Invalid session length: ${hoursRaw}. Must be ${MIN_HOURS}-${MAX_HOURS} hours.`);
  }
  return BASE_PRICE + (hours - MIN_HOURS) * HOURLY_ADD; // dollars
}

function priceCents(hours) {
  return priceForHours(hours) * 100;
}

module.exports = { priceForHours, priceCents, BASE_PRICE, HOURLY_ADD, MIN_HOURS, MAX_HOURS };
