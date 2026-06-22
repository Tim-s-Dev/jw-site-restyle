// GET /api/studio-availability?hours=4&days=21
// Returns valid studio start times (where the full N-hour block is free),
// grouped by local date, for the next `days` days.
const { getFreeSlots } = require('../lib/ghl');
const { validStartsByDay } = require('../lib/slots');
const { MIN_HOURS, MAX_HOURS } = require('../lib/pricing');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const hours = parseInt(req.query.hours, 10);
    if (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
      return res.status(400).json({ error: `hours must be ${MIN_HOURS}-${MAX_HOURS}` });
    }
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 21, 1), 60);

    // Lead time: start from tomorrow so customers can't book same-day.
    const now = Date.now();
    const startMs = now + 24 * 3600000;
    const endMs = now + days * 24 * 3600000;

    const free = await getFreeSlots(startMs, endMs);
    const byDay = validStartsByDay(free, hours);

    const days_out = Object.keys(byDay).sort().map((date) => ({
      date,
      slots: byDay[date].map((s) => ({ iso: s.iso })),
    }));

    res.status(200).json({ hours, timezone: process.env.BOOKING_TZ || 'America/Chicago', days: days_out });
  } catch (err) {
    console.error('studio-availability error:', err);
    res.status(502).json({ error: 'Could not load availability', detail: String(err.message || err) });
  }
};
