// POST /api/confirm-booking
// Body: { paymentIntentId, hours, slotIso, name, email, phone, notes }
// Verifies the payment actually succeeded (server-side, via Stripe) and only then
// creates the GHL appointment for the full session block. This ordering is what
// makes the flow reliable: no booking is ever created without a confirmed payment.
const { priceForHours } = require('../lib/pricing');
const { addHoursIso } = require('../lib/slots');
const { findOrCreateContact, createAppointment } = require('../lib/ghl');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

function fmt(iso, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: tz,
    }).format(new Date(iso));
  } catch { return iso; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const b = await readBody(req);
    const paymentsMode = process.env.PAYMENTS_MODE || 'live';
    const bookingMode = process.env.BOOKING_MODE || 'live';
    const tz = process.env.BOOKING_TZ || 'America/Chicago';

    // 1) Establish the authoritative booking details.
    let details;
    if (paymentsMode === 'mock') {
      details = { hours: Number(b.hours), startIso: b.slotIso, name: b.name, email: b.email, phone: b.phone, notes: b.notes };
    } else {
      if (!b.paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const pi = await stripe.paymentIntents.retrieve(b.paymentIntentId);
      if (pi.status !== 'succeeded') {
        return res.status(402).json({ error: `Payment not completed (status: ${pi.status})` });
      }
      const m = pi.metadata || {};
      details = { hours: Number(m.hours), startIso: m.startIso, name: m.name, email: m.email, phone: m.phone, notes: m.notes };
    }

    if (!details.startIso || !details.hours) return res.status(400).json({ error: 'Incomplete booking details' });
    const endIso = addHoursIso(details.startIso, details.hours);
    const dollars = priceForHours(details.hours);
    const title = `Studio Booking — ${details.name} (${details.hours}hr)`;
    const apptNotes = `Paid $${dollars} via Stripe. ${details.hours}-hour studio session.` +
      (details.notes ? `\nCustomer notes: ${details.notes}` : '');

    // 2) Create the GHL appointment (unless dry-run).
    let appointmentId = null;
    if (bookingMode === 'dry') {
      appointmentId = 'dry_run_no_write';
    } else {
      const contactId = await findOrCreateContact({ name: details.name, email: details.email, phone: details.phone });
      const appt = await createAppointment({ contactId, startTime: details.startIso, endTime: endIso, title, notes: apptNotes });
      appointmentId = appt.id;
    }

    res.status(200).json({
      booked: true,
      appointmentId,
      dryRun: bookingMode === 'dry',
      hours: details.hours,
      dollars,
      startIso: details.startIso,
      endIso,
      when: fmt(details.startIso, tz),
      timezone: tz,
    });
  } catch (err) {
    console.error('confirm-booking error:', err);
    res.status(500).json({ error: 'Booking failed after payment', detail: String(err.message || err) });
  }
};
