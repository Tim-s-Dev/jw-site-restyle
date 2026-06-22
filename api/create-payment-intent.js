// POST /api/create-payment-intent
// Body: { hours, slotIso, name, email, phone, notes }
// Server recomputes the price (never trust the client) and creates a Stripe
// PaymentIntent. Booking details ride along in metadata so confirm-booking can
// create the GHL appointment after payment succeeds.
const { priceForHours, priceCents } = require('../lib/pricing');
const { addHoursIso } = require('../lib/slots');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { hours, slotIso, name, email, phone, notes } = await readBody(req);

    if (!email || !name) return res.status(400).json({ error: 'Name and email are required' });
    if (!slotIso || !/T\d{2}:\d{2}/.test(String(slotIso))) return res.status(400).json({ error: 'A valid time slot is required' });

    let amount, dollars, endIso;
    try {
      dollars = priceForHours(hours);
      amount = priceCents(hours);
      endIso = addHoursIso(slotIso, Number(hours));
    } catch (e) {
      return res.status(400).json({ error: String(e.message || e) });
    }

    const mode = process.env.PAYMENTS_MODE || 'live';
    if (mode === 'mock') {
      // Local UI testing without touching Stripe.
      return res.status(200).json({
        clientSecret: 'mock_client_secret',
        paymentIntentId: 'pi_mock_' + Date.now(),
        amount, dollars, endIso, mock: true,
      });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      description: `JourneyWell studio — ${hours}hr session`,
      receipt_email: email,
      metadata: {
        product: 'studio-booking',
        hours: String(hours),
        startIso: slotIso,
        endIso,
        name, email, phone: phone || '', notes: notes || '',
      },
    });

    res.status(200).json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount, dollars, endIso,
    });
  } catch (err) {
    console.error('create-payment-intent error:', err);
    res.status(500).json({ error: 'Could not start checkout', detail: String(err.message || err) });
  }
};
