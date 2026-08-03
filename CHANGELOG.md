# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Docs

- **Documented the 2026 DVSA booking rule changes and the resulting breakage.** No code changes; this entry records the situation while the direction for the script itself is decided.

  **12 May 2026** — DVSA guidance states that candidates must not use unofficial services that scan the driving test booking service for appointments, and DVSA's booking terms and conditions prohibit bots, third-party applications and similar tools for searching test slots. DVSA state they can cancel a booking or restrict online booking access where bot activity is detected against a licence. This is the activity the script automates.

  **9 June 2026** — a car test can only be moved to one of the 3 nearest test centres to where it is booked, or back to the originally booked centre. DVSA's change service now shows the eligible centres directly.

  **Consequence for the script:** the multi-centre search flow (Flow 2) drives a free-text postcode box (`#test-centres-input` / `#test-centres-submit`) on `page-test-centre-search`. With the destination set now fixed at 3 centres, that search box is no longer needed and reportedly no longer present, so `requireSelector` fires a *"DVSA layout changed"* intervention and the flow stops. Reported in [#2](https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues/2) against v1.1.4.

  The exact replacement markup has **not** been confirmed against a live page — the DVSA site sits behind bot protection and the change-test-centre journey requires an authenticated booking. The diagnosis above is inferred from DVSA's published rule changes plus the selector named in the bug report.

  README gains a *2026 DVSA rule changes* section with sources, a prominent notice at the top, and a troubleshooting entry for the specific intervention.

---

## [1.1.4], 2026-05-19

### Added

- **"Maximum test changes reached" intervention.** When a booking has hit DVSA's limit on test changes (typically two reschedules), DVSA strips the "Change test centre" and "Change date/time" buttons from the booking summary and adds an explanatory message pointing the user at DVSA's contact number. The script now recognises this state explicitly.

  Detection requires BOTH `<header class="booking-change-incomplete">` AND DVSA's contact number `0300 200 1122` in the on-screen help text. The combination keeps false-positive risk near zero.

  When detected: the script logs the state, sets the paused flag in localStorage (so subsequent scheduled reloads exit early instead of looping on a page with no path forward), and surfaces a red intervention banner with clear instructions to call DVSA on `0300 200 1122` to request further changes. The auto-pause persists across reloads. Users manually unpause (floating play icon or `P`) if their booking situation changes — e.g. additional changes granted by phone, or a fresh booking made.

  Previously this state would trigger a generic *"DVSA layout changed"* intervention because the script would try and fail to click the missing `#test-centre-change` button. Accurate that something was wrong, but misleading about what.

- README troubleshooting section gains a corresponding entry describing the state and the auto-pause behaviour.

[1.1.4]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.1.4

---

## [1.1.3], 2026-05-19

### Fixed

- **Auto-recovery from post-CAPTCHA Tomcat 403 redirects.** DVSA's redirect chain after a CAPTCHA solve occasionally lands on a URL like `/manage?execution=eXsY&_eventId=search` which returns an HTTP 403 from the underlying Tomcat (the Spring WebFlow state machine rejects the stale `_eventId`). Without recovery, the script would sit indefinitely on the 403 page — the user had to manually strip the broken query string and reload `/manage` to get the automated flow going again.

  The script now detects this case (DVSA host + Tomcat 403 title + `_eventId` in URL) and automatically navigates to the canonical `https://driverpracticaltest.dvsa.gov.uk/manage` — exactly what a human would do manually. From there, the script's existing dispatch picks up normally (booking summary if session valid, login if not).

  A session-storage loop guard prevents infinite recovery attempts: if the script lands on the 403, recovers, and lands on the 403 *again* in the same tab session, it surfaces a "layout broken" intervention instead of looping. The guard is cleared automatically whenever the script reaches any recognised page state, so a later 403 in the same session can still recover.

  README troubleshooting section gains a new entry describing the brief 403 flash users may notice during the redirect.

[1.1.3]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.1.3

---

## [1.1.2], 2026-05-19

### Changed

- **Service-unavailable wake time now adapts to what DVSA actually says.** Previously the script always scheduled its wake at 06:05 regardless of what the "Service unavailable" page stated — brittle if DVSA shifts their downtime window. New behaviour: the script reads the stated return time from the page's `#unavailability-notice` element (e.g. *"It'll be back at 6 am"*), extracts the time, sanity-checks that it falls within a plausible service-restart window (04:00-12:00), and schedules wake at that time plus a 5-minute safety margin. If the element is missing, the text doesn't parse, or the parsed hour falls outside the sane range, the script falls back to the historical 06:05 heuristic. Worst case = unchanged from previous behaviour; best case = adaptive to whatever DVSA states.

- **Service-unavailable detection promoted to a proper page-state entry.** Previously handled as a default-branch special case via title + heading-text matching. The DVSA page uses the same body-ID convention as every other page in the flow (`page-service-c`), so the script now routes through the standard page-state switch alongside login, booking-details, etc. The legacy title/heading fallbacks are kept as safety nets in case DVSA changes the body ID in a future site update.

### Docs

- **New README troubleshooting entry**: *"DVSA service unavailable"*, describing the script's behaviour during DVSA downtime windows. Includes screenshot.

- **SECURITY.md and CONTRIBUTING.md reframed from active-support docs to no-obligation docs.** The previous wording contained explicit SLA-style commitments (e.g. "acknowledge within 7 days, assess within 14, fix within 30") and corporate-team framing ("we won't merge..."). The new wording explicitly states that the maintainer makes no commitment to ongoing maintenance, code review, response to issues, or merging of pull requests. The reporting channels still exist — what's gone is the implication that anything filed will necessarily be acted on. This is a hobby project shared in case it helps others, not a service. The technical content (setup instructions, coding conventions, PR checklist, what's in/out of scope, code of conduct) is unchanged.

