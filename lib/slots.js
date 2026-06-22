// Slot math for multi-hour studio sessions on a single GHL calendar.
//
// GHL's free-slots returns hourly start times that are individually open. For an
// N-hour session we only want starts where the *whole* block is free — i.e. N
// consecutive hourly slots are all available. This lets one calendar serve every
// 2–8 hour length without separate per-duration calendars, and prevents booking a
// long session that would overlap an existing appointment later in the block.

// Add `hours` to an ISO timestamp that carries an explicit offset (e.g. -05:00),
// preserving that same offset in the output.
function addHoursIso(iso, hours) {
  const offset = iso.slice(-6); // "-05:00" / "+00:00"
  const sign = offset[0] === '-' ? -1 : 1;
  const offMin = sign * (parseInt(offset.slice(1, 3), 10) * 60 + parseInt(offset.slice(4, 6), 10));
  const targetMs = Date.parse(iso) + hours * 3600000;
  // Shift into the wall-clock frame of the offset, then read UTC fields.
  const wall = new Date(targetMs + offMin * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return `${wall.getUTCFullYear()}-${p(wall.getUTCMonth() + 1)}-${p(wall.getUTCDate())}` +
         `T${p(wall.getUTCHours())}:${p(wall.getUTCMinutes())}:${p(wall.getUTCSeconds())}${offset}`;
}

// Given GHL free-slots JSON + desired session length, return valid start times
// grouped by local date: { "YYYY-MM-DD": [{ iso, ms }] }.
function validStartsByDay(freeSlotsJson, hours) {
  const dates = Object.keys(freeSlotsJson).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
  // Global set of every open start (epoch ms), across all days.
  const allMs = new Set();
  const perDay = {};
  for (const d of dates) {
    const slots = (freeSlotsJson[d] && freeSlotsJson[d].slots) || [];
    perDay[d] = slots.map((iso) => ({ iso, ms: Date.parse(iso) })).sort((a, b) => a.ms - b.ms);
    perDay[d].forEach((s) => allMs.add(s.ms));
  }
  const out = {};
  for (const d of dates) {
    const day = perDay[d];
    if (!day.length) continue;
    // Detect granularity (smallest gap); default to 1 hour.
    let stepMs = 3600000;
    for (let i = 1; i < day.length; i++) {
      const gap = day[i].ms - day[i - 1].ms;
      if (gap > 0 && gap < stepMs) stepMs = gap;
    }
    const need = Math.round((hours * 3600000) / stepMs); // # of consecutive slots required
    const valid = day.filter((s) => {
      for (let k = 0; k < need; k++) {
        if (!allMs.has(s.ms + k * stepMs)) return false;
      }
      return true;
    });
    if (valid.length) out[d] = valid.map((s) => ({ iso: s.iso, ms: s.ms }));
  }
  return out;
}

module.exports = { addHoursIso, validStartsByDay };
