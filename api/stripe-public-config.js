// Returns the Stripe publishable key + payment mode to the browser.
// Keeping this server-fed lets us swap test↔live keys with zero code changes.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    paymentsMode: process.env.PAYMENTS_MODE || 'live',
  });
};