[1.1.2]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.1.2

---

## [1.1.1], 2026-05-18

### Changed

- **Per-action click-through timing tightened further.** The v1.0.8 reduction halved individual delay values; this pass collapses unnecessary intermediate pauses where consecutive JS statements run synchronously anyway (no need to pause between filling a licence number and filling a booking ref when both happen instantly). Specifically:
  - `handleLogin`: 3 pauses (0.28-0.55s) → 1 pause (0.05-0.1s)
  - `handleTestDateChoice`: 2 pauses (0.25-0.5s) → 1 pause (0.08-0.15s)
  - `handleTestCentreSearch`: 2 pauses (0.2-0.4s) → 1 pause (0.05-0.1s)
  - `handleBookingDetails`: 1 pause kept, reduced 0.15-0.3s → 0.08-0.15s
  - `walkBackwards` calendar AJAX wait: 250-500ms → 200-400ms

  Typical Flow 2 cycle saves roughly 0.8-1.7s vs v1.1.0 on the click-through chain, with more savings on cycles that involve many calendar-walk clicks. The auto-book triplet was already at the floor and is unchanged.

  This is likely the last meaningful per-action speedup. Going further would risk DVSA's per-field validators racing the submit click (form rejected because the change-handler microtask hasn't run yet) or the calendar AJAX read happening mid-render (months with dates appearing empty, walk skipping past them silently).

### Docs

- **README tidy.** Compact "Jump to:" TOC line added after the WARNING callout for one-click navigation to Install / Troubleshooting / FAQ / Privacy / Auto-book safety / Terms of use. Relocated the settings-panel screenshot from "What it does" (where it duplicated the hero image) to inside Install step 4. Trimmed "What it does" from 6 bullets to 4. Renamed the bottom legal section "Before you install" → "Terms of use" (fixed a naming-vs-position contradiction).

- **Top badge row** now includes a Buy Me a Coffee badge alongside License, Version, Userscript, and Disclaimer.

[1.1.1]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.1.1

---

## [1.1.0], 2026-05-18

A pre-1.1.0 code-quality pass. Seven refactors landed on `main` since v1.0.8, all behaviour-preserving. The script is now substantially easier to extend, with single-source-of-truth helpers for the patterns that had organically duplicated over many iterations.

### Fixed

- **Self-test diagnostic was reading the wizard-completed flag via a bare hardcoded string** (`'dvsaWatcher.wizardCompleted'`) instead of the `WIZARD_COMPLETED_KEY` constant. If the constant ever changed, the diagnostic would silently desync and always report "not yet completed". Replaced the string with the constant.

