# JourneyWell Website Lead Automation — SOP

When someone submits the website form (Get Started drawer, contact forms,
studio booking, etc.), `chrome.js` POSTs JSON to a self-hosted **n8n**
webhook that fans the lead out to GoHighLevel, Notion, and Slack in
parallel. Total round trip is about 2 seconds.

This file lives in the repo so the next operator (Drake, future Claude,
anyone else) doesn't have to dig through n8n or chat history to understand
the wiring. Keep it current when anything changes.

---

## Flow

```
Website form (chrome.js)
    |  HTTPS POST { firstName, lastName, email, phone, path, message, ... }
    v
https://n8n.journeywellhub.com/webhook/jw-lead
    |
    v
n8n: "JW Website Lead Intake"  (workflow id lEWEKZubGriIj2sN, active)
    |
    +-- Normalize (Code node)
    |     - splits name into first/last
    |     - tags = ["website-form", "jw-{path}"]   e.g. jw-studio, jw-authority
    |     - builds GHL upsert payload
    |     - builds Notion page payload
    |
    +-- GHL Upsert (HTTP)         services.leadconnectorhq.com/contacts/upsert
    |   Notion Log (HTTP)         api.notion.com/v1/pages
    |        (run in parallel; dedupe by email handled by GHL)
    |
    +-- Slack Prep -> Slack Notify (chat.postMessage)
          channel #jw-leadteam  (C0AEWAS4Y6N)
```

## Key IDs

| Thing | ID |
|---|---|
| n8n workflow | `lEWEKZubGriIj2sN` (JW Website Lead Intake) |
| GHL location | `oHRQ5zrDv5a4WxPsJS5c` |
| Notion DB (LeadsDatabase2.0) | `29533cd7-4395-81db-b06d-c9dfd47b457c` |
| Slack channel | `C0AEWAS4Y6N` (#jw-leadteam) |

## Endpoints / Access

- **n8n UI**: https://n8n.journeywellhub.com
  Creds live in the vault as `N8N_OWNER_EMAIL`, `N8N_OWNER_PASSWORD`,
  `N8N_API_KEY`.
- **n8n VPS**: `ssh tim@100.120.251.70`
- **nginx CORS** at `/etc/nginx/sites-available/n8n.journeywellhub.com`
  - Location `/webhook/` answers the OPTIONS preflight at the nginx layer.
  - n8n itself adds `Access-Control-Allow-Origin` on the POST response.
  - **Do not** add ACAO at both layers — duplicate headers will break
    the browser's CORS check.
- **Live site**: https://jw-site-restyle.vercel.app
  - Vercel project is **not** git-connected. See `project_jw_site_vercel_deploy`
    memory or the deploy section below.

## The webhook URL

`chrome.js`, around line 152:

```js
const GHL_WEBHOOK_URL = 'https://n8n.journeywellhub.com/webhook/jw-lead';
```

**Do not leave this empty in `main` or in any commit that will be deployed.**
Historically, Tim set this in production from his Mac copy without
committing the value back to `Tim-s-Dev/platforms`. On 2026-06-05 a deploy
from Drake's copy overwrote the live URL with an empty string and silently
broke the form for several minutes. We restored it (commit `7d18e56`) and
the URL is now tracked in source control. Keep it that way.

## Deploying

Vercel project Root Directory is set to `jw-site-restyle`, so deploys must
run from the `platforms` repo root (not the `jw-site-restyle` subfolder).

```sh
cd C:\Users\drake\Documents\GitHub\platforms
npx --yes vercel@latest deploy --prod --yes --token=$VERCEL_TOKEN
```

After every prod deploy, verify the webhook is still wired:

```sh
curl -s https://jw-site-restyle.vercel.app/chrome.js \
  | grep -nE "GHL_WEBHOOK_URL\s*="
# expect: const GHL_WEBHOOK_URL = 'https://n8n.journeywellhub.com/webhook/jw-lead';
```

If the value comes back empty, you shipped a regression — revert or
re-apply the URL and redeploy immediately.

## Editing the automation

Two ways:

1. **n8n UI** at https://n8n.journeywellhub.com — open the
   `JW Website Lead Intake` workflow, change nodes, save, activate.
2. **n8n MCP** if it's connected in your Claude session — ask Claude to
   patch the workflow JSON via the API. Faster for batch edits.

Test fires can be sent with `curl` directly against the webhook (see the
last working test execution in n8n history for the JSON shape).

## Recovery / verification commands

```sh
# 1. Is the workflow active?
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://n8n.journeywellhub.com/api/v1/workflows/lEWEKZubGriIj2sN \
  | jq '.active'

# 2. Did the last few executions succeed?
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.journeywellhub.com/api/v1/executions?workflowId=lEWEKZubGriIj2sN&limit=5" \
  | jq '.data[] | {id, finished, mode, startedAt}'

# 3. Is the live site serving the webhook URL?
curl -s https://jw-site-restyle.vercel.app/chrome.js \
  | grep -nE "GHL_WEBHOOK_URL\s*="
```

## Known pitfalls

- **Vercel deploy from the wrong directory.** Must run from `platforms`
  repo root, not `jw-site-restyle/`. The Vercel project's Root Directory
  setting is already `jw-site-restyle`, so running from the subfolder
  makes the CLI look for `jw-site-restyle/jw-site-restyle` and fail.
- **Drake's local chrome.js can drift from production.** Tim has
  historically edited production from a separate Mac copy and not pushed
  back. Always `curl` the live `chrome.js` before deploying from this
  repo to spot config drift.
- **CORS double-headers.** Only nginx OR n8n should set
  `Access-Control-Allow-Origin`. Today nginx handles OPTIONS preflight
  and n8n sets ACAO on the POST. Don't change that without checking the
  other layer.
