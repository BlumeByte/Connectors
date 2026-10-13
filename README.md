# Connectors

Personal dashboard prototype for Instagram Creator, TikTok, Facebook Page, and X.

## Run locally

Requires Node.js 18 or newer. No packages need to be installed.

Run `npm start` in this folder and open http://127.0.0.1:4173.

## Working features

- Navigation between compose, accounts, calendar, publishing desk, and live studio.
- Channel selection, shared and per-channel captions, image/video previews.
- Local draft saving, editing, deletion, and dated draft agenda.
- Responsive desktop and mobile layouts.

## Prototype boundaries

No social accounts are connected. Nothing is sent to any social network. Dates organize drafts; they do not trigger publishing. Media previews use local object URLs and files are not uploaded or retained after reload. Draft text and channel settings are stored in browser localStorage. Do not store sensitive content in a shared browser. Clear browser site data to erase drafts.

Preview layouts do not transform media. No real platform validation, OAuth, scheduler, provider API, transcoding, or livestream relay is implemented. External links open Buffer and Restream. Optional Google Fonts requests supply typography; fallback fonts work offline.

## Integration phase

Add a server-side publishing adapter after confirming Buffer API access and current channel support. Keep provider credentials on the server, authorize accounts securely, validate media per destination, and track individual delivery jobs with duplicate protection. Add durable media storage and a real background scheduler. Evaluate Restream integration access separately; live eligibility must be verified on each account. Do not collect credentials in this static client.
