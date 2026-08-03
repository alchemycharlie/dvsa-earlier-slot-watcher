# DVSA Earlier Slot Watcher

A Tampermonkey userscript for UK learner drivers with an **existing DVSA practical driving test booking**. Watches the "Change your test" page for earlier cancellation slots at your test centre, alerts when one appears in your accepted date window, and can optionally auto-reschedule up to DVSA's final confirmation step.

**Does not book new tests**, you must already have a confirmed booking.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/alchemycharlie/dvsa-earlier-slot-watcher?label=version&color=brightgreen)](CHANGELOG.md)
[![Userscript](https://img.shields.io/badge/userscript-Tampermonkey-orange.svg)](https://www.tampermonkey.net/)
[![Disclaimer](https://img.shields.io/badge/read-disclaimer-yellow.svg)](DISCLAIMER.md)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/charlie.martina)

<p align="center">
  <img src="docs/screenshots/hero.png" alt="The DVSA Earlier Slot Watcher running on a DVSA booking page, showing the floating status pill and settings gear in the bottom-right corner" width="900">
</p>

> [!CAUTION]
> **DVSA changed the booking rules in 2026. Read this before installing or continuing to use the script.** See [2026 DVSA rule changes](#2026-dvsa-rule-changes) for detail and sources.
>
> - **From 12 May 2026**, DVSA's rules state that you **must not use unofficial services that scan the driving test booking service for appointments**. That is what this script does. DVSA say that where they detect bot activity linked to your licence they can **cancel your booking or restrict your online booking access**.
> - **From 9 June 2026**, you can only move a car test to one of the **3 nearest test centres** (plus the centre you originally booked). DVSA appear to have replaced the free-text test centre search with a fixed list of eligible centres, which is why the script's multi-centre search flow currently breaks with a *"DVSA layout changed"* intervention ([#2](https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues/2)).
>
> The script is **not currently working** for the multi-centre search flow, and the activity it automates is no longer permitted by DVSA. Use of it is at your own risk, against your own booking.

> [!WARNING]
> Unofficial community tool. No affiliation with DVSA, gov.uk, or the UK Government. No warranty, no liability for missed slots or account issues. By installing you accept the terms in **[DISCLAIMER.md](DISCLAIMER.md)**. Full legal and permitted-use details: [Terms of use](#terms-of-use).

**Jump to:** [2026 rule changes](#2026-dvsa-rule-changes) · [Install](#install) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Privacy](#privacy) · [Auto-book safety](#auto-book-safety) · [Terms of use](#terms-of-use)

---

## What it does

For users with an existing DVSA test booking who want to reschedule earlier:

- **Monitors** the "Change your test" page on a randomised 7-12 minute cycle.
- **Filters** by date window, weekends, and your instructor's unavailable dates.
- **Alerts** four ways at once: red banner, browser notification, audio chime, tab-title flash.
- **Auto-books (opt-in)** through to DVSA's "Confirm changes" page; the final commit stays manual.

---

## 2026 DVSA rule changes

DVSA changed the car practical test booking rules during 2026. Two of those changes bear directly on this script.

### 12 May 2026 — unofficial slot-scanning services

DVSA's guidance states that you cannot use *"unofficial services that scan the driving test booking service for appointments"*, including driving test cancellation finder websites and apps. DVSA's booking terms and conditions separately prohibit the use of bots, third-party applications or websites, data mining and similar extraction tools to search for available test slots.

DVSA's stated enforcement: where bot activity is detected against a licence, they can **cancel the booking** or **restrict online booking access**, leaving the candidate to manage their test by phone.

This script automates checking the booking service for earlier slots. Regardless of how carefully it paces itself, that is the activity the rule describes.

### 9 June 2026 — 3 nearest test centres

A car test can now only be moved to one of the **3 test centres nearest to where the test is currently booked** (by driving distance, avoiding motorways), or back to the centre it was originally booked at. DVSA state that the change service *"shows all your available options"*.

The practical consequence for this script: the "Change test centre" journey no longer needs, and appears no longer to offer, the free-text postcode search box the script drives. See [Test centre search box has gone](#test-centre-search-box-has-gone-dvsa-layout-changed-on-page-test-centre-search).

### Sources

- [Changes to driving test booking rules in 2026](https://www.gov.uk/guidance/changes-to-driving-test-booking-rules-in-2026) — GOV.UK
- [Check which driving test centres you can move your test to](https://www.gov.uk/government/publications/check-which-driving-test-centres-you-can-move-your-test-to/check-which-driving-test-centres-you-can-move-your-test-to) — GOV.UK
- [End of the road for unofficial driving test booking services](https://www.gov.uk/government/news/end-of-the-road-for-unofficial-driving-test-booking-services) — GOV.UK
- [Unofficial driving test booking apps and scams](https://readytopass.campaign.gov.uk/unofficial-driving-test-booking-apps-and-scams/) — DVSA "Ready to Pass?" campaign

---

## Quick start

The 60-second version. Full walkthrough in [Install](#install).

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click to install the script: **[DVSA Earlier Slot Watcher](https://raw.githubusercontent.com/alchemycharlie/dvsa-earlier-slot-watcher/main/dvsa-slot-watcher.user.js)**
3. **Chromium browsers only:** enable Tampermonkey's "Allow User Scripts" toggle ([why](#chromium-allow-user-scripts)).
4. Open [your DVSA booking page](https://driverpracticaltest.dvsa.gov.uk/manage) and log in.
5. The setup wizard appears. Walk through it. Save. Leave the tab open.

Press `S` for settings, `H` for history, `P` to pause.

---

## Install

### 1. Install Tampermonkey

[Tampermonkey](https://www.tampermonkey.net/) is the userscript manager (browser extension).

- [Chrome / Brave / Edge](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Safari (paid)](https://apps.apple.com/app/tampermonkey/id1482490089)

### 2. Chromium browsers: enable "Allow User Scripts" <a id="chromium-allow-user-scripts"></a>

> [!IMPORTANT]
> Since Chrome's Manifest V3 enforcement tightened, Chromium browsers require you to explicitly opt in to running userscripts. Without this step, Tampermonkey can install the script but won't run it on DVSA pages.

1. Open your browser's extensions page (`chrome://extensions/`, `edge://extensions/`, `brave://extensions/`, etc.).
2. Toggle **Developer mode** ON (top-right).
3. Click **Details** on the Tampermonkey card.
4. Toggle **Allow User Scripts** ON.

Official Tampermonkey guidance: <https://www.tampermonkey.net/faq.php?q=Q209>.

**Firefox users:** skip this step.

### 3. Install the script

Click in a browser with Tampermonkey installed: **[Install DVSA Earlier Slot Watcher](https://raw.githubusercontent.com/alchemycharlie/dvsa-earlier-slot-watcher/main/dvsa-slot-watcher.user.js)**

Tampermonkey opens its install screen. Click **Install**. It'll auto-update from the same URL on future releases.

### 4. Configure

1. Open <https://driverpracticaltest.dvsa.gov.uk/manage> and log in.
2. **First-time:** the 5-step setup wizard appears. **Returning:** click the gear icon (bottom-right) any time.
3. Fill in (wizard or panel):
   - Date window (earliest + latest acceptable dates)
   - Test centre (searchable dropdown, ~330 UK centres bundled)
   - Search term (postcode or centre name DVSA recognises)
   - Instructor unavailable dates (optional, paste or pick)
   - Auto-book (optional, off by default)
   - Auto-login (optional, paste licence + booking ref for session recovery)
4. Click **Save and reload** / **Finish setup**.
5. Leave the tab open. The script does the rest.

<p align="center"><strong>The first-run setup wizard</strong></p>

<table align="center">
  <tr>
    <td align="center" valign="top" width="33%">
      <img src="docs/screenshots/wizard-welcome.png" alt="Wizard step 1: Welcome screen with prerequisite reminder and disclaimer acceptance" width="280">
      <br>Step 1: Welcome &amp; disclaimer
    </td>
    <td align="center" valign="top" width="33%">
      <img src="docs/screenshots/wizard-test-by-range.png" alt="Wizard step 2: Date window picker with live preview" width="280">
      <br>Step 2: Date window with live preview
    </td>
    <td align="center" valign="top" width="33%">
      <img src="docs/screenshots/wizard-test-centre.png" alt="Wizard step 3: Test centre dropdown with search and search term field" width="280">
      <br>Step 3: Test centre + search term
    </td>
  </tr>
</table>

<p align="center">Steps 4 and 5 cover instructor dates and final options (refresh interval, auto-book opt-in, auto-login). Both are skippable.</p>

<p align="center">
  <img src="docs/screenshots/settings-panel.png" alt="The settings panel showing the Health card, Date window, monitoring preview, test centre dropdown, refresh interval, and other configuration options" width="720">
  <br>
  Once configured, the full settings panel (gear icon, bottom-right) gives access to everything — no code editing required.
</p>

<p align="center">
  <img src="docs/screenshots/monitoring-preview.png" alt="The 'What you're monitoring' card showing a live breakdown of how many dates would alert vs total in range" width="600">
  <br>
  "What you're monitoring" updates live as you tune the date window, weekend toggle, and instructor dates.
</p>

<p align="center">
  <img src="docs/screenshots/status-pill.png" alt="The floating status pill in the bottom-right showing the scanning state with a live countdown" width="380">
  <br>
  Status pill: current state + countdown to next refresh.
</p>

---

## Troubleshooting

### Installed but nothing happens on DVSA pages (Chromium browsers)

The **Allow User Scripts** toggle isn't on. See [step 2 of Install](#2-chromium-browsers-enable-allow-user-scripts).

Then reload the DVSA tab, the floating pill and gear should appear bottom-right.

Firefox users: this isn't required. Check the script is enabled in Tampermonkey's dashboard.

### Notifications aren't firing

Most likely:

1. **Permission denied**, Settings → Health card → Notifications. If "Denied", re-grant in your browser's site settings (padlock icon).
2. **Focus/DND mode**, macOS Focus, Windows Focus Assist, and Do Not Disturb modes swallow notifications. Whitelist the browser or disable.
3. **Notifications unsupported**, locked-down browsers or in-app webviews. Use a desktop browser.

### Audio alerts and the browser's autoplay policy

The script has two audio paths and they behave differently:

- **OS notification sound** (the more reliable one) — when a match fires, the script triggers a browser/OS notification, and the OS plays its own notification sound. This works **without any page-level gesture**; you just need to grant notification permission once (the prompt appears on first run). If notifications are granted and your OS notification sound is on, you'll get audio alerts whether or not you've clicked anywhere on the page.
- **In-page Web Audio chime** (the script's own beep) — Browsers (Chrome, Firefox, Safari) gate Web Audio behind a "user gesture" requirement: any click, tap, or keypress on the page unlocks it. After the first interaction, the chime works for the rest of the session. The Health card's **Chime** tile shows the current state (`Ready` after gesture, `Tap to enable` before).

If you've granted notification permission, the absence of the in-page chime isn't a real problem — the OS notification handles the audio cue, even when the tab is backgrounded.

**Want zero-gesture audio?** Some browsers let you grant a specific site permission to autoplay audio, which bypasses the gesture requirement for that origin and lets the Web Audio chime fire on first load:

- **Chrome / Edge / Brave:** site URL bar → padlock icon → Site settings → Sound → Allow.
- **Firefox:** site URL bar → padlock icon → click "More information" → Permissions → Autoplay → Allow Audio and Video.
- **Safari:** Settings → Websites → Auto-Play → set `driverpracticaltest.dvsa.gov.uk` to "Allow All Auto-Play".

This is optional. The default (OS notification sound + in-page chime after first click) is fine for most users.

### Error 15 / temporary block

DVSA returns "Error 15" when too many requests arrive from your IP. The script recognises this, pauses, and surfaces an intervention banner. Usually clears within 1-2 hours.

Common causes:

- Refresh interval set faster than the 7-12 min default.
- Script running in multiple tabs/browsers/devices simultaneously.
- Other traffic from your IP also hitting DVSA.

Wait for the block to clear, then resume. Full rationale for how the script behaves here: [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md#error-15--temporary-rate-limit-block).

<p align="center">
  <img src="docs/screenshots/error-15-lockout-detection.png" alt="The red intervention banner that appears when the script recognises DVSA's Error 15 response" width="720">
</p>

### CAPTCHA appeared

DVSA occasionally presents a CAPTCHA. The script recognises it, pauses, and hands control back. Complete it yourself; the script resumes on the next cycle. If CAPTCHAs appear every cycle, increase the refresh interval to 15-30 min and wait a few hours.

Full rationale for how the script behaves here: [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md#captcha-challenges).

<p align="center">
  <img src="docs/screenshots/captcha-detection.png" alt="The intervention banner when the script recognises a CAPTCHA challenge" width="720">
</p>

### Brief Tomcat 403 page after CAPTCHA

After solving a CAPTCHA, DVSA's redirect chain occasionally lands on a URL like `/manage?execution=eXsY&_eventId=search` which returns an HTTP 403 "Forbidden" page (a default Tomcat error page, not a styled DVSA page). This is a known Spring WebFlow stale-event behaviour — the redirect URL carries an `_eventId` that the WebFlow state machine has already consumed or no longer accepts, and the server rejects it.

The script detects this case and automatically navigates to the canonical `/manage` URL (no query parameters), which is what a human user would do manually. From there, monitoring resumes normally. You may see a brief 403 page flash before the redirect — that's expected, no action needed.

If the auto-recovery somehow fails (e.g. the same 403 appears immediately after recovery), the script surfaces a "layout broken" intervention instead of looping.

### DVSA put you in a queue (Queue-it waiting room)

DVSA uses Queue-it (a virtual waiting room) during peak load. The script recognises the queue page and shows your live position in two places: the floating status pill (e.g. "in DVSA queue · 23,731 ahead") and the browser tab title (e.g. `[23,731 ahead] Queue-it`). Both update every second as Queue-it refreshes the position. The tab title is handy when you've tabbed away — you can keep an eye on your position without switching to the queue tab.

Monitoring naturally pauses while queued — there's nothing to scan from the waiting room. Queue-it auto-redirects you back to the booking flow when your turn comes up, and monitoring resumes automatically.

The script does not interfere with the queue, attempt to skip it, or refresh faster than Queue-it itself does. Full rationale: [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md#how-the-script-responds-to-dvsas-protection-layer).

<p align="center">
  <img src="docs/screenshots/queue-it-aware.png" alt="The floating status pill showing the live DVSA queue position while the user is in Queue-it's virtual waiting room" width="720">
</p>

<p align="center">
  <img src="docs/screenshots/queue-it-tab.png" alt="The browser tab title showing the live DVSA queue position, e.g. '[23,731 ahead] Queue-it'" width="380">
</p>

### DVSA service unavailable

DVSA's booking service is sometimes taken offline and returns a "Service unavailable" page. The reason isn't always clear from the user side — it could be scheduled maintenance, capacity management, or something else — and DVSA doesn't publish a fixed schedule that I'm aware of. The page itself usually states when the service is expected to return.

When the script lands on this page, it first tries to read the stated return time directly from the page text (e.g. *"back at 6am"*, *"available from 06:00"*). If a sensible time is found, the script schedules itself to resume scanning 5 minutes after that. If the page text doesn't include a parseable time — DVSA changes the wording, or the page lays out the time in a way the parser doesn't recognise — the script falls back to a **06:05 heuristic** based on previously observed patterns. The fallback isn't guaranteed to match reality.

Until the script resumes, the status pill shows the scheduled wake time and the browser tab title is prefixed with `[Wake HH:MM]` so you can leave the tab in the background. The script logs an hourly heartbeat to the browser console so you can confirm it's still alive.

If the service is back before the scheduled wake time, manually reloading the DVSA tab will resume scanning earlier.

<p align="center">
  <img src="docs/screenshots/service-down-aware.png" alt="The DVSA 'Service unavailable' page, with the script's status pill displaying the scheduled wake time" width="720">
</p>

### Maximum test changes reached

DVSA allows a limited number of changes per booking — typically two reschedules. After that, the booking summary page replaces the "Change test centre" and "Change date/time" buttons with a message: *"The number of allowed changes to your booking has now been exceeded. You'll need to call the DVSA on 0300 200 1122 if you want to make any further changes to your test date."*

When the script lands on this page, it recognises the state, surfaces a red intervention banner explaining the situation, and **auto-pauses monitoring**. Since there's no flow forward — every automated path the script can take requires one of the "Change" buttons that DVSA has removed — continuing to scan would just be a slow loop with the same dead-end on every cycle.

The auto-pause persists across reloads. Unpause manually (click the floating play icon, or press `P`) only if your booking situation has changed — e.g. you called DVSA and got further changes granted, or you've cancelled and made a fresh booking.

<p align="center">
  <img src="docs/screenshots/change-limit-reached.png" alt="The DVSA booking summary when the change limit has been reached, with the script's red intervention banner explaining the state and pointing the user at DVSA's contact number" width="720">
</p>

### Test centre search box has gone ("DVSA layout changed" on page-test-centre-search)

**Symptom:** the intervention banner reads *"A page element the script needs is missing"* and names `#test-centres-input, postcode input on test centre search`.

**Known issue, not fixable by reinstalling.** Following the [9 June 2026 rule change](#9-june-2026--3-nearest-test-centres), a car test can only move to one of the 3 nearest centres, so DVSA no longer need a free-text postcode search on the change-test-centre page — they show the eligible centres directly. The script's multi-centre search flow (Flow 2) was built around that search box and has no path forward without it.

There is no workaround in the current version, and note that the [12 May 2026 rule](#12-may-2026--unofficial-slot-scanning-services) means automated scanning of the booking service is no longer permitted at all. Tracked in [#2](https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues/2).

### "Layout broken" intervention

DVSA changed page structure. The script bails rather than clicking the wrong thing.

1. Check for a script update: Tampermonkey dashboard → **Check for updates**.
2. If you're on the latest version, [file an issue](https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues/new/choose) with the body ID DVSA is now using and which selector broke.

### "Test centre mismatch" intervention

The H1 on the DVSA calendar page doesn't match your configured centre. Either:

- You typed the name slightly differently, open settings, pick from the dropdown.
- DVSA renamed the centre, pick from the dropdown again.
- You navigated to the wrong centre via DVSA's own search.

<p align="center">
  <img src="docs/screenshots/centre-mismatch.png" alt="The intervention banner shown when the centre on the DVSA page doesn't match the configured one" width="720">
</p>

### Can't see the floating cluster

Possible blockers:

- A browser extension overlay (translator, password manager) at the same position, toggle extensions.
- Zoom above 200%, the cluster may be off-screen. Zoom back.
- Ancestor CSS transform in DVSA's markup (rare, the cluster uses a single container to dodge this).

### Status pill says "configure to start" but values are filled in

Validation is failing somewhere. Open settings: offending fields have red rings. Common causes:

- Start date > end date.
- Auto-book time window with earliest > latest.
- Search term shorter than 2 chars, or still on the `AA1 1AA` placeholder.
- Test centre still on `Your Test Centre (Location)` placeholder.

### Auto-book clicked the wrong slot

Toggle **Test mode** on in settings → reload → verify the script reads the calendar correctly → turn Test mode off. If it persists, [file an issue](https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues/new/choose) with the body ID, console snippet, and a calendar screenshot.

Per the [DISCLAIMER](DISCLAIMER.md), you remain solely responsible for verifying the slot before clicking Confirm changes. Auto-book stops short of that final click on purpose.

---

## FAQ

**Does this book new tests for me?**
No. It only operates inside DVSA's "Change your test" management flow (`/manage*`). You must already have a confirmed booking.

**Is this legal?**
The script automates clicks you'd otherwise make manually on the management section of DVSA's site, using your own login, for your own booking. Whether your specific use complies with DVSA's terms is your responsibility. See [DISCLAIMER.md](DISCLAIMER.md). Seek independent legal advice if unsure.

**Will it work for HGV, motorcycle, or other test types?**
No, the script's `@match` rules target the car practical flow only (`driverpracticaltest.dvsa.gov.uk/manage*`). Other test types use different subdomains and pages. Contributions welcome.

**Does it work on mobile?**
Mobile is untested and unsupported. The UI is sized for desktop.

**Can I run multiple tabs / instances?**
No. They'd refresh independently and trip DVSA's rate limit (Error 15).

**Can I run this on a Raspberry Pi or server?**
No. The script is designed for an attended desktop browser tab. Headless or server-side use is out of scope.

**How do I update?**
Tampermonkey auto-updates from the `@updateURL`. Force an update: dashboard → script row → **Check for updates**. Saved settings are preserved.

**Why doesn't it auto-click the final Confirm button?**
DVSA holds the slot for 15 minutes once you reach Confirm. With one wasted reschedule possibly meaning months until the next opportunity, the human-in-the-loop gate is intentional. See [DISCLAIMER §11](DISCLAIMER.md#11-auto-book-feature-specific-waiver).

**How do I share my config without sharing credentials?**
Settings → **Backup & restore**. The "Include auto-login credentials in export" checkbox is **off by default** specifically for this. Shared JSON files have blank licence/booking-ref fields.

**Can I disable auto-book once enabled?**
Yes. Settings → uncheck **Auto-book through to the confirmation page** → Save. Falls back to alert-only mode immediately.

**Fastest way to add my instructor's unavailable dates?**
Settings → Instructor unavailable dates → **Paste multiple…** → paste one date per line (e.g. `2026-05-26`). Invalid lines are silently skipped.

---

## Privacy

- **Nothing is sent to me or anyone else.** No analytics, no telemetry, no error reporting.
- **All settings live in `localStorage`** in your own browser. Clearing browser data wipes them.
- **Scan history lives in `localStorage` too.** Export to CSV from the History panel.
- **Auto-login credentials are optional and local-only.** They're sent only to DVSA's login form, same as if you typed them.
- **No external CDNs, fonts, or scripts.** One self-contained `.user.js` file. Read it before installing if you want.

The only network calls the script triggers are the ones you'd make manually on the DVSA site.

---

## Auto-book safety

Auto-book is **opt-in** and disabled by default. When enabled:

1. Clicks the matching date on the calendar.
2. Clicks an available time slot within your accepted time window.
3. Clicks **Continue** on DVSA's "Warning! You'll lose your current booking" modal.
4. **STOPS** on the "Confirm changes" review page.

The final Confirm click stays manual. DVSA holds the slot for 15 minutes at that point, giving you time to verify date, time, and centre. While holding, the script:

- Flashes the page title with a red countdown.
- Pulses the Confirm button with a yellow highlight.
- Refuses to ever click Confirm or Abandon automatically.

If you're not comfortable with auto-book, leave it off. The alerts still fire so you can complete manually.

<p align="center">
  <img src="docs/screenshots/alert-fired.png" alt="The red alert banner when a matching slot is detected, with a 'Show me' button to jump to it" width="720">
</p>

<p align="center">
  <img src="docs/screenshots/history-panel.png" alt="The scan history modal showing KPI tiles and a table of every detected slot" width="720">
  <br>
  Every match, nearby alert, and spotted date is logged locally.
</p>

---

## Configuration tips

- **Don't go below 5-minute cycles.** Faster requests place unnecessary load on DVSA and trip Error 15. The 7-12 min default is comparable to a person checking the page periodically.
- **Keep the tab focused if you can.** Background tabs get `setTimeout` throttling, which stretches cycles.
- **Use Test mode to verify alerts.** Toggle it on, next scan fires a fake alert. Don't forget to turn it off.
- **Allow notifications.** Without them the only alert is in the tab itself.

---

## Terms of use

This section consolidates the legal and acceptable-use terms. Full versions are in [DISCLAIMER.md](DISCLAIMER.md).

### Unofficial and unwarranted

This is a free, unofficial, community-built tool. **Not affiliated with, endorsed by, or connected to the DVSA, gov.uk, or the UK Government** in any way.

By installing or using this script you accept:

- **No warranty.** "As is", "as available", no guarantees.
- **No liability** on the author for missed slots, lost bookings, account issues, incorrect bookings, missed alerts, or any other consequence.
- **You are solely responsible** for complying with DVSA's terms and for verifying every booking detail before clicking Confirm.

Full terms: **[DISCLAIMER.md](DISCLAIMER.md)**. If you don't accept them, do not install.

### Existing bookings only

The script is for people with an **existing, paid, confirmed** DVSA practical driving test booking who want to find an earlier cancellation slot at the same test centre and reschedule.

What it exists to do: remove the manual effort of repeatedly refreshing the "Change your test" page.

What it will not do:

- Book a new test from scratch.
- Skip the DVSA application or payment flow.
- Snap up newly-released slots before they reach DVSA's public booking page.
- Circumvent, evade, or interfere with DVSA's security measures.

The script only operates on `driverpracticaltest.dvsa.gov.uk/manage*` and `/login*`. It never touches the fresh-booking application URL. For the full treatment of how the script behaves around CAPTCHA, rate limits, page-structure changes, and session expiry, see [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md).

### Permitted use

For **individual personal use only**, by people in the UK who hold their own DVSA practical driving test booking and wish to reschedule to an earlier date.

**Not permitted:**

- Use on behalf of any other person (friends, family, pupils, clients).
- Use across multiple DVSA accounts.
- Commercial use of any kind. Driving instructors and schools must not run the script on behalf of pupils.
- Use for malicious or unlawful purposes, or anything that breaches DVSA terms, DVLA terms, the Computer Misuse Act 1990, or any other applicable UK law.
- Wrapping the script inside headless browsers, automation frameworks, or unattended server-side automation.
- Use outside the UK.

The script is, and will remain, free for genuine individual users. It must not be copied, modified, redistributed, or forked for financial gain. Forks intended to break, weaponise, or maliciously alter the script's behaviour are not endorsed by the author.

Full details: [DISCLAIMER §3 (Acceptable Use)](DISCLAIMER.md#3-acceptable-use-policy), [§4 (Distribution and Forks)](DISCLAIMER.md#4-distribution-modification-and-forks), [§5 (Project Philosophy)](DISCLAIMER.md#5-project-philosophy).

By completing installation and saving any configuration, you confirm that you have read and accepted the terms in [DISCLAIMER.md](DISCLAIMER.md).

---

## Contributing

This is a personal project shared as-is. Issue and PR templates exist in [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE/) if you'd like to file something, but there's no commitment that anything filed will be reviewed, responded to, or merged. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full picture.

If you do file a bug report, useful details include:

- Tampermonkey version and browser
- Console log snippet (`[DVSA Earlier Slot Watcher]` lines)
- The DVSA page state when it happened

For security issues, see [SECURITY.md](SECURITY.md) — don't file those as public issues.

---

## Support

Free, open source, and ad-free. If it's helped you find an earlier test date, a coffee is appreciated.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95-yellow.svg)](https://buymeacoffee.com/charlie.martina)

---

## License

- **Code:** MIT, see [LICENSE](LICENSE).
- **Disclaimer and limitation of liability:** [DISCLAIMER.md](DISCLAIMER.md). Installing or using the Software constitutes acceptance in full.

Independent, unofficial tool. Not affiliated with the DVSA, the UK Government, or gov.uk.