### Changed

- **One canonical map for panel config fields.** `handlePanelSave`, `exportPanelConfig`, and `finishWizard` previously each listed the same 18 config fields, in three different forms. Plus the import-validator allowlist (`_ALLOWED_SETTING_KEYS`) listed them a fourth time. All consolidated into a single `PANEL_FIELD_MAP` array (key, DOM id, coercion type, plus optional `credential:true` and `wizardForce:<value>` flags). New `readPanelInputs(panel)` reads from the DOM by iterating the map; the import allowlist is derived from it. Adding a new config field is now one map entry instead of editing five separate places.

- **Banner styles moved into CSS classes.** Five top-of-page alert banners (intervention, test alert, match, nearby, confirm-ready) each had near-identical inline `cssText` arrays differing only in colour and a couple of dimensions. Replaced with `.dvsa-banner` (+ modifiers: `-small`, `-dismissable`, `-low-z`) and `.dvsa-banner-close` (+ `-small`) classes. Each banner site is now ~3 lines (className + one inline `background` property) instead of ~8 lines of cssText. Restyling banners is now one CSS edit.

- **Single `flashTitle()` helper instead of 4 copies.** Four alert paths had the same "let flip / let flips / FLIP_CAP / setInterval" title-flash pattern. New `flashTitle(titleA, titleB, opts)` consolidates them. Side benefit: every refactored site now uniformly checks `document.body.dataset.alertAcknowledged` for early exit, fixing the "match-alert and nearby-alert didn't check the flag" inconsistency the audit flagged.

- **Single `createModalOverlay()` factory for the three primary modals.** Settings panel, history panel, and diagnostic modal each had ~25 lines of identical boilerplate (overlay backdrop, panel cssText, Esc handler, click-outside handler, close cleanup). Replaced with a factory that returns `{ overlay, panel, close }`. Three stale module-level Esc handler vars retired (`_panelEscHandler`, `_diagnosticEscHandler`, `_historyEscHandler`); Esc handlers are now local closures cleaned up automatically on modal close. Adding a 5th modal in future is now ~10 lines.

- **Storage key naming unified to `dvsa-watcher-*` prefix.** Three keys used the older `dvsaWatcher.*` dot-style namespace while the other seven used the kebab-style prefix everything else in the file uses. Renamed the three values; added a one-time `migrateLegacyStorageKeys()` migration at the start of `main()` that reads each legacy key, writes to the new key (only if the new key is currently empty), then deletes the old. Idempotent — re-runs after migration are no-ops. Existing users silently migrate on first load.

### Added

- **`Z_INDEX_OVERLAY` and `Z_INDEX_CLUSTER` constants** replace 11 hardcoded uses of `2147483647` / `2147483646` across inline-style cssText arrays and the injected CSS. Stacking decisions (modals above cluster) are now stated once near the top of the file.

- **`STATUS_STATE` enum** replaces 24 string-literal uses of `'init'` / `'scanning'` / `'manual'` / etc. across `setStatus` calls, case labels in `renderStatusPill`, and `STATUS.state ===` comparisons. The valid-states list lives in one place; the previously-stale comment is removed.

### Polish

- **Optional chaining sweep**: 8 occurrences of `(panel.querySelector('#X') || {}).value` pattern replaced with `panel.querySelector('#X')?.value`. Universally safe in evergreen browsers.

- **`catch` handler consistency**: six `catch(_)` sites changed to `catch(e)` to match the majority style elsewhere.

- **`CYCLES_DEFAULT()` helper** replaces two copies of the same default JSON-string literal in `recordCycle` / `getCycles`.

- **`escapeAttr` documented** as expecting raw text, never pre-encoded HTML (to prevent future double-encoding bugs).

### Internal metrics

The audit baseline was 5657 lines. After the cleanup the file is 5779 lines (+122). The line increase reflects added documentation around the new helpers; actual logic was deduplicated. Call sites for banners, title-flashes, modals, and form mapping are dramatically simpler. Top-10 longest functions list now has fewer >100-line functions because the boilerplate they shared moved into helpers.

[1.1.0]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.1.0

---

## [1.0.8], 2026-05-18

### Changed

