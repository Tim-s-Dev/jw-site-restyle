# Studio Booking — architecture & operations

Paid studio booking on journeywell.io. A customer picks a session length, sees
**real** studio availability, pays with a card, and a confirmed appointment is
written to GoHighLevel — all without leaving the site.

## Why this design (the important part)

The earlier plan embedded GHL's booking **iframe** mid-checkout. That can't work
reliably: the slot is chosen inside GHL's domain, so the page has no trustworthy
event to know a slot was booked before taking payment. We removed the iframe.

Instead the site treats **GHL as a backend, not a widget**:

1. The browser asks our API for open slots → we query GHL's **free-slots API** and
   render our own on-brand calendar.
2. The customer picks a slot and pays via **Stripe** (we control the whole order).
3. Only **after** Stripe confirms the payment does the server create the GHL
   appointment. No payment → no booking; no booking attempt before payment.

This ordering makes the flow correct: you can never get paid-with-no-slot or
slot-with-no-payment, and there's no fragile cross-domain handshake.

## Flow

```
Book the studio → pick hours (2–8) → contact info → pick date/time → pay → confirmed
                       │                                  │            │         │
                  price shown                    GHL free-slots    Stripe   GHL appointment
                                                 (N-hr blocks)              (created server-side
                                                                            after payment)
```

Pricing (server-authoritative, `lib/pricing.js`): **$250** for the 2-hour minimum,
**+$125/hour** after, capped at 8 hours. (2hr=$250 … 4hr=$500 … 8hr=$1000.)

## Multi-hour slots on one calendar

The studio sells 2–8 hour sessions but GHL has one "Studio Booking" calendar with
hourly availability. `lib/slots.js` only offers a start time when **N consecutive
hourly slots are free**, so a 4-hour session can't be booked into a 2-hour gap or
overlap a later appointment. One calendar serves every length — no per-duration
calendars needed.

## Code map

| File | Role |
|------|------|
| `api/studio-availability.js` | GET open start times for a given length (GHL free-slots + consecutive-hour filter) |
| `api/create-payment-intent.js` | Recomputes price server-side, creates a Stripe PaymentIntent |
| `api/confirm-booking.js` | Verifies the payment succeeded, then creates the GHL appointment |
| `api/stripe-public-config.js` | Serves the publishable key (test↔live swap with no code change) |
| `lib/ghl.js` | GHL v2 API helper (free-slots, find/create contact, create appointment) |
| `lib/pricing.js` / `lib/slots.js` | Price + slot math (shared, tested) |
| `chrome.js` (studio block) | Drawer steps 6–8: custom calendar, Stripe Payment Element, confirmation |
| `redesign.css` (studio section) | Calendar / summary / payment styling |
| `tools/dev-server.js` | Local Vercel-like server (static + /api) |
| `tools/browser-check.mjs` | Playwright end-to-end test of the whole flow |

## Environment variables

See `.env.example`. Required: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`GHL_PIT`, `GHL_LOCATION_ID`, `GHL_STUDIO_CALENDAR_ID`,
`GHL_STUDIO_ASSIGNED_USER_ID`, `BOOKING_TZ`, plus two mode switches:

- `PAYMENTS_MODE` — `live` (real Stripe; use **test** keys to test) or `mock` (skip Stripe, local UI only)
- `BOOKING_MODE` — `live` (write the real GHL appointment) or `dry` (simulate, no calendar write)

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:5050
npm run test:e2e             # Playwright walks the full flow
```

## Going live (production checklist)

1. In Vercel → Environment Variables (Production):
   - `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` → **live** keys (`sk_live_`/`pk_live_`)
   - `PAYMENTS_MODE=live`, `BOOKING_MODE=live`
   - GHL vars as in `.env.example`
2. Confirm the Stripe account is activated for live charges (business details, bank, ID).
3. Confirm the "Studio Booking" GHL calendar timezone is **America/Chicago** and the
   meeting location is the real address (10144 Patriot Dr, Suite A, Baton Rouge, LA 70816).
4. Merge to `main` → Vercel deploys production.

## Verified

- GHL location confirmed = **JourneyWell** (`oHRQ5zrDv5a4WxPsJS5c`).
- Free-slots read, contact create, appointment create+delete all confirmed against
  the live location.
- Full browser e2e (desktop + mobile) passes: real Stripe **test** payment → booking.
- A real GHL appointment was created via `confirm-booking`, verified, and deleted.
