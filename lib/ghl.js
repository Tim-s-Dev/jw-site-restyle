// GoHighLevel (LeadConnector) v2 API helper — server-side only.
// Uses a Private Integration Token (PIT). Never expose these to the browser.
const GHL_BASE = 'https://services.leadconnectorhq.com';

function cfg() {
  return {
    pit: process.env.GHL_PIT,
    locationId: process.env.GHL_LOCATION_ID,
    calendarId: process.env.GHL_STUDIO_CALENDAR_ID,
    assignedUserId: process.env.GHL_STUDIO_ASSIGNED_USER_ID,
    tz: process.env.BOOKING_TZ || 'America/Chicago',
  };
}

async function ghlFetch(path, { method = 'GET', body } = {}) {
  const { pit } = cfg();
  if (!pit) throw new Error('GHL_PIT is not configured');
  const res = await fetch(GHL_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${pit}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // A descriptive browser-like UA avoids LeadConnector's Cloudflare bot filter.
      'User-Agent': 'Mozilla/5.0 (compatible; JourneyWellStudioBooking/1.0)',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, ok: res.ok, json };
}

// Raw free-slots for the studio calendar within [startMs, endMs].
async function getFreeSlots(startMs, endMs) {
  const { calendarId, tz } = cfg();
  const qs = new URLSearchParams({
    startDate: String(startMs),
    endDate: String(endMs),
    timezone: tz,
  });
  const { status, ok, json } = await ghlFetch(`/calendars/${calendarId}/free-slots?${qs}`);
  if (!ok) throw new Error(`GHL free-slots failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  return json; // { "YYYY-MM-DD": { slots: [iso,...] }, ... }
}

// Create or reuse a contact by email; returns contactId.
async function findOrCreateContact({ name, email, phone }) {
  const { locationId } = cfg();
  const [firstName, ...rest] = String(name || '').trim().split(/\s+/);
  const body = {
    locationId,
    firstName: firstName || 'Studio',
    lastName: rest.join(' ') || 'Guest',
    email,
    phone: phone || undefined,
    source: 'Website — Studio Booking',
  };
  const { status, json } = await ghlFetch('/contacts/', { method: 'POST', body });
  const contact = json.contact || json;
  if (contact && contact.id) return contact.id;
  // Duplicate email → GHL returns the existing contactId in meta.
  const dup = json.meta && json.meta.contactId;
  if (dup) return dup;
  throw new Error(`GHL contact create failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
}

// Create a confirmed appointment for the given block. startTime/endTime are ISO w/ offset.
async function createAppointment({ contactId, startTime, endTime, title, notes }) {
  const { calendarId, locationId, assignedUserId } = cfg();
  const body = {
    calendarId,
    locationId,
    contactId,
    assignedUserId,
    startTime,
    endTime,
    title: title || 'Studio Booking',
    appointmentStatus: 'confirmed',
    ignoreFreeSlotValidation: true,
    notes: notes || undefined,
  };
  const { status, ok, json } = await ghlFetch('/calendars/events/appointments', { method: 'POST', body });
  const id = json.id || (json.event && json.event.id) || (json.appointment && json.appointment.id);
  if (!ok || !id) throw new Error(`GHL appointment create failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  return { id, raw: json };
}

module.exports = { cfg, ghlFetch, getFreeSlots, findOrCreateContact, createAppointment };