- **Per-action delays in the click-through flow halved.** Pauses between form fills, button clicks, and page transitions in `handleLogin`, `handleBookingDetails`, `handleTestDateChoice`, and `handleTestCentreSearch` were sitting at 0.15-0.6s, which made the end-to-end click-through feel slow compared to similar tools. They've been cut to roughly half (0.08-0.3s depending on the action). The calendar-walk AJAX wait in `walkBackwards` also tightened from 400-700ms to 250-500ms. Each end-to-end Flow 2 cycle saves roughly 0.6-1.2 seconds on the click-through chain. The auto-book triplet (date → time → Warning Continue) was already fast and is unchanged. The per-action timing is functional only (letting DOM/animations settle and validators run after `input`/`change` events); the script's pacing posture remains the 7-12 minute cycle interval as documented in [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md).

- **Settings panel Health card "Audio" tile renamed to "Chime".** The tile tracks only the in-page Web Audio chime, which is gated by the browser's autoplay policy. The previous label could mislead users into thinking ALL audio was disabled when in fact the OS notification sound (the more reliable audio path) was working independently. The `Awaiting click` value is now `Tap to enable` for clearer affordance. The README troubleshooting entry has been rewritten to explain both audio paths and document the optional browser-level autoplay permission (per-browser steps for Chrome, Firefox, Safari) as a zero-gesture alternative for users who want it.

### Added

- **Broader gesture types for priming the Web Audio chime.** In addition to `click` and `keydown`, the script now listens for `pointerdown` (unified mouse/touch/pen via the Pointer Events API) and `touchstart` (fallback for older browsers). Slightly broader coverage on touch and pen devices. All listeners use `{once: true}` and self-remove after priming.

### Removed

- **Credit/donate footer strip at the bottom of the settings panel.** The strip ("100% local, no data leaves your browser · Made by @alchemycharlie · Buy me a coffee · GitHub · Report issue") near-duplicated the About fieldset shown earlier in the same panel. The privacy framing is preserved in the README's Privacy section and the DISCLAIMER's no-data-leaves clauses; the panel now ends cleanly with the keyboard-shortcut hint row.

[1.0.8]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.8

---

## [1.0.7], 2026-05-18

### Fixed

- **Wizard incorrectly opened on the Queue-it subdomain (regression from v1.0.6).** When v1.0.6 added the `@match` for `queue.driverpracticaltest.dvsa.gov.uk`, it allowed the script to inject on the queue page, but `localStorage` is keyed **per origin**, and the queue subdomain has its own (empty) localStorage separate from the main `driverpracticaltest.dvsa.gov.uk` origin. The first-run config check would run on the queue origin, find nothing, and launch the setup wizard. Users importing config there ended up writing to the queue origin's localStorage instead of the main origin's, while believing their existing data had been wiped. **The data wasn't wiped**, it remained intact on the main origin, untouched.

  Fixed by moving the Queue-it detection BEFORE the config check in `main()`. On the queue subdomain the script now just shows the queue position and waits: no config check, no wizard, no scanning. When Queue-it redirects back to the main DVSA origin, the existing localStorage is read normally and everything works as before.

  **If you imported config on the queue subdomain in response to the wizard prompt:** your original config and history on `driverpracticaltest.dvsa.gov.uk` are still intact. The duplicate config on `queue.driverpracticaltest.dvsa.gov.uk` is now orphaned and harmless, but you can clear it manually via DevTools → Application → Local Storage → `queue.driverpracticaltest.dvsa.gov.uk` if you want a clean state.

### Added

- **Queue position now shows in the tab title** while you're in DVSA's Queue-it waiting room. Format: `[23,731 ahead] Queue-it`. The number updates live every second as Queue-it refreshes its position. Useful if you've tabbed away, you can see your position in the tab bar without switching to the queue tab.

[1.0.7]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.7

---

## [1.0.6], 2026-05-18

### Added

