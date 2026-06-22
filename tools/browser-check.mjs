// End-to-end browser test of the studio booking flow against the local dev server.
//   node tools/browser-check.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:5050';
const MOBILE = process.env.MOBILE === '1';
const SHOTS = MOBILE ? '/tmp/jw-shots-mobile' : '/tmp/jw-shots';
const VIEWPORT = MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 };
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log('•', ...a);
let step = 0;
const shot = async (page, name) => { await page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, '0')}-${name}.png`, fullPage: false }); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();
page.on('console', (m) => console.log('  [console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
page.on('response', (r) => { if (r.url().includes('/api/')) console.log('  [net]', r.status(), r.url().split('/api/')[1]); });

let failed = false;
try {
  log('open get-started?path=studio');
  await page.goto(`${BASE}/get-started.html?path=studio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-single-pill="studioHours"]', { timeout: 8000 });
  await shot(page, 'hours');

  log('pick 4-hour session');
  await page.click('.studio-hour-pill[data-val="4"]');
  await page.click('#drawerNext'); // Continue → contact

  log('fill contact');
  await page.waitForSelector('#contactName', { state: 'visible' });
  await page.fill('#contactName', 'Playwright Tester');
  await page.fill('#contactEmail', 'playwright-test@journeywell.io');
  await page.fill('#contactPhone', '+12255550199');
  await shot(page, 'contact');
  await page.click('#drawerNext'); // Choose a time →

  log('wait for live availability + pick first slot');
  await page.waitForSelector('.studio-slot', { timeout: 12000 });
  const slotCount = await page.locator('.studio-slot').count();
  log(`  ${slotCount} slots rendered`);
  await shot(page, 'calendar');
  await page.locator('.studio-slot').first().click();
  await page.click('#drawerNext'); // Continue to payment →

  log('wait for Stripe payment element');
  // summary should show price
  await page.waitForSelector('.studio-summary-row.total', { timeout: 8000 });
  const total = await page.locator('.studio-summary-row.total strong').textContent();
  log(`  summary total: ${total}`);
  // Stripe mounts nested iframes
  await page.waitForSelector('iframe[name^="__privateStripeFrame"]', { timeout: 15000 });
  await page.waitForTimeout(2500); // let Element fully render
  await shot(page, 'payment');

  log('fill test card 4242…');
  const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await frame.locator('[name="number"]').fill('4242424242424242', { timeout: 15000 });
  await frame.locator('[name="expiry"]').fill('1234');
  await frame.locator('[name="cvc"]').fill('123');
  // postal may or may not be present
  try { await frame.locator('[name="postalCode"]').fill('70816', { timeout: 2000 }); } catch {}
  await shot(page, 'card-filled');

  log('click Pay');
  const before = await page.locator('#drawerNext').textContent();
  const dis = await page.locator('#drawerNext').isDisabled();
  const cnt = await page.locator('#drawerNext').count();
  log(`  pay button: text=${JSON.stringify(before)} disabled=${dis} count=${cnt}`);
  await page.locator('#drawerNext').click({ force: true });
  await page.waitForTimeout(1500);
  log(`  pay button after click: ${JSON.stringify(await page.locator('#drawerNext').textContent())}`);

  log('wait for confirmation (step 8)');
  await page.waitForSelector('[data-step="8"].active', { timeout: 30000 });
  await page.waitForSelector('#studioDoneSummary .studio-summary-row', { timeout: 8000 });
  const doneSub = await page.locator('#studioDoneSub').textContent();
  const paid = await page.locator('#studioDoneSummary .studio-summary-row.total strong').textContent();
  await shot(page, 'confirmation');
  log(`  confirmation: "${doneSub}"  paid=${paid}`);

  if (!/booked/i.test(doneSub) || !/\$/.test(paid)) throw new Error('Confirmation content missing');
  console.log('\nRESULT: PASS ✓  (full flow: hours → contact → live calendar → Stripe → booked)');
} catch (e) {
  failed = true;
  const payErr = await page.locator('#studioPayError').textContent().catch(() => '');
  const activeStep = await page.locator('.drawer-step.active').getAttribute('data-step').catch(() => '?');
  console.log('  payError:', JSON.stringify(payErr));
  console.log('  active step at failure:', activeStep);
  await shot(page, 'FAILURE');
  console.log('\nRESULT: FAIL ✗ —', e.message);
} finally {
  await browser.close();
  console.log('screenshots in', SHOTS);
  process.exit(failed ? 1 : 0);
}