- **Queue-it virtual waiting room recognition.** DVSA uses Queue-it during peak load to put users in a virtual queue before they can reach the booking system. Previously the script wasn't running on the queue page at all (it lives on `queue.driverpracticaltest.dvsa.gov.uk`, a subdomain outside the script's previous `@match` rules), so users saw the floating status pill disappear when they got queued. The script now matches the queue subdomain too, detects the queue page, and surfaces the live queue position via the status pill (e.g. *"in DVSA queue · 23,731 ahead"*). Monitoring naturally pauses while queued; Queue-it's own auto-redirect resumes the script on the booking page when the user's turn comes up. The script does not interfere with Queue-it's logic, attempt to skip the queue, or refresh the queue page faster than Queue-it itself does, in line with the project's stated security posture ([docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md#how-the-script-responds-to-dvsas-protection-layer)).

### Note for existing users

- The new `@match` rule (`https://queue.driverpracticaltest.dvsa.gov.uk/*`) is a domain Tampermonkey hasn't seen the script on before. On auto-update, Tampermonkey will ask you to grant permission for the new domain. This is expected; granting permission is what lets the queue-page status pill work.

[1.0.6]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.6

---

## [1.0.5], 2026-05-17

### Fixed

- **Settings panel footer buttons now sit on a single row.** The default button padding made the five footer buttons (Reset to defaults, View scan history, Test alert, Cancel, Save and reload) just barely too wide for the 720px panel, so the right-side group wrapped to a second row. Tightened the footer-specific padding and font size by a single step so all five fit on one line. The outer flex-wrap remains intact so it still degrades gracefully on very narrow viewports.
- **Scan history footer no longer falls below the viewport.** The history panel's action buttons (Export CSV, Copy to clipboard, Clear all, Close) could fall below the visible area on shorter windows, requiring a scroll to reach. The panel is now a proper flex-column modal: header (title, KPI grid, filter buttons) holds its natural size at the top; the table region expands to fill the remaining vertical space and scrolls inside its own container; the footer is anchored to the bottom of the visible panel regardless of viewport size or how many history rows exist.

### Changed

- **Scan history capacity raised from 200 to 1,000 entries.** At ~180 bytes per entry, 1,000 entries is ~180KB of localStorage (well within the per-origin 5-10MB limit) and the flex/scroll layout handles the row count without performance issues. At a 7-12 minute cycle, 1,000 entries covers roughly 5-8 days of continuous monitoring before FIFO eviction kicks in. A new hint line in the history panel surfaces the cap to users and points them at **Export CSV** for keeping a permanent record beyond that window.

[1.0.5]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.5

---

## [1.0.4], 2026-05-17

### Changed

- **Error 15 intervention banner reworded to match the project's stated security posture.** The banner previously advised users to "switch to a private browsing window" to work around DVSA's rate-limit response, which directly contradicted the project's stated principle that the Software does not attempt to circumvent DVSA's security measures (see [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md)). The banner now reads: *"Standard DVSA rate-limit response. Script paused. Wait for the block to clear naturally (typically 1-2 hours), then resume."* The expected wait time was also corrected (previously "~15 minutes", which contradicted the 1-2 hour figure stated in the README and SECURITY-POSTURE doc).
- **Centre-mismatch intervention instruction** no longer leaks the internal `EXPECTED_CENTRE` variable name. Reworded to *"Calendar loaded a different test centre. Monitoring is paused. Verify your configured test centre and reload."*
- **Settings-panel refresh-interval hint** reworded to describe DVSA's response in consistent terms: *"Faster than 5 minutes is likely to trip DVSA's standard rate-limiting (Error 15) and is not recommended."*

[1.0.4]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.4

---

## [1.0.3], 2026-05-17

### Added

- **Import-existing-config option on the first-run wizard.** A new callout on step 1 (Welcome) lets users with a previously-exported JSON config restore their settings directly, skipping the rest of the wizard. The import flow reuses the same strict validator as the settings panel's Backup &amp; restore section (rejects unknown keys, type mismatches, files without the `_meta.source` marker). A `window.confirm` shows the parsed settings summary before applying. If the imported config has `AUTO_BOOK` enabled, the user's OK click on the summary serves as informed acknowledgement and the auto-book consent flag is written, analogous to the in-wizard consent modal on step 5.
- Use case: setting up the script on a new browser, device, or browser profile after exporting from a previous install. Previously the user had to walk through all 5 wizard steps and then import via the settings panel; now they can do it in one click on the welcome screen.

[1.0.3]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.3

---

## [1.0.2], 2026-05-17

### Fixed

- **Config-export `_meta.version` field is now dynamic.** Previously, exporting your settings to JSON would write a hardcoded `"version": "1.0.0"` regardless of which version of the script was actually running, so exports from a 1.0.1 install mis-identified themselves as 1.0.0 in the file. The export now reads `SCRIPT_VERSION` so the stamp always reflects the install that produced it.

### Changed

- **README version badge is now dynamic.** Switched from a hardcoded shields.io badge to one that auto-queries GitHub for the latest tag. Future version bumps now propagate to the badge without manual README edits.
- **DISCLAIMER footer no longer carries a software-version stamp.** The disclaimer's terms apply across versions, so tying its footer to a single release number risked drift exactly like this. The date stamp remains so users can still see when terms last changed.

[1.0.2]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.2

---

## [1.0.1], 2026-05-17

### Fixed

- **Auto-book consent modal now fires from the wizard.** Previously, ticking the auto-book checkbox in step 5 of the first-run wizard would silently enable the feature without firing the explicit-consent modal that the post-wizard settings panel uses. Both paths now share the same modal with the same three acknowledgements and link to DISCLAIMER section 11. The wizard's onboarding can no longer be a quieter path to enable an elevated-risk feature.
- **Skip button on the wizard's final step was a no-op.** The Skip handler clamped at step 5, so clicking Skip on step 5 stayed on step 5. The button is now hidden on the final step (the Finish button is the correct action there).
- **Removed a now-redundant implicit ack-setter in `finishWizard()`.** It existed as a workaround for the wizard not firing the consent modal; with the modal now firing from the wizard, the workaround is obsolete and was masking the model.

### Documentation

- README install steps now include an explicit "Chrome / Edge / Brave: enable Allow User Scripts" step between installing Tampermonkey and installing the script. This catches a common Chromium-only gotcha where Tampermonkey can install the script but won't actually run it until the user toggles "Allow User Scripts" in the extension's Details page. Firefox is unaffected.
- New troubleshooting entry covering the "I installed the script but nothing happens" symptom that this Chromium quirk causes, with a direct fix.
- Both sections link to the official Tampermonkey FAQ Q209 for canonical guidance.

[1.0.1]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.1

---

## [1.0.0], 2026-05-17

Initial public release.

### Default search flow

The auto-cycling search now uses the **multi-centre test-centre search** rather than the older single-centre date-focused walk. On the booking management page, the script clicks the test-centre "Change" link (`#test-centre-change`), which lands on the postcode-search page where `handleTestCentreSearch` runs a single request and parses a summary showing availability at the target centre plus nearby centres. Matches drill straight into the calendar; otherwise the script self-cycles on the search page.

The older date-focused flow remains available as a manual path: if a user clicks the date-time "Change" link (`#date-time-change`) themselves, the script handles the resulting pages (`handleTestDateChoice` then `handleCalendar`) exactly as before. Only the *automatic* trigger has changed.

Reasons:
- The centre-search response shows multiple centres' availability per request, so `ALERT_ANY_CENTRE` becomes meaningful.
- One request per cycle instead of a full calendar walk: lighter load on DVSA's site, more in line with normal human use of the page.
- Per-cycle navigation stays on the search page rather than reloading `/manage` each time.
- The script only drills into a calendar when a match is actually found, rather than always loading one.

### Monitoring
- Randomised refresh cycles (5–60 min, default 7–12) with human-pacing jitter
- Date-window matching with weekend exclusion toggle
- Instructor-unavailable-date filter
- Walk-backwards through earlier dates each cycle to extend search beyond the loaded month
- Self-recovery from session expiry (manual prompt or auto-login)

### Alerts
- Red banner overlay + browser/OS notification + audio chime + tab-title flash
- "Show me" jump-to-slot button on the floating cluster
- Test alert mode for verifying alerts work before relying on them
- Hammer-protection on the test-alert button (cancellable mid-burst)

### Auto-book (opt-in)
- Auto-clicks date → time → Warning! Continue, stops on the Confirm changes page
- 15-minute slot-hold countdown with yellow highlight on the Confirm button
- Forced off in Test mode; refuses to ever click Confirm or Abandon
- One-time informed-consent modal fires before auto-book can be enabled: explains exactly what auto-book does, points to the disclaimer's auto-book waiver (§8), and requires explicit "I understand" before the feature activates
- Consent acknowledgement is stored as an ISO timestamp in localStorage and surfaced in the self-test diagnostic for audit purposes
- Save-time guard catches users who already had auto-book on from before the consent flow existed
- Wizard's auto-book step counts as implicit acknowledgement (the welcome step covers disclaimer acceptance), so wizard users aren't prompted twice

### Settings panel
- In-page panel, no code editing required for day-to-day use
- Live field validation with red error rings
- Searchable test-centre dropdown (~330 UK centres bundled, self-healing from real DVSA H1)
- Instructor-date picker with pill UI + bulk paste mode
- Live "What you're monitoring" preview with stacked-bar breakdown
- Health snapshot card (notifications/audio/last scan/auto-login status)
- Pause/resume from the floating cluster

### Scan history
- Persistent log of every match, nearby alert, and spotted date
- KPI tile grid (scans, matches, nearby, spotted, find rate, last 7 days, avg lead, last spotted)
- Filter by finding type + group-duplicates toggle
- CSV export with sighting + total-sightings columns for duplicate analysis
- Copy-to-clipboard + clear history

### Quality of life
- Monoline inline-SVG icons across all section headers and cluster buttons (no OS emoji drift)
- Floating status pill with live countdown + cycle count
- "Alert on any centre" toggle for informational non-target-centre alerts
- Test-centre mismatch detection (intervention alert if wrong centre loads)
- Layout-broken detection (intervention alert if DVSA changes selectors)
- Manual-trigger mode for active monitoring without auto-clicking
- Console API: `dvsaWatcher.history()`, `dvsaWatcher.clear()`, etc.
- Privacy reassurance strip in the settings panel footer
- 100% local, no analytics, no telemetry, no external calls beyond DVSA itself

### Keyboard shortcuts
- `S`, toggle settings panel
- `P`, pause/resume monitoring
- `H`, toggle scan history modal
- `Esc`, close any open modal
- Ignores keypresses inside inputs and when any modifier is held (so browser shortcuts like Cmd+S aren't hijacked)
- Visible hint row in the settings panel showing all four shortcuts

### Credential privacy
- Driving licence and booking reference inputs are masked (`type="password"`) by default
- Eye-icon reveal toggle per input, flips to plaintext for verification
- Defaults back to masked every time the settings panel reopens
- `autocomplete="off"` so browsers don't prompt to save the values

### Backup & restore
- Export panel config to a downloadable JSON file (`dvsa-watcher-config-YYYY-MM-DD.json`)
- Optional checkbox: *Include auto-login credentials* (default **off** for safety when sharing)
- Restore from a JSON file with strict validation:
  - Rejects files missing the `_meta.source` marker
  - Rejects any unknown settings keys (no arbitrary localStorage writes)
  - Rejects type mismatches (e.g. string where a number is expected)
- Restore shows a confirm dialog with a summary of the settings before applying
- Restore merges with current config, missing keys keep their existing values

### Legal and terms

Hardened legal posture across the project ahead of public release:

- **Acceptable Use Policy** added as DISCLAIMER §3, defining permitted use (individual, own booking, UK jurisdiction, own credentials) and prohibited use (on behalf of others, multiple accounts, commercial use of any kind, malicious or unlawful purposes, headless or automation-framework wrapping, use outside the UK)
- **Distribution, Modification and Forks** added as DISCLAIMER §4, asking forks and derivatives to remain non-commercial and clearly distinguished from the original, and giving users the canonical install URL plus instructions for verifying authenticity
- **Project Philosophy** added as DISCLAIMER §5, stating that the script is and will remain free for genuine individual users, that source remains visible, and that the project exists to help individuals rather than to be commercialised
- **User Responsibilities** (DISCLAIMER §8) expanded with eligibility, own-booking-only use, authenticity verification, and acceptance of project lifecycle
- **Indemnification** (DISCLAIMER §14) broadened to cover breaches of the Acceptable Use Policy and the Distribution rules
- **Modifications, Discontinuation, and Changes to these Terms** (DISCLAIMER §15) reorganised to explicitly cover script discontinuation
- Prominent **Permitted and prohibited use** callout added near the top of the README with cross-references to the new DISCLAIMER sections
- All cross-references between docs updated for the new section numbering (auto-book waiver is now §11)

### Style

- All em dashes removed from documentation and the script, replaced with commas, colons, or sentence breaks depending on context
- Colour emojis removed from documentation and user-facing strings (the wizard, consent modal, status pill, credit footer). The script's existing monoline SVG icons (date, centre, clock, lock, etc.) remain in place. Monochrome text glyphs (`✓`, `⚠`, `✗`, `○`) are retained because they read as icons rather than emoji in most fonts.
- README's three top-level callouts (disclaimer warning, existing-bookings-only, permitted use) converted to GitHub native alert syntax (`[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`) for proper coloured callout boxes
- MIT licence ([LICENSE](LICENSE)) with a brief disclaimer summary
- Comprehensive disclaimer and limitation of liability ([DISCLAIMER.md](DISCLAIMER.md)) covering: no affiliation with DVSA / UK Gov, **explicit scope-of-operation clause (existing bookings only, does not book new tests)**, "as is" no-warranty, no-liability for missed slots or account issues, user responsibilities, no guarantees, assumption of risk, auto-book-specific waiver, indemnification, governing law (England and Wales)
- Acceptance prompt in the README's install steps
- Prominent "for existing bookings only" callout near the top of the README, with matching language in the wizard welcome screen, FAQ, and userscript `@description`

### First-run setup wizard
- 5-step guided onboarding for new users (Welcome / Date window / Test centre / Instructor dates / Final options)
- Fires automatically the first time the script loads with invalid or placeholder config
- Progress dots, Back / Skip / Next / Finish navigation
- Live monitoring preview on the date-window step
- Native datalist combobox for the test centre (search across 356 bundled UK centres)
- Pill UI for instructor unavailable dates (skippable)
- Optional auto-book opt-in and auto-login fields on the final step
- Summary recap before Finish
- "Use the full settings panel instead →" escape hatch on every step
- Disclaimer acceptance prompt on the welcome step
- `localStorage` flag (`dvsaWatcher.wizardCompleted`) prevents the wizard from re-firing once completed or explicitly skipped

### Self-test diagnostic
- One-click diagnostic in the About section that probes: script version, environment, Tampermonkey presence, notification permission, audio context state, localStorage writability, panel config presence, cycles + findings counts, configuration validity, and DVSA selector presence on the current page
- Output formatted as plain text with `✓` / `⚠` / `✗` / `○` glyphs
- Copy-to-clipboard button for pasting straight into bug reports
- Re-run button for after-fix verification

### About pane in settings
- Script version, license, author shown prominently
- Links to GitHub repo, CHANGELOG, DISCLAIMER, Report issue
- "Check for updates" instructions for Tampermonkey users
- Inline "Run self-test diagnostic" button
- Inline "Re-run setup wizard" button, walk through the wizard again with current values pre-filled (cancelling mid-wizard preserves existing config)

### Tab-focus indicator
- 5th Health card tile shows current tab focus state
- Tracks `visibilitychange` events: warns the user if the tab has been backgrounded recently, since browsers throttle `setTimeout` in inactive tabs and may delay scan cycles
- Health grid uses `auto-fit` columns so tiles flow gracefully across panel widths

### Userscript header hardening
- `@noframes` directive added, prevents the script from accidentally loading in iframes (DevTools panels, OAuth popups, etc.)

### Project infrastructure
- [SECURITY.md](SECURITY.md), responsible-disclosure policy, scope, timeline
- [CONTRIBUTING.md](CONTRIBUTING.md), local dev setup, coding conventions, what's welcome / not welcome, PR checklist
- `.github/workflows/syntax-check.yml`, GitHub Actions workflow that runs `node --check` on every PR touching the public userscript
- Bug report and feature request issue templates

### Documentation
- Expanded README with a Quick Start TL;DR at the top
- Comprehensive Troubleshooting section (notifications, audio, Error 15, layout-broken, centre mismatch, missing cluster, validation errors)
- FAQ covering legality, test types, mobile, multi-tab, updates, manual-confirm rationale, config sharing, restore-to-different-browser, site changes, headless / server-side scanning, telemetry/privacy

[1.0.0]: https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/releases/tag/v1.0.0
