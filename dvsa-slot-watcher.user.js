// ==UserScript==
// @name         DVSA Earlier Slot Watcher (RETIRED)
// @namespace    https://github.com/alchemycharlie/dvsa-earlier-slot-watcher
// @version      2.0.0
// @description  RETIRED, NO LONGER MONITORS. This script is deprecated and unmaintained. DVSA rules from 12 May 2026 prohibit using unofficial services that scan the driving test booking service for appointments, and DVSA can cancel your booking or restrict your online booking access if bot activity is detected against your licence. The automated flow is disabled: on load the script shows a notice and stops. Source stays available under MIT for anyone who wants to fork it.
// @author       alchemycharlie
// @homepageURL  https://github.com/alchemycharlie/dvsa-earlier-slot-watcher
// @supportURL   https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues
// @updateURL    https://raw.githubusercontent.com/alchemycharlie/dvsa-earlier-slot-watcher/main/dvsa-slot-watcher.user.js
// @downloadURL  https://raw.githubusercontent.com/alchemycharlie/dvsa-earlier-slot-watcher/main/dvsa-slot-watcher.user.js
// @license      MIT
// @match        https://driverpracticaltest.dvsa.gov.uk/manage*
// @match        https://driverpracticaltest.dvsa.gov.uk/login*
// @match        https://queue.driverpracticaltest.dvsa.gov.uk/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // Script version. Kept in sync with the @version line in the userscript
    // header at the top of this file. Surfaced in the About pane of the
    // settings panel and in the self-test diagnostic output for bug reports.
    const SCRIPT_VERSION = '2.0.0';

    // =========================================================================
    //  RETIRED
    // =========================================================================
    // This project is deprecated and no longer maintained by its author.
    //
    // Two things happened:
    //
    //   1. From 12 May 2026, DVSA's rules state that candidates must not use
    //      unofficial services that scan the driving test booking service for
    //      appointments. DVSA's booking terms and conditions separately
    //      prohibit bots and third-party tools for searching test slots, and
    //      DVSA state they can cancel a booking or restrict online booking
    //      access where bot activity is detected against a licence. That
    //      consequence lands on the user's own test. Scanning is exactly what
    //      this script did.
    //
    //   2. From 9 June 2026, a car test can only be moved to one of the 3
    //      nearest test centres (or back to the originally booked one), so
    //      DVSA's change-test-centre page no longer offers the free-text
    //      postcode search the multi-centre flow was built around. That flow
    //      was already broken as a result (issue #2).
    //
    // With DEPRECATED = true, main() renders a notice and returns before any
    // page handler runs. Nothing is clicked, submitted, scheduled or reloaded.
    //
    // The rest of the source is left intact and MIT-licensed. If you fork this
    // and intend to run it, setting DEPRECATED = false restores the original
    // behaviour — but understand that you would be running a slot scanner
    // against a service whose operator now expressly forbids it, and the risk
    // (cancelled booking, loss of online access) is yours.
    const DEPRECATED = true;

    // Tab-focus tracking. Browsers throttle setTimeout (and other timers) when
    // a tab is in the background, which can stretch the script's refresh
    // cycle from "8 minutes" to "much longer". We track the most recent time
    // the tab was hidden so the Health card can warn the user that their
    // scans may have been delayed.
    let _tabEverBackgrounded = false;
    let _tabLastHiddenAt = null;
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                _tabEverBackgrounded = true;
                _tabLastHiddenAt = Date.now();
            }
        });
    }

    // Panel-saved overrides are read once at startup. Click the gear icon (bottom-right
    // on any DVSA page) to edit settings without touching code. Values below act as
    // defaults, anything saved via the panel wins.
    const PANEL_CONFIG_KEY = 'dvsa-watcher-config';
    const _storedCfg = (() => {
        try { return JSON.parse(localStorage.getItem(PANEL_CONFIG_KEY) || '{}'); }
        catch (e) { return {}; }
    })();
    const _cfg = (key, fallback) => _storedCfg[key] !== undefined ? _storedCfg[key] : fallback;

    // =========================================================================
    //  DEFAULTS  --  edit these only if you want to pre-fill the settings panel
    //                 for new installs. Day-to-day, use the gear icon instead.
    // =========================================================================
    const TARGET_START_DATE = _cfg('TARGET_START_DATE', 'YYYY-MM-DD');
    const TARGET_END_DATE   = _cfg('TARGET_END_DATE',   'YYYY-MM-DD');
    const REFRESH_MIN_MINS  = _cfg('REFRESH_MIN_MINS',  7);
    const REFRESH_MAX_MINS  = _cfg('REFRESH_MAX_MINS',  12);
    const EXPECTED_CENTRE   = _cfg('EXPECTED_CENTRE',   'Your Test Centre (Location)');
    const WALK_PREV_AVAIL   = _cfg('WALK_PREV_AVAIL',   true);
    const MAX_PREV_CLICKS   = _cfg('MAX_PREV_CLICKS',   12);
    const EXCLUDE_WEEKENDS  = _cfg('EXCLUDE_WEEKENDS',  true);
    const TEST_MODE         = _cfg('TEST_MODE',         false);

    // Auto-book (opt-in): when a match is found, auto-click date/time/Continue
    // through to DVSA's "Confirm changes" page. Final commit stays manual.
    const AUTO_BOOK         = _cfg('AUTO_BOOK',         false);
    const EARLIEST_TIME     = _cfg('EARLIEST_TIME',     '00:00');
    const LATEST_TIME       = _cfg('LATEST_TIME',       '23:59');

    // Alert on any centre with availability (informational, non-target centres).
    const ALERT_ANY_CENTRE  = _cfg('ALERT_ANY_CENTRE',  false);

    const SEARCH_POSTCODE   = _cfg('SEARCH_POSTCODE',   'AA1 1AA');
    const MANUAL_TRIGGER    = _cfg('MANUAL_TRIGGER',    false);

    // Auto-login (optional): leave blank for manual login prompts.
    const LOGIN_LICENCE_NUMBER = _cfg('LOGIN_LICENCE_NUMBER', '');
    const LOGIN_BOOKING_REF    = _cfg('LOGIN_BOOKING_REF',    '');

    const INSTRUCTOR_UNAVAILABLE_DATES = _cfg('INSTRUCTOR_UNAVAILABLE_DATES', []);
    // =========================================================================

    const LOG_PREFIX = '[DVSA Earlier Slot Watcher]';
    const log = (...args) => console.log(LOG_PREFIX, ...args);

    // ---- z-index layering ----
    // Centralised so the stacking order is intentional: modal overlays sit
    // above intervention banners and alert banners, which sit above the
    // floating cluster (so modals can cover the cluster when open).
    // 2147483647 is the max 32-bit signed integer, which is the practical
    // ceiling for z-index in every browser engine.
    const Z_INDEX_OVERLAY = 2147483647;   // intervention banners, alert banners, modal overlays
    const Z_INDEX_CLUSTER = 2147483646;   // floating pill/gear cluster, nearby-alert banner

    // Page states identified by document.body.id on each page of the DVSA flow
    const PAGE_STATE = {
        LOGIN:              'page-login',               // session-expired re-auth page
        BOOKING_DETAILS:    'page-ibs-summary',         // post-login landing
        TEST_DATE_CHOICE:   'page-test-preferences',    // "How do you want to search?" page
        CALENDAR:           'page-available-time',      // calendar with bookable dates
        TEST_CENTRE_SEARCH: 'page-test-centre-search', // multi-centre availability search
        CONFIRM_BOOKING:    'page-confirm-booking',     // final "Confirm changes" review page
        SERVICE_UNAVAILABLE:'page-service-c'            // "Service unavailable" downtime page
    };

    // Session storage key for "auto-book just navigated here" flag.
    // Set by autoBookFlow before clicking Continue, read+consumed by handleConfirmBooking.
    const AUTO_BOOK_FLAG_KEY = 'dvsa-watcher-auto-book-flag';

    // Session storage key for "we just attempted recovery from a post-CAPTCHA
    // Tomcat 403 redirect". Used as a loop guard: if we land on the 403 page,
    // navigate to /manage to recover, and then land on the 403 page AGAIN,
    // give up and surface an intervention rather than loop forever. Cleared
    // when we successfully reach any recognised PAGE_STATE.
    const POST_CAPTCHA_RECOVERY_KEY = 'dvsa-watcher-post-captcha-recovery';

    // Persistent localStorage key for auto-book consent acknowledgement.
    // Set to an ISO timestamp the first time the user explicitly enables
    // auto-book via the consent modal (or completes the wizard with auto-book
    // turned on, which counts as implicit ack). Surfaced in the self-test
    // diagnostic as an audit trail of when the user consented.
    const AUTO_BOOK_ACK_KEY = 'dvsa-watcher-auto-book-ack';
    function getAutoBookAck() {
        try { return localStorage.getItem(AUTO_BOOK_ACK_KEY) || ''; }
        catch (e) { return ''; }
    }
    function setAutoBookAck() {
        try { localStorage.setItem(AUTO_BOOK_ACK_KEY, new Date().toISOString()); }
        catch (e) { /* storage full or disabled, silently ignore */ }
    }

    // Reasons why the user must intervene manually
    const INTERVENTION_REASONS = {
        CAPTCHA:             'captcha challenge',
        TEMP_BLOCK:          'Error 15 temp block',
        LOGIN:               'session expired',
        CENTRE_MISMATCH:     'test centre mismatch',
        LAYOUT_BROKEN:       'DVSA layout changed',
        MAX_CHANGES_REACHED: 'maximum test changes reached'
    };

    // What the user should actually do for each intervention type
    const INTERVENTION_INSTRUCTIONS = {
        'captcha challenge':             'Solve the captcha to continue.',
        'Error 15 temp block':           'Standard DVSA rate-limit response. Script paused. Wait for the block to clear naturally (typically 1-2 hours), then resume.',
        'session expired':               'Re-enter your driving licence number and booking reference.',
        'test centre mismatch':          'Calendar loaded a different test centre. Monitoring is paused. Verify your configured test centre and reload.',
        'DVSA layout changed':           'A page element the script needs is missing. DVSA may have updated their site, check for a script update.',
        'maximum test changes reached':  'DVSA\'s change limit has been hit for this booking. Call DVSA on 0300 200 1122 to request further changes. Monitoring auto-paused; unpause only if your booking situation changes.'
    };

    // ---- Findings log (persisted to localStorage for verification & history) ----
    // STORAGE_MAX caps the array length. At ~180 bytes per entry, 1000 entries
    // is ~180KB of localStorage, well within the per-origin 5-10MB limit. Older
    // entries are evicted FIFO once the cap is hit. The history panel surfaces
    // the cap to the user so they know to export to CSV if they want a
    // permanent record beyond the most recent 1000 findings.
    const STORAGE_KEY = 'dvsa-watcher-findings';
    const STORAGE_MAX = 1000;
    const CYCLES_KEY  = 'dvsa-watcher-cycles';
    // Default shape for the cycles record. Used both as a fallback when the
    // localStorage entry is missing/corrupt and as the seed for recordCycle().
    const CYCLES_DEFAULT = () => ({ count: 0, first: null, last: null });

    function recordCycle() {
        try {
            const data = JSON.parse(localStorage.getItem(CYCLES_KEY) || JSON.stringify(CYCLES_DEFAULT()));
            data.count = (data.count || 0) + 1;
            if (!data.first) data.first = new Date().toISOString();
            data.last = new Date().toISOString();
            localStorage.setItem(CYCLES_KEY, JSON.stringify(data));
        } catch (e) {
            log('Failed to record cycle:', e.message);
        }
    }

    function getCycles() {
        try {
            return JSON.parse(localStorage.getItem(CYCLES_KEY) || JSON.stringify(CYCLES_DEFAULT()));
        } catch (e) {
            return CYCLES_DEFAULT();
        }
    }

    function recordFinding(type, dates, note) {
        try {
            const entry = {
                ts: new Date().toISOString(),
                type: type,  // 'match' (alerted) or 'spotted' (saw but outside window)
                dates: Array.isArray(dates) ? dates : [dates],
                note: note || null
            };
            const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            arr.push(entry);
            while (arr.length > STORAGE_MAX) arr.shift();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
            log(`Recorded ${type} finding: ${entry.dates.join(', ')}`);
        } catch (e) {
            log('Failed to record finding:', e.message);
        }
    }

    function getFindings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function printFindings() {
        const findings = getFindings();
        if (!findings.length) {
            console.log(`${LOG_PREFIX} No findings recorded yet.`);
            return;
        }
        console.log(`${LOG_PREFIX} === ${findings.length} findings ===`);
        findings.forEach((f, i) => {
            const date = new Date(f.ts).toLocaleString('en-GB');
            const dates = (f.dates || []).join(', ');
            const note = f.note ? ` (${f.note})` : '';
            console.log(`${LOG_PREFIX} #${i + 1}  ${date}  [${f.type}]  ${dates}${note}`);
        });
    }

    function clearFindings() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CYCLES_KEY);
            log('Findings and cycles cleared.');
        } catch (e) {
            log('Failed to clear findings:', e.message);
        }
    }

    function analyseFindings() {
        const findings = getFindings();
        const cycles = getCycles();
        const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        console.log(`${LOG_PREFIX} === DVSA Earlier Slot Watcher Analytics ===`);

        if (!cycles.count) {
            console.log(`${LOG_PREFIX} No scan cycles recorded yet.`);
            return;
        }

        const periodStart = cycles.first ? new Date(cycles.first) : null;
        const periodEnd = cycles.last ? new Date(cycles.last) : new Date();
        const hours = periodStart ? (periodEnd - periodStart) / 3600000 : 0;

        console.log(`${LOG_PREFIX} Period: ${periodStart ? periodStart.toLocaleString('en-GB') : '?'}`);
        console.log(`${LOG_PREFIX}     to: ${periodEnd.toLocaleString('en-GB')} (${hours.toFixed(1)} hours)`);
        console.log(`${LOG_PREFIX} Scans completed: ${cycles.count}`);

        if (!findings.length) {
            console.log(`${LOG_PREFIX} Total findings: 0`);
            console.log(`${LOG_PREFIX} No availability detected in this period at ${EXPECTED_CENTRE}.`);
            return;
        }

        const matches = findings.filter(f => f.type === 'match');
        const spotted = findings.filter(f => f.type === 'spotted');
        console.log(`${LOG_PREFIX} Total findings: ${findings.length} (${matches.length} match, ${spotted.length} spotted)`);
        console.log(`${LOG_PREFIX} Find rate: ${(findings.length / cycles.count * 100).toFixed(1)}% of scans surfaced any date`);

        // Day of week breakdown of the test dates themselves
        const dowCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
        findings.forEach(f => {
            (f.dates || []).forEach(d => {
                const dow = new Date(d + 'T12:00:00').getDay();
                dowCounts[dowNames[dow]]++;
            });
        });
        console.log(`${LOG_PREFIX} Available test dates by day of week:`);
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
            const bar = '*'.repeat(dowCounts[day]);
            console.log(`${LOG_PREFIX}   ${day}: ${dowCounts[day]} ${bar}`);
        });

        // Time of day distribution of when findings were detected (i.e., when DVSA released them or made them visible)
        const todBuckets = { '00-06': 0, '06-09': 0, '09-12': 0, '12-15': 0, '15-18': 0, '18-21': 0, '21-24': 0 };
        findings.forEach(f => {
            const hour = new Date(f.ts).getHours();
            if (hour < 6) todBuckets['00-06']++;
            else if (hour < 9) todBuckets['06-09']++;
            else if (hour < 12) todBuckets['09-12']++;
            else if (hour < 15) todBuckets['12-15']++;
            else if (hour < 18) todBuckets['15-18']++;
            else if (hour < 21) todBuckets['18-21']++;
            else todBuckets['21-24']++;
        });
        console.log(`${LOG_PREFIX} When findings were detected (clock time):`);
        Object.entries(todBuckets).forEach(([bucket, count]) => {
            const bar = '*'.repeat(count);
            console.log(`${LOG_PREFIX}   ${bucket}: ${count} ${bar}`);
        });

        // Lead time analysis (days from when we saw it to when the test would be)
        const leadTimes = [];
        findings.forEach(f => {
            const findingDate = new Date(f.ts);
            (f.dates || []).forEach(d => {
                const targetDate = new Date(d + 'T12:00:00');
                leadTimes.push((targetDate - findingDate) / 86400000);
            });
        });
        if (leadTimes.length) {
            const min = Math.min(...leadTimes);
            const max = Math.max(...leadTimes);
            const avg = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
            console.log(`${LOG_PREFIX} Lead time (days ahead of "now"):`);
            console.log(`${LOG_PREFIX}   min: ${min.toFixed(0)}, max: ${max.toFixed(0)}, avg: ${avg.toFixed(0)}`);
        }

        // Time since last finding
        const lastFinding = findings[findings.length - 1];
        const ageMs = Date.now() - new Date(lastFinding.ts).getTime();
        const ageHours = ageMs / 3600000;
        const ageMins = ageMs / 60000;
        const ageStr = ageHours >= 1 ? `${ageHours.toFixed(1)} hours ago` : `${ageMins.toFixed(0)} minutes ago`;
        console.log(`${LOG_PREFIX} Last finding: ${ageStr} (${(lastFinding.dates || []).join(', ')})`);
    }

    function buildFindingsCsv() {
        const findings = getFindings();
        const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const typeLabel = { match: 'Match', nearby: 'Nearby', spotted: 'Spotted' };

        // Proper CSV cell quoting: wrap in quotes if value contains comma, quote, or newline;
        // double up any internal quotes per RFC 4180.
        const csvCell = (v) => {
            if (v == null) return '';
            const s = String(v);
            return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        // Internal note text like "(informational - not target centre)" is noise once
        // the data is in a sheet, the Type and "In target window?" columns convey the
        // same information more cleanly. Strip those well-known internal phrases;
        // pass anything else through (e.g. "auto-book: held 9:07am", "outside target window").
        const STRIP_PATTERNS = /^(informational - not target centre|alert fired - non-target centre|target centre but outside window\/filters)$/i;

        // Parse the recordFinding note into (centre, cleanedNote).
        // Notes from non-target sites come as "Centre Name (internal explanation)"
        //,we lift the centre into its own column and drop the explanation.
        // Notes without a parenthetical (e.g. "outside target window") have no
        // centre embedded, the slot must be at the target centre by elimination.
        const parseNote = (rawNote) => {
            if (!rawNote) return { centre: EXPECTED_CENTRE, note: '' };
            const m = rawNote.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (m) {
                const centre = m[1].trim();
                const detail = m[2].trim();
                return {
                    centre,
                    note: STRIP_PATTERNS.test(detail) ? '' : detail
                };
            }
            return { centre: EXPECTED_CENTRE, note: rawNote };
        };

        const inTargetWindow = (d) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_START_DATE)) return '';
            if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_END_DATE))   return '';
            return (d >= TARGET_START_DATE && d <= TARGET_END_DATE) ? 'Yes' : 'No';
        };

        // Pre-pass: count how many times each unique slot has been sighted.
        // Key is (date|type|note),same key the history modal uses for its
        // "Group duplicates" toggle, so the CSV's Total sightings column matches
        // the ×N badge you see in grouped view. (date, centre) alone would conflate
        // a Match and a separate Spotted on the same day; keeping type separate is
        // a more honest count of "events of this kind".
        const sightingTotals = new Map();
        findings.forEach(f => {
            (f.dates || []).forEach(d => {
                const key = `${d}|${f.type}|${f.note || ''}`;
                sightingTotals.set(key, (sightingTotals.get(key) || 0) + 1);
            });
        });

        // Header row, analyst-friendly order, every column independently sortable/filterable
        const header = [
            'Test date',        // The available slot's date (YYYY-MM-DD, Sheets recognises as date)
            'Day',              // Day-of-week of test (Mon/Tue/...)
            'Centre',           // Which centre the slot is at
            'Type',             // Match (target centre, in window) / Nearby (other centre alerted) / Spotted (other)
            'In target window', // Yes / No (relative to TARGET_START_DATE..TARGET_END_DATE)
            'Spotted on',       // The date the script saw it (YYYY-MM-DD)
            'Spotted at',       // The time of day the script saw it (HH:MM, 24h, browser local time)
            'Days ahead',       // Days from spotted-on to test-date
            'Sighting',         // 1, 2, 3...,which time this same slot was seen. Filter =1 for unique view.
            'Total sightings',  // Total times this same slot was seen across all recorded findings.
            'Notes'             // Cleaned freeform note (auto-book details, "outside target window", etc.)
        ];

        const sightingSeen = new Map();  // running counter while emitting rows in chronological order
        const rows = [header.map(csvCell).join(',')];
        findings.forEach(f => {
            (f.dates || []).forEach(d => {
                const findingTs = new Date(f.ts);
                const targetDate = new Date(d + 'T12:00:00');
                const dow = dowNames[targetDate.getDay()];
                const leadDays = Math.round((targetDate.getTime() - findingTs.getTime()) / 86400000);
                // en-CA gives ISO YYYY-MM-DD which Sheets parses as a date in any locale
                const spottedDate = findingTs.toLocaleDateString('en-CA');
                const spottedTime = findingTs.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                const { centre, note } = parseNote(f.note);
                const key = `${d}|${f.type}|${f.note || ''}`;
                const sightingNum = (sightingSeen.get(key) || 0) + 1;
                sightingSeen.set(key, sightingNum);
                const totalSightings = sightingTotals.get(key);
                rows.push([
                    d,
                    dow,
                    centre,
                    typeLabel[f.type] || f.type,
                    inTargetWindow(d),
                    spottedDate,
                    spottedTime,
                    leadDays,
                    sightingNum,
                    totalSightings,
                    note
                ].map(csvCell).join(','));
            });
        });
        return rows.join('\n');
    }

    function exportFindings() {
        const findings = getFindings();
        const csv = buildFindingsCsv();

        if (!findings.length) {
            log('No findings to export yet.');
            return csv;
        }

        // Trigger a browser download so the data persists outside the console
        try {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `dvsa-findings-${ts}.csv`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
            }, 100);
            log(`Exported ${findings.length} findings to dvsa-findings-${ts}.csv (check Downloads folder)`);
        } catch (e) {
            log('Download trigger failed, falling back to console output:', e.message);
            console.log(`${LOG_PREFIX} === Findings CSV ===`);
            console.log(csv);
        }
        return csv;
    }

    function copyFindingsToClipboard() {
        if (!getFindings().length) {
            log('No findings to copy yet.');
            return;
        }
        const csv = buildFindingsCsv();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(csv).then(
                () => log(`Copied ${getFindings().length} findings to clipboard. Paste into a spreadsheet.`),
                e => log('Clipboard write failed:', e.message)
            );
        } else {
            log('Clipboard API unavailable. Use dvsaWatcher.export() to download as a file instead.');
        }
    }

    // Expose API to the page console
    try {
        window.dvsaWatcher = {
            print:    printFindings,
            findings: getFindings,
            cycles:   getCycles,
            analyse:  analyseFindings,
            export:   exportFindings,
            copy:     copyFindingsToClipboard,
            clear:    clearFindings
        };
    } catch (e) { /* ignore */ }

    function randomReloadMs() {
        const min = REFRESH_MIN_MINS * 60 * 1000;
        const max = REFRESH_MAX_MINS * 60 * 1000;
        return Math.floor(min + Math.random() * (max - min));
    }

    // Brief stagger between actions. Used to let DOM/animations settle between
    // clicks and add a little timing jitter. Values are deliberately short:
    // the script's pacing approach is "human-comparable cycle rate (7-12 min
    // between page checks)" rather than "fine-grained click timing within a
    // single session". The cycle interval is the part that matters for being
    // respectful of DVSA's infrastructure and falling within their normal
    // rate-limiting thresholds; the per-action timing inside a single cycle
    // is just there to let DOM/animations settle.
    function humanPause(minSec, maxSec) {
        const ms = minSec * 1000 + Math.random() * (maxSec - minSec) * 1000;
        return new Promise(r => setTimeout(r, ms));
    }

    // Flash document.title between two strings on an interval, capped at
    // maxFlips total flips. Used by every alert path that wants to surface a
    // pending action in the tab bar (intervention, test alert, match, nearby).
    // Returns the interval ID so callers can clear it early if needed.
    //
    // Stops automatically when:
    //   - flips reaches maxFlips (default 600), OR
    //   - document.body.dataset.alertAcknowledged is set (unless caller passes
    //     stopOnAcknowledged: false — used by the test alert because it
    //     manages its own lifecycle and shouldn't be terminated by real alerts)
    //
    // Options:
    //   intervalMs         (default 700)  ms between flips
    //   maxFlips           (default 600)  cap total flips so we don't run forever
    //   restoreTo          (default null) if set, document.title is restored
    //                                     to this value once the interval ends
    //   stopOnAcknowledged (default true) also exit when alertAcknowledged is set
    //   onComplete         (default null) invoked once when the interval ends
    //                                     (after restoreTo has been applied)
    function flashTitle(titleA, titleB, opts) {
        opts = opts || {};
        const intervalMs = opts.intervalMs || 700;
        const maxFlips   = opts.maxFlips   || 600;
        const stopOnAck  = opts.stopOnAcknowledged !== false;
        let flip = true;
        let flips = 0;
        const id = setInterval(() => {
            if (flips++ >= maxFlips || (stopOnAck && document.body.dataset.alertAcknowledged)) {
                clearInterval(id);
                if (opts.restoreTo != null) document.title = opts.restoreTo;
                if (opts.onComplete) opts.onComplete();
                return;
            }
            document.title = flip ? titleA : titleB;
            flip = !flip;
        }, intervalMs);
        return id;
    }

    // Poll the DOM with `predicate()` until it returns truthy or `timeoutMs` elapses.
    // Resolves with the predicate's return value (so you can do `const el = await waitFor(...)`).
    // Resolves with null on timeout.
    function waitFor(predicate, timeoutMs, pollMs) {
        timeoutMs = timeoutMs || 5000;
        pollMs = pollMs || 100;
        return new Promise(resolve => {
            const start = Date.now();
            const tick = () => {
                let result;
                try { result = predicate(); } catch (e) { result = null; }
                if (result) return resolve(result);
                if (Date.now() - start >= timeoutMs) return resolve(null);
                setTimeout(tick, pollMs);
            };
            tick();
        });
    }

    // Parse DVSA's `data-datetime-label` (e.g. "Thursday 17 September 2026 9:07am")
    // to minutes-since-midnight (0–1439). Returns null if unparseable.
    // Used by auto-book to filter time radios against EARLIEST_TIME / LATEST_TIME.
    function parseSlotTimeLabel(label) {
        if (!label) return null;
        const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(label);
        if (!m) return null;
        let hour = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const ampm = m[3].toLowerCase();
        if (ampm === 'pm' && hour !== 12) hour += 12;
        else if (ampm === 'am' && hour === 12) hour = 0;
        return hour * 60 + min;
    }

    // Parse "HH:MM" (24h, with or without leading zero) to minutes-since-midnight.
    function parseTimeOfDay(hhmm) {
        const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
        if (!m) return null;
        const h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
        return h * 60 + mm;
    }

    function scanVisibleCalendar() {
        // In test mode, include the user's existing booking so we can verify the alert chain
        const selector = TEST_MODE
            ? 'td.BookingCalendar-date--bookable a.BookingCalendar-dateLink'
            : 'td.BookingCalendar-date--bookable a.BookingCalendar-dateLink:not(.is-chosen)';
        const links = document.querySelectorAll(selector);
        const out = [];
        links.forEach(a => {
            const d = a.dataset.date;
            if (d) out.push(d);
        });
        return out;
    }

    function inRange(dateStr) {
        return dateStr >= TARGET_START_DATE && dateStr <= TARGET_END_DATE;
    }

    function isInstructorUnavailable(dateStr) {
        return INSTRUCTOR_UNAVAILABLE_DATES.includes(dateStr);
    }

    function isWeekend(dateStr) {
        // Parse at noon to sidestep timezone edge cases
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        return day === 0 || day === 6;  // 0 = Sun, 6 = Sat
    }

    function isAcceptable(dateStr) {
        if (TEST_MODE) return true;
        return inRange(dateStr)
            && !isInstructorUnavailable(dateStr)
            && (!EXCLUDE_WEEKENDS || !isWeekend(dateStr));
    }

    function calendarSnapshot() {
        const body = document.querySelector('.BookingCalendar-datesBody');
        return body ? body.innerHTML : '';
    }

    function clickPrevAvailable() {
        const link = document.querySelector('a.BookingCalendar-nav--prev-avail');
        if (!link) return false;
        link.click();
        return true;
    }

    function isNoEarlierWarningVisible() {
        const warn = document.querySelector('#no-earlier-slots-warn');
        if (!warn) return false;
        const style = window.getComputedStyle(warn);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        // Also treat zero-height/empty as hidden
        return warn.offsetParent !== null && warn.getBoundingClientRect().height > 0;
    }

    function setWatchingTitle(minsUntilReload) {
        const base = document.title.replace(/^\[Watch [^\]]+\]\s*/, '');
        document.title = `[Watch ${minsUntilReload.toFixed(1)}m] ${base}`;
    }

    function returnToStart() {
        log('Navigating to /manage to start a fresh flow.');
        window.location.href = '/manage';
    }

    function scheduleTestCentreRecheck() {
        const ms = randomReloadMs();
        const totalMins = ms / 60000;
        log(`Re-running test centre search in ${totalMins.toFixed(1)} minutes.`);
        setWatchingTitle(totalMins);

        const endTime = Date.now() + ms;
        setStatus({ state: STATUS_STATE.SCANNING, endTime });

        const countdownInterval = setInterval(() => {
            if (document.body.dataset.slotFound) {
                clearInterval(countdownInterval);
                return;
            }
            const msRemaining = endTime - Date.now();
            if (msRemaining <= 60000) {
                clearInterval(countdownInterval);
                return;
            }
            const minsRemaining = msRemaining / 60000;
            log(`${minsRemaining.toFixed(1)} minutes until next test centre search.`);
            setWatchingTitle(minsRemaining);
        }, 60000);

        setTimeout(() => {
            clearInterval(countdownInterval);
            if (document.body.dataset.slotFound) return;
            // Re-click "Find test centres" to refresh results on the same page
            const btn = document.querySelector('#test-centres-submit');
            if (btn) {
                log('Re-running test centre search (clicking Find test centres).');
                btn.click();
            } else {
                log('Submit button missing on rerun. Idling.');
            }
        }, ms);
    }

    function scheduleNextCycle() {
        const ms = randomReloadMs();
        const totalMins = ms / 60000;
        log(`No match. Restarting flow in ${totalMins.toFixed(1)} minutes.`);
        setWatchingTitle(totalMins);

        const endTime = Date.now() + ms;
        setStatus({ state: STATUS_STATE.SCANNING, endTime });

        // Heartbeat countdown logs every 60 seconds so you can see the script is alive
        const countdownInterval = setInterval(() => {
            if (document.body.dataset.slotFound) {
                clearInterval(countdownInterval);
                return;
            }
            const msRemaining = endTime - Date.now();
            if (msRemaining <= 60000) {
                // Less than a minute left, main setTimeout will fire shortly
                clearInterval(countdownInterval);
                return;
            }
            const minsRemaining = msRemaining / 60000;
            log(`${minsRemaining.toFixed(1)} minutes until next cycle.`);
            setWatchingTitle(minsRemaining);
        }, 60000);

        setTimeout(() => {
            clearInterval(countdownInterval);
            // Don't navigate away if a slot was found just before the timer fires
            if (!document.body.dataset.slotFound) {
                returnToStart();
            }
        }, ms);
    }

    function detectInterventionState() {
        // Imperva error pages share the _Incapsula_Resource iframe pattern.
        // Distinguish by the edet code: 12 = captcha challenge, 15 = temp IP block.
        const impervaFrame = document.querySelector('iframe[src*="_Incapsula_Resource"]');
        if (impervaFrame) {
            const src = impervaFrame.getAttribute('src') || '';
            if (src.includes('edet=15')) return INTERVENTION_REASONS.TEMP_BLOCK;
            if (src.includes('edet=12')) return INTERVENTION_REASONS.CAPTCHA;
            // Unknown edet code - default to captcha (most common challenge type)
            return INTERVENTION_REASONS.CAPTCHA;
        }
        // hCaptcha standalone (in case it ever appears outside the Imperva wrapper)
        if (document.querySelector('iframe[src*="hcaptcha"]')) return INTERVENTION_REASONS.CAPTCHA;
        if (document.querySelector('[class*="h-captcha"], [data-hcaptcha-widget-id]')) return INTERVENTION_REASONS.CAPTCHA;

        // Login page - body id and URL are precise unambiguous signals
        const bodyId = (document.body && document.body.id || '');
        if (bodyId === 'page-login') return INTERVENTION_REASONS.LOGIN;
        if (location.pathname.toLowerCase() === '/login') return INTERVENTION_REASONS.LOGIN;

        return null;
    }

    // Fire N notifications in sequence with the same tag. Each plays the OS sound,
    // but only one popup is visible at a time (subsequent ones replace the previous).
    // This gives a longer audible cue without needing page audio context.
    // Clicking any notification sets the acknowledge flag, which stops the burst (and
    // the matching audio beep / title flash loops) on their next tick.
    function fireOSNotificationBurst(title, body, tag, count, intervalMs) {
        if (!window.Notification || Notification.permission !== 'granted') return;
        count = count || 1;
        intervalMs = intervalMs || 1500;
        let fired = 0;
        const fire = () => {
            try {
                const n = new Notification(title, { body, requireInteraction: true, tag });
                n.onclick = () => {
                    document.body.dataset.alertAcknowledged = '1';
                    try { window.focus(); n.close(); } catch (e) { /* ignore */ }
                };
            } catch (e) { /* ignore */ }
            fired++;
            if (fired < count && !document.body.dataset.alertAcknowledged) {
                setTimeout(fire, intervalMs);
            }
        };
        fire();
    }

    function fireInterventionAlert(reason, detail) {
        if (document.body.dataset.interventionFlagged) return;
        document.body.dataset.interventionFlagged = '1';
        const instruction = INTERVENTION_INSTRUCTIONS[reason] || 'Resolve to continue monitoring.';
        const detailSuffix = detail ? ` (${detail})` : '';
        log(`*** ACTION REQUIRED: ${reason}${detailSuffix} - ${instruction} ***`);
        setStatus({ state: STATUS_STATE.ACTION, label: reason + detailSuffix });

        // Title flash (less urgent cadence than slot-match alert). 1s interval,
        // capped at ~10 minutes so it doesn't run forever after you resolve the
        // intervention. Exits early if alertAcknowledged is set.
        flashTitle(
            `[ACTION NEEDED] ${reason}`,
            `[!] DVSA Earlier Slot Watcher needs you`,
            { intervalMs: 1000, maxFlips: 600 }
        );

        // Different banner colour for temp block (red) vs other interventions (orange)
        // Red banner for hard stops the user has to address externally (wait
        // out the rate-limit, or call DVSA). Orange for transient states the
        // user can resolve in-tab (solve a CAPTCHA, re-login, etc.).
        const isBlock = reason === INTERVENTION_REASONS.TEMP_BLOCK ||
                        reason === INTERVENTION_REASONS.MAX_CHANGES_REACHED;
        const bgColour = isBlock ? '#d4351c' : '#f47738';

        const banner = document.createElement('div');
        banner.className = 'dvsa-banner dvsa-banner-small';
        banner.style.background = bgColour;
        banner.textContent = `${reason.toUpperCase()}: ${instruction}${detailSuffix}`;
        document.body.prepend(banner);

        // Audible cue via OS notifications. More chimes for the harder block.
        fireOSNotificationBurst(
            `DVSA Earlier Slot Watcher: ${reason}`,
            instruction + detailSuffix,
            'dvsa-intervention',
            isBlock ? 4 : 2,
            2000
        );
    }

    // Wrap document.querySelector for elements the script MUST find to make
    // progress on the current page. If DVSA renames or removes the element,
    // fire a LAYOUT_BROKEN intervention so the user notices instead of the
    // script idling silently.
    function requireSelector(selector, contextLabel) {
        const el = document.querySelector(selector);
        if (!el) {
            log(`Critical selector "${selector}" (${contextLabel}) not found, DVSA may have changed their markup.`);
            fireInterventionAlert(INTERVENTION_REASONS.LAYOUT_BROKEN, `${selector},${contextLabel}`);
            return null;
        }
        return el;
    }

    // Detect the Tomcat 403 page DVSA's redirect chain occasionally lands on
    // after a CAPTCHA solve. Spring WebFlow sometimes builds the post-CAPTCHA
    // redirect URL with an _eventId that the state machine has already
    // consumed or doesn't accept at that point; the underlying Tomcat returns
    // a 403 Forbidden as a result. A human user works around this by stripping
    // the broken query string and reloading /manage; we automate the same
    // recovery.
    //
    // Detection is deliberately tight: must be on the DVSA host, must have
    // the distinctive Tomcat 403 title, and the URL must carry an _eventId
    // parameter (other 403s — e.g. truly forbidden resources — wouldn't match
    // this pattern and shouldn't trigger auto-recovery).
    function isPostCaptchaForbiddenRedirect() {
        if (window.location.hostname !== 'driverpracticaltest.dvsa.gov.uk') return false;
        if (!/HTTP Status 403/i.test(document.title || '')) return false;
        if (!/_eventId=/i.test(window.location.search || '')) return false;
        return true;
    }

    // Navigate to the canonical /manage URL to recover from a post-CAPTCHA
    // Tomcat 403. The session-storage flag is a loop guard: if recovery
    // somehow lands us back on the 403 page, we don't loop forever — we
    // surface an intervention instead. The flag is cleared in main() once
    // we reach any recognised PAGE_STATE.
    function recoverFromPostCaptchaRedirect() {
        if (sessionStorage.getItem(POST_CAPTCHA_RECOVERY_KEY)) {
            log('Post-CAPTCHA 403 recovery already attempted this session and we are still on the 403 page. Surfacing intervention rather than looping.');
            sessionStorage.removeItem(POST_CAPTCHA_RECOVERY_KEY);
            fireInterventionAlert(INTERVENTION_REASONS.LAYOUT_BROKEN, 'post-CAPTCHA 403 recovery failed');
            return;
        }
        sessionStorage.setItem(POST_CAPTCHA_RECOVERY_KEY, new Date().toISOString());
        log('Detected post-CAPTCHA 403 (DVSA redirect carried a stale _eventId). Navigating to /manage to recover.');
        window.location.href = 'https://driverpracticaltest.dvsa.gov.uk/manage';
    }

    // Detect DVSA's "Service unavailable" page. The canonical signal is the
    // body ID (`page-service-c`), matching DVSA's pattern for every other
    // page in the flow. The title and h2 fallbacks are safety nets in case
    // DVSA changes the body ID in a future site update — better to detect
    // via a fallback than miss the page entirely.
    function isServiceUnavailable() {
        if (document.body && document.body.id === PAGE_STATE.SERVICE_UNAVAILABLE) return true;
        if (document.title === 'Service unavailable') return true;
        const h2 = document.querySelector('#unavailability-notice-title');
        if (h2 && /can.t use this service/i.test(h2.textContent || '')) return true;
        const h1 = document.querySelector('h1');
        if (h1 && /can.t use this service/i.test(h1.textContent || '')) return true;
        return false;
    }

    // Read the expected service-return time from the DVSA "Service unavailable"
    // page. The text lives in a stable element (`#unavailability-notice`) — at
    // time of writing, contents look like "It'll be back at 6 am". Returns a
    // Date for the next return time, or null if the element is missing, the
    // text can't be parsed, or the parsed hour falls outside a sensible
    // service-restart window. Caller falls back to a hardcoded heuristic in
    // those cases.
    function parseServiceReturnTime() {
        const notice = document.getElementById('unavailability-notice');
        if (!notice) return null;
        const text = (notice.textContent || '').trim();
        if (!text) return null;

        // Simple time pattern: "6 am", "6:00", "06:00 am", "6.30am", "6am", etc.
        // Since we're reading from the canonical notice element, no keyword
        // anchoring is needed — just extract the time.
        const match = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i);
        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = (match[3] || '').toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

        // Sensible service-restart-window sanity check (04:00-12:00).
        // Outside this range is almost certainly a parse mistake.
        if (hours < 4 || hours > 12) {
            log(`Service-down: parsed return hour ${hours} from #unavailability-notice is outside sensible 04:00-12:00 restart window; falling back to heuristic.`);
            return null;
        }

        const now = new Date();
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);

        log(`Service-down: parsed "${text}" from #unavailability-notice → return at ${target.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`);
        return target;
    }

    function scheduleWakeUp() {
        const now = new Date();

        // Prefer reading the return time from the page itself. The DVSA
        // "Service unavailable" page typically states when the service is
        // expected to return; trusting that is more robust than hardcoding
        // a fixed time, which only works as long as DVSA's downtime patterns
        // don't shift. If parsing fails (page text doesn't include a usable
        // time, or it's outside a sensible restart window), fall back to the
        // historical 06:05 heuristic.
        let target;
        const parsed = parseServiceReturnTime();
        if (parsed) {
            // +5 min safety margin in case DVSA's stated time is approximate.
            target = new Date(parsed.getTime() + 5 * 60 * 1000);
            log(`Service-down: parsed return time from page (${parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}). Scheduling wake at +5 min safety margin.`);
        } else {
            target = new Date(now);
            target.setHours(6, 5, 0, 0);
            if (target <= now) target.setDate(target.getDate() + 1);
            log('Service-down: no return time found in page text. Using 06:05 fallback heuristic.');
        }

        const ms = target.getTime() - now.getTime();
        const hours = ms / 3600000;
        const targetStr = target.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        log(`DVSA scheduled downtime detected. Resuming at ${targetStr} (in ${hours.toFixed(1)} hours).`);
        setStatus({ state: STATUS_STATE.WAKE, endTime: target.getTime(), label: targetStr });

        const base = document.title.replace(/^\[[^\]]+\]\s*/, '');
        document.title = `[Wake ${targetStr}] ${base}`;

        // Hourly heartbeat so you can see the script is alive during the long wait
        const heartbeat = setInterval(() => {
            if (document.body.dataset.slotFound) {
                clearInterval(heartbeat);
                return;
            }
            const msRemaining = target.getTime() - Date.now();
            if (msRemaining <= 60000) {
                clearInterval(heartbeat);
                return;
            }
            const hoursLeft = msRemaining / 3600000;
            log(`${hoursLeft.toFixed(1)} hours until service resumes at ${targetStr}.`);
        }, 3600000); // every 60 minutes

        setTimeout(() => {
            clearInterval(heartbeat);
            if (!document.body.dataset.slotFound) {
                log('Service should be back. Resuming flow.');
                returnToStart();
            }
        }, ms);
    }

    // ---- Queue-it (DVSA virtual waiting room) ----
    // DVSA uses Queue-it during peak load. Users land on a queue page served from
    // queue.driverpracticaltest.dvsa.gov.uk and wait their turn. Queue-it auto-
    // redirects back to the booking flow when capacity frees up. The script's role
    // here is to recognise the page, surface the queue position via the status pill,
    // and stop monitoring (we cannot monitor the booking calendar from the queue
    // page). The script does NOT interfere with Queue-it's redirect or attempt to
    // skip the queue — that would be exactly the kind of working-around-DVSA-
    // protection-mechanisms behaviour disclaimed in docs/SECURITY-POSTURE.md.
    function isQueueItPage() {
        if (document.querySelector('meta#queue-it_log')) return true;
        if (document.body && document.body.dataset && document.body.dataset.pageid === 'queue') {
            return true;
        }
        return false;
    }

    async function handleQueueItPage() {
        log('On DVSA Queue-it waiting room. Monitoring paused; Queue-it will redirect us to the booking flow when our turn comes up.');
        setStatus({ state: STATUS_STATE.QUEUE });
        // renderStatusPill reads the position live from the page each tick, so no
        // additional polling needed here. When Queue-it redirects us back to the
        // booking flow, the next page navigation re-runs main() and normal scanning
        // resumes.
    }

    // Cap auto-login retries per session. Repeated failed logins are the fastest path
    // to an Error 15 block, so after MAX_LOGIN_ATTEMPTS we bail and ask for manual help.
    const LOGIN_ATTEMPTS_KEY = 'dvsa-watcher-login-attempts';
    const MAX_LOGIN_ATTEMPTS = 2;

    async function handleLogin() {
        log('On Login page.');

        // No credentials configured - fall back to manual intervention alert
        if (!LOGIN_LICENCE_NUMBER || !LOGIN_BOOKING_REF) {
            log('LOGIN_LICENCE_NUMBER / LOGIN_BOOKING_REF not configured. Firing intervention alert for manual login.');
            fireInterventionAlert(INTERVENTION_REASONS.LOGIN);
            return;
        }

        // Track attempts in sessionStorage so a reload after a failed submit increments the counter.
        // A successful login navigates to /manage where handleBookingDetails clears the counter.
        const attempts = parseInt(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || '0', 10);
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            log(`Reached ${attempts} failed auto-login attempts. Bailing to manual intervention to avoid an Error 15 block.`);
            fireInterventionAlert(INTERVENTION_REASONS.LOGIN);
            return;
        }

        const licenceInput = document.querySelector('#driving-licence-number');
        const refInput     = document.querySelector('#application-reference-number');
        const submitBtn    = document.querySelector('#booking-login');

        if (!licenceInput || !refInput || !submitBtn) {
            log('Login form fields not found. Firing intervention alert.');
            fireInterventionAlert(INTERVENTION_REASONS.LOGIN);
            return;
        }

        sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, String(attempts + 1));
        log(`Auto-login attempt ${attempts + 1}/${MAX_LOGIN_ATTEMPTS}.`);

        // Skip if the form is already filled (e.g. the user typed before the script ran)
        if (licenceInput.value && refInput.value) {
            log('Login form already has values. Not overwriting. Submitting as-is.');
            await humanPause(0.04, 0.08);
            submitBtn.click();
            return;
        }

        // Fill both fields back-to-back. value-set + input/change dispatch is
        // synchronous in JS so there's no need to pause between fields. The
        // single pause before submit lets DVSA's per-field validators (which
        // attach to the change event) finish before we hit submit.
        log('Auto-filling driving licence number.');
        licenceInput.focus();
        licenceInput.value = LOGIN_LICENCE_NUMBER;
        licenceInput.dispatchEvent(new Event('input',  { bubbles: true }));
        licenceInput.dispatchEvent(new Event('change', { bubbles: true }));

        log('Auto-filling booking reference.');
        refInput.focus();
        refInput.value = LOGIN_BOOKING_REF;
        refInput.dispatchEvent(new Event('input',  { bubbles: true }));
        refInput.dispatchEvent(new Event('change', { bubbles: true }));

        await humanPause(0.05, 0.1);
        log('Submitting login form.');
        submitBtn.click();
    }

    // Detect DVSA's "maximum test changes reached" terminal state. This appears
    // on the standard page-ibs-summary booking summary but with the "Change
    // test centre" / "Change date/time" buttons stripped and an explanatory
    // message added. Detection requires BOTH:
    //
    //   (1) <header class="booking-change-incomplete"> — the marker DVSA puts
    //       on the booking summary when the change limit has been hit
    //   (2) DVSA's contact number 0300 200 1122 in the help-text panel — a
    //       very specific tell, unlikely to appear on the page for any other
    //       reason
    //
    // Both must match for a positive detection, keeping false-positive risk
    // near zero.
    function isMaxChangesReached() {
        const header = document.querySelector('header.booking-change-incomplete');
        if (!header) return false;
        const helpEl = document.querySelector('.onscreen-help');
        const helpText = ((helpEl && helpEl.textContent) || '').replace(/\s+/g, ' ');
        return /0300\s*200\s*1122/.test(helpText);
    }

    async function handleBookingDetails() {
        // Reaching this page means login succeeded - clear the auto-login retry counter
        sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);

        // Terminal-state check: if this booking has hit DVSA's maximum number
        // of allowed changes (typically 2), the page replaces both "Change"
        // buttons with an explanatory message pointing the user at DVSA's
        // contact number. There's no path forward for the script — every
        // automated flow (Flow 1, Flow 2, auto-book) requires one of those
        // buttons. Surface a clear intervention and auto-pause monitoring,
        // since further reload cycles would just re-detect the same dead-end.
        // The user can manually unpause if their booking situation changes.
        if (isMaxChangesReached()) {
            log('Booking has reached DVSA\'s maximum change limit. Auto-pausing monitoring; user must call DVSA on 0300 200 1122 to proceed.');
            localStorage.setItem(PAUSED_KEY, '1');
            fireInterventionAlert(INTERVENTION_REASONS.MAX_CHANGES_REACHED);
            return;
        }

        // The script supports two flows on /manage:
        //
        //   Flow 2 (auto, default): click the test-centre "Change" link
        //     → /manage?...&_eventId=editTestCentre
        //     → page-test-centre-search
        //     → handleTestCentreSearch runs a postcode search and parses a
        //       multi-centre availability summary in one request, then either
        //       drills into the calendar (on a match) or self-cycles on the
        //       search page. This is the cheaper, more informative path.
        //
        //   Flow 1 (manual only): user clicks the date-time "Change" link
        //     → /manage?...&_eventId=editTestDate
        //     → page-test-preferences
        //     → handleTestDateChoice picks "earliest available" and submits
        //     → page-available-time, calendar at the existing test centre
        //     → handleCalendar walks the calendar at one centre, deeper view.
        //
        // Auto-cycling uses Flow 2 because it's more efficient and gives a
        // wider view per request. Flow 1's handlers stay live, so a user who
        // clicks the date-time Change link manually still gets the script's
        // behaviour from that point onward.
        if (MANUAL_TRIGGER) {
            log('On Booking details page. MANUAL_TRIGGER mode: idle. Click either "Change" link (test centre or date/time) to start a search.');
            setStatus({ state: STATUS_STATE.MANUAL });
            return;
        }
        log('On Booking details page. Will click "Change" for test centre (Flow 2: multi-centre search).');
        await humanPause(0.08, 0.15);
        const btn = requireSelector('#test-centre-change', 'Change test centre link on booking summary');
        if (!btn) return;
        log('Clicking #test-centre-change.');
        btn.click();
    }

    async function handleTestDateChoice() {
        // Single short pause to let the page settle, then click radio + submit
        // back-to-back. The radio's change-event dispatch runs synchronously,
        // so there's no need to pause between it and the submit click.
        log('On Test date choice page. Will select "Show earliest available date" and submit.');
        await humanPause(0.08, 0.15);
        const radio = requireSelector('#test-choice-earliest', '"Show earliest available date" radio');
        if (!radio) return;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        log('Selected #test-choice-earliest radio.');

        const submitBtn = requireSelector('#driving-licence-submit', 'submit button on test date choice page');
        if (!submitBtn) return;
        log('Clicking submit.');
        submitBtn.click();
    }

    // ---- Test centre search handler ----
    function parseTestCentreResults(resultItems) {
        const summary = [];
        resultItems.forEach(li => {
            const nameEl = li.querySelector('h4');
            const statusEl = li.querySelector('h5');
            const linkEl = li.querySelector('a.test-centre-details-link');
            if (!nameEl || !statusEl) return;

            const name = nameEl.textContent.trim();
            const status = statusEl.textContent.trim();
            const id = linkEl ? (linkEl.id || '').replace('centre-name-', '') : null;

            // Empty state: "No tests found on any date"
            if (/no tests found/i.test(status)) {
                summary.push({ name, id, available: false });
                return;
            }

            // Available state: "available tests around DD/MM/YYYY"
            const m = status.match(/available tests around\s+(\d{2})\/(\d{2})\/(\d{4})/i);
            if (m) {
                const [, dd, mm, yyyy] = m;
                const isoDate = `${yyyy}-${mm}-${dd}`;
                summary.push({ name, id, available: true, date: isoDate, raw: status });
                return;
            }

            // Unknown format
            summary.push({ name, id, available: null, raw: status });
            log(`  Unrecognised status for ${name}: "${status}"`);
        });

        // Log a tidy summary
        summary.forEach(s => {
            if (s.available === true)  log(`  ${s.name}: AVAILABLE around ${s.date}`);
            else if (s.available === false) log(`  ${s.name}: no availability`);
        });

        // Process each available finding against our filters
        const expectedCentreLower = EXPECTED_CENTRE.toLowerCase();
        summary.filter(s => s.available === true).forEach(s => {
            const isTargetCentre = s.name.toLowerCase().includes(expectedCentreLower);
            if (isTargetCentre && isAcceptable(s.date)) {
                // MATCH: target centre with acceptable date. Fire the alert
                // AND auto-click into the calendar to confirm and pick a specific date.
                fireAlert([s.date]);
                if (s.id) {
                    const link = document.querySelector(`#centre-name-${s.id}`);
                    if (link) {
                        log(`Auto-clicking into ${s.name} to load the calendar.`);
                        link.click();
                    } else {
                        log(`Could not find link for ${s.name} (centre id ${s.id}). User must click manually.`);
                    }
                }
            } else {
                // Spotted but not a match: either wrong centre or outside filters
                const note = isTargetCentre
                    ? `${s.name} (target centre but outside window/filters)`
                    : `${s.name} (informational - not target centre)`;
                recordFinding('spotted', [s.date], note);

                // If ALERT_ANY_CENTRE is on, fire an informational "nearby" alert for
                // non-target centres with an acceptable date, once per (centre, date)
                // per browser session. Does NOT auto-book or navigate.
                if (ALERT_ANY_CENTRE && !isTargetCentre && isAcceptable(s.date) && !hasAlertedNearby(s.name, s.date)) {
                    markAlertedNearby(s.name, s.date);
                    fireNearbyAlert(s.name, s.date);
                }
            }
        });

        return summary;
    }

    async function handleTestCentreSearch() {
        // Bail early on the validation-error state (e.g. invalid postcode submitted)
        const errorSummary = document.querySelector('section.error-summary');
        if (errorSummary && /valid postcode/i.test(errorSummary.textContent || '')) {
            log('Search returned validation error. Will resubmit with the configured postcode.');
        }

        const input = requireSelector('#test-centres-input', 'postcode input on test centre search');
        if (!input) return;
        const submitBtn = requireSelector('#test-centres-submit', 'submit button on test centre search');
        if (!submitBtn) return;

        const results = document.querySelectorAll('.test-centre-results li');
        const currentValue = (input.value || '').trim().toLowerCase();
        const targetValue  = SEARCH_POSTCODE.trim().toLowerCase();
        const inputHasError = (input.parentElement && input.parentElement.classList.contains('error'));

        // Fast path: results visible AND postcode matches AND no validation error → parse straight away
        if (results.length && currentValue === targetValue && !inputHasError) {
            log(`Test centre search: ${results.length} result(s) for "${input.value}". Parsing.`);
            recordCycle();
            parseTestCentreResults(results);
            // Auto-cycle on this page: re-click "Find test centres" after the interval to refresh.
            // This stays on the test centre search page rather than navigating to /manage.
            if (MANUAL_TRIGGER) {
                log('MANUAL_TRIGGER mode: parse complete, idle.');
                setStatus({ state: STATUS_STATE.MANUAL });
            } else {
                scheduleTestCentreRecheck();
            }
            return;
        }

        // Otherwise, fill the postcode and submit a fresh search.
        // Single short pause before the fill (lets the page settle); no second
        // pause between fill and submit since input/change dispatch is sync.
        log(`Filling postcode "${SEARCH_POSTCODE}" and submitting test centre search.`);
        await humanPause(0.05, 0.1);
        input.value = SEARCH_POSTCODE;
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        log('Clicking #test-centres-submit.');
        submitBtn.click();
        // Page reload will re-invoke this handler; the fast-path branch will then parse results.
    }

    // Audible alert + notification permission both require a user gesture per browser policy.
    // Prime both on the first click or keypress against the page.
    let audioCtx = null;
    function primeUserGestureFeatures() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                log('Audio context failed:', e.message);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (window.Notification && Notification.permission === 'default') {
            try {
                Notification.requestPermission().then(p => log('Notification permission:', p));
            } catch (e) {
                log('Notification request failed:', e.message);
            }
        }
    }
    // Listen on a broad set of gesture types so priming succeeds on any user
    // interaction. Browsers count each of these as a "user activation" for the
    // purposes of unlocking autoplay. pointerdown covers mouse + touch + pen
    // via the unified Pointer Events API; touchstart is a fallback for older
    // browsers that don't dispatch pointerdown. {once:true} self-removes after
    // priming so we don't keep listeners alive once the gesture has happened.
    //
    // Skipped entirely while DEPRECATED: a retired script has no alerts to
    // play, and prompting for notification permission on a page it no longer
    // acts on would be both pointless and misleading.
    if (!DEPRECATED) {
        document.addEventListener('click',       primeUserGestureFeatures, { once: true, capture: true });
        document.addEventListener('keydown',     primeUserGestureFeatures, { once: true, capture: true });
        document.addEventListener('pointerdown', primeUserGestureFeatures, { once: true, capture: true });
        document.addEventListener('touchstart',  primeUserGestureFeatures, { once: true, capture: true, passive: true });
    }

    // =========================================================================
    //  SETTINGS PANEL
    //  Floating gear icon (bottom-right) opens a modal for editing config
    //  without touching the code. Saves to localStorage and reloads.
    // =========================================================================

    function isConfigValidForScanning() {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_START_DATE)) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_END_DATE)) return false;
        if (new Date(TARGET_START_DATE + 'T12:00:00') > new Date(TARGET_END_DATE + 'T12:00:00')) return false;
        if (!EXPECTED_CENTRE || /^your test centre/i.test(EXPECTED_CENTRE.trim())) return false;
        // DVSA accepts free text (postcode, outward only, or centre name). Just
        // require something non-trivial, at least 2 characters.
        if (!SEARCH_POSTCODE || SEARCH_POSTCODE.trim().length < 2) return false;
        // Reject the template's example postcode so first-run users are forced to set their own
        if (/^aa1\s*1aa$/i.test(SEARCH_POSTCODE.trim())) return false;
        return true;
    }

    // Escape a value for safe insertion into HTML attribute values or text
    // nodes built via innerHTML/template literals. Expects RAW text; do not
    // pass pre-encoded HTML through here or you'll double-encode (& becomes
    // &amp; first, so any literal "&amp;" in input would become "&amp;amp;").
    function escapeAttr(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ---- Test centre catalogue ----
    // Best-effort list of DVSA practical car test centres in the UK. Used to
    // populate the settings-panel combobox so users can pick instead of typing.
    // Names follow DVSA's convention as they appear on the booking site.
    //
    // This list is best-effort and self-heals: every time the script reads the
    // centre H1 on the chosen-test-centre page, the actual centre name is added
    // to a local "discovered" list (see addDiscoveredCentre below) and merged
    // into the dropdown. Gaps fill themselves over time. The combobox also
    // accepts a custom value for any centre missing from the list, DVSA
    // accepts any text and the existing H1 mismatch check catches typos.
    const KNOWN_TEST_CENTRES = [
        // Greater London
        'Barking (London)', 'Barnet (London)', 'Belvedere (London)', 'Borehamwood (London)',
        'Brentford (London)', 'Bromley (London)', 'Chingford (London)', 'Croydon (London)',
        'Enfield (London)', 'Erith (London)', 'Goodmayes (London)', 'Greenford (London)',
        'Hayes (London)', 'Hendon (London)', 'Hither Green (London)', 'Hornchurch (London)',
        'Isleworth (London)', 'Mill Hill (London)', 'Mitcham (London)', 'Morden (London)',
        'Pinner (London)', 'Sidcup (London)', 'Southall (London)', 'South Norwood (London)',
        'Tolworth (London)', 'Tottenham (London)', 'Uxbridge (London)', 'Wanstead (London)',
        'West Wickham (London)', 'Wood Green (London)', 'Yeading (London)',

        // South East England
        'Ashford (Kent)', 'Aylesbury', 'Banbury', 'Basildon', 'Basingstoke',
        'Bishop’s Stortford', 'Brighton (Shoreham)', 'Burgess Hill', 'Cambridge (Brookmount Court)',
        'Canterbury', 'Chelmsford (Hanbury Road)', 'Chertsey', 'Chichester', 'Clacton-on-Sea',
        'Colchester', 'Crawley (Gatwick)', 'Eastbourne', 'Farnborough', 'Folkestone',
        'Gillingham', 'Guildford', 'Hastings', 'Herne Bay', 'High Wycombe',
        'Huntingdon', 'Ipswich', 'Lee on the Solent', 'Letchworth', 'Lowestoft',
        'Maidstone', 'Medway (Gillingham)', 'Milton Keynes', 'Newbury', 'Newhaven',
        'Norwich (Jupiter Road)', 'Norwich (Peachman Way)', 'Oxford (Cowley)', 'Peterborough',
        'Portsmouth', 'Reading', 'Redhill', 'Sevenoaks', 'Slough', 'Southampton (Forest Hills)',
        'Southampton (Maybush)', 'Southend-on-Sea', 'St Albans', 'Stevenage', 'Tilbury',
        'Tunbridge Wells', 'Watford', 'Worthing',

        // South West England
        'Barnstaple', 'Bath', 'Bodmin', 'Bournemouth', 'Bridgwater', 'Bristol (Avonmouth)',
        'Bristol (Brislington)', 'Bristol (Kingswood)', 'Bristol (Southmead)', 'Camborne',
        'Cheltenham', 'Chippenham', 'Dorchester', 'Exeter', 'Gloucester', 'Launceston',
        'Newton Abbot', 'Pembroke Dock', 'Penzance', 'Plymouth', 'Poole', 'Salisbury',
        'Swindon', 'Taunton', 'Tiverton', 'Torquay', 'Trowbridge', 'Truro', 'Weston-super-Mare',
        'Weymouth', 'Yeovil',

        // East Midlands
        'Boston', 'Buxton', 'Chesterfield', 'Derby (Alvaston)', 'Grantham', 'Grimsby',
        'Kettering', 'Leicester (Cannock Street)', 'Leicester (Wigston)', 'Lincoln',
        'Loughborough', 'Mansfield', 'Market Harborough', 'Melton Mowbray', 'Newark',
        'Northampton', 'Nottingham (Chalfont Drive)', 'Nottingham (Colwick)', 'Skegness',
        'Spalding', 'Worksop',

        // West Midlands
        'Birmingham (Garretts Green)', 'Birmingham (Kingstanding)', 'Birmingham (Kings Heath)',
        'Birmingham (Shirley)', 'Birmingham (South Yardley)', 'Birmingham (Sutton Coldfield)',
        'Birmingham (Wyndley)', 'Bloxwich (Walsall)', 'Burton on Trent', 'Cannock',
        'Coventry', 'Hereford', 'Kidderminster', 'Leamington Spa', 'Lichfield',
        'Ludlow', 'Nuneaton', 'Redditch', 'Rugby', 'Shrewsbury', 'Stafford',
        'Stoke-on-Trent (Cobridge)', 'Stoke-on-Trent (Newcastle-under-Lyme)', 'Stratford-upon-Avon',
        'Telford', 'Wolverhampton', 'Worcester',

        // North West England
        'Atherton (Manchester)', 'Barrow-in-Furness', 'Birkenhead', 'Blackburn (with Darwen)',
        'Blackpool', 'Bolton (Manchester)', 'Bredbury (Manchester)', 'Burnley', 'Bury (Manchester)',
        'Carlisle', 'Cheetham Hill (Manchester)', 'Chester', 'Chorley', 'Crewe', 'Failsworth (Manchester)',
        'Heysham', 'Kendal', 'Lancaster', 'Liverpool (Garston)', 'Liverpool (Norris Green)',
        'Liverpool (Speke)', 'Liverpool (Upton)', 'Macclesfield', 'Manchester (Cheetham Hill)',
        'Manchester (Failsworth)', 'Manchester (Sale)', 'Manchester (West Didsbury)',
        'Northwich', 'Oldham', 'Penrith', 'Preston', 'Rochdale', 'Sale (Manchester)',
        'Salford', 'Southport', 'St Helens', 'Stockport', 'Warrington', 'West Didsbury (Manchester)',
        'Whitehaven', 'Widnes', 'Wigan', 'Workington',

        // Yorkshire & Humber
        'Beverley', 'Bradford (Heaton)', 'Bradford (Thornbury)', 'Doncaster', 'Featherstone',
        'Halifax', 'Heckmondwike', 'Horsforth (Leeds)', 'Huddersfield', 'Hull (Wilmington)',
        'Keighley', 'Leeds', 'Leeds (Harehills)', 'Leeds (Horsforth)', 'Malton',
        'Pontefract', 'Rotherham', 'Scarborough', 'Scunthorpe', 'Sheffield (Handsworth)',
        'Sheffield (Middlewood Road)', 'Sheffield (Tinsley)', 'Skipton', 'Wakefield', 'York',

        // North East England
        'Berwick-upon-Tweed', 'Bishop Auckland', 'Blyth', 'Darlington', 'Durham',
        'Gateshead', 'Hartlepool', 'Hexham', 'Middlesbrough', 'Morpeth', 'Newcastle upon Tyne',
        'Newcastle (Gosforth)', 'Redcar', 'Stockton-on-Tees', 'Sunderland', 'Tynemouth',

        // Scotland
        'Aberdeen North (Cove)', 'Aberdeen South', 'Airdrie', 'Anniesland (Glasgow)',
        'Arbroath', 'Ayr', 'Ballater', 'Banff', 'Barrhead (Glasgow)', 'Bishopbriggs (Glasgow)',
        'Buckie', 'Campbeltown', 'Crieff', 'Cumnock', 'Dumbarton', 'Dumfries',
        'Dundee', 'Dunfermline', 'Dunoon', 'East Kilbride', 'Edinburgh (Currie)',
        'Edinburgh (Musselburgh)', 'Elgin', 'Falkirk', 'Forfar', 'Fort William',
        'Fraserburgh', 'Galashiels', 'Glasgow (Anniesland)', 'Glasgow (Baillieston)',
        'Glasgow (Bishopbriggs)', 'Glasgow (Mount Vernon)', 'Glasgow (Shieldhall)', 'Greenock',
        'Haddington', 'Hamilton', 'Hawick', 'Huntly', 'Inveraray', 'Inverness',
        'Inverurie', 'Irvine', 'Isle of Mull (Tobermory)', 'Kilmarnock', 'Kirkcaldy',
        'Kirkwall (Orkney)', 'Kyle of Lochalsh', 'Lanark', 'Lerwick (Shetland)',
        'Livingston', 'Lochgilphead', 'Mallaig', 'Mount Vernon (Glasgow)', 'Newton Stewart',
        'Oban', 'Paisley', 'Peebles', 'Perth', 'Peterhead', 'Pitlochry', 'Portree (Skye)',
        'Stirling', 'Stornoway', 'Stranraer', 'Thurso', 'Ullapool', 'Wick',

        // Wales
        'Aberystwyth', 'Bala', 'Bangor (Penrhosgarnedd)', 'Brecon', 'Bridgend', 'Caernarfon',
        'Cardiff (Fairwater)', 'Cardiff (Llanishen)', 'Carmarthen', 'Chepstow', 'Dolgellau',
        'Haverfordwest', 'Llandrindod Wells', 'Llanelli', 'Llantrisant', 'Merthyr Tydfil',
        'Mold', 'Monmouth', 'Neath', 'Newport (Maesglas)', 'Pembroke Dock', 'Pwllheli',
        'Rhyl', 'Swansea', 'Tredegar', 'Wrexham',

        // Northern Ireland
        'Armagh', 'Ballymena', 'Belfast (Balmoral)', 'Belfast (Mallusk)', 'Coleraine',
        'Cookstown', 'Craigavon', 'Downpatrick', 'Enniskillen', 'Larne', 'Limavady',
        'Lisburn', 'Londonderry', 'Newry', 'Newtownards', 'Omagh', 'Portadown'
    ];

    // Self-healing discovery: when the script reads the centre name from a real
    // DVSA page (chosen-test-centre H1), it's stored locally and merged into the
    // combobox list. Even if the bundled KNOWN_TEST_CENTRES has the wrong name
    // for a user's centre, after one cycle the correct name appears in the dropdown.
    const DISCOVERED_CENTRES_KEY = 'dvsa-watcher-discovered-centres';

    function getDiscoveredCentres() {
        try {
            const raw = localStorage.getItem(DISCOVERED_CENTRES_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr.filter(s => typeof s === 'string' && s.trim()) : [];
        } catch (e) {
            return [];
        }
    }

    function addDiscoveredCentre(name) {
        if (!name || typeof name !== 'string') return;
        const clean = name.trim();
        if (!clean || clean.length > 80) return;  // sanity guard
        // Skip if already in bundled list (case-insensitive)
        const known = KNOWN_TEST_CENTRES.some(c => c.toLowerCase() === clean.toLowerCase());
        if (known) return;
        const list = getDiscoveredCentres();
        if (list.some(c => c.toLowerCase() === clean.toLowerCase())) return;
        list.push(clean);
        try {
            localStorage.setItem(DISCOVERED_CENTRES_KEY, JSON.stringify(list));
        } catch (e) { /* storage full or disabled, silently ignore */ }
    }

    // Merged + sorted list for the combobox. Discovered centres are tagged so
    // the UI can mark them visually if we ever want to.
    function getAllKnownCentres() {
        const seen = new Set();
        const out = [];
        const push = (name) => {
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push(name);
        };
        KNOWN_TEST_CENTRES.forEach(push);
        getDiscoveredCentres().forEach(push);
        return out.sort((a, b) => a.localeCompare(b, 'en-GB'));
    }

    // ---- Status pill ----
    // Small chip rendered to the left of the gear icon. Shows what the script is
    // doing right now: scanning + countdown to next refresh, awaiting your click
    // (manual mode), action needed, slot found, overnight wake, or "configure".
    // Re-renders every second; event functions push state via setStatus().
    //
    // STATUS_STATE is the single source of truth for valid pill states. Adding
    // a new state means a new entry here, a new case in renderStatusPill, and
    // (typically) one or more setStatus() call sites — and that's all.
    const STATUS_STATE = Object.freeze({
        INIT:     'init',
        SCANNING: 'scanning',
        MANUAL:   'manual',
        ACTION:   'action',
        MATCH:    'match',
        WAKE:     'wake',
        QUEUE:    'queue',
        INVALID:  'invalid',
        PAUSED:   'paused',
        BOOKING:  'booking',
        CONFIRM:  'confirm'
    });
    const STATUS = {
        state: STATUS_STATE.INIT,
        endTime: null,   // unix ms for countdown states
        label: null      // free-text suffix for some states
    };

    function setStatus(patch) {
        Object.assign(STATUS, patch);
        renderStatusPill();
    }

    function renderStatusPill() {
        const pill = document.getElementById('dvsa-watcher-status');
        if (!pill) return;
        const cycles = (getCycles().count || 0);
        let text = '', bg = '#505a5f';
        switch (STATUS.state) {
            case STATUS_STATE.INIT:
                text = '… initialising';
                break;
            case STATUS_STATE.SCANNING:
                if (STATUS.endTime && STATUS.endTime > Date.now()) {
                    const ms = STATUS.endTime - Date.now();
                    const mins = Math.floor(ms / 60000);
                    const secs = Math.floor((ms % 60000) / 1000);
                    text = `⟳ next in ${mins}m ${secs.toString().padStart(2, '0')}s · ${cycles} scans`;
                } else {
                    text = `⟳ scanning · ${cycles} scans`;
                }
                bg = '#00703c';
                break;
            case STATUS_STATE.MANUAL:
                text = `⏸ awaiting your click · ${cycles} scans`;
                bg = '#1d70b8';
                break;
            case STATUS_STATE.ACTION:
                text = `⚠ ${STATUS.label || 'action needed'}`;
                bg = '#d4351c';
                break;
            case STATUS_STATE.MATCH:
                text = `✓ slot ${STATUS.label || 'found'}`;
                bg = '#00703c';
                break;
            case STATUS_STATE.WAKE:
                if (STATUS.endTime && STATUS.endTime > Date.now()) {
                    const ms = STATUS.endTime - Date.now();
                    const hrs = Math.floor(ms / 3600000);
                    const mins = Math.floor((ms % 3600000) / 60000);
                    text = `wakes in ${hrs}h ${mins.toString().padStart(2, '0')}m`;
                } else {
                    text = `wakes at ${STATUS.label || 'next window'}`;
                }
                bg = '#1d70b8';
                break;
            case STATUS_STATE.QUEUE: {
                // Read the live queue position from Queue-it's own DOM. Queue-it
                // updates this value every 40s via its own polling loop; this
                // renderer runs every 1s and just picks up the latest.
                const el = document.getElementById('MainPart_lbUsersInLineAheadOfYou');
                const raw = el ? (el.textContent || '').replace(/[^0-9]/g, '') : '';
                const n = parseInt(raw, 10);
                text = Number.isFinite(n) && n > 0
                    ? `in DVSA queue · ${n.toLocaleString('en-GB')} ahead`
                    : 'in DVSA queue';
                bg = '#1d70b8';
                // Surface the queue position in the tab title too, so the user can
                // see their position without switching to this tab. Static prefix
                // (no flashing) since the queue is informational, not a call to
                // action. Falls back to the base Queue-it title if the position
                // is unknown or has hit zero.
                const queueTitleBase = 'Queue-it';
                const desiredTitle = (Number.isFinite(n) && n > 0)
                    ? `[${n.toLocaleString('en-GB')} ahead] ${queueTitleBase}`
                    : queueTitleBase;
                if (document.title !== desiredTitle) document.title = desiredTitle;
                break;
            }
            case STATUS_STATE.INVALID:
                text = '⚙ configure to start';
                bg = '#f47738';
                break;
            case STATUS_STATE.PAUSED:
                text = `⏸ paused · ${cycles} scans`;
                bg = '#505a5f';
                break;
            case STATUS_STATE.BOOKING:
                text = `auto-booking${STATUS.label ? ` ${STATUS.label}` : '…'}`;
                bg = '#f47738';
                break;
            case STATUS_STATE.CONFIRM:
                if (STATUS.endTime && STATUS.endTime > Date.now()) {
                    const ms = STATUS.endTime - Date.now();
                    const mins = Math.floor(ms / 60000);
                    const secs = Math.floor((ms % 60000) / 1000);
                    text = `BOOK NOW · ${mins}m ${secs.toString().padStart(2, '0')}s left`;
                } else {
                    text = `BOOK NOW (hold may have expired)`;
                }
                bg = '#d4351c';
                break;
            default:
                text = '⏸ idle';
        }
        pill.textContent = text;
        pill.style.background = bg;

        // Show-me action button: visible only on match / confirm states.
        // Colour + label adapt to the page context.
        const showMeBtn = document.getElementById('dvsa-watcher-show-me');
        if (showMeBtn) {
            if (STATUS.state === STATUS_STATE.MATCH) {
                showMeBtn.style.display = 'block';
                showMeBtn.style.background = '#00703c';
                showMeBtn.textContent = 'Jump to slot';
            } else if (STATUS.state === STATUS_STATE.CONFIRM) {
                showMeBtn.style.display = 'block';
                showMeBtn.style.background = '#d4351c';
                showMeBtn.textContent = 'Jump to Confirm';
            } else {
                showMeBtn.style.display = 'none';
            }
        }
    }

    // ---- Pause / resume ----
    // Stops the scanner from scheduling new cycles without uninstalling the
    // script. Persisted across reloads via localStorage. Test alert, settings,
    // and history panels all still work while paused.
    const PAUSED_KEY = 'dvsa-watcher-paused';

    function isPaused() {
        return localStorage.getItem(PAUSED_KEY) === '1';
    }

    function togglePause() {
        if (isPaused()) {
            localStorage.removeItem(PAUSED_KEY);
            log('Monitoring resumed. Reloading.');
        } else {
            localStorage.setItem(PAUSED_KEY, '1');
            log('Monitoring paused. Reloading.');
        }
        window.location.reload();
    }

    // ---- Inline SVG icon registry ----
    // Monoline 16x16 viewBox icons styled with stroke:currentColor so they pick
    // up the surrounding text colour. Replaces emojis in section headers and on
    // cluster buttons, emojis render inconsistently across OS/browser font
    // versions and look amateurish next to GOV.UK Frontend styling.
    function dvsaIcon(name, size) {
        const px = size || 14;
        const PATHS = {
            calendar:  '<rect x="2" y="3.5" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5.5" y1="2" x2="5.5" y2="5"/><line x1="10.5" y1="2" x2="10.5" y2="5"/>',
            pin:       '<path d="M8 14 C8 14 12.5 9.5 12.5 6.5 A4.5 4.5 0 0 0 3.5 6.5 C3.5 9.5 8 14 8 14 Z"/><circle cx="8" cy="6.5" r="1.6"/>',
            clock:     '<circle cx="8" cy="8" r="6"/><polyline points="8,4.5 8,8 11,9.5"/>',
            filter:    '<path d="M2 3 H14 L9.5 8.5 V13 H6.5 V8.5 Z"/>',
            bolt:      '<path d="M9.5 2 L4 9 H7.5 L6.5 14 L12 7 H8.5 L9.5 2 Z"/>',
            ban:       '<circle cx="8" cy="8" r="6"/><line x1="3.8" y1="3.8" x2="12.2" y2="12.2"/>',
            lock:      '<rect x="3.5" y="7.5" width="9" height="6" rx="1"/><path d="M5.5 7.5 V5 a2.5 2.5 0 0 1 5 0 V7.5"/>',
            sliders:   '<line x1="4" y1="3" x2="4" y2="13"/><line x1="8" y1="3" x2="8" y2="13"/><line x1="12" y1="3" x2="12" y2="13"/><circle cx="4" cy="6" r="1.5"/><circle cx="8" cy="10" r="1.5"/><circle cx="12" cy="5" r="1.5"/>',
            heart:     '<path d="M8 13.5 C8 13.5 2 9.5 2 6 a3.4 3.4 0 0 1 6 -1 a3.4 3.4 0 0 1 6 1 c0 3.5 -6 7.5 -6 7.5 Z"/>',
            clipboard: '<rect x="3" y="3.5" width="10" height="11" rx="1.5"/><rect x="5.5" y="1.5" width="5" height="3" rx="0.5"/><line x1="6" y1="8" x2="10" y2="8"/><line x1="6" y1="11" x2="10" y2="11"/>',
            settings:  '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5 v2 M8 12.5 v2 M1.5 8 h2 M12.5 8 h2 M3.3 3.3 l1.4 1.4 M11.3 11.3 l1.4 1.4 M3.3 12.7 l1.4 -1.4 M11.3 4.7 l1.4 -1.4"/>',
            pause:     '<rect x="4.5" y="3.5" width="2.4" height="9" rx="0.4"/><rect x="9.1" y="3.5" width="2.4" height="9" rx="0.4"/>',
            play:      '<path d="M5 3 L13 8 L5 13 Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/>',
            eye:       '<path d="M1.5 8 C3 4.5 5.5 3 8 3 C10.5 3 13 4.5 14.5 8 C13 11.5 10.5 13 8 13 C5.5 13 3 11.5 1.5 8 Z"/><circle cx="8" cy="8" r="2"/>',
            'eye-off': '<path d="M2 2 L14 14"/><path d="M5.5 4.5 C6.3 4.2 7.1 4 8 4 C10.5 4 13 5.5 14.5 9 C14.1 9.9 13.6 10.7 13 11.4"/><path d="M11.2 11.7 C10.2 12.2 9.1 12.5 8 12.5 C5.5 12.5 3 11 1.5 8 C2.3 6.5 3.4 5.4 4.6 4.8"/><path d="M6.7 6.7 A2 2 0 0 0 9.3 9.3"/>',
            download:  '<path d="M8 2 V11 M4.5 7.5 L8 11 L11.5 7.5 M2.5 13 H13.5"/>',
            upload:    '<path d="M8 11 V2 M4.5 5.5 L8 2 L11.5 5.5 M2.5 13 H13.5"/>'
        };
        const path = PATHS[name] || '';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
    }

    // Inject pill and gear into a single fixed-position container so they're
    // guaranteed to render together inline regardless of page CSS quirks (e.g.
    // ancestor transforms can break position:fixed on individual elements).
    // Inject the keyframe used by the "Show me" pulse highlight once.
    function injectWatcherCSS() {
        if (document.getElementById('dvsa-watcher-style')) return;
        const style = document.createElement('style');
        style.id = 'dvsa-watcher-style';
        style.textContent = `
            /* ---- "Show me" pulse highlight (calendar date or Confirm button) ---- */
            @keyframes dvsa-pulse {
                0%   { box-shadow: 0 0 0 0    rgba(255,221,0,0.85); outline-color: rgba(255,221,0,1); }
                50%  { box-shadow: 0 0 0 14px rgba(255,221,0,0);    outline-color: rgba(255,221,0,1); }
                100% { box-shadow: 0 0 0 0    rgba(255,221,0,0);    outline-color: rgba(255,221,0,1); }
            }
            .dvsa-pulse-active {
                animation: dvsa-pulse 0.9s ease-out 3;
                outline: 3px solid #ffdd00 !important;
                outline-offset: 4px;
                position: relative;
                z-index: 100;
            }

            /* ---- Settings + History panels: shared styles, all dvsa- prefixed ---- */
            .dvsa-p h2 { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #0b0c0c; letter-spacing: -0.2px; }
            .dvsa-p .dvsa-subtitle { color: #505a5f; font-size: 13px; margin: 0 0 18px; }

            .dvsa-p fieldset.dvsa-fs {
                border: 1px solid #dadcde;
                border-radius: 6px;
                padding: 14px 16px 16px;
                margin: 0 0 12px;
                background: #fff;
                transition: border-color .15s ease;
            }
            .dvsa-p fieldset.dvsa-fs:focus-within { border-color: #1d70b8; }
            .dvsa-p legend.dvsa-lg {
                padding: 0 8px;
                font-weight: 700;
                font-size: 13px;
                color: #0b0c0c;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .dvsa-p legend.dvsa-lg .dvsa-ic {
                display: inline-flex; align-items: center; justify-content: center;
                width: 22px; height: 22px; border-radius: 50%;
                background: #f3f2f1; color: #0b0c0c;
            }
            .dvsa-p legend.dvsa-lg .dvsa-ic svg { display: block; }

            /* Inline icon next to button text (e.g. "Paste multiple") */
            .dvsa-p button.dvsa-btn.dvsa-btn-icon-text {
                display: inline-flex; align-items: center; gap: 6px;
            }
            .dvsa-p button.dvsa-btn.dvsa-btn-icon-text svg { display: block; }

            .dvsa-p label.dvsa-lb {
                display: block;
                margin-bottom: 12px;
                font-size: 13px;
                color: #0b0c0c;
                font-weight: 500;
            }
            .dvsa-p label.dvsa-lb:last-child { margin-bottom: 0; }
            .dvsa-p label.dvsa-cb {
                display: flex; align-items: flex-start; gap: 10px;
                padding: 6px 0; margin: 0; font-size: 13px; cursor: pointer;
                font-weight: normal;
            }
            .dvsa-p label.dvsa-cb input[type="checkbox"] {
                margin: 2px 0 0 0; flex-shrink: 0; cursor: pointer;
            }
            .dvsa-p label.dvsa-cb .dvsa-cb-label { flex: 1; line-height: 1.4; }

            .dvsa-p .dvsa-hint {
                color: #505a5f;
                margin: 4px 0 0;
                font-size: 12px;
                line-height: 1.45;
            }
            .dvsa-p .dvsa-hint code {
                background: #f3f2f1;
                padding: 1px 5px;
                border-radius: 3px;
                font-size: 11.5px;
                font-family: ui-monospace,Menlo,monospace;
            }

            .dvsa-p .dvsa-err {
                color: #d4351c;
                margin-top: 8px;
                font-size: 13px;
                font-weight: 500;
                min-height: 0;
            }

            .dvsa-p .dvsa-row {
                display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
            }
            .dvsa-p .dvsa-grid-2 {
                display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
            }
            .dvsa-p .dvsa-grid-3 {
                display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
            }

            .dvsa-p input.dvsa-in,
            .dvsa-p textarea.dvsa-in {
                display: block;
                width: 100%;
                box-sizing: border-box;
                padding: 8px 10px;
                margin-top: 4px;
                border: 1px solid #b1b4b6;
                border-radius: 4px;
                font: 14px system-ui,sans-serif;
                background: #fff;
                color: #0b0c0c;
                transition: border-color .15s ease, box-shadow .15s ease;
            }
            .dvsa-p input.dvsa-in:hover { border-color: #505a5f; }
            .dvsa-p input.dvsa-in:focus,
            .dvsa-p textarea.dvsa-in:focus {
                outline: none;
                border-color: #1d70b8;
                box-shadow: 0 0 0 3px rgba(29,112,184,0.22);
            }
            .dvsa-p input.dvsa-in.dvsa-narrow  { max-width: 130px; }
            .dvsa-p input.dvsa-in.dvsa-medium  { max-width: 200px; }
            .dvsa-p input.dvsa-in.dvsa-mono    { font-family: ui-monospace,Menlo,monospace; }

            .dvsa-p .dvsa-input-unit { position: relative; display: inline-block; width: auto; }
            .dvsa-p .dvsa-input-unit > input { padding-right: 48px; }
            .dvsa-p .dvsa-input-unit > .dvsa-unit {
                position: absolute; right: 12px; top: 50%;
                transform: translateY(calc(-50% + 2px));
                color: #505a5f; font-size: 12px; pointer-events: none;
                font-weight: 500;
            }

            .dvsa-p button.dvsa-btn {
                padding: 8px 14px;
                background: #fff;
                color: #0b0c0c;
                border: 1px solid #b1b4b6;
                border-radius: 4px;
                cursor: pointer;
                font: 600 13px system-ui,sans-serif;
                transition: background .12s ease, border-color .12s ease, box-shadow .12s ease;
            }
            .dvsa-p button.dvsa-btn:hover:not(:disabled) { background: #f3f2f1; border-color: #505a5f; }
            .dvsa-p button.dvsa-btn:focus-visible {
                outline: 3px solid #ffdd00; outline-offset: 1px;
            }
            .dvsa-p button.dvsa-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .dvsa-p button.dvsa-btn-primary {
                background: #00703c; color: #fff; border-color: #00703c;
            }
            .dvsa-p button.dvsa-btn-primary:hover:not(:disabled) {
                background: #005a30; border-color: #005a30;
            }
            .dvsa-p button.dvsa-btn-danger {
                color: #d4351c; border-color: #d4351c;
            }
            .dvsa-p button.dvsa-btn-danger:hover:not(:disabled) {
                background: #fef2f1; border-color: #d4351c;
            }
            .dvsa-p button.dvsa-btn-sm { padding: 5px 10px; font-size: 12px; }

            .dvsa-p .dvsa-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
                padding-top: 6px;
                border-top: 1px solid #f3f2f1;
                margin-top: 4px;
            }
            .dvsa-p .dvsa-footer-left,
            .dvsa-p .dvsa-footer-right { display: flex; gap: 8px; flex-wrap: wrap; }
            /* Slightly tighter than the default .dvsa-btn so all five footer
               buttons (Reset, View history, Test alert, Cancel, Save) fit on a
               single row inside the 720px panel. Falls back to wrap on very
               narrow viewports via the .dvsa-footer flex-wrap above. */
            .dvsa-p .dvsa-footer button.dvsa-btn {
                padding: 6px 11px;
                font-size: 12px;
                white-space: nowrap;
            }

            .dvsa-p .dvsa-divider {
                height: 1px; background: #f3f2f1; margin: 16px 0 14px; border: 0;
            }

            /* ---- Test centre combobox ---- */
            .dvsa-p .dvsa-combo { position: relative; margin-top: 4px; }
            .dvsa-p .dvsa-combo input.dvsa-in { padding-right: 36px; margin-top: 0; }
            .dvsa-p .dvsa-combo .dvsa-combo-toggle {
                position: absolute;
                right: 4px;
                top: 50%;
                transform: translateY(-50%);
                width: 28px;
                height: 28px;
                background: transparent;
                border: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #505a5f;
                border-radius: 3px;
                padding: 0;
                font-size: 0;
            }
            .dvsa-p .dvsa-combo .dvsa-combo-toggle::after {
                content: '';
                width: 0; height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid currentColor;
                transition: transform .15s ease;
            }
            .dvsa-p .dvsa-combo[data-open="true"] .dvsa-combo-toggle::after {
                transform: rotate(180deg);
            }
            .dvsa-p .dvsa-combo .dvsa-combo-toggle:hover { background: #f3f2f1; color: #0b0c0c; }
            .dvsa-p .dvsa-combo .dvsa-combo-toggle:focus-visible {
                outline: 3px solid #ffdd00; outline-offset: 1px;
            }
            .dvsa-p .dvsa-combo-listbox {
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                right: 0;
                background: #fff;
                border: 1px solid #b1b4b6;
                border-radius: 4px;
                box-shadow: 0 6px 18px rgba(0,0,0,0.12);
                max-height: 280px;
                overflow-y: auto;
                z-index: 10;
            }
            .dvsa-p .dvsa-combo-option {
                padding: 7px 12px;
                font-size: 13px;
                color: #0b0c0c;
                cursor: pointer;
                line-height: 1.35;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .dvsa-p .dvsa-combo-option:hover,
            .dvsa-p .dvsa-combo-option.is-active {
                background: #f3f2f1;
            }
            .dvsa-p .dvsa-combo-option.is-selected {
                font-weight: 600;
            }
            .dvsa-p .dvsa-combo-option .dvsa-combo-tag {
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                padding: 2px 6px;
                border-radius: 3px;
                color: #505a5f;
                background: #f3f2f1;
                flex-shrink: 0;
            }
            .dvsa-p .dvsa-combo-option .dvsa-combo-match { font-weight: 700; color: #0b0c0c; }
            .dvsa-p .dvsa-combo-option.is-custom {
                font-style: italic;
                color: #505a5f;
                border-top: 1px solid #ececec;
            }
            .dvsa-p .dvsa-combo-option.is-custom .dvsa-combo-match {
                font-style: normal; font-weight: 700; color: #0b0c0c;
            }
            .dvsa-p .dvsa-combo-empty {
                padding: 10px 12px;
                font-size: 12px;
                color: #505a5f;
                font-style: italic;
            }
            .dvsa-p input.dvsa-in.dvsa-custom-value {
                box-shadow: 0 0 0 2px #f47738;
            }
            .dvsa-p .dvsa-custom-hint {
                color: #f47738;
                font-size: 12px;
                margin-top: 6px;
                display: none;
            }
            .dvsa-p .dvsa-custom-hint.is-shown { display: block; }

            /* ---- Settings panel: "What you're monitoring" preview card ---- */
            .dvsa-p .dvsa-preview {
                margin: 0 0 12px;
                padding: 12px 14px;
                background: #f8f8f8;
                border: 1px solid #ececec;
                border-radius: 6px;
            }
            .dvsa-p .dvsa-preview-label {
                color: #505a5f;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin: 0 0 6px;
                font-weight: 700;
            }
            .dvsa-p .dvsa-preview-main {
                font-size: 16px;
                font-weight: 700;
                color: #0b0c0c;
                margin: 0 0 4px;
            }
            .dvsa-p .dvsa-preview-main .dvsa-preview-alert {
                color: #00703c;
                font-variant-numeric: tabular-nums;
            }
            .dvsa-p .dvsa-preview-main.is-zero .dvsa-preview-alert {
                color: #d4351c;
            }
            .dvsa-p .dvsa-preview-sub {
                color: #505a5f;
                font-size: 12px;
                line-height: 1.5;
                margin: 0;
            }
            .dvsa-p .dvsa-preview-sub strong {
                color: #0b0c0c;
                font-variant-numeric: tabular-nums;
            }
            .dvsa-p .dvsa-preview-bar {
                display: flex;
                width: 100%;
                height: 8px;
                margin: 8px 0 4px;
                border-radius: 4px;
                overflow: hidden;
                background: #ececec;
            }
            .dvsa-p .dvsa-preview-bar > span {
                display: block;
                height: 100%;
            }
            .dvsa-p .dvsa-preview-bar > .dvsa-bar-alert     { background: #00703c; }
            .dvsa-p .dvsa-preview-bar > .dvsa-bar-weekend   { background: #b1b4b6; }
            .dvsa-p .dvsa-preview-bar > .dvsa-bar-instructor{ background: #f47738; }
            .dvsa-p .dvsa-preview-legend {
                display: flex; gap: 14px; flex-wrap: wrap;
                font-size: 11px; color: #505a5f; margin-top: 4px;
            }
            .dvsa-p .dvsa-preview-legend > span { display: inline-flex; align-items: center; gap: 5px; }
            .dvsa-p .dvsa-preview-legend i {
                display: inline-block; width: 8px; height: 8px; border-radius: 2px;
            }
            .dvsa-p .dvsa-preview-legend .dvsa-bar-alert      { background: #00703c; }
            .dvsa-p .dvsa-preview-legend .dvsa-bar-weekend    { background: #b1b4b6; }
            .dvsa-p .dvsa-preview-legend .dvsa-bar-instructor { background: #f47738; }
            .dvsa-p .dvsa-preview-invalid {
                color: #505a5f; font-style: italic; font-size: 13px;
            }

            /* ---- History modal: KPI tile grid ---- */
            .dvsa-p .dvsa-kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin: 0 0 16px;
            }
            .dvsa-p .dvsa-kpi-tile {
                padding: 10px 12px;
                background: #f8f8f8;
                border: 1px solid #ececec;
                border-radius: 4px;
            }
            .dvsa-p .dvsa-kpi-label {
                color: #505a5f;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            .dvsa-p .dvsa-kpi-value {
                font-size: 18px;
                font-weight: 700;
                color: #0b0c0c;
                line-height: 1.1;
                font-variant-numeric: tabular-nums;
            }
            .dvsa-p .dvsa-kpi-value.is-empty { color: #b1b4b6; font-weight: 600; }
            .dvsa-p .dvsa-kpi-value.is-match { color: #00703c; }
            .dvsa-p .dvsa-kpi-value.is-nearby { color: #1d70b8; }
            .dvsa-p .dvsa-kpi-sub {
                font-size: 11px;
                color: #505a5f;
                margin-top: 3px;
            }
            .dvsa-p .dvsa-kpi-period {
                grid-column: 1 / -1;
                color: #505a5f;
                font-size: 12px;
                padding: 8px 12px 0;
                border-top: 1px solid #ececec;
            }

            /* ---- Auto-book consent modal ---- */
            .dvsa-consent-overlay {
                position: fixed; inset: 0; z-index: ${Z_INDEX_OVERLAY};
                background: rgba(0,0,0,.6);
                display: flex; align-items: center; justify-content: center;
                font: 14px/1.4 system-ui,sans-serif;
            }
            .dvsa-consent-panel {
                background: #fff; color: #0b0c0c;
                width: 540px; max-width: 96vw;
                max-height: 92vh; overflow-y: auto;
                border-radius: 10px;
                box-shadow: 0 12px 36px rgba(0,0,0,.5);
                padding: 28px; box-sizing: border-box;
            }
            .dvsa-consent-panel h2 {
                margin: 0 0 6px;
                font-size: 22px;
                font-weight: 700;
                color: #0b0c0c;
                letter-spacing: -0.2px;
            }
            .dvsa-consent-panel p,
            .dvsa-consent-panel ul,
            .dvsa-consent-panel ol {
                font-size: 13.5px;
                line-height: 1.55;
                color: #0b0c0c;
                margin: 0 0 12px;
            }
            .dvsa-consent-panel ul, .dvsa-consent-panel ol {
                padding-left: 22px;
            }
            .dvsa-consent-panel li { margin-bottom: 5px; }
            .dvsa-consent-panel strong { font-weight: 600; }
            .dvsa-consent-panel .dvsa-consent-action {
                padding: 12px 14px;
                margin: 14px 0;
                background: #fff7df;
                border: 1px solid #ffdd00;
                border-radius: 4px;
                font-size: 13px;
                line-height: 1.55;
            }
            .dvsa-consent-footer {
                display: flex; align-items: center; gap: 8px;
                margin-top: 18px; padding-top: 16px;
                border-top: 1px solid #f3f2f1;
                flex-wrap: wrap;
            }
            .dvsa-consent-footer .dvsa-consent-link {
                color: #1d70b8;
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
            }
            .dvsa-consent-footer .dvsa-consent-link:hover { text-decoration: underline; }
            .dvsa-consent-footer-spacer { flex: 1; }

            /* ---- First-run setup wizard ---- */
            .dvsa-wiz-overlay {
                position: fixed; inset: 0; z-index: ${Z_INDEX_OVERLAY};
                background: rgba(0,0,0,.55);
                display: flex; align-items: center; justify-content: center;
                font: 14px/1.4 system-ui,sans-serif;
            }
            .dvsa-wiz-panel {
                background: #fff; color: #0b0c0c;
                width: 560px; max-width: 96vw;
                max-height: 92vh; overflow-y: auto;
                border-radius: 10px;
                box-shadow: 0 12px 36px rgba(0,0,0,.5);
                padding: 0; box-sizing: border-box;
            }
            .dvsa-wiz-header {
                padding: 18px 24px 12px;
                border-bottom: 1px solid #f3f2f1;
            }
            .dvsa-wiz-progress {
                display: flex; gap: 6px; margin-bottom: 14px;
            }
            .dvsa-wiz-progress-dot {
                flex: 1; height: 4px; border-radius: 2px;
                background: #ececec; transition: background .2s ease;
            }
            .dvsa-wiz-progress-dot.is-done { background: #00703c; }
            .dvsa-wiz-progress-dot.is-current { background: #1d70b8; }
            .dvsa-wiz-step-num {
                font-size: 11px;
                color: #505a5f;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            .dvsa-wiz-title {
                margin: 0 0 6px;
                font-size: 22px;
                font-weight: 700;
                color: #0b0c0c;
                letter-spacing: -0.2px;
            }
            .dvsa-wiz-subtitle {
                margin: 0;
                color: #505a5f;
                font-size: 13px;
                line-height: 1.5;
            }
            .dvsa-wiz-body {
                padding: 20px 24px;
            }
            .dvsa-wiz-body label.dvsa-lb {
                display: block; margin: 0 0 14px;
                font-size: 13px; color: #0b0c0c; font-weight: 500;
            }
            .dvsa-wiz-body input[type="text"],
            .dvsa-wiz-body input[type="date"],
            .dvsa-wiz-body input[type="time"],
            .dvsa-wiz-body input[type="password"],
            .dvsa-wiz-body input[type="number"] {
                display: block; width: 100%;
                box-sizing: border-box;
                padding: 8px 10px; margin-top: 4px;
                border: 1px solid #b1b4b6; border-radius: 4px;
                font: 14px system-ui,sans-serif;
                background: #fff; color: #0b0c0c;
            }
            .dvsa-wiz-body input:focus {
                outline: none;
                border-color: #1d70b8;
                box-shadow: 0 0 0 3px rgba(29,112,184,0.22);
            }
            .dvsa-wiz-body .dvsa-hint {
                color: #505a5f; font-size: 12px; line-height: 1.45; margin: 4px 0 0;
            }
            .dvsa-wiz-body .dvsa-err {
                color: #d4351c; margin-top: 8px; font-size: 13px; font-weight: 500; min-height: 0;
            }
            .dvsa-wiz-grid-2 {
                display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
            }
            .dvsa-wiz-welcome {
                font-size: 14px; line-height: 1.65; color: #0b0c0c;
            }
            .dvsa-wiz-welcome ul {
                margin: 12px 0; padding-left: 22px;
            }
            .dvsa-wiz-welcome li { margin-bottom: 4px; }
            .dvsa-wiz-callout {
                margin: 14px 0 0;
                padding: 12px 14px;
                background: #fff7df;
                border: 1px solid #ffdd00;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1.55;
                color: #0b0c0c;
            }
            .dvsa-wiz-import-callout {
                margin: 14px 0 0;
                padding: 14px 16px;
                background: #f3f2f1;
                border: 1px solid #dadcde;
                border-radius: 6px;
                font-size: 13px;
                line-height: 1.5;
            }
            .dvsa-wiz-import-callout strong { color: #0b0c0c; font-weight: 600; }
            .dvsa-wiz-import-callout p {
                color: #505a5f;
                margin: 4px 0 10px;
                font-size: 12.5px;
                line-height: 1.5;
            }
            .dvsa-wiz-import-callout .dvsa-err { margin-top: 8px; }
            .dvsa-wiz-summary {
                margin: 0 0 16px;
                padding: 12px 14px;
                background: #f8f8f8;
                border: 1px solid #ececec;
                border-radius: 6px;
                font-size: 13px;
                line-height: 1.6;
            }
            .dvsa-wiz-summary-label {
                font-size: 10px; color: #505a5f;
                text-transform: uppercase; letter-spacing: 0.6px;
                font-weight: 700; margin-bottom: 6px;
            }
            .dvsa-wiz-summary ul {
                margin: 0; padding-left: 18px;
            }
            .dvsa-wiz-summary li { margin-bottom: 3px; }
            .dvsa-wiz-footer {
                display: flex; align-items: center; gap: 8px;
                padding: 14px 24px 18px;
                border-top: 1px solid #f3f2f1;
                flex-wrap: wrap;
            }
            .dvsa-wiz-skip-panel {
                background: transparent; border: 0;
                color: #1d70b8; cursor: pointer;
                font: 500 12px system-ui,sans-serif;
                padding: 4px 6px; border-radius: 3px;
            }
            .dvsa-wiz-skip-panel:hover { text-decoration: underline; }
            .dvsa-wiz-footer-spacer { flex: 1; }
            .dvsa-wiz-instructor-input {
                display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;
            }
            .dvsa-wiz-instructor-pills {
                margin: 0 0 8px; min-height: 24px;
                display: flex; gap: 6px; flex-wrap: wrap;
            }
            .dvsa-wiz-pill {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 4px 8px 4px 10px;
                background: #e8f1f9; color: #1d70b8;
                border-radius: 14px;
                font: 600 12px system-ui,sans-serif;
                font-variant-numeric: tabular-nums;
            }
            .dvsa-wiz-pill button {
                background: rgba(0,0,0,0.08); border: 0; color: inherit;
                width: 18px; height: 18px; border-radius: 50%;
                cursor: pointer; font: bold 13px/1 system-ui,sans-serif;
                display: inline-flex; align-items: center; justify-content: center; padding: 0;
            }

            /* ---- About fieldset ---- */
            .dvsa-p .dvsa-about-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px 16px;
                margin-bottom: 12px;
            }
            .dvsa-p .dvsa-about-label {
                font-size: 10px;
                color: #505a5f;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
                margin-bottom: 3px;
            }
            .dvsa-p .dvsa-about-value {
                font-size: 13px;
                color: #0b0c0c;
                font-weight: 500;
            }
            .dvsa-p .dvsa-about-version {
                font-family: ui-monospace,Menlo,monospace;
                font-weight: 600;
            }
            .dvsa-p .dvsa-about-link {
                color: #1d70b8;
                text-decoration: none;
                font-weight: 500;
            }
            .dvsa-p .dvsa-about-link:hover { text-decoration: underline; }
            .dvsa-p .dvsa-about-sep { color: #b1b4b6; padding: 0 2px; }
            .dvsa-p .dvsa-about-links {
                padding-top: 10px;
                border-top: 1px solid #ececec;
                font-size: 12px;
                color: #505a5f;
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                align-items: center;
            }

            /* ---- Masked input wrapper (licence / booking ref reveal toggle) ---- */
            .dvsa-p .dvsa-mask-wrap {
                position: relative;
            }
            .dvsa-p .dvsa-mask-wrap > input.dvsa-in {
                padding-right: 38px;
            }
            .dvsa-p .dvsa-mask-toggle {
                position: absolute;
                right: 4px;
                top: 50%;
                transform: translateY(calc(-50% + 2px));
                width: 28px;
                height: 28px;
                background: transparent;
                border: 0;
                cursor: pointer;
                color: #505a5f;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 3px;
                padding: 0;
            }
            .dvsa-p .dvsa-mask-toggle:hover { background: #f3f2f1; color: #0b0c0c; }
            .dvsa-p .dvsa-mask-toggle:focus-visible {
                outline: 2px solid #ffdd00; outline-offset: 1px;
            }

            /* ---- Keyboard shortcut hint row ---- */
            .dvsa-p .dvsa-shortcuts {
                margin: 12px 0 0;
                padding: 8px 12px;
                background: #f8f8f8;
                border: 1px solid #ececec;
                border-radius: 4px;
                color: #505a5f;
                font-size: 11.5px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-wrap: wrap;
                gap: 4px 8px;
            }
            .dvsa-p .dvsa-shortcut-kbd {
                display: inline-block;
                padding: 1px 6px;
                background: #fff;
                border: 1px solid #b1b4b6;
                border-radius: 3px;
                box-shadow: 0 1px 0 #b1b4b6;
                font: 600 11px ui-monospace,Menlo,monospace;
                color: #0b0c0c;
                min-width: 14px;
                text-align: center;
            }
            .dvsa-p .dvsa-shortcut-sep { color: #b1b4b6; }

            /* ---- Top-of-page alert banners ----
               Used by intervention, match, test, confirm-ready, and nearby
               alerts. Each banner site applies .dvsa-banner plus zero or more
               modifier classes (-small, -dismissable, -low-z) and sets its own
               background colour inline (the colour is the one piece that's
               unique per banner). Close-button styling lives at the bottom. */
            .dvsa-banner {
                position: fixed; top: 0; left: 0; right: 0;
                z-index: ${Z_INDEX_OVERLAY};
                color: #fff;
                font: bold 22px/1.3 system-ui, sans-serif;
                padding: 18px 24px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, .4);
            }
            .dvsa-banner.dvsa-banner-small {
                font-size: 18px;
                padding: 14px 24px;
            }
            .dvsa-banner.dvsa-banner-dismissable {
                cursor: pointer;
                user-select: none;
                padding-right: 56px;
            }
            /* Nearby-centre alerts sit one z-stack below modal-tier banners so
               a real match banner from a target centre always takes priority. */
            .dvsa-banner.dvsa-banner-low-z {
                z-index: ${Z_INDEX_CLUSTER};
                box-shadow: 0 4px 12px rgba(0, 0, 0, .3);
                transition: transform .2s ease;
            }
            .dvsa-banner-close {
                position: absolute; top: 50%; right: 16px;
                transform: translateY(-50%);
                background: transparent;
                border: 1px solid rgba(255, 255, 255, .5);
                color: #fff;
                width: 32px; height: 32px;
                border-radius: 50%;
                font: bold 20px/1 system-ui, sans-serif;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .dvsa-banner-close.dvsa-banner-close-small {
                width: 28px; height: 28px;
                font-size: 18px;
            }

        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // Scroll an element into view and pulse a yellow outline around it 3 times.
    // Used by the "Show me" pill button.
    function pulseElement(el) {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('dvsa-pulse-active');
        // Force reflow so removing+re-adding restarts the animation
        void el.offsetWidth;
        el.classList.add('dvsa-pulse-active');
        setTimeout(() => el.classList.remove('dvsa-pulse-active'), 3000);
    }

    // Click handler for the "Show me" pill, jumps to the relevant element
    // based on the current status state.
    function showMeAction() {
        if (STATUS.state === STATUS_STATE.MATCH) {
            // Match label is dates.join(', '),first comma-separated entry is dates[0]
            const firstDate = (STATUS.label || '').split(',')[0].trim();
            if (!firstDate) return;
            const link = document.querySelector(`a.BookingCalendar-dateLink[data-date="${firstDate}"]`);
            if (!link) {
                log(`Show me: no DOM element found for ${firstDate} (probably navigated away from the calendar).`);
                return;
            }
            // Pulse the parent TD so the highlight covers the whole date cell
            pulseElement(link.closest('td') || link);
        } else if (STATUS.state === STATUS_STATE.CONFIRM) {
            const btn = document.querySelector('#confirm-changes');
            if (!btn) {
                log('Show me: #confirm-changes not on this page.');
                return;
            }
            pulseElement(btn);
        }
    }

    function injectControlCluster() {
        if (document.getElementById('dvsa-watcher-cluster')) return;
        injectWatcherCSS();

        const cluster = document.createElement('div');
        cluster.id = 'dvsa-watcher-cluster';
        cluster.style.cssText = [
            'position:fixed','bottom:16px','right:16px',`z-index:${Z_INDEX_CLUSTER}`,
            'display:flex','align-items:center','gap:8px',
            'font-family:system-ui,sans-serif','margin:0','padding:0'
        ].join(';');

        const pill = document.createElement('div');
        pill.id = 'dvsa-watcher-status';
        pill.title = 'DVSA Earlier Slot Watcher status';
        pill.style.cssText = [
            'padding:7px 14px','border-radius:16px',
            'background:#505a5f','color:#fff',
            'font:600 12px/1.4 system-ui,sans-serif',
            'box-shadow:0 2px 8px rgba(0,0,0,.35)',
            'pointer-events:none','user-select:none',
            'white-space:nowrap','letter-spacing:0.2px',
            'transition:background .25s ease','margin:0'
        ].join(';');
        pill.textContent = '… initialising';

        // Show-me action pill, hidden by default, shown by renderStatusPill
        // when STATUS.state is 'match' or 'confirm'. Click jumps to the element.
        const showMeBtn = document.createElement('button');
        showMeBtn.id = 'dvsa-watcher-show-me';
        showMeBtn.type = 'button';
        showMeBtn.title = 'Scroll to the relevant element and pulse a highlight around it';
        showMeBtn.textContent = 'Show me';
        showMeBtn.style.cssText = [
            'padding:7px 14px','border-radius:16px',
            'background:#00703c','color:#fff',
            'font:600 12px/1.4 system-ui,sans-serif',
            'box-shadow:0 2px 8px rgba(0,0,0,.35)',
            'border:0','cursor:pointer','margin:0',
            'white-space:nowrap','letter-spacing:0.2px',
            'transition:background .15s ease, transform .15s ease',
            'display:none'
        ].join(';');
        showMeBtn.addEventListener('mouseenter', () => { showMeBtn.style.transform = 'scale(1.05)'; });
        showMeBtn.addEventListener('mouseleave', () => { showMeBtn.style.transform = 'scale(1)'; });
        showMeBtn.addEventListener('click', showMeAction);

        // Round button factory, same styling as gear, different icon/handler.
        // `iconHtml` is raw HTML (e.g. inline SVG markup from dvsaIcon()).
        const makeRoundButton = (id, iconHtml, title, onClick) => {
            const b = document.createElement('button');
            b.id = id;
            b.type = 'button';
            b.title = title;
            b.innerHTML = iconHtml;
            b.style.cssText = [
                'width:44px','height:44px','border-radius:50%','border:0',
                'background:#0b0c0c','color:#fff','cursor:pointer',
                'box-shadow:0 2px 8px rgba(0,0,0,.35)','padding:0','margin:0',
                'display:flex','align-items:center','justify-content:center','flex:0 0 auto',
                'transition:transform .15s ease, background .15s ease'
            ].join(';');
            b.addEventListener('mouseenter', () => {
                b.style.background = '#262626';
                b.style.transform = 'scale(1.05)';
            });
            b.addEventListener('mouseleave', () => {
                b.style.background = '#0b0c0c';
                b.style.transform = 'scale(1)';
            });
            b.addEventListener('click', onClick);
            return b;
        };

        const paused = isPaused();
        const pauseBtn = makeRoundButton(
            'dvsa-watcher-pause',
            dvsaIcon(paused ? 'play' : 'pause', 18),
            paused ? 'Resume monitoring' : 'Pause monitoring',
            togglePause
        );

        const gearBtn = makeRoundButton(
            'dvsa-watcher-gear',
            dvsaIcon('settings', 20),
            'DVSA Earlier Slot Watcher settings',
            () => openSettingsPanel()
        );

        cluster.appendChild(pill);
        cluster.appendChild(showMeBtn);
        cluster.appendChild(pauseBtn);
        cluster.appendChild(gearBtn);
        document.body.appendChild(cluster);

        renderStatusPill();
        setInterval(renderStatusPill, 1000);
    }

    // ---- Keyboard shortcuts ----
    // Global keydown listener. S = settings (toggle), P = pause/resume,
    // H = history (toggle), Esc = close any open modal. Skips when focus is in
    // any input/textarea/contenteditable so typing doesn't trigger anything;
    // skips when any modifier (Cmd/Ctrl/Alt/Shift) is held so browser shortcuts
    // like Cmd+S aren't hijacked.
    function wireKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const t = e.target;
            if (!t) return;
            const tag = t.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (t.isContentEditable) return;
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

            const key = (e.key || '').toLowerCase();
            const settingsOpen = !!document.getElementById('dvsa-watcher-panel');
            const historyOpen  = !!document.getElementById('dvsa-history-panel');

            switch (key) {
                case 's':
                    e.preventDefault();
                    if (settingsOpen) closeSettingsPanel();
                    else              openSettingsPanel();
                    break;
                case 'p':
                    e.preventDefault();
                    togglePause();
                    break;
                case 'h':
                    e.preventDefault();
                    if (historyOpen)  closeHistoryPanel();
                    else              openHistoryPanel();
                    break;
                case 'escape':
                    // Per-modal Esc handlers also exist; this is the fallback that
                    // closes whichever is open if focus drifted outside the modal.
                    if (settingsOpen) closeSettingsPanel();
                    if (historyOpen)  closeHistoryPanel();
                    break;
            }
        });
    }

    // ---- First-run setup wizard ----
    // Guided onboarding for new users. Fires automatically when:
    //   1. The script's saved config is missing or has placeholder values, AND
    //   2. The user hasn't already completed (or skipped) the wizard.
    //
    // 5 steps: Welcome → Date window → Test centre → Instructor dates → Final
    // options. Each step has Back / Skip / Next buttons as appropriate. A
    // "Use the full settings panel instead" escape hatch lives on every step.
    //
    // The wizard's state is held in _wizardState; it commits to localStorage
    // only on the final Finish click, then reloads.

    const WIZARD_COMPLETED_KEY = 'dvsa-watcher-wizard-completed';
    let _wizardState = null;
    let _wizardEscHandler = null;

    // Quick test for whether the wizard should run instead of the regular
    // "configure to start" settings-panel auto-open.
    function shouldRunWizard() {
        if (isConfigValidForScanning()) return false;
        if (localStorage.getItem(WIZARD_COMPLETED_KEY)) return false;
        return true;
    }

    function openSetupWizard() {
        if (document.getElementById('dvsa-wizard-overlay')) return;

        // Initialise state with current panel-saved values as starting points
        // (or sensible defaults if none). Lets returning users with partial
        // config pick up where they left off.
        _wizardState = {
            step: 1,
            config: {
                TARGET_START_DATE:            (/^\d{4}-\d{2}-\d{2}$/.test(TARGET_START_DATE) ? TARGET_START_DATE : ''),
                TARGET_END_DATE:              (/^\d{4}-\d{2}-\d{2}$/.test(TARGET_END_DATE)   ? TARGET_END_DATE   : ''),
                EXPECTED_CENTRE:              (/^your test centre/i.test(EXPECTED_CENTRE.trim()) ? '' : EXPECTED_CENTRE),
                SEARCH_POSTCODE:              (/^aa1\s*1aa$/i.test(SEARCH_POSTCODE.trim()) ? '' : SEARCH_POSTCODE),
                REFRESH_MIN_MINS:             REFRESH_MIN_MINS,
                REFRESH_MAX_MINS:             REFRESH_MAX_MINS,
                EXCLUDE_WEEKENDS:             EXCLUDE_WEEKENDS,
                WALK_PREV_AVAIL:              WALK_PREV_AVAIL,
                MAX_PREV_CLICKS:              MAX_PREV_CLICKS,
                AUTO_BOOK:                    false,    // always start opt-out for safety
                EARLIEST_TIME:                EARLIEST_TIME,
                LATEST_TIME:                  LATEST_TIME,
                LOGIN_LICENCE_NUMBER:         '',       // always start blank for safety
                LOGIN_BOOKING_REF:            '',
                INSTRUCTOR_UNAVAILABLE_DATES: [...(INSTRUCTOR_UNAVAILABLE_DATES || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))]
            }
        };

        const overlay = document.createElement('div');
        overlay.id = 'dvsa-wizard-overlay';
        overlay.className = 'dvsa-wiz-overlay';

        const panel = document.createElement('div');
        panel.id = 'dvsa-wizard-panel';
        panel.className = 'dvsa-wiz-panel';

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        renderWizardStep(panel);

        _wizardEscHandler = (e) => {
            if (e.key === 'Escape') {
                // Don't accidentally lose progress, require an explicit close action.
                // Esc just nudges the user toward Skip or Cancel.
            }
        };
        document.addEventListener('keydown', _wizardEscHandler);
    }

    function closeSetupWizard() {
        const overlay = document.getElementById('dvsa-wizard-overlay');
        if (overlay) overlay.remove();
        if (_wizardEscHandler) {
            document.removeEventListener('keydown', _wizardEscHandler);
            _wizardEscHandler = null;
        }
        _wizardState = null;
    }

    function renderWizardStep(panel) {
        if (!_wizardState) return;
        const step = _wizardState.step;
        const totalSteps = 5;

        // Progress dots
        const dots = [];
        for (let i = 1; i <= totalSteps; i++) {
            const cls = i < step ? 'is-done' : i === step ? 'is-current' : '';
            dots.push(`<div class="dvsa-wiz-progress-dot ${cls}"></div>`);
        }

        const titles = {
            1: { num: 'Step 1 of 5', title: 'Welcome',              sub: 'A 60-second walkthrough to get you set up.' },
            2: { num: 'Step 2 of 5', title: 'When do you want to test by?', sub: 'Pick the earliest and latest dates you would accept.' },
            3: { num: 'Step 3 of 5', title: 'Which test centre?',   sub: 'The script monitors a single centre.' },
            4: { num: 'Step 4 of 5', title: 'Instructor unavailable dates', sub: 'Optional, dates your instructor can\'t do. Skip if not applicable.' },
            5: { num: 'Step 5 of 5', title: 'Final options',        sub: 'Optional refinements. Skip to use sensible defaults.' }
        };
        const t = titles[step];

        panel.innerHTML = `
            <div class="dvsa-wiz-header">
                <div class="dvsa-wiz-progress">${dots.join('')}</div>
                <div class="dvsa-wiz-step-num">${t.num}</div>
                <h2 class="dvsa-wiz-title">${escapeAttr(t.title)}</h2>
                <p class="dvsa-wiz-subtitle">${escapeAttr(t.sub)}</p>
            </div>
            <div class="dvsa-wiz-body" id="dvsa-wiz-body">
                ${renderWizardStepBody(step)}
            </div>
            <div class="dvsa-wiz-footer">
                <button type="button" class="dvsa-wiz-skip-panel" id="dvsa-wiz-skip-to-panel" title="Skip the wizard and use the full settings panel instead">Use the full settings panel →</button>
                <div class="dvsa-wiz-footer-spacer"></div>
                ${step > 1 ? '<button type="button" class="dvsa-btn" id="dvsa-wiz-back">← Back</button>' : ''}
                ${step === 4 ? '<button type="button" class="dvsa-btn" id="dvsa-wiz-skip">Skip</button>' : ''}
                ${step < 5 ? '<button type="button" class="dvsa-btn dvsa-btn-primary" id="dvsa-wiz-next">' + (step === 1 ? 'Get started →' : 'Next →') + '</button>' : '<button type="button" class="dvsa-btn dvsa-btn-primary" id="dvsa-wiz-finish">Finish setup ✓</button>'}
            </div>
        `;

        wireWizardButtons(panel);
        wireWizardStepInputs(panel);
    }

    function renderWizardStepBody(step) {
        const c = _wizardState.config;
        switch (step) {
            case 1:
                return `
                    <div class="dvsa-wiz-welcome">
                        <p><strong>DVSA Earlier Slot Watcher</strong> helps people with an <strong>existing DVSA practical driving test booking</strong> find an earlier cancellation slot at the same test centre and reschedule to it. It sits in a browser tab and watches the "Change your test" page, when a slot appears within your date window, it alerts you four ways at once so you don't miss it.</p>
                        <p style="padding:10px 12px;background:#f3f2f1;border-radius:4px;font-size:13px;margin:12px 0;"><strong>Prerequisite:</strong> you must already have a confirmed DVSA test booking. This script doesn't book new tests, only reschedules existing ones.</p>
                        <p>You'll set up:</p>
                        <ul>
                            <li>Your acceptable date window</li>
                            <li>Your test centre</li>
                            <li>(Optional) Dates your instructor can't do</li>
                            <li>(Optional) Auto-reschedule + auto-login</li>
                        </ul>
                        <div class="dvsa-wiz-callout">
                            <strong>⚠ Before you continue:</strong> By proceeding you accept the terms in the <a href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/DISCLAIMER.md" target="_blank" rel="noopener noreferrer" style="color:#1d70b8;font-weight:600;">disclaimer</a>. The script is provided "as is" with no warranty, no liability for missed slots or account issues, and no affiliation with DVSA.
                        </div>
                        <div class="dvsa-wiz-import-callout">
                            <strong>Already have a config from a previous install?</strong>
                            <p>If you've exported your settings from another browser or device, you can restore them here instead of walking through the wizard. The page will reload immediately after applying.</p>
                            <button id="dvsa-wiz-import" type="button" class="dvsa-btn">Import existing config…</button>
                            <input id="dvsa-wiz-import-input" type="file" accept="application/json,.json" style="display:none;">
                            <div class="dvsa-err" id="dvsa-wiz-err-import"></div>
                        </div>
                    </div>
                `;
            case 2:
                return `
                    <div class="dvsa-wiz-grid-2">
                        <label class="dvsa-lb">Earliest acceptable date
                            <input type="date" id="dvsa-wiz-start" value="${escapeAttr(c.TARGET_START_DATE)}">
                        </label>
                        <label class="dvsa-lb">Latest acceptable date
                            <input type="date" id="dvsa-wiz-end" value="${escapeAttr(c.TARGET_END_DATE)}">
                        </label>
                    </div>
                    <label class="dvsa-lb" style="margin-top:6px;display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer;">
                        <input type="checkbox" id="dvsa-wiz-weekends" ${c.EXCLUDE_WEEKENDS ? 'checked' : ''}>
                        <span>Exclude Saturdays and Sundays</span>
                    </label>
                    <div id="dvsa-wiz-preview" style="margin-top:10px;"></div>
                    <div class="dvsa-err" id="dvsa-wiz-err-dates"></div>
                `;
            case 3:
                const centres = getAllKnownCentres();
                const options = centres.map(name => `<option value="${escapeAttr(name)}"></option>`).join('');
                return `
                    <label class="dvsa-lb">Test centre name (start typing to search)
                        <input type="text" id="dvsa-wiz-centre" list="dvsa-wiz-centre-list" value="${escapeAttr(c.EXPECTED_CENTRE)}" autocomplete="off" spellcheck="false" placeholder="e.g. Bromley (London)">
                        <datalist id="dvsa-wiz-centre-list">${options}</datalist>
                        <p class="dvsa-hint">${centres.length} UK centres available. If yours isn't listed, type it exactly as DVSA shows it, the script will pick it up after the first scan.</p>
                    </label>
                    <label class="dvsa-lb">Search term DVSA uses to find your centre
                        <input type="text" id="dvsa-wiz-postcode" value="${escapeAttr(c.SEARCH_POSTCODE)}" autocomplete="off" placeholder="e.g. BR1 or Bromley">
                        <p class="dvsa-hint">Any of: full postcode (<code>SW1A 1AA</code>), outward only (<code>SE10</code>, <code>BR1</code>), or centre name. Whatever returns your target centre in DVSA's search results.</p>
                    </label>
                    <div class="dvsa-err" id="dvsa-wiz-err-centre"></div>
                `;
            case 4:
                return `
                    <p style="margin:0 0 12px;color:#505a5f;font-size:13px;">Only dates inside your date window have any effect. Skip if your instructor's flexible or you don't have one.</p>
                    <div class="dvsa-wiz-instructor-input">
                        <input type="date" id="dvsa-wiz-inst-input" style="width:170px;">
                        <button type="button" class="dvsa-btn dvsa-btn-primary" id="dvsa-wiz-inst-add" style="background:#0b0c0c;border-color:#0b0c0c;">+ Add</button>
                    </div>
                    <div class="dvsa-wiz-instructor-pills" id="dvsa-wiz-inst-pills"></div>
                    <div class="dvsa-err" id="dvsa-wiz-err-instructor"></div>
                `;
            case 5:
                // Summary block at top + final options below
                return `
                    <div class="dvsa-wiz-summary">
                        <div class="dvsa-wiz-summary-label">Setup so far</div>
                        <ul id="dvsa-wiz-summary-list"></ul>
                    </div>
                    <p style="margin:0 0 12px;color:#505a5f;font-size:13px;">These options are advanced. You can change any of them later via the settings panel (<kbd class="dvsa-shortcut-kbd" style="display:inline-block;padding:1px 6px;background:#fff;border:1px solid #b1b4b6;border-radius:3px;font:600 11px ui-monospace,Menlo,monospace;">S</kbd>).</p>
                    <div class="dvsa-wiz-grid-2">
                        <label class="dvsa-lb">Refresh min (minutes)
                            <input type="number" id="dvsa-wiz-refresh-min" min="5" max="60" value="${c.REFRESH_MIN_MINS}">
                        </label>
                        <label class="dvsa-lb">Refresh max (minutes)
                            <input type="number" id="dvsa-wiz-refresh-max" min="5" max="60" value="${c.REFRESH_MAX_MINS}">
                        </label>
                    </div>
                    <label class="dvsa-lb" style="display:flex;align-items:flex-start;gap:8px;font-weight:normal;cursor:pointer;">
                        <input type="checkbox" id="dvsa-wiz-autobook" ${c.AUTO_BOOK ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;">
                        <span><strong>Auto-book through to the confirmation page</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;line-height:1.5;">Auto-clicks date / time / Continue and stops on DVSA's Confirm changes page (you still click Confirm manually). See the disclaimer's auto-book section for the elevated-risk warning.</span></span>
                    </label>
                    <label class="dvsa-lb" style="display:flex;align-items:flex-start;gap:8px;font-weight:normal;cursor:pointer;">
                        <input type="checkbox" id="dvsa-wiz-autologin-toggle" ${c.LOGIN_LICENCE_NUMBER && c.LOGIN_BOOKING_REF ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;">
                        <span><strong>Set up auto-login (optional)</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;line-height:1.5;">Stored in your browser's localStorage so the script can recover from session expiry without manual login. Skip if you'd rather log in manually each time.</span></span>
                    </label>
                    <div id="dvsa-wiz-login-fields" style="display:none;margin-top:10px;padding:12px;background:#f8f8f8;border-radius:4px;">
                        <label class="dvsa-lb">Driving licence number
                            <input type="password" id="dvsa-wiz-licence" value="${escapeAttr(c.LOGIN_LICENCE_NUMBER)}" maxlength="16" style="text-transform:uppercase;font-family:ui-monospace,Menlo,monospace;" placeholder="16 chars" autocomplete="off">
                        </label>
                        <label class="dvsa-lb">Booking reference
                            <input type="password" id="dvsa-wiz-ref" value="${escapeAttr(c.LOGIN_BOOKING_REF)}" maxlength="12" style="font-family:ui-monospace,Menlo,monospace;" placeholder="6–12 digits" autocomplete="off">
                        </label>
                    </div>
                    <div class="dvsa-err" id="dvsa-wiz-err-options"></div>
                `;
        }
        return '';
    }

    function wireWizardButtons(panel) {
        const skipPanelBtn = panel.querySelector('#dvsa-wiz-skip-to-panel');
        const backBtn      = panel.querySelector('#dvsa-wiz-back');
        const skipBtn      = panel.querySelector('#dvsa-wiz-skip');
        const nextBtn      = panel.querySelector('#dvsa-wiz-next');
        const finishBtn    = panel.querySelector('#dvsa-wiz-finish');

        if (skipPanelBtn) skipPanelBtn.addEventListener('click', () => {
            if (window.confirm('Skip the wizard and use the full settings panel instead? You can always re-run the wizard by clearing your browser storage.')) {
                localStorage.setItem(WIZARD_COMPLETED_KEY, 'skipped-to-panel:' + new Date().toISOString());
                closeSetupWizard();
                openSettingsPanel({ message: 'Configure the script before monitoring can start. All required fields must be filled and valid.' });
            }
        });

        if (backBtn) backBtn.addEventListener('click', () => {
            commitWizardStepInputs(panel);   // preserve in-progress edits
            _wizardState.step = Math.max(1, _wizardState.step - 1);
            renderWizardStep(panel);
        });

        if (skipBtn) skipBtn.addEventListener('click', () => {
            // Skip doesn't validate, moves forward leaving the step's values at whatever they currently are (often empty / defaults)
            _wizardState.step = Math.min(5, _wizardState.step + 1);
            renderWizardStep(panel);
        });

        if (nextBtn) nextBtn.addEventListener('click', () => {
            const err = validateWizardStep(panel);
            if (err) {
                showWizardStepError(panel, err);
                return;
            }
            commitWizardStepInputs(panel);
            _wizardState.step = Math.min(5, _wizardState.step + 1);
            renderWizardStep(panel);
        });

        if (finishBtn) finishBtn.addEventListener('click', () => {
            const err = validateWizardStep(panel);
            if (err) {
                showWizardStepError(panel, err);
                return;
            }
            commitWizardStepInputs(panel);
            finishWizard();
        });
    }

    function wireWizardStepInputs(panel) {
        const step = _wizardState.step;

        if (step === 1) {
            // Import-existing-config path. Lets a user with a previously-exported
            // JSON config (e.g. moving to a new browser, restoring after a
            // browser-data wipe) skip the rest of the wizard and apply that
            // config directly. Reuses parseImportedConfig + summariseImportedConfig
            // from the panel's Backup & restore section, with one wizard-specific
            // addition: on successful apply, also write WIZARD_COMPLETED_KEY so
            // the wizard doesn't re-fire after the reload, and write the
            // auto-book ack flag if the imported config has AUTO_BOOK=true.
            // The import-confirm dialog explicitly shows "Auto-book: on" in
            // its summary, so the user's OK click is informed acknowledgement
            // analogous to the in-wizard consent modal on step 5.
            const importBtn   = panel.querySelector('#dvsa-wiz-import');
            const importInput = panel.querySelector('#dvsa-wiz-import-input');
            const errSlot     = panel.querySelector('#dvsa-wiz-err-import');

            if (importBtn && importInput) {
                importBtn.addEventListener('click', () => importInput.click());
                importInput.addEventListener('change', () => {
                    if (errSlot) errSlot.textContent = '';
                    const file = importInput.files && importInput.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = parseImportedConfig(String(reader.result || ''));
                        if (!result.ok) {
                            if (errSlot) errSlot.textContent = result.error;
                            importInput.value = '';
                            return;
                        }
                        const summary = summariseImportedConfig(result.settings, result.meta);
                        const confirmMsg = `Restore these settings from "${file.name}" and skip the rest of the wizard?\n\n${summary}\n\nThe page will reload immediately after applying. Click OK to proceed.`;
                        if (!window.confirm(confirmMsg)) {
                            importInput.value = '';
                            return;
                        }
                        try {
                            const current = JSON.parse(localStorage.getItem(PANEL_CONFIG_KEY) || '{}');
                            const merged = { ...current, ...result.settings };
                            localStorage.setItem(PANEL_CONFIG_KEY, JSON.stringify(merged));
                            localStorage.setItem(WIZARD_COMPLETED_KEY, new Date().toISOString());
                            if (result.settings.AUTO_BOOK === true) {
                                setAutoBookAck();
                            }
                            log('Config imported via wizard. Reloading.');
                            window.location.reload();
                        } catch (e) {
                            if (errSlot) errSlot.textContent = 'Failed to apply imported config: ' + e.message;
                        }
                    };
                    reader.onerror = () => {
                        if (errSlot) errSlot.textContent = 'Could not read file.';
                    };
                    reader.readAsText(file);
                });
            }
        }

        if (step === 2) {
            const updatePreview = () => renderWizardPreview(panel);
            const ids = ['dvsa-wiz-start', 'dvsa-wiz-end', 'dvsa-wiz-weekends'];
            ids.forEach(id => {
                const el = panel.querySelector(`#${id}`);
                if (el) { el.addEventListener('input', updatePreview); el.addEventListener('change', updatePreview); }
            });
            updatePreview();
        }

        if (step === 4) {
            renderWizardInstructorPills(panel);
            const addBtn = panel.querySelector('#dvsa-wiz-inst-add');
            const input  = panel.querySelector('#dvsa-wiz-inst-input');
            const errEl  = panel.querySelector('#dvsa-wiz-err-instructor');
            if (addBtn && input) {
                const doAdd = () => {
                    const d = (input.value || '').trim();
                    if (errEl) errEl.textContent = '';
                    if (!d) {
                        if (errEl) errEl.textContent = 'Pick a date first.';
                        return;
                    }
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                        if (errEl) errEl.textContent = `"${d}" is not a valid date.`;
                        return;
                    }
                    if (_wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES.includes(d)) {
                        if (errEl) errEl.textContent = `${d} is already in the list.`;
                        return;
                    }
                    _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES.push(d);
                    _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES.sort();
                    input.value = '';
                    renderWizardInstructorPills(panel);
                };
                addBtn.addEventListener('click', doAdd);
                input.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
            }
        }

        if (step === 5) {
            renderWizardSummary(panel);
            const toggle = panel.querySelector('#dvsa-wiz-autologin-toggle');
            const fields = panel.querySelector('#dvsa-wiz-login-fields');
            if (toggle && fields) {
                const sync = () => { fields.style.display = toggle.checked ? 'block' : 'none'; };
                toggle.addEventListener('change', sync);
                sync();
            }

            // Auto-book consent gate inside the wizard. Mirrors the panel's
            // change-listener path so a user who enables auto-book during
            // setup gets the same explicit consent modal (with its three
            // acknowledgements and link to DISCLAIMER section 11) as a user
            // who enables auto-book later via the settings panel. Without
            // this, the wizard would be a quieter path to enable a feature
            // that deserves a deliberate moment.
            const autoBookCheckbox = panel.querySelector('#dvsa-wiz-autobook');
            if (autoBookCheckbox) {
                autoBookCheckbox.addEventListener('change', () => {
                    if (autoBookCheckbox.checked && !getAutoBookAck()) {
                        openAutoBookConsentModal({
                            onCancel: () => { autoBookCheckbox.checked = false; }
                            // onConfirm: nothing to do, the modal writes the ack flag itself
                        });
                    }
                });
            }
        }
    }

    function renderWizardPreview(panel) {
        const start = panel.querySelector('#dvsa-wiz-start')?.value || '';
        const end   = panel.querySelector('#dvsa-wiz-end')?.value || '';
        const excludeWeekends = panel.querySelector('#dvsa-wiz-weekends')?.checked;
        const stats = computeMonitoringPreview({
            start, end, excludeWeekends,
            instructorDates: _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES
        });
        const container = panel.querySelector('#dvsa-wiz-preview');
        if (!container) return;
        if (!stats.ok) {
            container.innerHTML = '<p style="color:#505a5f;font-size:12px;margin:0;font-style:italic;">Pick both dates above to see preview.</p>';
            return;
        }
        const isZero = stats.alertable === 0;
        container.innerHTML = `
            <div style="padding:10px 12px;background:#f8f8f8;border:1px solid #ececec;border-radius:4px;font-size:13px;">
                <strong style="color:${isZero ? '#d4351c' : '#00703c'};font-variant-numeric:tabular-nums;font-size:15px;">${stats.alertable}</strong>
                date${stats.alertable === 1 ? '' : 's'} would alert
                <span style="color:#505a5f;font-size:12px;">· ${stats.total} total in range · ${stats.durationLabel}</span>
                ${stats.weekends ? `<div style="color:#505a5f;font-size:11.5px;margin-top:4px;">${stats.weekends} weekend${stats.weekends === 1 ? '' : 's'} ${excludeWeekends ? 'excluded' : 'allowed'}</div>` : ''}
                ${isZero ? '<div style="color:#d4351c;font-size:12px;font-weight:600;margin-top:6px;">⚠ No dates would alert</div>' : ''}
            </div>
        `;
    }

    function renderWizardInstructorPills(panel) {
        const container = panel.querySelector('#dvsa-wiz-inst-pills');
        if (!container) return;
        const dates = _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES;
        if (!dates.length) {
            container.innerHTML = '<span style="color:#505a5f;font-size:12px;font-style:italic;">No dates added. Add one above, or skip this step.</span>';
            return;
        }
        container.innerHTML = dates.map(d => {
            const date = new Date(d + 'T12:00:00');
            const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            return `<span class="dvsa-wiz-pill">${escapeAttr(label)}<button type="button" data-remove="${escapeAttr(d)}" aria-label="Remove ${escapeAttr(d)}">×</button></span>`;
        }).join('');
        container.querySelectorAll('button[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = btn.dataset.remove;
                _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES = _wizardState.config.INSTRUCTOR_UNAVAILABLE_DATES.filter(x => x !== d);
                renderWizardInstructorPills(panel);
            });
        });
    }

    function renderWizardSummary(panel) {
        const c = _wizardState.config;
        const ul = panel.querySelector('#dvsa-wiz-summary-list');
        if (!ul) return;
        const items = [];
        items.push(`<li>Date window: <strong>${escapeAttr(c.TARGET_START_DATE)} → ${escapeAttr(c.TARGET_END_DATE)}</strong>${c.EXCLUDE_WEEKENDS ? ', weekends excluded' : ''}</li>`);
        items.push(`<li>Test centre: <strong>${escapeAttr(c.EXPECTED_CENTRE)}</strong></li>`);
        items.push(`<li>Search term: <strong>${escapeAttr(c.SEARCH_POSTCODE)}</strong></li>`);
        const instCount = (c.INSTRUCTOR_UNAVAILABLE_DATES || []).length;
        items.push(`<li>Instructor unavailable dates: <strong>${instCount}</strong></li>`);
        ul.innerHTML = items.join('');
    }

    function commitWizardStepInputs(panel) {
        const c = _wizardState.config;
        const step = _wizardState.step;
        const v = (id) => { const el = panel.querySelector(`#${id}`); return el ? el.value : ''; };
        const checked = (id) => { const el = panel.querySelector(`#${id}`); return el ? !!el.checked : false; };

        if (step === 2) {
            c.TARGET_START_DATE  = v('dvsa-wiz-start').trim();
            c.TARGET_END_DATE    = v('dvsa-wiz-end').trim();
            c.EXCLUDE_WEEKENDS   = checked('dvsa-wiz-weekends');
        }
        if (step === 3) {
            c.EXPECTED_CENTRE = v('dvsa-wiz-centre').trim();
            c.SEARCH_POSTCODE = v('dvsa-wiz-postcode').trim();
        }
        // step 4 commits to c.INSTRUCTOR_UNAVAILABLE_DATES directly via the pill handlers
        if (step === 5) {
            c.REFRESH_MIN_MINS = parseInt(v('dvsa-wiz-refresh-min'), 10) || REFRESH_MIN_MINS;
            c.REFRESH_MAX_MINS = parseInt(v('dvsa-wiz-refresh-max'), 10) || REFRESH_MAX_MINS;
            c.AUTO_BOOK        = checked('dvsa-wiz-autobook');
            if (checked('dvsa-wiz-autologin-toggle')) {
                c.LOGIN_LICENCE_NUMBER = v('dvsa-wiz-licence').trim().toUpperCase();
                c.LOGIN_BOOKING_REF    = v('dvsa-wiz-ref').trim();
            } else {
                c.LOGIN_LICENCE_NUMBER = '';
                c.LOGIN_BOOKING_REF    = '';
            }
        }
    }

    function validateWizardStep(panel) {
        const step = _wizardState.step;
        const v = (id) => { const el = panel.querySelector(`#${id}`); return el ? el.value.trim() : ''; };
        if (step === 1) return null;   // welcome, no validation
        if (step === 2) {
            const start = v('dvsa-wiz-start');
            const end   = v('dvsa-wiz-end');
            return _validateDates(start, end);
        }
        if (step === 3) {
            const centre   = v('dvsa-wiz-centre');
            const postcode = v('dvsa-wiz-postcode');
            return _validateCentre(centre, postcode);
        }
        if (step === 4) return null;   // optional, can be empty
        if (step === 5) {
            const min = parseInt(v('dvsa-wiz-refresh-min'), 10);
            const max = parseInt(v('dvsa-wiz-refresh-max'), 10);
            const refreshErr = _validateRefresh(min, max);
            if (refreshErr) return refreshErr;
            const toggle = panel.querySelector('#dvsa-wiz-autologin-toggle');
            if (toggle && toggle.checked) {
                const licence = v('dvsa-wiz-licence').toUpperCase();
                const ref     = v('dvsa-wiz-ref');
                if (!licence || !ref) return 'Fill in both licence and booking ref, or untick "Set up auto-login".';
                const loginErr = _validateLogin(licence, ref);
                if (loginErr) return loginErr;
            }
            return null;
        }
        return null;
    }

    function showWizardStepError(panel, msg) {
        const slots = panel.querySelectorAll('.dvsa-err');
        // Clear all then write to the last (always the active step's slot)
        slots.forEach(s => s.textContent = '');
        if (slots.length) slots[slots.length - 1].textContent = msg;
    }

    function finishWizard() {
        const c = _wizardState.config;
        // Build the config object from PANEL_FIELD_MAP. Each field is read
        // from the wizard's working-copy state, except for fields with a
        // `wizardForce` value (TEST_MODE, MANUAL_TRIGGER, ALERT_ANY_CENTRE),
        // which the wizard intentionally resets to safe defaults regardless
        // of any prior config value. Adding a new field to PANEL_FIELD_MAP
        // automatically flows it through the wizard finish.
        const cfg = {};
        PANEL_FIELD_MAP.forEach(f => {
            cfg[f.key] = (f.wizardForce !== undefined) ? f.wizardForce : c[f.key];
        });
        try {
            localStorage.setItem(PANEL_CONFIG_KEY, JSON.stringify(cfg));
            localStorage.setItem(WIZARD_COMPLETED_KEY, new Date().toISOString());
            // Auto-book consent acknowledgement is handled by the wizard's own
            // step 5 change-listener (mirrors the panel's behaviour). The
            // listener fires openAutoBookConsentModal when the checkbox
            // transitions to checked and no prior ack exists, and the modal
            // writes the ack flag on Confirm or unticks the checkbox on
            // Cancel. So by the time finishWizard runs, either auto-book is
            // off (no ack needed) or auto-book is on AND the user has
            // already confirmed (ack flag already written). No fallback set
            // here is required.
            log('Setup wizard completed. Reloading.');
            window.location.reload();
        } catch (e) {
            window.alert('Failed to save wizard config: ' + e.message);
        }
    }

    // ---- Modal overlay factory ----
    // The settings panel, history panel, and diagnostic modal all sit on a
    // full-screen overlay backdrop with the same z-index, the same dimmer,
    // the same Esc-to-close behaviour, and the same click-outside-to-close
    // behaviour. Their PANELS differ in width, padding, and (for history) a
    // flex-column layout, but everything else is identical.
    //
    // createModalOverlay() builds the overlay + panel shell, wires the Esc
    // and click-outside dismiss handlers, and returns { overlay, panel, close }
    // for the caller to populate. Close is idempotent and removes both the
    // overlay and the keydown listener cleanly.
    //
    // The auto-book consent modal does NOT use this factory because (a) it
    // uses CSS classes for styling rather than inline cssText, and (b) it
    // treats click-outside as a Cancel action rather than a passive dismiss.
    //
    // Options:
    //   id            required; overlay element id (also used by the
    //                 already-open guard)
    //   panelWidth    px (default 720)
    //   panelPadding  px (default 28)
    //   panelMaxVh    vh integer for max-height (default 92)
    //   panelFlexColumn  if true, panel uses display:flex/flex-direction:column
    //                    and overflow:hidden (history panel pattern, so its
    //                    footer can be sticky inside the panel rather than
    //                    pushing past max-height)
    //   onClose       optional, called once after the overlay is removed
    //   dismissOnClickOutside  default true
    function createModalOverlay(opts) {
        if (document.getElementById(opts.id)) return null;

        const overlay = document.createElement('div');
        overlay.id = opts.id;
        overlay.style.cssText = [
            'position:fixed','inset:0',`z-index:${Z_INDEX_OVERLAY}`,
            'background:rgba(0,0,0,.55)',
            'display:flex','align-items:center','justify-content:center',
            'font:14px/1.4 system-ui,sans-serif'
        ].join(';');

        const panel = document.createElement('div');
        panel.className = 'dvsa-p';
        const panelStyles = [
            'background:#fff','color:#0b0c0c',
            `width:${opts.panelWidth || 720}px`,'max-width:96vw',
            `max-height:${opts.panelMaxVh || 92}vh`,
            'border-radius:8px',
            'box-shadow:0 10px 30px rgba(0,0,0,.45)',
            `padding:${opts.panelPadding || 28}px`,
            'box-sizing:border-box'
        ];
        if (opts.panelFlexColumn) {
            panelStyles.push('display:flex','flex-direction:column','overflow:hidden');
        } else {
            panelStyles.push('overflow-y:auto');
        }
        panel.style.cssText = panelStyles.join(';');

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        let closed = false;
        function close() {
            if (closed) return;
            closed = true;
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', escHandler);
            if (opts.onClose) opts.onClose();
        }

        function escHandler(e) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', escHandler);

        if (opts.dismissOnClickOutside !== false) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });
        }

        return { overlay, panel, close };
    }

    // The settings/history/diagnostic modals expose module-level "close X"
    // functions that callers (e.g. button handlers, wizard re-run, consent
    // onClose) invoke without holding a reference to the factory result.
    // We track the live close fn for each modal in these vars; the public
    // closeX() wrappers delegate. When a modal isn't open, the var is null
    // and the wrapper is a no-op.
    let _closeSettingsPanel = null;
    let _closeHistoryPanel = null;
    let _closeDiagnosticModal = null;

    function openSettingsPanel(opts) {
        opts = opts || {};
        const modal = createModalOverlay({
            id: 'dvsa-watcher-panel',
            panelWidth: 720,
            panelPadding: 28,
            onClose: () => { _closeSettingsPanel = null; }
        });
        if (!modal) return;
        const { panel, close } = modal;
        _closeSettingsPanel = close;

        panel.innerHTML = buildPanelHTML(opts.message);

        panel.querySelector('#dvsa-cancel').addEventListener('click', close);
        panel.querySelector('#dvsa-save').addEventListener('click', () => handlePanelSave(panel));
        panel.querySelector('#dvsa-reset').addEventListener('click', () => handlePanelReset());
        panel.querySelector('#dvsa-view-history').addEventListener('click', () => openHistoryPanel());
        panel.querySelector('#dvsa-test-alert').addEventListener('click', () => fireTestAlert());

        // Initialise instructor-date working copy from current config; render pills
        _panelInstructorDates = [...(INSTRUCTOR_UNAVAILABLE_DATES || [])]
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
        _panelInstructorDates.sort();
        wireInstructorDateHandlers(panel);
        renderInstructorPills(panel);

        wireCentreCombobox(panel);

        wirePreviewHooks(panel);
        renderMonitoringPreview(panel);

        wireMaskToggles(panel);

        wireBackupHandlers(panel);

        const diagnosticBtn = panel.querySelector('#dvsa-run-diagnostic');
        if (diagnosticBtn) diagnosticBtn.addEventListener('click', () => openDiagnosticModal());

        const rerunWizardBtn = panel.querySelector('#dvsa-rerun-wizard');
        if (rerunWizardBtn) rerunWizardBtn.addEventListener('click', () => {
            // Close settings, open wizard. Wizard initialises with current
            // values from constants (which reflect saved localStorage),
            // so the user can walk through with their existing config
            // pre-filled. Cancelling mid-wizard leaves config untouched;
            // only the final Finish click writes back to localStorage.
            close();
            openSetupWizard();
        });

        // Auto-book consent gate: when the user transitions the checkbox to
        // checked and no prior acknowledgement exists, show the consent modal.
        // Cancel reverts the checkbox; Confirm leaves it checked and writes
        // the ack flag.
        const autoBookCheckbox = panel.querySelector('#dvsa-autobook');
        if (autoBookCheckbox) {
            autoBookCheckbox.addEventListener('change', () => {
                if (autoBookCheckbox.checked && !getAutoBookAck()) {
                    openAutoBookConsentModal({
                        onCancel: () => { autoBookCheckbox.checked = false; }
                        // onConfirm: nothing to do, checkbox stays checked, flag is set inside the modal
                    });
                }
            });
        }

        attachLiveValidation(panel);
    }

    function closeSettingsPanel() {
        if (_closeSettingsPanel) _closeSettingsPanel();
    }

    // Health snapshot, diagnostic block at the top of the settings panel.
    // Snapshot at panel-open time; reopen to refresh.
    function buildHealthGridHTML() {
        // Notification permission
        let notif = { label: 'Unsupported', color: '#505a5f', icon: '✗' };
        if (window.Notification) {
            const p = Notification.permission;
            if      (p === 'granted') notif = { label: 'Granted',          color: '#00703c', icon: '✓' };
            else if (p === 'denied')  notif = { label: 'Denied',           color: '#d4351c', icon: '✗' };
            else                       notif = { label: 'Not yet granted',  color: '#f47738', icon: '⚠' };
        }

        // Audio context state. This card tracks the in-page Web Audio chime
        // only, not the OS-level notification sound (which is handled by the
        // browser/OS once notification permission is granted and doesn't need
        // a page-level gesture). The labels below say "chime" explicitly so
        // users don't conclude they have no audio at all if it shows "tap to
        // enable" — OS notifications still play sound independently.
        let audio = { label: 'Tap to enable', color: '#f47738', icon: '⚠' };
        if (audioCtx) {
            if      (audioCtx.state === 'running')   audio = { label: 'Ready',         color: '#00703c', icon: '✓' };
            else if (audioCtx.state === 'suspended') audio = { label: 'Tap to enable', color: '#f47738', icon: '⚠' };
            else                                       audio = { label: audioCtx.state,  color: '#505a5f', icon: '○' };
        }

        // Last scan
        const cyc = getCycles();
        let lastScan = { label: 'Never', color: '#505a5f', icon: '○' };
        if (cyc.last) {
            const ms = Date.now() - new Date(cyc.last).getTime();
            let txt;
            if      (ms < 60000)    txt = `${Math.max(0, Math.floor(ms / 1000))}s ago`;
            else if (ms < 3600000)  txt = `${Math.floor(ms / 60000)}m ago`;
            else if (ms < 86400000) txt = `${Math.floor(ms / 3600000)}h ago`;
            else                    txt = `${Math.floor(ms / 86400000)}d ago`;
            const stale = ms > 3600000;  // >1 hour
            lastScan = {
                label: txt,
                color: stale ? '#f47738' : '#00703c',
                icon:  stale ? '⚠' : '✓'
            };
        }

        // Auto-login attempts (this browser session)
        let login;
        if (!LOGIN_LICENCE_NUMBER || !LOGIN_BOOKING_REF) {
            login = { label: 'Manual login', color: '#505a5f', icon: '○' };
        } else {
            const used = parseInt(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || '0', 10);
            if (used >= MAX_LOGIN_ATTEMPTS) {
                login = { label: `${used}/${MAX_LOGIN_ATTEMPTS},locked`, color: '#d4351c', icon: '✗' };
            } else if (used > 0) {
                login = { label: `${used}/${MAX_LOGIN_ATTEMPTS} used`,     color: '#f47738', icon: '⚠' };
            } else {
                login = { label: `${used}/${MAX_LOGIN_ATTEMPTS} used`,     color: '#00703c', icon: '✓' };
            }
        }

        // Tab focus / background-throttling indicator. Browsers slow down
        // setTimeout in inactive tabs; if the tab has been backgrounded
        // recently, scans may have been delayed. Warn the user so they can
        // keep the tab in the foreground for reliable monitoring.
        let tabFocus;
        if (document.visibilityState === 'hidden') {
            // Rarely seen (the panel must be open to see this), but possible
            // if user opens panel then switches tabs without closing it.
            tabFocus = { label: 'Backgrounded', color: '#d4351c', icon: '⚠' };
        } else if (_tabEverBackgrounded && _tabLastHiddenAt) {
            const minsAgo = Math.floor((Date.now() - _tabLastHiddenAt) / 60000);
            const ago = minsAgo < 1 ? '<1m ago' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;
            tabFocus = { label: `Hidden ${ago}`, color: '#f47738', icon: '⚠' };
        } else {
            tabFocus = { label: 'Active', color: '#00703c', icon: '✓' };
        }

        const card = (title, d) => `
            <div style="padding:12px 14px;background:#f8f8f8;border:1px solid #ececec;border-radius:6px;">
                <div style="color:#505a5f;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;font-weight:600;">${title}</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:${d.color};font-size:16px;font-weight:bold;">${d.icon}</span>
                    <span style="color:${d.color};font-size:13px;font-weight:600;">${escapeAttr(d.label)}</span>
                </div>
            </div>
        `;

        return `
            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('heart')}</span>Health</legend>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(125px, 1fr));gap:10px;">
                    ${card('Notifications', notif)}
                    ${card('Chime',         audio)}
                    ${card('Last scan',     lastScan)}
                    ${card('Auto-login',    login)}
                    ${card('Tab focus',     tabFocus)}
                </div>
                <p class="dvsa-hint" style="margin-top:10px;">Snapshot taken when panel opened. Reopen to refresh.</p>
            </fieldset>
        `;
    }

    function buildPanelHTML(message) {
        const startDefault = /^\d{4}-\d{2}-\d{2}$/.test(TARGET_START_DATE) ? TARGET_START_DATE : '';
        const endDefault   = /^\d{4}-\d{2}-\d{2}$/.test(TARGET_END_DATE)   ? TARGET_END_DATE   : '';
        const banner = message
            ? `<div style="padding:12px 16px;background:#f47738;color:#fff;border-radius:6px;margin:0 0 16px;font-weight:600;font-size:14px;line-height:1.4;">${escapeAttr(message)}</div>`
            : '';
        return `
            <h2>DVSA Earlier Slot Watcher</h2>
            <p class="dvsa-subtitle">Settings are saved to this browser only. The page reloads after saving so changes take effect immediately.</p>
            ${banner}

            ${buildHealthGridHTML()}

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('calendar')}</span>Date window</legend>
                <div class="dvsa-grid-2">
                    <label class="dvsa-lb">Earliest acceptable date
                        <input id="dvsa-start" type="date" class="dvsa-in" value="${escapeAttr(startDefault)}">
                    </label>
                    <label class="dvsa-lb">Latest acceptable date
                        <input id="dvsa-end" type="date" class="dvsa-in" value="${escapeAttr(endDefault)}">
                    </label>
                </div>
                <div id="dvsa-err-dates" class="dvsa-err"></div>
            </fieldset>

            <div id="dvsa-preview" class="dvsa-preview">
                <p class="dvsa-preview-label">What you're monitoring</p>
                <div id="dvsa-preview-body">
                    <p class="dvsa-preview-invalid">Set a valid date window to see preview.</p>
                </div>
            </div>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('pin')}</span>Test centre</legend>
                <label class="dvsa-lb" for="dvsa-centre">Centre name (search the dropdown or type a custom value)</label>
                <div id="dvsa-centre-combo" class="dvsa-combo" data-open="false">
                    <input id="dvsa-centre" type="text" class="dvsa-in" value="${escapeAttr(EXPECTED_CENTRE)}"
                           autocomplete="off" spellcheck="false"
                           role="combobox" aria-autocomplete="list" aria-expanded="false"
                           aria-controls="dvsa-centre-listbox"
                           placeholder="Start typing to search…">
                    <button type="button" class="dvsa-combo-toggle" aria-label="Show centre list" tabindex="-1"></button>
                    <div id="dvsa-centre-listbox" class="dvsa-combo-listbox" role="listbox" hidden></div>
                </div>
                <p class="dvsa-hint">Searches ~330 UK centres. Found gaps are added automatically after each scan. Pick one or type your own, DVSA's exact wording is required.</p>
                <p class="dvsa-custom-hint" id="dvsa-centre-custom-hint">⚠ Custom value, must match DVSA's exact wording (case-sensitive). The script will halt with a mismatch alert if it doesn't.</p>
                <label class="dvsa-lb" style="margin-top:14px;">Search term (postcode or centre name)
                    <input id="dvsa-postcode" type="text" class="dvsa-in dvsa-medium" value="${escapeAttr(SEARCH_POSTCODE)}">
                    <p class="dvsa-hint">Any of: full postcode (<code>SW1A 1AA</code>), outward only (<code>SE10</code>, <code>BR1</code>), or centre name (<code>Bromley</code>, <code>Nott</code>). Whatever returns your target centre in DVSA's results.</p>
                </label>
                <div id="dvsa-err-centre" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('clock')}</span>Refresh interval</legend>
                <div class="dvsa-grid-2">
                    <label class="dvsa-lb">Minimum
                        <span class="dvsa-input-unit"><input id="dvsa-refresh-min" type="number" min="5" max="60" class="dvsa-in dvsa-narrow" value="${REFRESH_MIN_MINS}"><span class="dvsa-unit">min</span></span>
                    </label>
                    <label class="dvsa-lb">Maximum
                        <span class="dvsa-input-unit"><input id="dvsa-refresh-max" type="number" min="5" max="60" class="dvsa-in dvsa-narrow" value="${REFRESH_MAX_MINS}"><span class="dvsa-unit">min</span></span>
                    </label>
                </div>
                <p class="dvsa-hint">Randomised each cycle. Faster than 5 minutes is likely to trip DVSA's standard rate-limiting (Error 15) and is not recommended.</p>
                <div id="dvsa-err-refresh" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('filter')}</span>Filters &amp; alerts</legend>
                <label class="dvsa-cb"><input id="dvsa-weekends" type="checkbox" ${EXCLUDE_WEEKENDS ? 'checked' : ''}><span class="dvsa-cb-label">Exclude Saturdays and Sundays</span></label>
                <label class="dvsa-cb"><input id="dvsa-walk" type="checkbox" ${WALK_PREV_AVAIL ? 'checked' : ''}><span class="dvsa-cb-label">Walk back through earlier dates each cycle</span></label>
                <label class="dvsa-lb" style="margin:8px 0 0;">Max "Previous available" clicks per cycle
                    <span class="dvsa-input-unit"><input id="dvsa-walk-max" type="number" min="1" max="30" class="dvsa-in dvsa-narrow" value="${MAX_PREV_CLICKS}"><span class="dvsa-unit">clicks</span></span>
                </label>
                <hr class="dvsa-divider">
                <label class="dvsa-cb"><input id="dvsa-alert-any" type="checkbox" ${ALERT_ANY_CENTRE ? 'checked' : ''}><span class="dvsa-cb-label"><strong>Alert on any centre with availability</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;">Fires a soft blue "nearby" alert (banner + chime + notification) for non-target centres in your date window. Does NOT auto-book or navigate. Deduplicated per (centre, date) per browser session.</span></span></label>
                <div id="dvsa-err-filters" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('bolt')}</span>Auto-book</legend>
                <label class="dvsa-cb"><input id="dvsa-autobook" type="checkbox" ${AUTO_BOOK ? 'checked' : ''}><span class="dvsa-cb-label"><strong>Auto-book through to the confirmation page</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;">When a slot matches, the script auto-clicks date / time / Continue on the Warning modal and stops on DVSA's <strong>Confirm changes</strong> page. The final click stays manual, DVSA holds the slot for 15 minutes. Disabled while Test mode is on.</span></span></label>
                <hr class="dvsa-divider">
                <div class="dvsa-grid-2">
                    <label class="dvsa-lb">Earliest time you'll accept
                        <input id="dvsa-earliest-time" type="time" class="dvsa-in dvsa-medium" value="${escapeAttr(EARLIEST_TIME)}">
                    </label>
                    <label class="dvsa-lb">Latest time you'll accept
                        <input id="dvsa-latest-time" type="time" class="dvsa-in dvsa-medium" value="${escapeAttr(LATEST_TIME)}">
                    </label>
                </div>
                <p class="dvsa-hint">Only auto-book time slots within this window. Set <code>00:00</code>–<code>23:59</code> to accept any time.</p>
                <div id="dvsa-err-autobook" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('ban')}</span>Instructor unavailable dates</legend>
                <p class="dvsa-hint" style="margin:0 0 12px;">Dates your instructor can't do. Only dates inside your target window have any effect, others are kept for safety if you widen the window later.</p>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px;">
                    <input id="dvsa-instructor-input" type="date" class="dvsa-in" style="width:170px;margin:0;">
                    <button id="dvsa-instructor-add" type="button" class="dvsa-btn dvsa-btn-primary" style="background:#0b0c0c;border-color:#0b0c0c;">+ Add</button>
                    <button id="dvsa-instructor-bulk-toggle" type="button" class="dvsa-btn dvsa-btn-sm dvsa-btn-icon-text">${dvsaIcon('clipboard', 13)}<span>Paste multiple…</span></button>
                    <span style="flex:1;"></span>
                    <span id="dvsa-instructor-summary" style="color:#505a5f;font-size:12px;font-weight:500;"></span>
                </div>
                <div id="dvsa-instructor-bulk" style="display:none;margin:0 0 10px;padding:12px;background:#f3f2f1;border-radius:4px;">
                    <label style="display:block;font-size:12px;color:#505a5f;margin:0 0 6px;font-weight:500;">Paste dates (one per line, YYYY-MM-DD). Invalid lines are ignored:</label>
                    <textarea id="dvsa-instructor-bulk-text" rows="5" class="dvsa-in dvsa-mono" style="margin:0 0 8px;"></textarea>
                    <div style="display:flex;gap:6px;">
                        <button id="dvsa-instructor-bulk-add" type="button" class="dvsa-btn dvsa-btn-primary dvsa-btn-sm">Add all</button>
                        <button id="dvsa-instructor-bulk-cancel" type="button" class="dvsa-btn dvsa-btn-sm">Cancel</button>
                    </div>
                </div>
                <div id="dvsa-instructor-pills" style="margin:0 0 10px;min-height:24px;"></div>
                <button id="dvsa-instructor-clear" type="button" class="dvsa-btn dvsa-btn-danger dvsa-btn-sm">Clear all dates</button>
                <div id="dvsa-err-instructor" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('lock')}</span>Auto-login <span style="opacity:0.6;font-weight:normal;font-size:11px;text-transform:none;letter-spacing:0;">(optional)</span></legend>
                <p class="dvsa-hint" style="margin:0 0 12px;">Stored in your browser only. Leave both blank to get a manual-login prompt when DVSA expires your session. Values are masked by default, click the eye icon to reveal.</p>
                <div class="dvsa-grid-2">
                    <label class="dvsa-lb">Driving licence number
                        <div class="dvsa-mask-wrap">
                            <input id="dvsa-licence" type="password" class="dvsa-in dvsa-mono" value="${escapeAttr(LOGIN_LICENCE_NUMBER)}" maxlength="16" style="text-transform:uppercase;" placeholder="16 chars, e.g. SMITH912043JK9AB" autocomplete="off" spellcheck="false">
                            <button type="button" class="dvsa-mask-toggle" data-target="dvsa-licence" aria-label="Show or hide licence number" title="Show/hide" tabindex="-1">${dvsaIcon('eye', 14)}</button>
                        </div>
                    </label>
                    <label class="dvsa-lb">Booking reference
                        <div class="dvsa-mask-wrap">
                            <input id="dvsa-ref" type="password" class="dvsa-in dvsa-mono" value="${escapeAttr(LOGIN_BOOKING_REF)}" maxlength="12" placeholder="6–12 digits" autocomplete="off" spellcheck="false">
                            <button type="button" class="dvsa-mask-toggle" data-target="dvsa-ref" aria-label="Show or hide booking reference" title="Show/hide" tabindex="-1">${dvsaIcon('eye', 14)}</button>
                        </div>
                    </label>
                </div>
                <div id="dvsa-err-login" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('sliders')}</span>Advanced</legend>
                <label class="dvsa-cb"><input id="dvsa-manual" type="checkbox" ${MANUAL_TRIGGER ? 'checked' : ''}><span class="dvsa-cb-label"><strong>Manual trigger mode</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;">Script idles on each page until you click "Change" yourself. Useful for active monitoring (Monday morning release window).</span></span></label>
                <label class="dvsa-cb"><input id="dvsa-test" type="checkbox" ${TEST_MODE ? 'checked' : ''}><span class="dvsa-cb-label"><strong>Test mode</strong><br><span style="color:#505a5f;font-size:12px;font-weight:normal;">Alert fires on ANY visible bookable date, including your current booking. Use to verify alerts work, then turn off. Disables auto-book entirely.</span></span></label>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('download')}</span>Backup &amp; restore</legend>
                <p class="dvsa-hint" style="margin:0 0 12px;">Save your settings to a JSON file or restore from one. Useful as a backup before clearing browser data, or to copy settings to another browser. Credentials are excluded by default, only export them if you trust where the file's going.</p>
                <label class="dvsa-cb" style="margin-bottom:10px;"><input id="dvsa-export-creds" type="checkbox"><span class="dvsa-cb-label">Include auto-login credentials in export</span></label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button id="dvsa-export-config" type="button" class="dvsa-btn dvsa-btn-icon-text">${dvsaIcon('download', 13)}<span>Download config (JSON)</span></button>
                    <button id="dvsa-import-config" type="button" class="dvsa-btn dvsa-btn-icon-text">${dvsaIcon('upload', 13)}<span>Restore from file…</span></button>
                    <input id="dvsa-import-input" type="file" accept="application/json,.json" style="display:none;">
                </div>
                <div id="dvsa-err-backup" class="dvsa-err"></div>
            </fieldset>

            <fieldset class="dvsa-fs">
                <legend class="dvsa-lg"><span class="dvsa-ic">${dvsaIcon('settings')}</span>About</legend>
                <div class="dvsa-about-grid">
                    <div>
                        <div class="dvsa-about-label">Script</div>
                        <div class="dvsa-about-value">DVSA Earlier Slot Watcher</div>
                    </div>
                    <div>
                        <div class="dvsa-about-label">Version</div>
                        <div class="dvsa-about-value dvsa-about-version">v${SCRIPT_VERSION}</div>
                    </div>
                    <div>
                        <div class="dvsa-about-label">License</div>
                        <div class="dvsa-about-value"><a class="dvsa-about-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></div>
                    </div>
                    <div>
                        <div class="dvsa-about-label">Author</div>
                        <div class="dvsa-about-value"><a class="dvsa-about-link" href="https://github.com/alchemycharlie" target="_blank" rel="noopener noreferrer">@alchemycharlie</a></div>
                    </div>
                </div>
                <div class="dvsa-about-links">
                    <a class="dvsa-about-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher" target="_blank" rel="noopener noreferrer">GitHub repo</a>
                    <span class="dvsa-about-sep">·</span>
                    <a class="dvsa-about-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a>
                    <span class="dvsa-about-sep">·</span>
                    <a class="dvsa-about-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/DISCLAIMER.md" target="_blank" rel="noopener noreferrer">Disclaimer</a>
                    <span class="dvsa-about-sep">·</span>
                    <a class="dvsa-about-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues" target="_blank" rel="noopener noreferrer">Report issue</a>
                </div>
                <p class="dvsa-hint" style="margin-top:12px;">To check for updates: open the Tampermonkey dashboard, click this script's row, then <strong>Check for updates</strong>. Your saved settings are preserved across updates.</p>
                <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button id="dvsa-run-diagnostic" type="button" class="dvsa-btn dvsa-btn-sm">Run self-test diagnostic</button>
                    <button id="dvsa-rerun-wizard" type="button" class="dvsa-btn dvsa-btn-sm" title="Walk through the setup wizard again. Your current values are preserved unless you click Finish on the last step.">Re-run setup wizard</button>
                </div>
            </fieldset>

            <div class="dvsa-footer">
                <div class="dvsa-footer-left">
                    <button id="dvsa-reset" type="button" class="dvsa-btn">Reset to defaults</button>
                    <button id="dvsa-view-history" type="button" class="dvsa-btn">View scan history</button>
                    <button id="dvsa-test-alert" type="button" class="dvsa-btn" title="Fire a fake alert to verify banner, title flash, notification and beep" ${_testActive ? 'disabled' : ''}>${_testActive ? 'Test running…' : 'Test alert'}</button>
                </div>
                <div class="dvsa-footer-right">
                    <button id="dvsa-cancel" type="button" class="dvsa-btn">Cancel</button>
                    <button id="dvsa-save" type="button" class="dvsa-btn dvsa-btn-primary">Save and reload</button>
                </div>
            </div>

            <p class="dvsa-shortcuts">
                <span class="dvsa-shortcut-kbd">S</span> settings
                <span class="dvsa-shortcut-sep">·</span>
                <span class="dvsa-shortcut-kbd">P</span> pause/resume
                <span class="dvsa-shortcut-sep">·</span>
                <span class="dvsa-shortcut-kbd">H</span> history
                <span class="dvsa-shortcut-sep">·</span>
                <span class="dvsa-shortcut-kbd">Esc</span> close
            </p>
        `;
    }

    // ---- Live-preview helpers ----
    // Pure functions used by the "What you're monitoring" card in the settings
    // panel and the stats strip in the history modal. Both compute on-demand
    // from current state; no caching needed (panel re-render is cheap).

    // Enumerate dates between start and end (inclusive) and classify each.
    // Returns { ok, total, weekends, instructor, alertable, durationLabel, endLabel }.
    // If the date range is invalid, ok=false and the rest of the fields are zero.
    function computeMonitoringPreview({ start, end, excludeWeekends, instructorDates }) {
        const out = { ok: false, total: 0, weekends: 0, instructor: 0, alertable: 0, durationLabel: '', endLabel: '' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return out;
        const startDt = new Date(start + 'T12:00:00');
        const endDt   = new Date(end + 'T12:00:00');
        if (isNaN(startDt) || isNaN(endDt) || startDt > endDt) return out;

        const blocked = new Set((instructorDates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
        const cursor = new Date(startDt);
        while (cursor <= endDt) {
            out.total++;
            const dow = cursor.getDay();
            const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            const isWeekend = (dow === 0 || dow === 6);
            const isInstructor = blocked.has(iso);
            if (isWeekend) out.weekends++;
            if (isInstructor) out.instructor++;
            // A date is "alertable" if it would survive the script's filters.
            // Weekend dates are only excluded when EXCLUDE_WEEKENDS is on.
            // Instructor dates are always excluded.
            if (!isInstructor && (!excludeWeekends || !isWeekend)) out.alertable++;
            cursor.setDate(cursor.getDate() + 1);
        }

        // Human-readable duration: "2.5 weeks" or "5 days"
        const days = out.total;
        let dur;
        if      (days < 14)  dur = `${days} day${days === 1 ? '' : 's'}`;
        else if (days < 60)  dur = `${(days / 7).toFixed(1)} weeks`;
        else                 dur = `${(days / 30).toFixed(1)} months`;
        out.durationLabel = dur;
        out.endLabel = endDt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        out.ok = true;
        return out;
    }

    // Aggregate stats over the findings array. Returns { total, last7, avgLeadDays, lastFindingMs }.
    // avgLeadDays = mean of (test date - finding timestamp), useful to gauge how
    // far ahead the script tends to spot cancellations.
    function computeFindingStats(findings) {
        const out = { total: 0, last7: 0, avgLeadDays: null, lastFindingMs: null };
        if (!findings || !findings.length) return out;
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 86400000;
        let leadSum = 0, leadCount = 0;
        let mostRecent = 0;
        findings.forEach(f => {
            const ts = new Date(f.ts).getTime();
            if (isNaN(ts)) return;
            out.total++;
            if (ts >= sevenDaysAgo) out.last7++;
            if (ts > mostRecent) mostRecent = ts;
            (f.dates || []).forEach(d => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
                const slotMs = new Date(d + 'T12:00:00').getTime();
                if (!isNaN(slotMs)) { leadSum += (slotMs - ts); leadCount++; }
            });
        });
        if (leadCount) out.avgLeadDays = leadSum / leadCount / 86400000;
        if (mostRecent) out.lastFindingMs = now - mostRecent;
        return out;
    }

    // Format a "Xh Ym ago" / "Xd ago" relative-time string from milliseconds.
    function formatRelativeAgo(ms) {
        if (ms == null || ms < 0) return '-';
        if (ms < 60000)    return `${Math.floor(ms / 1000)}s ago`;
        if (ms < 3600000)  return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return m ? `${h}h ${m}m ago` : `${h}h ago`;
        }
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        return h ? `${d}d ${h}h ago` : `${d}d ago`;
    }

    // ---- Per-group field validators ----
    // Each returns null when valid or an error string when invalid. Shared between
    // live validation (on blur) and the Save handler.
    function _validateDates(start, end) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'Start date is required and must be YYYY-MM-DD.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(end))   return 'End date is required and must be YYYY-MM-DD.';
        if (new Date(start + 'T12:00:00') > new Date(end + 'T12:00:00')) return 'Start date must be on or before end date.';
        return null;
    }
    function _validateCentre(centre, postcode) {
        if (!centre) return 'Centre name is required.';
        if (!postcode || postcode.length < 2) return 'Search term is required (at least 2 characters).';
        // DVSA accepts: full postcode ("SW1A 1AA"), outward only ("SE10"),
        // or centre name ("Bromley", "Nott"). Free text, minimal validation.
        return null;
    }
    function _validateRefresh(min, max) {
        if (!Number.isFinite(min) || min < 5) return 'Min refresh must be at least 5 minutes.';
        if (!Number.isFinite(max) || max <= min) return 'Max refresh must be greater than min refresh.';
        return null;
    }
    function _validateWalk(walkMax) {
        if (!Number.isFinite(walkMax) || walkMax < 1 || walkMax > 30) return 'Max walk clicks must be between 1 and 30.';
        return null;
    }

    // ---- Instructor-date helpers (settings panel) ----
    function renderInstructorPills(panel) {
        const container = panel.querySelector('#dvsa-instructor-pills');
        const summary = panel.querySelector('#dvsa-instructor-summary');
        if (!container) return;

        const startVal = panel.querySelector('#dvsa-start')?.value || '';
        const endVal   = panel.querySelector('#dvsa-end')?.value || '';
        const total = _panelInstructorDates.length;
        const inWindowCount = _panelInstructorDates.filter(d =>
            (!startVal || d >= startVal) && (!endVal || d <= endVal)
        ).length;

        if (summary) {
            summary.textContent = total === 0
                ? ''
                : `${total} date${total > 1 ? 's' : ''} blocked · ${inWindowCount} in target window`;
        }

        if (total === 0) {
            container.innerHTML = '<p style="color:#505a5f;font-size:12px;margin:0;font-style:italic;">No dates blocked. Add one above.</p>';
            renderMonitoringPreview(panel);
            return;
        }

        container.innerHTML = _panelInstructorDates.map(d => {
            const date = new Date(d + 'T12:00:00');
            const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum = date.getDate();
            const monthName = date.toLocaleDateString('en-GB', { month: 'short' });
            const year = date.getFullYear();
            const inWindow = (!startVal || d >= startVal) && (!endVal || d <= endVal);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            let badge, bg, fg, border;
            if (!inWindow) {
                badge = 'outside window';
                bg = '#f3f2f1'; fg = '#505a5f'; border = '#dadcde';
            } else if (isWeekend) {
                badge = 'weekend';
                bg = '#fff7e6'; fg = '#7a4a00'; border = '#ffd99c';
            } else {
                badge = 'in window';
                bg = '#e6f0e6'; fg = '#005a30'; border = '#a8d3a8';
            }

            return `<span style="display:inline-flex;align-items:center;gap:8px;padding:4px 4px 4px 10px;background:${bg};color:${fg};border:1px solid ${border};border-radius:14px;font-size:12px;margin:0 6px 6px 0;font-variant-numeric:tabular-nums;">
                <span><strong>${dayName} ${dayNum} ${monthName} ${year}</strong> <span style="opacity:0.75;font-size:11px;">· ${badge}</span></span>
                <button type="button" data-remove-date="${escapeAttr(d)}" title="Remove ${escapeAttr(d)}" style="background:rgba(0,0,0,0.08);border:0;color:inherit;width:18px;height:18px;border-radius:50%;cursor:pointer;font:bold 13px/1 system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;padding:0;">×</button>
            </span>`;
        }).join('');

        container.querySelectorAll('[data-remove-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = btn.dataset.removeDate;
                _panelInstructorDates = _panelInstructorDates.filter(x => x !== d);
                _setFieldError(panel, 'instructor', null);
                renderInstructorPills(panel);
            });
        });

        renderMonitoringPreview(panel);
    }

    // Wire preview-card hooks for inputs that aren't already covered by the
    // instructor-pill render path (date inputs + weekends checkbox). Pill
    // changes already trigger renderInstructorPills, which calls renderMonitoringPreview.
    function wirePreviewHooks(panel) {
        const refresh = () => renderMonitoringPreview(panel);
        ['dvsa-start', 'dvsa-end'].forEach(id => {
            const el = panel.querySelector(`#${id}`);
            if (el) {
                el.addEventListener('change', refresh);
                el.addEventListener('input', refresh);
            }
        });
        const weekends = panel.querySelector('#dvsa-weekends');
        if (weekends) weekends.addEventListener('change', refresh);
    }

    // Render the "What you're monitoring" card. Pure read of current panel
    // state, call whenever any input that affects the count changes.
    function renderMonitoringPreview(panel) {
        const body = panel.querySelector('#dvsa-preview-body');
        if (!body) return;
        const start = panel.querySelector('#dvsa-start')?.value || '';
        const end   = panel.querySelector('#dvsa-end')?.value || '';
        const excludeWeekends = panel.querySelector('#dvsa-weekends')?.checked;

        const stats = computeMonitoringPreview({
            start, end, excludeWeekends,
            instructorDates: _panelInstructorDates
        });

        if (!stats.ok) {
            body.innerHTML = '<p class="dvsa-preview-invalid">Set a valid date window above to see preview.</p>';
            return;
        }

        const alertablePct = stats.total ? (stats.alertable / stats.total) * 100 : 0;
        const weekendPct   = stats.total ? (stats.weekends   / stats.total) * 100 : 0;
        // Instructor dates can overlap with weekends; show as a separate
        // visual bar but clamp so the total never exceeds 100%.
        const instructorPct = stats.total ? Math.min(stats.instructor / stats.total * 100, 100 - alertablePct - weekendPct) : 0;
        const otherExcluded = Math.max(0, 100 - alertablePct - weekendPct - instructorPct);

        const isZero = stats.alertable === 0;
        const breakdown = [];
        if (stats.weekends)   breakdown.push(`<strong>${stats.weekends}</strong> weekend${stats.weekends === 1 ? '' : 's'} ${excludeWeekends ? 'excluded' : 'allowed'}`);
        if (stats.instructor) breakdown.push(`<strong>${stats.instructor}</strong> instructor date${stats.instructor === 1 ? '' : 's'} blocked`);
        breakdown.push(`window ends <strong>${escapeAttr(stats.endLabel)}</strong> (<strong>${escapeAttr(stats.durationLabel)}</strong>)`);

        body.innerHTML = `
            <p class="dvsa-preview-main${isZero ? ' is-zero' : ''}">
                <span class="dvsa-preview-alert">${stats.alertable}</span>
                date${stats.alertable === 1 ? '' : 's'} would alert
                <span style="font-weight:400;color:#505a5f;font-size:13px;">· ${stats.total} total in range</span>
            </p>
            <div class="dvsa-preview-bar" title="${stats.alertable} alertable / ${stats.weekends} weekend / ${stats.instructor} instructor / ${stats.total} total">
                <span class="dvsa-bar-alert" style="width:${alertablePct.toFixed(2)}%;"></span>
                <span class="dvsa-bar-weekend" style="width:${(excludeWeekends ? weekendPct : 0).toFixed(2)}%;"></span>
                <span class="dvsa-bar-instructor" style="width:${instructorPct.toFixed(2)}%;"></span>
            </div>
            <div class="dvsa-preview-legend">
                <span><i class="dvsa-bar-alert"></i>Alertable</span>
                ${excludeWeekends && stats.weekends ? '<span><i class="dvsa-bar-weekend"></i>Weekend (excluded)</span>' : ''}
                ${stats.instructor ? '<span><i class="dvsa-bar-instructor"></i>Instructor blocked</span>' : ''}
            </div>
            <p class="dvsa-preview-sub" style="margin-top:8px;">${breakdown.join(' · ')}${isZero ? ' &nbsp; <span style="color:#d4351c;font-weight:600;">⚠ No dates would alert</span>' : ''}</p>
        `;
    }

    function _addInstructorDate(panel, d) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            _setFieldError(panel, 'instructor', `"${d}" is not a valid date (use YYYY-MM-DD).`);
            return false;
        }
        if (_panelInstructorDates.indexOf(d) !== -1) {
            _setFieldError(panel, 'instructor', `${d} is already in the list.`);
            return false;
        }
        _panelInstructorDates.push(d);
        _panelInstructorDates.sort();
        return true;
    }

    function wireInstructorDateHandlers(panel) {
        const addBtn = panel.querySelector('#dvsa-instructor-add');
        const input  = panel.querySelector('#dvsa-instructor-input');
        if (addBtn && input) {
            const doAdd = () => {
                const d = (input.value || '').trim();
                if (!d) {
                    _setFieldError(panel, 'instructor', 'Pick a date first.');
                    return;
                }
                if (_addInstructorDate(panel, d)) {
                    input.value = '';
                    _setFieldError(panel, 'instructor', null);
                    renderInstructorPills(panel);
                }
            };
            addBtn.addEventListener('click', doAdd);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        }

        const clearBtn = panel.querySelector('#dvsa-instructor-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!_panelInstructorDates.length) return;
                if (!window.confirm(`Remove all ${_panelInstructorDates.length} instructor date${_panelInstructorDates.length > 1 ? 's' : ''}?`)) return;
                _panelInstructorDates = [];
                _setFieldError(panel, 'instructor', null);
                renderInstructorPills(panel);
            });
        }

        const bulkToggle = panel.querySelector('#dvsa-instructor-bulk-toggle');
        const bulkPanel  = panel.querySelector('#dvsa-instructor-bulk');
        const bulkText   = panel.querySelector('#dvsa-instructor-bulk-text');
        const bulkAdd    = panel.querySelector('#dvsa-instructor-bulk-add');
        const bulkCancel = panel.querySelector('#dvsa-instructor-bulk-cancel');

        if (bulkToggle && bulkPanel) {
            bulkToggle.addEventListener('click', () => {
                bulkPanel.style.display = bulkPanel.style.display === 'none' ? 'block' : 'none';
                if (bulkPanel.style.display === 'block' && bulkText) bulkText.focus();
            });
        }
        if (bulkAdd && bulkText) {
            bulkAdd.addEventListener('click', () => {
                const lines = (bulkText.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                let added = 0, skipped = 0;
                lines.forEach(line => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(line)) { skipped++; return; }
                    if (_panelInstructorDates.indexOf(line) !== -1) { skipped++; return; }
                    _panelInstructorDates.push(line);
                    added++;
                });
                _panelInstructorDates.sort();
                bulkText.value = '';
                if (bulkPanel) bulkPanel.style.display = 'none';
                _setFieldError(panel, 'instructor', skipped ? `Added ${added}; skipped ${skipped} (invalid or duplicate).` : null);
                renderInstructorPills(panel);
            });
        }
        if (bulkCancel && bulkPanel && bulkText) {
            bulkCancel.addEventListener('click', () => {
                bulkText.value = '';
                bulkPanel.style.display = 'none';
                _setFieldError(panel, 'instructor', null);
            });
        }

        // Re-render pills if the date window changes (in-window vs outside-window labels update)
        const startEl = panel.querySelector('#dvsa-start');
        const endEl   = panel.querySelector('#dvsa-end');
        if (startEl) startEl.addEventListener('change', () => renderInstructorPills(panel));
        if (endEl)   endEl.addEventListener('change', () => renderInstructorPills(panel));
    }

    function _validateLogin(licence, ref) {
        const errs = [];
        if (licence && !/^[A-Z0-9]{16}$/.test(licence)) errs.push('Licence must be exactly 16 alphanumeric characters.');
        if (ref && !/^\d{6,12}$/.test(ref)) errs.push('Booking ref must be 6-12 digits.');
        return errs.length ? errs.join(' ') : null;
    }
    // Instructor dates are now managed by add/remove pill UI which enforces
    // validity at add-time. _panelInstructorDates is always already valid.
    function _validateInstructor() {
        return null;
    }
    function _validateAutoBook(earliest, latest) {
        const eMin = parseTimeOfDay(earliest);
        const lMin = parseTimeOfDay(latest);
        if (eMin == null) return 'Earliest time must be HH:MM (24-hour, e.g. "07:00").';
        if (lMin == null) return 'Latest time must be HH:MM (24-hour, e.g. "18:00").';
        if (eMin > lMin)  return 'Earliest time must be on or before latest time.';
        return null;
    }

    // Field-group → input IDs map. Used to highlight all inputs in a group when
    // a validation error fires (e.g. both date fields glow red on a date error).
    const _groupInputIds = {
        dates:      ['dvsa-start', 'dvsa-end'],
        centre:     ['dvsa-centre', 'dvsa-postcode'],
        refresh:    ['dvsa-refresh-min', 'dvsa-refresh-max'],
        filters:    ['dvsa-walk-max'],
        login:      ['dvsa-licence', 'dvsa-ref'],
        instructor: ['dvsa-instructor-input'],
        autobook:   ['dvsa-earliest-time', 'dvsa-latest-time']
    };

    function _setFieldError(panel, group, msg) {
        const errEl = panel.querySelector(`#dvsa-err-${group}`);
        if (errEl) errEl.textContent = msg || '';
        (_groupInputIds[group] || []).forEach(id => {
            const inp = panel.querySelector(`#${id}`);
            if (!inp) return;
            // Use box-shadow so the input doesn't reflow when the error appears
            inp.style.boxShadow = msg ? '0 0 0 2px #d4351c' : 'none';
        });
    }

    function _validateGroup(panel, group) {
        const $ = (id) => panel.querySelector(`#${id}`);
        const val = (id) => ($(id) ? $(id).value : '');
        const num = (id) => parseInt(val(id), 10);
        switch (group) {
            case 'dates':      return _validateDates(val('dvsa-start').trim(), val('dvsa-end').trim());
            case 'centre':     return _validateCentre(val('dvsa-centre').trim(), val('dvsa-postcode').trim());
            case 'refresh':    return _validateRefresh(num('dvsa-refresh-min'), num('dvsa-refresh-max'));
            case 'filters':    return _validateWalk(num('dvsa-walk-max'));
            case 'login':      return _validateLogin(val('dvsa-licence').trim().toUpperCase(), val('dvsa-ref').trim());
            case 'instructor': return _validateInstructor();
            case 'autobook':   return _validateAutoBook(val('dvsa-earliest-time').trim(), val('dvsa-latest-time').trim());
        }
        return null;
    }

    function attachLiveValidation(panel) {
        Object.entries(_groupInputIds).forEach(([group, ids]) => {
            ids.forEach(id => {
                const el = panel.querySelector(`#${id}`);
                if (!el) return;
                // On blur: validate the whole group, show error if any
                el.addEventListener('blur', () => {
                    _setFieldError(panel, group, _validateGroup(panel, group));
                });
                // On input: clear the group's error while the user is fixing it.
                // Re-validation happens when they tab away again.
                el.addEventListener('input', () => {
                    _setFieldError(panel, group, null);
                });
            });
        });
    }

    // ---- Self-test diagnostic ----
    // Runs a battery of environment + feature probes and formats the output as
    // a multi-line text report. Useful for bug reports: users can run the
    // diagnostic and paste the output into an issue. Output is copy-friendly
    // (plain text, no Markdown decoration).
    function runSelfTestDiagnostic() {
        const results = [];
        const line = (status, label, detail) => {
            const glyph = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : status === 'fail' ? '✗' : '○';
            results.push(`${glyph} ${label}${detail ? `,${detail}` : ''}`);
        };

        results.push('=== DVSA Earlier Slot Watcher · self-test diagnostic ===');
        results.push(`Generated: ${new Date().toLocaleString('en-GB')}`);
        results.push('');

        // Script
        results.push('--- Script ---');
        line('ok', `Version: ${SCRIPT_VERSION}`);
        line('ok', `Page body ID: ${document.body.id || '(none)'}`);
        line('ok', `URL: ${location.pathname}`);

        // Browser / OS
        results.push('');
        results.push('--- Environment ---');
        const ua = navigator.userAgent || '(unavailable)';
        line('ok', 'User agent', ua);
        line('ok', 'Language', navigator.language || '(unset)');
        line(navigator.onLine ? 'ok' : 'warn', 'Network', navigator.onLine ? 'online' : 'offline');
        const hasTM = !!(window.GM_info || (window.unsafeWindow && window.unsafeWindow.GM_info));
        line(hasTM ? 'ok' : 'warn', 'Tampermonkey', hasTM ? 'detected' : 'not detected (script may be running outside Tampermonkey)');

        // Notifications
        results.push('');
        results.push('--- Notifications ---');
        if (!window.Notification) {
            line('fail', 'Notifications API', 'unavailable in this browser');
        } else {
            const perm = Notification.permission;
            const status = perm === 'granted' ? 'ok' : perm === 'denied' ? 'fail' : 'warn';
            line(status, 'Permission', perm);
        }

        // Audio
        results.push('');
        results.push('--- Audio ---');
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
            line('fail', 'AudioContext', 'unavailable in this browser');
        } else if (!audioCtx) {
            line('warn', 'AudioContext', 'not yet primed, click anywhere on the page once to enable');
        } else {
            const status = audioCtx.state === 'running' ? 'ok' : audioCtx.state === 'suspended' ? 'warn' : 'fail';
            line(status, 'State', audioCtx.state);
            line('ok', 'Sample rate', `${audioCtx.sampleRate} Hz`);
        }

        // Storage
        results.push('');
        results.push('--- Storage ---');
        try {
            const probe = '__dvsa_probe__';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
            line('ok', 'localStorage', 'writable');
            const stored = localStorage.getItem(PANEL_CONFIG_KEY);
            const findingsLen = (() => {
                try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').length; }
                catch (e) { return 0; }
            })();
            const cycles = getCycles();
            line('ok', 'Panel config', stored ? 'present' : 'using code defaults');
            line('ok', 'Findings', `${findingsLen} record(s)`);
            line('ok', 'Cycles', `${cycles.count} scan(s)${cycles.last ? `, last ${formatRelativeAgo(Date.now() - new Date(cycles.last).getTime())}` : ''}`);
            const discovered = getDiscoveredCentres();
            line('ok', 'Discovered centres', `${discovered.length} (in addition to ${KNOWN_TEST_CENTRES.length} bundled)`);
            const wizardDone = localStorage.getItem(WIZARD_COMPLETED_KEY);
            line('ok', 'Setup wizard', wizardDone ? `completed ${wizardDone}` : 'not yet completed (or skipped)');
        } catch (e) {
            line('fail', 'localStorage', `unavailable: ${e.message}`);
        }

        // Config validity
        results.push('');
        results.push('--- Configuration ---');
        const valid = isConfigValidForScanning();
        line(valid ? 'ok' : 'fail', 'Valid for scanning', valid ? 'yes' : 'no, missing or placeholder values');
        line('ok', 'Target window', `${TARGET_START_DATE} → ${TARGET_END_DATE}`);
        line('ok', 'Centre', EXPECTED_CENTRE || '(unset)');
        line('ok', 'Search term', SEARCH_POSTCODE || '(unset)');
        line('ok', 'Refresh', `${REFRESH_MIN_MINS}–${REFRESH_MAX_MINS} min`);
        line(AUTO_BOOK ? 'warn' : 'ok', 'Auto-book', AUTO_BOOK ? 'enabled' : 'disabled');
        const _abAck = getAutoBookAck();
        if (AUTO_BOOK) {
            line(_abAck ? 'ok' : 'warn', 'Auto-book consent ack', _abAck || 'NOT YET ACKNOWLEDGED,consent modal will fire on next save');
        } else {
            line('ok', 'Auto-book consent ack', _abAck || 'n/a (auto-book disabled)');
        }
        line(TEST_MODE ? 'warn' : 'ok', 'Test mode', TEST_MODE ? 'enabled (alerts fire on any date)' : 'disabled');
        line(isPaused() ? 'warn' : 'ok', 'Paused', isPaused() ? 'yes' : 'no');
        const hasLogin = !!(LOGIN_LICENCE_NUMBER && LOGIN_BOOKING_REF);
        line('ok', 'Auto-login', hasLogin ? 'configured' : 'manual login (credentials not stored)');

        // DVSA page selectors (probes on current page)
        results.push('');
        results.push('--- DVSA selectors on this page ---');
        const probes = [
            { sel: '#chosen-test-centre h1',          label: 'Centre H1 (calendar page)' },
            { sel: '.BookingCalendar',                label: 'Calendar widget' },
            { sel: '.BookingCalendar-previousLink',   label: 'Previous-available link' },
            { sel: '#slot-warning-continue',          label: 'Warning! Continue button' },
            { sel: '#confirm-changes',                label: 'Confirm changes button' },
            { sel: '#driving-licence-number',         label: 'Licence input (login page)' },
            { sel: '#application-reference-number',   label: 'Booking ref input (login page)' }
        ];
        probes.forEach(({ sel, label }) => {
            const found = !!document.querySelector(sel);
            line(found ? 'ok' : 'warn', label, found ? `${sel} (found)` : `${sel} (not on this page)`);
        });

        results.push('');
        results.push('=== End of diagnostic ===');
        return results.join('\n');
    }

    function openDiagnosticModal() {
        const report = runSelfTestDiagnostic();
        const modal = createModalOverlay({
            id: 'dvsa-diagnostic-modal',
            panelWidth: 680,
            panelPadding: 24,
            panelMaxVh: 88,
            onClose: () => { _closeDiagnosticModal = null; }
        });
        if (!modal) return;
        const { panel, close } = modal;
        _closeDiagnosticModal = close;

        panel.innerHTML = `
            <h2 style="margin:0 0 6px;font-size:20px;">Self-test diagnostic</h2>
            <p style="margin:0 0 16px;color:#505a5f;font-size:13px;">Snapshot of script + environment + DVSA page state. Useful for bug reports, copy this and paste into a GitHub issue.</p>
            <pre id="dvsa-diagnostic-output" style="margin:0 0 14px;padding:14px;background:#f3f2f1;border-radius:4px;font:12px/1.55 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;max-height:55vh;overflow:auto;color:#0b0c0c;"></pre>
            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                <button id="dvsa-diagnostic-copy" type="button" class="dvsa-btn">Copy to clipboard</button>
                <button id="dvsa-diagnostic-rerun" type="button" class="dvsa-btn">Re-run</button>
                <button id="dvsa-diagnostic-close" type="button" class="dvsa-btn dvsa-btn-primary">Close</button>
            </div>
        `;
        panel.querySelector('#dvsa-diagnostic-output').textContent = report;

        const copyBtn = panel.querySelector('#dvsa-diagnostic-copy');
        copyBtn.addEventListener('click', () => {
            const text = panel.querySelector('#dvsa-diagnostic-output').textContent;
            navigator.clipboard.writeText(text).then(() => {
                const original = copyBtn.textContent;
                copyBtn.textContent = 'Copied ✓';
                copyBtn.disabled = true;
                setTimeout(() => { copyBtn.textContent = original; copyBtn.disabled = false; }, 1800);
            }).catch(() => {
                copyBtn.textContent = 'Copy failed, select text manually';
            });
        });

        panel.querySelector('#dvsa-diagnostic-rerun').addEventListener('click', () => {
            panel.querySelector('#dvsa-diagnostic-output').textContent = runSelfTestDiagnostic();
        });
        panel.querySelector('#dvsa-diagnostic-close').addEventListener('click', close);
    }

    function closeDiagnosticModal() {
        if (_closeDiagnosticModal) _closeDiagnosticModal();
    }

    // ---- Auto-book consent modal ----
    // One-time informed-consent gate fired before auto-book can be enabled.
    // Lays out what auto-book does, points to the disclaimer's auto-book
    // waiver (DISCLAIMER §8), and requires explicit "I understand" before
    // setting the AUTO_BOOK_ACK_KEY flag. Fires from:
    //   (a) the settings panel when the user transitions the checkbox to
    //       checked AND no prior ack exists
    //   (b) the settings panel save guard when AUTO_BOOK would be saved as
    //       true AND no prior ack exists (catches legacy users who already
    //       had auto-book on from before the consent flow existed)
    // The wizard skips this modal because step 5 already explains auto-book
    // and the welcome step covers the disclaimer; finishWizard() writes the
    // ack flag directly if the user enabled auto-book during setup.
    let _consentEscHandler = null;
    function openAutoBookConsentModal(opts) {
        opts = opts || {};
        if (document.getElementById('dvsa-autobook-consent-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'dvsa-autobook-consent-overlay';
        overlay.className = 'dvsa-consent-overlay';

        const panel = document.createElement('div');
        panel.className = 'dvsa-consent-panel';
        panel.innerHTML = `
            <h2>Enabling auto-book</h2>
            <p>Auto-book goes beyond the alert-only mode. When a matching slot appears, the script will automatically:</p>
            <ul>
                <li>Click the date on the calendar</li>
                <li>Click an available time within your preferred window</li>
                <li>Click <strong>Continue</strong> on DVSA's <em>Warning! You'll lose your current booking</em> modal</li>
            </ul>
            <p>It will <strong>stop</strong> on the <em>Confirm changes</em> page. <strong>You</strong> click the final commit yourself, DVSA holds the slot for 15 minutes once you reach this page, giving you time to verify the date, time, and centre are correct.</p>
            <div class="dvsa-consent-action">
                <strong>By enabling auto-book, you confirm:</strong>
                <ol style="margin: 8px 0 0;">
                    <li>You have an <strong>existing DVSA test booking</strong> and want to reschedule it.</li>
                    <li>You understand the auto-book waiver in <a class="dvsa-consent-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/DISCLAIMER.md#11-auto-book-feature-specific-waiver" target="_blank" rel="noopener noreferrer">DISCLAIMER §11</a>, including that DVSA selectors can shift without notice and the script may occasionally click an unintended element.</li>
                    <li>Any account-level consequences from DVSA (flagged account, voided booking, refused future bookings) are <strong>your responsibility</strong>, not the author's.</li>
                </ol>
            </div>
            <div class="dvsa-consent-footer">
                <a class="dvsa-consent-link" href="https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/blob/main/DISCLAIMER.md" target="_blank" rel="noopener noreferrer">Read full disclaimer ↗</a>
                <span class="dvsa-consent-footer-spacer"></span>
                <button id="dvsa-autobook-consent-cancel" type="button" class="dvsa-btn">Cancel</button>
                <button id="dvsa-autobook-consent-confirm" type="button" class="dvsa-btn dvsa-btn-primary">I understand, enable auto-book</button>
            </div>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const close = () => {
            overlay.remove();
            if (_consentEscHandler) {
                document.removeEventListener('keydown', _consentEscHandler);
                _consentEscHandler = null;
            }
        };

        panel.querySelector('#dvsa-autobook-consent-cancel').addEventListener('click', () => {
            close();
            if (opts.onCancel) opts.onCancel();
        });
        panel.querySelector('#dvsa-autobook-consent-confirm').addEventListener('click', () => {
            setAutoBookAck();
            close();
            if (opts.onConfirm) opts.onConfirm();
        });
        // Esc and overlay click both count as Cancel, explicit choice still
        // required to enable, but no need to trap the user.
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close();
                if (opts.onCancel) opts.onCancel();
            }
        });
        _consentEscHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                if (opts.onCancel) opts.onCancel();
            }
        };
        document.addEventListener('keydown', _consentEscHandler);
    }

    // ---- Backup & restore (config import / export) ----
    // Whitelist of settings keys and their expected JS types. The import path
    // refuses any JSON that contains keys not in this map. Keeps the format
    // explicit and prevents arbitrary localStorage pollution via a malicious
    // import file.
    // ---- Canonical panel field map ----
    // Single source of truth for "what config fields exist, how to read each
    // from the settings panel DOM, how each is typed in JSON, and what the
    // wizard forces on finish". Three writers consume this list:
    //   - readPanelInputs(panel): reads DOM → config object (used by
    //     handlePanelSave and exportPanelConfig)
    //   - finishWizard: reads from _wizardState.config → config object, with
    //     per-field wizardForce overrides
    //   - _ALLOWED_SETTING_KEYS (derived below): the import-validator allowlist
    //     used by parseImportedConfig
    // Adding a new config field means a single entry in this array and that's
    // all (plus wiring whatever input controls the user interacts with).
    const PANEL_FIELD_MAP = [
        { key: 'TARGET_START_DATE',            id: 'dvsa-start',         type: 'trimmedString' },
        { key: 'TARGET_END_DATE',              id: 'dvsa-end',           type: 'trimmedString' },
        { key: 'EXPECTED_CENTRE',              id: 'dvsa-centre',        type: 'trimmedString' },
        { key: 'SEARCH_POSTCODE',              id: 'dvsa-postcode',      type: 'trimmedString' },
        { key: 'REFRESH_MIN_MINS',             id: 'dvsa-refresh-min',   type: 'int' },
        { key: 'REFRESH_MAX_MINS',             id: 'dvsa-refresh-max',   type: 'int' },
        { key: 'EXCLUDE_WEEKENDS',             id: 'dvsa-weekends',      type: 'checkbox' },
        { key: 'WALK_PREV_AVAIL',              id: 'dvsa-walk',          type: 'checkbox' },
        { key: 'MAX_PREV_CLICKS',              id: 'dvsa-walk-max',      type: 'int' },
        { key: 'TEST_MODE',                    id: 'dvsa-test',          type: 'checkbox', wizardForce: false },
        { key: 'MANUAL_TRIGGER',               id: 'dvsa-manual',        type: 'checkbox', wizardForce: false },
        { key: 'AUTO_BOOK',                    id: 'dvsa-autobook',      type: 'checkbox' },
        { key: 'ALERT_ANY_CENTRE',             id: 'dvsa-alert-any',     type: 'checkbox', wizardForce: false },
        { key: 'EARLIEST_TIME',                id: 'dvsa-earliest-time', type: 'trimmedString' },
        { key: 'LATEST_TIME',                  id: 'dvsa-latest-time',   type: 'trimmedString' },
        { key: 'LOGIN_LICENCE_NUMBER',         id: 'dvsa-licence',       type: 'upperTrimmedString', credential: true },
        { key: 'LOGIN_BOOKING_REF',            id: 'dvsa-ref',           type: 'trimmedString',       credential: true },
        { key: 'INSTRUCTOR_UNAVAILABLE_DATES', id: null,                 type: 'instructorDates' }
    ];

    // Read every field from the settings panel DOM and return a config object
    // matching the PANEL_CONFIG_KEY schema. INSTRUCTOR_UNAVAILABLE_DATES comes
    // from the panel's working-copy state (_panelInstructorDates is the source
    // of truth while the panel is open; the pill UI mutates it directly).
    function readPanelInputs(panel) {
        const cfg = {};
        PANEL_FIELD_MAP.forEach(f => {
            if (f.type === 'instructorDates') {
                cfg[f.key] = [..._panelInstructorDates];
                return;
            }
            const el = panel.querySelector('#' + f.id);
            if (!el) { cfg[f.key] = undefined; return; }
            switch (f.type) {
                case 'trimmedString':      cfg[f.key] = (el.value || '').trim(); break;
                case 'upperTrimmedString': cfg[f.key] = (el.value || '').trim().toUpperCase(); break;
                case 'int':                cfg[f.key] = parseInt(el.value, 10); break;
                case 'checkbox':           cfg[f.key] = !!el.checked; break;
                default:                   cfg[f.key] = el.value;
            }
        });
        return cfg;
    }

    // Maps DOM-reading types to JSON-validator types (the simpler set the
    // import validator expects). Derived from PANEL_FIELD_MAP so adding a
    // field automatically extends the import allowlist.
    const _FIELD_TYPE_TO_JSON_TYPE = {
        trimmedString:      'string',
        upperTrimmedString: 'string',
        int:                'number',
        checkbox:           'boolean',
        instructorDates:    'array'
    };
    const _ALLOWED_SETTING_KEYS = Object.fromEntries(
        PANEL_FIELD_MAP.map(f => [f.key, _FIELD_TYPE_TO_JSON_TYPE[f.type] || 'string'])
    );

    // Exports current panel state to a JSON file via a one-shot blob download.
    // `includeCredentials=false` blanks out the licence number + booking ref so
    // a shared config doesn't leak credentials.
    function exportPanelConfig(panel, includeCredentials) {
        const settings = readPanelInputs(panel);
        if (!includeCredentials) {
            // Blank out credential fields (licence number, booking ref) so a
            // shared export can't leak login details. Driven by the
            // `credential: true` flag in PANEL_FIELD_MAP.
            PANEL_FIELD_MAP.filter(f => f.credential).forEach(f => {
                settings[f.key] = '';
            });
        }

        const payload = {
            _meta: {
                source:             'dvsa-watcher',
                version:            SCRIPT_VERSION,
                exportedAt:         new Date().toISOString(),
                includesCredentials: !!includeCredentials
            },
            settings: settings
        };

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const isoDate = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `dvsa-watcher-config-${isoDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log(`Config exported${includeCredentials ? ' (incl. credentials)' : ' (credentials skipped)'}.`);
    }

    // Read + validate a JSON config file. Returns { ok, settings, meta, error }.
    function parseImportedConfig(text) {
        let parsed;
        try { parsed = JSON.parse(text); }
        catch (e) { return { ok: false, error: 'File is not valid JSON.' }; }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: 'File is not a config object.' };
        }
        const meta = parsed._meta || {};
        if (meta.source !== 'dvsa-watcher') {
            return { ok: false, error: 'This doesn\'t look like a DVSA Earlier Slot Watcher config file (missing _meta.source).' };
        }
        const settings = parsed.settings;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            return { ok: false, error: 'Missing or invalid "settings" object.' };
        }
        const unknownKeys = Object.keys(settings).filter(k => !(k in _ALLOWED_SETTING_KEYS));
        if (unknownKeys.length) {
            return { ok: false, error: `Unknown settings keys: ${unknownKeys.join(', ')}` };
        }
        const typeErrors = [];
        Object.entries(settings).forEach(([k, v]) => {
            const expected = _ALLOWED_SETTING_KEYS[k];
            const actual = expected === 'array' ? (Array.isArray(v) ? 'array' : typeof v) : typeof v;
            if (actual !== expected) typeErrors.push(`${k} (expected ${expected}, got ${actual})`);
        });
        if (typeErrors.length) {
            return { ok: false, error: `Type errors: ${typeErrors.join('; ')}` };
        }
        return { ok: true, settings, meta };
    }

    // Build a human-readable summary of a parsed config for the confirm dialog.
    function summariseImportedConfig(s, meta) {
        const lines = [];
        if (meta.exportedAt) {
            const exportedDate = new Date(meta.exportedAt);
            if (!isNaN(exportedDate)) {
                lines.push(`Exported: ${exportedDate.toLocaleString('en-GB')}`);
            }
        }
        lines.push('');
        if (s.TARGET_START_DATE && s.TARGET_END_DATE) {
            lines.push(`• Date window: ${s.TARGET_START_DATE} → ${s.TARGET_END_DATE}`);
        }
        if (s.EXPECTED_CENTRE)    lines.push(`• Test centre: ${s.EXPECTED_CENTRE}`);
        if (s.SEARCH_POSTCODE)    lines.push(`• Search term: ${s.SEARCH_POSTCODE}`);
        if (s.REFRESH_MIN_MINS != null && s.REFRESH_MAX_MINS != null) {
            lines.push(`• Refresh: ${s.REFRESH_MIN_MINS}–${s.REFRESH_MAX_MINS} min`);
        }
        if (Array.isArray(s.INSTRUCTOR_UNAVAILABLE_DATES) && s.INSTRUCTOR_UNAVAILABLE_DATES.length) {
            lines.push(`• ${s.INSTRUCTOR_UNAVAILABLE_DATES.length} instructor unavailable dates`);
        }
        lines.push(`• Auto-book: ${s.AUTO_BOOK ? 'on' : 'off'}`);
        lines.push(`• Exclude weekends: ${s.EXCLUDE_WEEKENDS ? 'yes' : 'no'}`);
        lines.push(`• Alert any centre: ${s.ALERT_ANY_CENTRE ? 'on' : 'off'}`);
        if (s.EARLIEST_TIME && s.LATEST_TIME) {
            lines.push(`• Auto-book time window: ${s.EARLIEST_TIME}–${s.LATEST_TIME}`);
        }
        if (s.LOGIN_LICENCE_NUMBER || s.LOGIN_BOOKING_REF) {
            lines.push('• Auto-login: credentials included');
        } else {
            lines.push('• Auto-login: credentials skipped (manual login)');
        }
        return lines.join('\n');
    }

    // Apply an imported config. Merges with currently-saved panel config so
    // missing keys keep their existing values. Reloads the page on success.
    function applyImportedConfig(settings) {
        let current = {};
        try { current = JSON.parse(localStorage.getItem(PANEL_CONFIG_KEY) || '{}'); }
        catch (e) { current = {}; }
        const merged = { ...current, ...settings };
        try {
            localStorage.setItem(PANEL_CONFIG_KEY, JSON.stringify(merged));
            log('Config imported. Reloading.');
            window.location.reload();
        } catch (e) {
            log(`Import failed: ${e.message}`);
            window.alert('Failed to save imported config: ' + e.message);
        }
    }

    function wireBackupHandlers(panel) {
        const exportBtn  = panel.querySelector('#dvsa-export-config');
        const importBtn  = panel.querySelector('#dvsa-import-config');
        const fileInput  = panel.querySelector('#dvsa-import-input');
        const credCheck  = panel.querySelector('#dvsa-export-creds');
        const errSlot    = panel.querySelector('#dvsa-err-backup');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (errSlot) errSlot.textContent = '';
                try {
                    exportPanelConfig(panel, !!(credCheck && credCheck.checked));
                } catch (e) {
                    if (errSlot) errSlot.textContent = 'Export failed: ' + e.message;
                }
            });
        }

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                if (errSlot) errSlot.textContent = '';
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const result = parseImportedConfig(String(reader.result || ''));
                    if (!result.ok) {
                        if (errSlot) errSlot.textContent = result.error;
                        fileInput.value = '';   // allow re-picking the same file after fixing
                        return;
                    }
                    const summary = summariseImportedConfig(result.settings, result.meta);
                    const confirmMsg = `Restore these settings from "${file.name}"?\n\n${summary}\n\nThis will overwrite your current panel config and reload the page. Click OK to apply.`;
                    if (window.confirm(confirmMsg)) {
                        applyImportedConfig(result.settings);
                    } else {
                        fileInput.value = '';
                    }
                };
                reader.onerror = () => {
                    if (errSlot) errSlot.textContent = 'Could not read file.';
                };
                reader.readAsText(file);
            });
        }
    }

    // ---- Mask-toggle handlers ----
    // Each .dvsa-mask-toggle button flips its target input between
    // type="password" (masked) and type="text" (revealed). State is per
    // panel-open: every reopen defaults back to masked for safety. Icon
    // swaps to "eye-off" when revealed.
    function wireMaskToggles(panel) {
        panel.querySelectorAll('.dvsa-mask-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = panel.querySelector(`#${targetId}`);
                if (!input) return;
                const revealed = input.type === 'text';
                input.type = revealed ? 'password' : 'text';
                btn.innerHTML = dvsaIcon(revealed ? 'eye' : 'eye-off', 14);
                btn.setAttribute('aria-pressed', String(!revealed));
            });
        });
    }

    // ---- Test centre combobox ----
    // Searchable dropdown over KNOWN_TEST_CENTRES + getDiscoveredCentres().
    // Accepts any custom value (DVSA centre-mismatch check is the safety net).
    // Keyboard: ArrowDown/Up to navigate, Enter to select, Escape to close, Tab
    // closes without selecting.
    function wireCentreCombobox(panel) {
        const wrap   = panel.querySelector('#dvsa-centre-combo');
        const input  = panel.querySelector('#dvsa-centre');
        const toggle = wrap ? wrap.querySelector('.dvsa-combo-toggle') : null;
        const list   = panel.querySelector('#dvsa-centre-listbox');
        const hint   = panel.querySelector('#dvsa-centre-custom-hint');
        if (!wrap || !input || !toggle || !list) return;

        const allCentres = getAllKnownCentres();
        const MAX_VISIBLE = 80;
        let activeIndex = -1;
        let lastOptions = [];   // array of { value, isCustom, isDiscovered }

        const isKnown = (val) => {
            if (!val) return false;
            const v = val.trim().toLowerCase();
            return allCentres.some(c => c.toLowerCase() === v);
        };

        const updateCustomState = () => {
            const v = input.value.trim();
            const custom = !!v && !isKnown(v);
            input.classList.toggle('dvsa-custom-value', custom);
            if (hint) hint.classList.toggle('is-shown', custom);
        };

        const highlightMatch = (label, query) => {
            if (!query) return escapeAttr(label);
            const idx = label.toLowerCase().indexOf(query.toLowerCase());
            if (idx < 0) return escapeAttr(label);
            return escapeAttr(label.slice(0, idx)) +
                   '<span class="dvsa-combo-match">' + escapeAttr(label.slice(idx, idx + query.length)) + '</span>' +
                   escapeAttr(label.slice(idx + query.length));
        };

        const renderOptions = (query) => {
            const q = (query || '').trim();
            const ql = q.toLowerCase();
            const discoveredSet = new Set(getDiscoveredCentres().map(c => c.toLowerCase()));

            let matches = ql
                ? allCentres.filter(c => c.toLowerCase().includes(ql))
                : allCentres.slice();

            // Stable ordering: exact matches first, then startsWith, then includes
            if (ql) {
                matches.sort((a, b) => {
                    const al = a.toLowerCase(), bl = b.toLowerCase();
                    const aRank = al === ql ? 0 : al.startsWith(ql) ? 1 : 2;
                    const bRank = bl === ql ? 0 : bl.startsWith(ql) ? 1 : 2;
                    if (aRank !== bRank) return aRank - bRank;
                    return a.localeCompare(b, 'en-GB');
                });
            }

            const truncated = matches.length > MAX_VISIBLE;
            const shown = matches.slice(0, MAX_VISIBLE);
            const exactMatch = ql && matches.some(c => c.toLowerCase() === ql);
            const showCustomEntry = ql && !exactMatch;

            lastOptions = shown.map(name => ({
                value: name,
                isCustom: false,
                isDiscovered: discoveredSet.has(name.toLowerCase())
            }));
            if (showCustomEntry) {
                lastOptions.push({ value: q, isCustom: true, isDiscovered: false });
            }

            if (lastOptions.length === 0) {
                list.innerHTML = '<div class="dvsa-combo-empty">No centres match. Type to use as a custom value.</div>';
                activeIndex = -1;
                return;
            }

            const html = lastOptions.map((opt, i) => {
                const cls = [
                    'dvsa-combo-option',
                    opt.isCustom ? 'is-custom' : '',
                    !opt.isCustom && input.value.trim().toLowerCase() === opt.value.toLowerCase() ? 'is-selected' : ''
                ].filter(Boolean).join(' ');
                const label = opt.isCustom
                    ? `Use custom value: "<span class="dvsa-combo-match">${escapeAttr(opt.value)}</span>"`
                    : highlightMatch(opt.value, ql);
                const tag = opt.isDiscovered
                    ? '<span class="dvsa-combo-tag" title="Captured from a DVSA page">Discovered</span>'
                    : '';
                return `<div class="${cls}" role="option" data-index="${i}" data-value="${escapeAttr(opt.value)}" data-custom="${opt.isCustom ? '1' : '0'}"><span>${label}</span>${tag}</div>`;
            }).join('') + (truncated ? `<div class="dvsa-combo-empty">+${matches.length - MAX_VISIBLE} more, keep typing to narrow down…</div>` : '');

            list.innerHTML = html;
            activeIndex = lastOptions.length ? 0 : -1;
            updateActiveOption();
        };

        const updateActiveOption = () => {
            const opts = list.querySelectorAll('.dvsa-combo-option');
            opts.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
            const active = opts[activeIndex];
            if (active) active.scrollIntoView({ block: 'nearest' });
        };

        const openList = () => {
            if (wrap.dataset.open === 'true') return;
            renderOptions(input.value);
            list.hidden = false;
            wrap.dataset.open = 'true';
            input.setAttribute('aria-expanded', 'true');
        };

        const closeList = () => {
            if (wrap.dataset.open !== 'true') return;
            list.hidden = true;
            wrap.dataset.open = 'false';
            input.setAttribute('aria-expanded', 'false');
            activeIndex = -1;
        };

        const selectOption = (opt) => {
            if (!opt) return;
            input.value = opt.value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            updateCustomState();
            closeList();
            input.focus();
        };

        // ---- Event wiring ----
        input.addEventListener('focus', () => { openList(); input.select(); });
        input.addEventListener('click', () => openList());
        input.addEventListener('input', () => { openList(); renderOptions(input.value); updateCustomState(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (wrap.dataset.open !== 'true') openList();
                if (lastOptions.length) { activeIndex = (activeIndex + 1) % lastOptions.length; updateActiveOption(); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (wrap.dataset.open !== 'true') { openList(); return; }
                if (lastOptions.length) { activeIndex = (activeIndex - 1 + lastOptions.length) % lastOptions.length; updateActiveOption(); }
            } else if (e.key === 'Enter') {
                if (wrap.dataset.open === 'true' && activeIndex >= 0) {
                    e.preventDefault();
                    selectOption(lastOptions[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                if (wrap.dataset.open === 'true') { e.preventDefault(); closeList(); }
            } else if (e.key === 'Tab') {
                closeList();
            } else if (e.key === 'Home' || e.key === 'End') {
                if (wrap.dataset.open === 'true' && lastOptions.length) {
                    e.preventDefault();
                    activeIndex = e.key === 'Home' ? 0 : lastOptions.length - 1;
                    updateActiveOption();
                }
            }
        });
        input.addEventListener('blur', () => {
            // Defer so option clicks register before close
            setTimeout(() => {
                if (!wrap.contains(document.activeElement)) closeList();
                updateCustomState();
            }, 120);
        });
        toggle.addEventListener('mousedown', (e) => {
            // Prevent stealing focus from input
            e.preventDefault();
            if (wrap.dataset.open === 'true') {
                closeList();
            } else {
                input.focus();
                openList();
            }
        });
        list.addEventListener('mousedown', (e) => {
            const opt = e.target.closest('.dvsa-combo-option');
            if (!opt) return;
            e.preventDefault();
            const idx = parseInt(opt.dataset.index, 10);
            selectOption(lastOptions[idx]);
        });
        list.addEventListener('mousemove', (e) => {
            const opt = e.target.closest('.dvsa-combo-option');
            if (!opt) return;
            const idx = parseInt(opt.dataset.index, 10);
            if (idx !== activeIndex) { activeIndex = idx; updateActiveOption(); }
        });

        // Initial custom-value check (in case the saved EXPECTED_CENTRE isn't in the list)
        updateCustomState();
    }

    function handlePanelSave(panel) {
        // Run every validator. Each call writes its own error slot + input ring.
        const groups = ['dates', 'centre', 'refresh', 'filters', 'login', 'instructor', 'autobook'];
        let ok = true;
        groups.forEach(g => {
            const err = _validateGroup(panel, g);
            _setFieldError(panel, g, err);
            if (err) ok = false;
        });

        if (!ok) {
            const firstWithText = Array.from(panel.querySelectorAll('[id^="dvsa-err-"]')).find(el => el.textContent);
            if (firstWithText) firstWithText.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Auto-book consent guard. Catches legacy users (auto-book already on
        // from before the consent flow existed) at the commit point. Live
        // change-listener handles the "user just ticked it" path; this is the
        // safety net for the "auto-book was already on" path.
        const willEnableAutoBook = !!(panel.querySelector('#dvsa-autobook') && panel.querySelector('#dvsa-autobook').checked);
        if (willEnableAutoBook && !getAutoBookAck()) {
            openAutoBookConsentModal({
                onConfirm: () => handlePanelSave(panel),   // re-enter save now that ack is set
                onCancel:  () => {
                    // User backed out. Revert the checkbox and abort the save.
                    const cb = panel.querySelector('#dvsa-autobook');
                    if (cb) cb.checked = false;
                }
            });
            return;
        }

        const cfg = readPanelInputs(panel);

        try {
            localStorage.setItem(PANEL_CONFIG_KEY, JSON.stringify(cfg));
            log('Settings saved. Reloading.');
            window.location.reload();
        } catch (e) {
            const dst = panel.querySelector('#dvsa-err-dates');
            if (dst) dst.textContent = 'Save failed: ' + e.message;
        }
    }

    function handlePanelReset() {
        if (!window.confirm('Reset all settings to the values hardcoded in the script? Your panel-saved overrides will be wiped.')) return;
        localStorage.removeItem(PANEL_CONFIG_KEY);
        log('Panel config cleared. Reloading.');
        window.location.reload();
    }

    // ---- History panel ----
    // Modal showing every recorded finding (matches + spotted dates) with stats,
    // filter buttons, and export/copy/clear actions. Opened from the settings
    // panel "View scan history" button or via dvsaWatcher.history() in DevTools.

    let _historyFilter = 'all';     // 'all' | 'match' | 'spotted'
    let _historyGrouped = false;    // false = one row per sighting, true = group by (date, type, note)
    // Settings-panel state: working copy of the instructor-date list while
    // the panel is open. Hydrated from INSTRUCTOR_UNAVAILABLE_DATES when the
    // panel opens; written back to localStorage on Save. Sorted ascending.
    let _panelInstructorDates = [];

    function openHistoryPanel() {
        // panelFlexColumn:true so the footer (Export/Copy/Clear/Close) stays
        // anchored at the bottom of the visible panel regardless of how many
        // history rows exist. The table region inside buildHistoryHTML uses
        // flex:1 + overflow-y:auto to scroll independently; header and
        // footer flex-shrink:0 to hold their natural sizes.
        const modal = createModalOverlay({
            id: 'dvsa-history-panel',
            panelWidth: 820,
            panelFlexColumn: true,
            onClose: () => { _closeHistoryPanel = null; }
        });
        if (!modal) return;
        const { panel } = modal;
        _closeHistoryPanel = modal.close;
        renderHistoryPanel(panel);
    }

    function closeHistoryPanel() {
        if (_closeHistoryPanel) _closeHistoryPanel();
    }

    function renderHistoryPanel(panel) {
        panel.innerHTML = buildHistoryHTML();

        panel.querySelector('#dvsa-hist-close').addEventListener('click', closeHistoryPanel);

        const exportBtn = panel.querySelector('#dvsa-hist-export');
        if (exportBtn && !exportBtn.disabled) exportBtn.addEventListener('click', () => exportFindings());

        const copyBtn = panel.querySelector('#dvsa-hist-copy');
        if (copyBtn && !copyBtn.disabled) copyBtn.addEventListener('click', () => copyFindingsToClipboard());

        const clearBtn = panel.querySelector('#dvsa-hist-clear');
        if (clearBtn && !clearBtn.disabled) {
            clearBtn.addEventListener('click', () => {
                if (!window.confirm('Wipe all scan history and cycle counts? This cannot be undone.')) return;
                clearFindings();
                renderHistoryPanel(panel);
            });
        }

        panel.querySelectorAll('[data-filter]').forEach(b => {
            b.addEventListener('click', () => {
                _historyFilter = b.dataset.filter;
                renderHistoryPanel(panel);
            });
        });

        const groupBtn = panel.querySelector('#dvsa-hist-group');
        if (groupBtn) groupBtn.addEventListener('click', () => {
            _historyGrouped = !_historyGrouped;
            renderHistoryPanel(panel);
        });
    }

    function buildHistoryHTML() {
        const findings = getFindings();
        const cycles = getCycles();
        const matches = findings.filter(f => f.type === 'match');
        const nearby  = findings.filter(f => f.type === 'nearby');
        const spotted = findings.filter(f => f.type === 'spotted');

        let statsBlock;
        if (cycles.count) {
            const first = cycles.first ? new Date(cycles.first).toLocaleString('en-GB') : '-';
            const last  = cycles.last  ? new Date(cycles.last).toLocaleString('en-GB')  : '-';
            const hours = cycles.first ? ((Date.now() - new Date(cycles.first).getTime()) / 3600000).toFixed(1) : '0';
            const findRate = cycles.count ? ((findings.length / cycles.count) * 100).toFixed(1) : '0';
            const fStats = computeFindingStats(findings);
            const leadStr = fStats.avgLeadDays != null ? `${fStats.avgLeadDays.toFixed(1)}d` : '-';
            const lastStr = fStats.lastFindingMs != null ? formatRelativeAgo(fStats.lastFindingMs) : '-';
            const tile = (label, value, cls, sub) => `
                <div class="dvsa-kpi-tile">
                    <div class="dvsa-kpi-label">${label}</div>
                    <div class="dvsa-kpi-value${cls ? ' ' + cls : ''}${value === 0 || value === '-' ? ' is-empty' : ''}">${value}</div>
                    ${sub ? `<div class="dvsa-kpi-sub">${sub}</div>` : ''}
                </div>
            `;
            statsBlock = `
                <div class="dvsa-kpi-grid" style="flex-shrink:0;">
                    ${tile('Scans',     cycles.count,        '', '')}
                    ${tile('Matches',   matches.length,      'is-match', '')}
                    ${tile('Nearby',    nearby.length,       'is-nearby', '')}
                    ${tile('Spotted',   spotted.length,      '', '')}
                    ${tile('Find rate', `${findRate}%`,      '', `${findings.length} of ${cycles.count} scans`)}
                    ${tile('Last 7 days', fStats.last7,      '', `${findings.length ? Math.round(fStats.last7 / Math.max(findings.length, 1) * 100) + '% of all' : 'no findings yet'}`)}
                    ${tile('Avg lead',  leadStr,             '', 'spot → test date')}
                    ${tile('Last spotted', lastStr,          '', '')}
                    <div class="dvsa-kpi-period">
                        Period: <strong>${escapeAttr(first)}</strong> → <strong>${escapeAttr(last)}</strong> (${hours} hours of monitoring)
                    </div>
                </div>
            `;
        } else {
            statsBlock = '<p style="color:#505a5f;margin:0 0 16px;padding:12px;background:#f3f2f1;border-radius:4px;flex-shrink:0;">No scans recorded yet. The script logs each refresh cycle when it completes.</p>';
        }

        const filterBtn = (key, label, count) => {
            const active = _historyFilter === key;
            return `<button data-filter="${key}" type="button" style="padding:6px 12px;background:${active ? '#0b0c0c' : '#fff'};color:${active ? '#fff' : '#0b0c0c'};border:1px solid #b1b4b6;border-radius:4px;cursor:pointer;font:600 12px system-ui,sans-serif;">${label} (${count})</button>`;
        };
        const groupBtnLabel = _historyGrouped ? '≡ Show all sightings' : '≡ Group duplicates';
        const groupBtnHtml = `<button id="dvsa-hist-group" type="button" style="padding:6px 12px;background:${_historyGrouped ? '#0b0c0c' : '#fff'};color:${_historyGrouped ? '#fff' : '#0b0c0c'};border:1px solid #b1b4b6;border-radius:4px;cursor:pointer;font:600 12px system-ui,sans-serif;" title="Toggle between one row per sighting and one row per unique (date, centre) combo">${groupBtnLabel}</button>`;
        const filterRow = `
            <div style="display:flex;gap:6px;margin:0 0 12px;align-items:center;flex-wrap:wrap;flex-shrink:0;">
                <span style="color:#505a5f;font-size:12px;margin-right:4px;">Filter:</span>
                ${filterBtn('all',     'All',     findings.length)}
                ${filterBtn('match',   'Matches', matches.length)}
                ${filterBtn('nearby',  'Nearby',  nearby.length)}
                ${filterBtn('spotted', 'Spotted', spotted.length)}
                <span style="flex:1;"></span>
                ${groupBtnHtml}
            </div>
        `;

        const filtered = _historyFilter === 'match'   ? matches
                       : _historyFilter === 'nearby'  ? nearby
                       : _historyFilter === 'spotted' ? spotted
                       : findings;

        // Build row-data, either flat (one row per finding, dates joined) or
        // grouped (one row per unique (date, type, note) tuple with sighting count).
        let rowData;
        if (_historyGrouped) {
            const groups = new Map();
            filtered.forEach(f => {
                (f.dates || []).forEach(d => {
                    const key = `${d}|${f.type}|${f.note || ''}`;
                    let g = groups.get(key);
                    if (!g) {
                        g = { date: d, type: f.type, note: f.note || '', count: 0, firstTs: f.ts, lastTs: f.ts };
                        groups.set(key, g);
                    }
                    g.count++;
                    if (new Date(f.ts).getTime() < new Date(g.firstTs).getTime()) g.firstTs = f.ts;
                    if (new Date(f.ts).getTime() > new Date(g.lastTs).getTime()) g.lastTs = f.ts;
                });
            });
            rowData = Array.from(groups.values()).sort((a, b) =>
                new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()
            );
        } else {
            rowData = [...filtered].reverse().map(f => ({
                date: (f.dates || []).join(', '),
                type: f.type,
                note: f.note || '',
                count: 1,
                firstTs: f.ts,
                lastTs: f.ts
            }));
        }

        let rowsHtml;
        if (!rowData.length) {
            const msg = findings.length
                ? `No ${_historyFilter} entries. Switch filter to see other types.`
                : 'No findings logged yet. They will appear here once the script detects bookable dates.';
            rowsHtml = `<tr><td colspan="4" style="padding:32px;text-align:center;color:#505a5f;">${msg}</td></tr>`;
        } else {
            rowsHtml = rowData.map(r => {
                const time = new Date(r.lastTs).toLocaleString('en-GB');
                const typeBg = r.type === 'match'  ? '#00703c'
                             : r.type === 'nearby' ? '#1d70b8'
                             : '#505a5f';
                const countBadge = (_historyGrouped && r.count > 1)
                    ? ` <span style="background:#0b0c0c;color:#fff;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:bold;margin-left:4px;">×${r.count}</span>`
                    : '';
                return `
                    <tr style="border-top:1px solid #f3f2f1;">
                        <td style="padding:8px 10px;white-space:nowrap;font-size:12px;color:#505a5f;font-variant-numeric:tabular-nums;">${escapeAttr(time)}${countBadge}</td>
                        <td style="padding:8px 10px;"><span style="background:${typeBg};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">${escapeAttr(r.type)}</span></td>
                        <td style="padding:8px 10px;font-family:ui-monospace,Menlo,monospace;font-size:12px;">${escapeAttr(r.date)}</td>
                        <td style="padding:8px 10px;font-size:12px;color:#505a5f;">${escapeAttr(r.note)}</td>
                    </tr>
                `;
            }).join('');
        }

        const hasData = findings.length > 0;
        const hasAnything = hasData || cycles.count > 0;

        return `
            <h2 style="margin:0 0 16px;font-size:20px;flex-shrink:0;">Scan history</h2>
            ${statsBlock}
            ${filterRow}
            <div style="border:1px solid #b1b4b6;border-radius:4px;overflow:hidden;margin:0 0 8px;flex:1 1 auto;min-height:120px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f3f2f1;font-size:11px;text-transform:uppercase;color:#505a5f;letter-spacing:0.3px;">
                            <th style="padding:10px;text-align:left;width:160px;">${_historyGrouped ? 'Last seen' : 'Timestamp'}</th>
                            <th style="padding:10px;text-align:left;width:90px;">Type</th>
                            <th style="padding:10px;text-align:left;width:200px;">${_historyGrouped ? 'Date' : 'Dates'}</th>
                            <th style="padding:10px;text-align:left;">Note</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <p style="margin:0 0 10px;font-size:11px;color:#505a5f;text-align:center;flex-shrink:0;">
                History is capped at the most recent ${STORAGE_MAX.toLocaleString()} entries; older ones are removed as new findings come in. Use <strong>Export CSV</strong> to keep a permanent record.
            </p>
            <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;flex-shrink:0;padding-top:12px;border-top:1px solid #f3f2f1;">
                <div style="display:flex;gap:8px;">
                    <button id="dvsa-hist-export" type="button" style="padding:8px 12px;background:#fff;border:1px solid #b1b4b6;border-radius:4px;cursor:${hasData ? 'pointer' : 'not-allowed'};opacity:${hasData ? '1' : '0.5'};font:14px system-ui,sans-serif;" ${hasData ? '' : 'disabled'}>Export CSV</button>
                    <button id="dvsa-hist-copy" type="button" style="padding:8px 12px;background:#fff;border:1px solid #b1b4b6;border-radius:4px;cursor:${hasData ? 'pointer' : 'not-allowed'};opacity:${hasData ? '1' : '0.5'};font:14px system-ui,sans-serif;" ${hasData ? '' : 'disabled'}>Copy to clipboard</button>
                    <button id="dvsa-hist-clear" type="button" style="padding:8px 12px;background:#fff;border:1px solid #d4351c;color:#d4351c;border-radius:4px;cursor:${hasAnything ? 'pointer' : 'not-allowed'};opacity:${hasAnything ? '1' : '0.5'};font:14px system-ui,sans-serif;" ${hasAnything ? '' : 'disabled'}>Clear all</button>
                </div>
                <button id="dvsa-hist-close" type="button" style="padding:8px 16px;background:#fff;border:1px solid #b1b4b6;border-radius:4px;cursor:pointer;font:14px system-ui,sans-serif;">Close</button>
            </div>
        `;
    }

    // Expose console shortcuts so panels can be opened from DevTools too
    try {
        if (window.dvsaWatcher) {
            window.dvsaWatcher.settings = () => openSettingsPanel();
            window.dvsaWatcher.history = () => openHistoryPanel();
            window.dvsaWatcher.pause = () => togglePause();
            window.dvsaWatcher.isPaused = () => isPaused();
        }
    } catch (e) { /* ignore */ }

    // Shared between the real alert beep loop and the panel's "Test alert" button.
    // Plays a single 4-note burst (~1.4s). Returns silently if the audio context
    // hasn't been primed by a user gesture yet.
    function playBeepBurst() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        let t = audioCtx.currentTime;
        for (let i = 0; i < 4; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = 880 + (i % 2 === 0 ? 0 : 220);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.start(t);
            osc.stop(t + 0.3);
            t += 0.35;
        }
    }

    function beepLoop() {
        playBeepBurst();
        // Cap at ~5 minutes (75 × 4s) and stop early if the alert is acknowledged.
        // Without a cap, beeps would continue forever after you've grabbed the slot.
        let bursts = 1;
        const BURST_CAP = 75;
        const beepInterval = setInterval(() => {
            if (bursts++ >= BURST_CAP || document.body.dataset.alertAcknowledged) {
                clearInterval(beepInterval);
                return;
            }
            playBeepBurst();
        }, 4000);
    }

    // Fire the full alert chain (banner + title flash + OS notification + audio)
    // without touching scanner state. Used by the "Test alert" button in the
    // settings panel so users can verify their setup works.
    //
    // Hammer-protected: re-clicking while a test is running is a no-op (otherwise
    // banners, title flashes, and beeps would stack). Manual cancel: × on the
    // banner or click the banner itself.
    let _testActive = false;
    const _testTimers = { intervals: [], timeouts: [] };
    let _testBaseTitle = null;

    function cancelTestAlert() {
        if (!_testActive) return;

        _testTimers.intervals.forEach(clearInterval);
        _testTimers.timeouts.forEach(clearTimeout);
        _testTimers.intervals.length = 0;
        _testTimers.timeouts.length = 0;

        const banner = document.getElementById('dvsa-test-banner');
        if (banner) banner.remove();

        if (_testBaseTitle !== null) {
            document.title = _testBaseTitle;
            _testBaseTitle = null;
        }

        // Stop the OS notification burst by setting the acknowledge flag the
        // burst function checks before chaining. Clear it after the burst would
        // have completed so future real alerts aren't affected.
        document.body.dataset.alertAcknowledged = '1';
        setTimeout(() => { delete document.body.dataset.alertAcknowledged; }, 2000);

        _testActive = false;

        // Re-enable the Test alert button(s) in any open settings panel.
        // The `.dvsa-btn:disabled` CSS handles the visual state automatically.
        document.querySelectorAll('#dvsa-test-alert').forEach(b => {
            b.disabled = false;
            b.textContent = 'Test alert';
        });
    }

    function fireTestAlert() {
        if (_testActive) {
            log('Test alert already running. Use the × on the banner to cancel, or wait for the 10s auto-dismiss.');
            // Briefly flash the existing banner to draw the eye
            const banner = document.getElementById('dvsa-test-banner');
            if (banner) {
                banner.style.transition = 'transform .15s ease';
                banner.style.transform = 'scale(1.02)';
                setTimeout(() => { banner.style.transform = 'scale(1)'; }, 150);
            }
            return;
        }
        _testActive = true;
        log('TEST ALERT triggered from settings panel.');

        // Disable the Test alert button(s) for the duration, CSS handles visual state
        document.querySelectorAll('#dvsa-test-alert').forEach(b => {
            b.disabled = true;
            b.textContent = 'Test running…';
        });

        // Orange banner so it's visually distinct from a real (green) match.
        // Whole banner is clickable to dismiss; explicit × button for clarity.
        const banner = document.createElement('div');
        banner.id = 'dvsa-test-banner';
        banner.className = 'dvsa-banner dvsa-banner-dismissable';
        banner.style.background = '#f47738';
        banner.textContent = 'TEST ALERT, this is what a real match looks like. Click anywhere to dismiss.';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.title = 'Dismiss test alert';
        closeBtn.textContent = '×';
        closeBtn.className = 'dvsa-banner-close';
        banner.appendChild(closeBtn);

        banner.addEventListener('click', cancelTestAlert);
        document.body.prepend(banner);

        // Auto-dismiss after 10s
        _testTimers.timeouts.push(setTimeout(cancelTestAlert, 10000));

        // Title flash, 20 flips (~14 seconds). Test alert manages its own
        // lifecycle (auto-dismiss, manual click, cancelTestAlert) so it doesn't
        // stop on global alertAcknowledged — that flag is for real alerts and
        // should not let a real alert terminate the test alert mid-flow (or
        // vice versa). Title is restored to whatever was there before the test
        // started; _testBaseTitle is cleared via onComplete so a second test
        // alert can capture a fresh baseline.
        _testBaseTitle = document.title;
        _testTimers.intervals.push(flashTitle(
            '>>> TEST ALERT <<<',
            '>>> CHECK YOUR ALERTS <<<',
            {
                intervalMs: 700,
                maxFlips: 20,
                restoreTo: _testBaseTitle,
                stopOnAcknowledged: false,
                onComplete: () => { _testBaseTitle = null; }
            }
        ));

        // OS notification burst,3 chimes is enough to verify
        fireOSNotificationBurst(
            'DVSA Earlier Slot Watcher: TEST ALERT',
            'Your alert chain is wired up. This is a test, not a real match.',
            'dvsa-test',
            3,
            1500
        );

        // Audio: immediate burst + one ~1.5s later, then silence
        playBeepBurst();
        _testTimers.timeouts.push(setTimeout(playBeepBurst, 1500));
    }

    function fireAlert(dates) {
        if (document.body.dataset.slotFound) return;
        document.body.dataset.slotFound = '1';
        log('MATCH FOUND:', dates);
        recordFinding('match', dates);
        setStatus({ state: STATUS_STATE.MATCH, label: dates.join(', ') });

        // Flashing title, capped so it doesn't run forever after you grab the
        // slot. ~5 minutes of flashing at 700ms is plenty to get your attention.
        flashTitle(
            `>>> SLOT ${dates[0]} <<<`,
            `>>> GRAB IT NOW <<<`,
            { intervalMs: 700, maxFlips: 430 }
        );

        // Big in-page banner with link to the date
        const banner = document.createElement('div');
        banner.className = 'dvsa-banner';
        banner.style.background = '#00703c';
        banner.innerHTML = `EARLIER SLOT AVAILABLE: ${dates.join(', ')} &mdash; book it now`;
        document.body.prepend(banner);

        // Try to scroll the first matching date into view
        const firstLink = document.querySelector(`a.BookingCalendar-dateLink[data-date="${dates[0]}"]`);
        if (firstLink) firstLink.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // OS notification burst - 5 chimes over ~7 seconds. Works without page audio gesture.
        // This is the primary audible cue. Each notification replaces the prior one (same tag)
        // so visually it's a single popup, but the sound plays for each fire.
        fireOSNotificationBurst(
            'DVSA: earlier slot available',
            `${EXPECTED_CENTRE}: ${dates.join(', ')}. Open the tab and book.`,
            'dvsa-match',
            5,
            1500
        );

        // Web Audio beeps as bonus (only works if page audio context was primed by click)
        beepLoop();
    }

    // ---- Nearby-centre alert (ALERT_ANY_CENTRE) ----
    // Soft FYI when a non-target centre has availability. Distinct visual
    // identity (blue banner vs. green target match / red ready-to-book) so the
    // user knows at a glance which fired. Single audio chime, not the looped
    // alarm. Does NOT set slotFound, monitoring continues. Does NOT trigger
    // auto-book (which is target-centre only).

    const ALERTED_NEARBY_KEY = 'dvsa-watcher-alerted-nearby';

    function hasAlertedNearby(centre, date) {
        try {
            const arr = JSON.parse(sessionStorage.getItem(ALERTED_NEARBY_KEY) || '[]');
            return arr.indexOf(`${centre}|${date}`) !== -1;
        } catch (e) { return false; }
    }

    function markAlertedNearby(centre, date) {
        try {
            const arr = JSON.parse(sessionStorage.getItem(ALERTED_NEARBY_KEY) || '[]');
            const key = `${centre}|${date}`;
            if (arr.indexOf(key) === -1) arr.push(key);
            // Cap to 200 entries to bound memory
            sessionStorage.setItem(ALERTED_NEARBY_KEY, JSON.stringify(arr.slice(-200)));
        } catch (e) { /* ignore */ }
    }

    function fireNearbyAlert(centreName, date) {
        log(`NEARBY ALERT: ${centreName} has availability around ${date}.`);
        recordFinding('nearby', [date], `${centreName} (alert fired - non-target centre)`);

        // Blue banner, distinct from target match (green) and ready-to-book (red).
        // Inserted below any existing banner so it doesn't displace a real match alert.
        const banner = document.createElement('div');
        banner.className = 'dvsa-banner dvsa-banner-small dvsa-banner-dismissable dvsa-banner-low-z dvsa-nearby-banner';
        banner.style.background = '#1d70b8';
        banner.textContent = `NEARBY: ${centreName} has availability around ${date}. (Informational, not your target centre.)`;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.title = 'Dismiss nearby alert';
        closeBtn.textContent = '×';
        closeBtn.className = 'dvsa-banner-close dvsa-banner-close-small';
        banner.appendChild(closeBtn);
        banner.addEventListener('click', () => banner.remove());
        document.body.prepend(banner);

        // Auto-dismiss after 30 seconds
        setTimeout(() => banner.remove(), 30000);

        // Brief title flash (10 flips ~7 seconds) so users not on the tab still notice
        const baseTitle = document.title;
        flashTitle(
            `ℹ ${centreName.toUpperCase()} ${date}`,
            `(nearby) ${baseTitle}`,
            { intervalMs: 700, maxFlips: 10, restoreTo: baseTitle }
        );

        // One OS notification, distinct tag so it doesn't replace a real match alert
        fireOSNotificationBurst(
            `DVSA Nearby: ${centreName}`,
            `Availability around ${date}. Informational only, not your configured centre.`,
            'dvsa-nearby',
            1,
            0
        );

        // One audio chime (not the looped beep alarm)
        playBeepBurst();
    }

    // Fire the loud "you have a held slot, click Confirm changes" alarm on the
    // page-confirm-booking page. Different from fireAlert: uses red urgency
    // colours, runs a 15-minute countdown in the title + status pill, and
    // explicitly tells the user to click Confirm changes.
    //
    // The script never auto-clicks #confirm-changes or #abandon, those are
    // 100% the user's call. This alarm just maximises the chance they see it.
    function fireReadyToBookAlert(data) {
        if (document.body.dataset.slotFound) return;
        document.body.dataset.slotFound = '1';
        log(`READY TO BOOK: ${data.date} ${data.timeLabel || ''}, DVSA is holding the slot for 15 minutes. Click "Confirm changes".`);
        recordFinding('match', [data.date], `auto-book: held ${data.timeLabel || ''}`);

        // 15-minute countdown anchored to when auto-book click happened
        const holdMs = 15 * 60 * 1000;
        const endTime = (data.clickTs || Date.now()) + holdMs;
        setStatus({ state: STATUS_STATE.CONFIRM, endTime, label: data.timeLabel || '' });

        // Title flash with countdown. Cap at the hold expiry.
        let flip = true;
        const titleInterval = setInterval(() => {
            const msLeft = endTime - Date.now();
            if (msLeft <= 0) {
                clearInterval(titleInterval);
                return;
            }
            const mins = Math.floor(msLeft / 60000);
            const secs = Math.floor((msLeft % 60000) / 1000);
            const cd = `${mins}m ${secs.toString().padStart(2, '0')}s`;
            document.title = flip
                ? `BOOK NOW · ${cd} LEFT`
                : `>>> CLICK CONFIRM CHANGES <<<`;
            flip = !flip;
        }, 700);

        // Big red banner anchored at top
        const banner = document.createElement('div');
        banner.className = 'dvsa-banner';
        banner.style.background = '#d4351c';
        banner.innerHTML = `READY TO BOOK: <strong>${escapeAttr(data.date)} ${escapeAttr(data.timeLabel || '')}</strong> &mdash; review the page and click <strong>Confirm changes</strong> within 15 minutes. If not the right slot, click <strong>Abandon this change</strong> then pause the script (⏸).`;
        document.body.prepend(banner);

        // Highlight the actual Confirm button on the page so user can find it fast
        const confirmBtn = document.querySelector('#confirm-changes');
        if (confirmBtn) {
            confirmBtn.style.boxShadow = '0 0 0 4px #ffdd00, 0 0 20px 4px #ffdd00';
            confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // OS notification burst, louder than the standard match (more chimes)
        fireOSNotificationBurst(
            'DVSA: BOOK NOW,slot held for 15 min',
            `${data.date} ${data.timeLabel || ''}. Open the tab and click Confirm changes.`,
            'dvsa-ready-to-book',
            7,
            1500
        );

        beepLoop();
    }

    async function handleConfirmBooking() {
        const raw = sessionStorage.getItem(AUTO_BOOK_FLAG_KEY);
        sessionStorage.removeItem(AUTO_BOOK_FLAG_KEY);  // consume on read either way

        if (!raw) {
            log('On Confirm-booking page (not via auto-book, script took no action). Idling.');
            return;
        }

        let data;
        try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (!data || !data.ts || Date.now() - data.ts > 30000) {
            log('Stale auto-book flag (>30s old),ignoring. User probably reached this page manually.');
            return;
        }

        log('Auto-book reached the confirm-booking page. Firing READY-TO-BOOK alarm.');
        fireReadyToBookAlert({
            date: data.date,
            timeLabel: data.timeLabel,
            clickTs: data.ts
        });
    }

    // Auto-book navigation chain. Runs AFTER fireAlert has already kicked off
    // the regular visible alarm, so even if any step here fails the user is
    // already aware a slot was found.
    //
    // Steps (each with pause check + timeout fallback):
    //   1. Click the matched date cell in the calendar
    //   2. Wait for slot picker to populate that date's times
    //   3. Filter times by EARLIEST_TIME/LATEST_TIME, pick the earliest
    //   4. Click that time radio (opens DVSA's Warning! modal)
    //   5. Wait for #slot-warning-continue (or short-notice equivalent)
    //   6. Set sessionStorage flag with date + time + timestamp
    //   7. Click Continue. Page navigates to page-confirm-booking.
    //   8. Safety: if no nav within 5s, clear the flag
    //
    // The script does NOT click anything on page-confirm-booking, that's
    // handleConfirmBooking's job (which just fires the alarm and stops).
    async function autoBookFlow(targetDate) {
        if (TEST_MODE) {
            log('Auto-book blocked: TEST_MODE is on. Manual review only.');
            return;
        }
        if (isPaused()) {
            log('Auto-book blocked: monitoring is paused.');
            return;
        }

        const earliestMin = parseTimeOfDay(EARLIEST_TIME);
        const latestMin   = parseTimeOfDay(LATEST_TIME);
        if (earliestMin == null || latestMin == null || earliestMin > latestMin) {
            log(`Auto-book blocked: invalid time range "${EARLIEST_TIME}".."${LATEST_TIME}". Configure via settings.`);
            return;
        }

        setStatus({ state: STATUS_STATE.BOOKING, label: targetDate });
        log(`Auto-book: target date ${targetDate}`);

        // 1. Click the date cell
        const dateLink = document.querySelector(`a.BookingCalendar-dateLink[data-date="${targetDate}"]`);
        if (!dateLink) {
            log(`Auto-book aborted: date link for ${targetDate} not found in DOM.`);
            return;
        }
        await humanPause(0.05, 0.15);
        if (isPaused()) { log('Auto-book aborted mid-flow: paused.'); return; }
        log(`Auto-book: clicking date ${targetDate}`);
        dateLink.click();

        // 2. Wait for the slot picker to populate this date's times
        const dayLi = await waitFor(
            () => document.querySelector(`li.SlotPicker-day#date-${targetDate}`),
            5000
        );
        if (!dayLi) {
            log(`Auto-book aborted: slot picker did not populate for ${targetDate} within 5s.`);
            return;
        }
        const radios = dayLi.querySelectorAll('input.SlotPicker-slot');
        if (!radios.length) {
            log(`Auto-book aborted: no time radios under #date-${targetDate}.`);
            return;
        }

        // 3. Filter radios by configured time range; pick earliest match
        let chosen = null;
        for (const r of radios) {
            const labelMin = parseSlotTimeLabel(r.dataset.datetimeLabel || '');
            if (labelMin == null) continue;
            if (labelMin < earliestMin || labelMin > latestMin) continue;
            chosen = r;
            break;  // radios appear in chronological order; first match is earliest
        }
        if (!chosen) {
            log(`Auto-book aborted: ${targetDate} has times but none within ${EARLIEST_TIME}–${LATEST_TIME}.`);
            return;
        }
        const timeLabel = chosen.dataset.datetimeLabel || '';
        log(`Auto-book: clicking time radio "${timeLabel}"`);

        if (isPaused()) { log('Auto-book aborted mid-flow: paused.'); return; }
        await humanPause(0.1, 0.25);
        chosen.click();

        // 4. Wait for the Warning modal's Continue button to appear.
        //    Primary selector is #slot-warning-continue (captured live).
        //    Fallback: any visible button with class 'dialog-action' whose text is "Continue"
        //    (handles short-notice variant if its ID differs).
        const continueBtn = await waitFor(() => {
            const direct = document.querySelector('#slot-warning-continue');
            if (direct && direct.offsetParent !== null) return direct;
            const candidates = document.querySelectorAll('button.dialog-action, .ui-dialog-buttonset button');
            for (const b of candidates) {
                if (b.offsetParent === null) continue;
                if (/continue/i.test(b.textContent || '')) return b;
            }
            return null;
        }, 5000);

        if (!continueBtn) {
            log('Auto-book aborted: Warning modal Continue button not found within 5s.');
            return;
        }
        if (isPaused()) { log('Auto-book aborted mid-flow: paused.'); return; }

        // 5. Set the session flag BEFORE clicking, so handleConfirmBooking can pick it up.
        sessionStorage.setItem(AUTO_BOOK_FLAG_KEY, JSON.stringify({
            ts: Date.now(),
            date: targetDate,
            timeLabel
        }));

        await humanPause(0.05, 0.15);
        log('Auto-book: clicking Warning modal Continue. Navigating to confirm-booking page.');
        continueBtn.click();

        // 6. Safety: if click didn't navigate (e.g. button intercepted), clear flag after 5s.
        //    If nav happened, the page unloads and this setTimeout is discarded.
        setTimeout(() => {
            const stillThere = sessionStorage.getItem(AUTO_BOOK_FLAG_KEY);
            if (stillThere) {
                try {
                    const parsed = JSON.parse(stillThere);
                    if (parsed.ts && Date.now() - parsed.ts < 7000) {
                        log('Auto-book: Continue click did not navigate within 5s. Clearing stale flag.');
                        sessionStorage.removeItem(AUTO_BOOK_FLAG_KEY);
                    }
                } catch (e) { /* ignore */ }
            }
        }, 5000);
    }

    async function walkBackwards() {
        // Track every unique bookable date we surface during the walk so we can record findings
        const spotted = new Set();

        // Skip entirely if the "no earlier tests available" warning is already shown
        if (isNoEarlierWarningVisible()) {
            log('"No earlier tests" warning already visible. Skipping walk.');
            return [];
        }
        // Click "Previous available" repeatedly, scanning after each click
        for (let i = 0; i < MAX_PREV_CLICKS; i++) {
            const before = calendarSnapshot();
            const ok = clickPrevAvailable();
            if (!ok) {
                log('No "Previous available" link present.');
                break;
            }
            // Wait for the calendar to update (AJAX render after clicking "Previous available").
            // DVSA's calendar AJAX typically completes in 100-250ms; this 200-400ms
            // window leaves ~150ms of clear buffer for slower connections, busy CDNs,
            // and laggy machines. Going lower (e.g. 180ms floor) leaves only ~80ms
            // of buffer and risks reading a calendar mid-render — months that have
            // dates would appear empty and the script would walk past them.
            await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
            // If the click produced the warning, we are done walking
            if (isNoEarlierWarningVisible()) {
                log('Hit "no earlier tests" warning. End of earlier dates.');
                break;
            }
            const after = calendarSnapshot();
            if (before === after) {
                log('Calendar did not change after "Previous available" click. End of earlier dates.');
                break;
            }
            const visible = scanVisibleCalendar();
            visible.forEach(d => spotted.add(d));
            const dates = visible.filter(isAcceptable);
            if (dates.length) {
                log('Match while walking backwards:', dates);
                return dates;
            }
            // If the visible month is now entirely before the target window, stop walking
            if (visible.length && visible.every(d => d < TARGET_START_DATE)) {
                log('Walked past target window. Stopping.');
                break;
            }
        }
        // No match. If we saw anything during the walk, record it as "spotted" for the history log.
        if (spotted.size) {
            const sorted = Array.from(spotted).sort();
            recordFinding('spotted', sorted, 'outside target window');
        }
        return [];
    }

    function logConfig() {
        log('Active configuration:');
        log(`  Date window:           ${TARGET_START_DATE} to ${TARGET_END_DATE}`);
        log(`  Refresh interval:      ${REFRESH_MIN_MINS} to ${REFRESH_MAX_MINS} minutes (randomised)`);
        log(`  Test centre:           ${EXPECTED_CENTRE}`);
        log(`  Exclude weekends:      ${EXCLUDE_WEEKENDS}`);
        log(`  Walk previous avail:   ${WALK_PREV_AVAIL} (max ${MAX_PREV_CLICKS} clicks)`);
        log(`  Search term:           ${SEARCH_POSTCODE}`);
        log(`  Trigger mode:          ${MANUAL_TRIGGER ? 'MANUAL (you click, script assists)' : 'AUTO (full self-cycling)'}`);
        log(`  Auto-book:             ${AUTO_BOOK ? `ON (time ${EARLIEST_TIME}–${LATEST_TIME})` : 'off'}${AUTO_BOOK && TEST_MODE ? ',DISABLED by Test mode' : ''}`);
        log(`  Alert any centre:      ${ALERT_ANY_CENTRE ? 'ON (soft alerts for non-target centres)' : 'off'}`);
        log(`  Auto-login:            ${(LOGIN_LICENCE_NUMBER && LOGIN_BOOKING_REF) ? 'configured (credentials present)' : 'not configured (manual login required)'}`);
        log(`  Instructor blocked:    ${INSTRUCTOR_UNAVAILABLE_DATES.length} dates`);
        const findings = getFindings();
        const cycles = getCycles();
        if (findings.length || cycles.count) {
            const matches = findings.filter(f => f.type === 'match').length;
            const spotted = findings.filter(f => f.type === 'spotted').length;
            log(`  Scans completed:       ${cycles.count}`);
            log(`  Findings history:      ${findings.length} entries (${matches} match, ${spotted} spotted)`);
            log(`  Run dvsaWatcher.analyse() for breakdown, .print() for raw list, .export() for CSV.`);
        } else {
            log(`  Scans completed:       0`);
            log(`  Findings history:      0 entries. Data will accumulate as the script runs.`);
        }
        if (TEST_MODE) log('  *** TEST MODE ON *** alert will fire on any visible bookable date.');

        // Notifications are the primary audible cue (audio beeps need a page gesture).
        // Warn loudly if permission isn't granted so the user knows alerts will be silent.
        if (window.Notification) {
            const perm = Notification.permission;
            if (perm === 'denied') {
                log('  *** WARNING: notification permission is DENIED. No popup or sound alert will fire on a match. Re-enable in browser settings.');
            } else if (perm === 'default') {
                log('  Notification permission not yet granted. Click anywhere on the page once to be prompted.');
            } else {
                log(`  Notification permission: ${perm}.`);
            }
        } else {
            log('  *** WARNING: Notifications API unavailable in this browser. No popup alerts.');
        }
    }

    async function handleCalendar() {
        if (!requireSelector('.BookingCalendar', 'calendar widget on test-time page')) return;

        // Verify test centre. If the H1 is missing entirely that's a layout change.
        // If it's there but doesn't match EXPECTED_CENTRE, that's a config issue.
        const centreH1 = requireSelector('#chosen-test-centre h1', 'chosen test centre heading');
        if (!centreH1) return;
        // The H1 contains a visually-hidden accessibility span like "Test date / time"
        // before the centre name. Strip it so the log + intervention message is clean.
        const vh = centreH1.querySelector('.visuallyhidden');
        const centreText = (centreH1.textContent || '').replace(vh ? vh.textContent : '', '').trim();
        // Self-healing: capture the actual centre name DVSA shows so the
        // settings-panel combobox can offer it next time, even if not in our
        // bundled KNOWN_TEST_CENTRES list. Safe to call every cycle, it's a
        // localStorage no-op when the name is already known.
        addDiscoveredCentre(centreText);
        if (EXPECTED_CENTRE && !centreText.includes(EXPECTED_CENTRE)) {
            log(`Test centre mismatch (expected "${EXPECTED_CENTRE}", got "${centreText}"). Firing intervention alert.`);
            fireInterventionAlert(INTERVENTION_REASONS.CENTRE_MISMATCH);
            return;
        }

        // Count this as a successful scan cycle for analytics
        recordCycle();

        // Scan current month
        let matches = scanVisibleCalendar().filter(isAcceptable);
        if (matches.length) {
            fireAlert(matches);
            // Auto-book the earliest match if enabled. fireAlert has already fired
            // so the user is alerted regardless of what happens next.
            if (AUTO_BOOK && !TEST_MODE) {
                await autoBookFlow(matches[0]);
            }
            return;
        }

        // Walk back through earlier dates
        if (WALK_PREV_AVAIL) {
            matches = await walkBackwards();
            if (matches.length) {
                fireAlert(matches);
                if (AUTO_BOOK && !TEST_MODE) {
                    await autoBookFlow(matches[0]);
                }
                return;
            }
        }

        if (MANUAL_TRIGGER) {
            log('MANUAL_TRIGGER mode: scan complete, no auto-cycle scheduled.');
            setStatus({ state: STATUS_STATE.MANUAL });
            return;
        }
        scheduleNextCycle();
    }

    // One-time storage-key migration from the legacy dot-style names
    // (dvsaWatcher.autoBookAcknowledged etc.) to the unified kebab-style
    // prefix used by every other key (dvsa-watcher-auto-book-ack etc.).
    // Reads the value from the old key, writes it to the new key (only if
    // the new key is empty, to avoid clobbering a manually-set value), then
    // deletes the old key. Idempotent: subsequent loads find the old keys
    // absent and do nothing. Wrap each in try/catch so one storage error
    // doesn't block the others.
    function migrateLegacyStorageKeys() {
        const migrations = [
            { old: 'dvsaWatcher.autoBookAcknowledged', neu: AUTO_BOOK_ACK_KEY },
            { old: 'dvsaWatcher.discoveredCentres',    neu: DISCOVERED_CENTRES_KEY },
            { old: 'dvsaWatcher.wizardCompleted',      neu: WIZARD_COMPLETED_KEY }
        ];
        migrations.forEach(m => {
            try {
                const oldVal = localStorage.getItem(m.old);
                if (oldVal == null) return;
                if (localStorage.getItem(m.neu) == null) {
                    localStorage.setItem(m.neu, oldVal);
                    log(`Migrated storage key: ${m.old} → ${m.neu}`);
                }
                localStorage.removeItem(m.old);
            } catch (e) {
                log(`Migration failed for ${m.old}: ${e.message}`);
            }
        });
    }

    // Render the retirement notice. This is the script's entire behaviour while
    // DEPRECATED is true: one dismissable banner, then nothing. Deliberately
    // built from scratch rather than routed through fireInterventionAlert —
    // interventions set STATUS, flash the tab title and fire OS notification
    // bursts, all of which imply "resolve this and monitoring resumes". It
    // doesn't. Dismissal is per page load; there's no persistence to add when
    // the script does nothing else.
    function showRetirementNotice() {
        if (document.getElementById('dvsa-retired-banner')) return;
        injectWatcherCSS();

        const banner = document.createElement('div');
        banner.id = 'dvsa-retired-banner';
        banner.className = 'dvsa-banner dvsa-banner-small dvsa-banner-dismissable';
        banner.style.background = '#505a5f';
        banner.textContent =
            'DVSA Earlier Slot Watcher has been retired and no longer monitors for slots. ' +
            'Since 12 May 2026 DVSA’s rules do not allow unofficial services that scan the ' +
            'booking service for appointments. Please uninstall it from Tampermonkey. Click to dismiss.';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.title = 'Dismiss';
        closeBtn.textContent = '×';
        closeBtn.className = 'dvsa-banner-close dvsa-banner-close-small';
        banner.appendChild(closeBtn);

        banner.addEventListener('click', () => banner.remove());
        document.body.prepend(banner);
    }

    async function main() {
        // Retirement gate. Comes before everything — including the queue-page
        // and config checks — so that no stored config is read, no timer is
        // scheduled and no element on a DVSA page is ever touched.
        if (DEPRECATED) {
            log(`v${SCRIPT_VERSION}: retired. Monitoring is disabled and will not start. See https://github.com/alchemycharlie/dvsa-earlier-slot-watcher for why.`);
            showRetirementNotice();
            return;
        }

        // Runs first: brings legacy dvsaWatcher.* storage keys forward to the
        // unified dvsa-watcher-* prefix. Idempotent, safe to call on every load.
        migrateLegacyStorageKeys();
        logConfig();
        // Best-effort audio context prime. The 'once' click/keydown listeners are the
        // primary path, but if you've already interacted with DVSA in this tab before
        // the script ran, the gesture is already live and this no-op succeeds.
        primeUserGestureFeatures();
        injectControlCluster();
        wireKeyboardShortcuts();

        // Queue-it virtual waiting room: must be checked FIRST, before the config
        // and pause guards. The queue page lives on queue.driverpracticaltest.dvsa.gov.uk,
        // a separate origin with its own (empty) localStorage. If we ran the config
        // check here, it would always fail on the queue subdomain and incorrectly
        // launch the setup wizard, potentially leading users to import or re-enter
        // config that ends up orphaned on the queue origin instead of the main
        // DVSA origin where it actually belongs. By detecting the queue page first,
        // we just surface the queue position and wait; the user's real config on
        // driverpracticaltest.dvsa.gov.uk is left completely alone.
        if (isQueueItPage()) {
            await handleQueueItPage();
            return;
        }

        // First-run guard: if config is missing or still on placeholder values,
        // open the setup wizard (for brand-new users) or the settings panel
        // (for returning users who've already seen the wizard but have invalid
        // config). The gear icon stays available so the user can always come
        // back to it.
        if (!isConfigValidForScanning()) {
            log('Configuration incomplete or invalid. Scanner paused, configure via the settings panel to start monitoring.');
            setStatus({ state: STATUS_STATE.INVALID });
            if (shouldRunWizard()) {
                openSetupWizard();
            } else {
                openSettingsPanel({
                    message: 'Configure the script before monitoring can start. All required fields must be filled and valid.'
                });
            }
            return;
        }

        // Pause guard: user clicked the pause button. Stop here without dispatching
        // to any handler. Settings, history, and test alert still work via the cluster.
        if (isPaused()) {
            log('Monitoring is paused. Click the play button (▶) in the bottom-right cluster to resume.');
            setStatus({ state: STATUS_STATE.PAUSED });
            return;
        }

        setStatus({ state: STATUS_STATE.SCANNING, endTime: null });
        const state = document.body.id || '';
        log(`Page state: ${state || '(unknown)'}`);

        // If we've reached any recognised DVSA page state, clear the
        // post-CAPTCHA-recovery loop-guard flag. This means a future stale-
        // _eventId 403 later in the session can still trigger a recovery
        // (rather than being treated as "already tried, give up").
        if (state.startsWith('page-')) {
            sessionStorage.removeItem(POST_CAPTCHA_RECOVERY_KEY);
        }

        switch (state) {
            case PAGE_STATE.LOGIN:
                await handleLogin();
                return;
            case PAGE_STATE.BOOKING_DETAILS:
                await handleBookingDetails();
                return;
            case PAGE_STATE.TEST_DATE_CHOICE:
                await handleTestDateChoice();
                return;
            case PAGE_STATE.CALENDAR:
                await handleCalendar();
                return;
            case PAGE_STATE.TEST_CENTRE_SEARCH:
                await handleTestCentreSearch();
                return;
            case PAGE_STATE.CONFIRM_BOOKING:
                await handleConfirmBooking();
                return;
            case PAGE_STATE.SERVICE_UNAVAILABLE:
                log('Detected DVSA "Service unavailable" page.');
                scheduleWakeUp();
                return;
            default:
                // Post-CAPTCHA Tomcat 403 redirect: DVSA's redirect chain
                // occasionally lands on a /manage URL with a stale _eventId
                // that the WebFlow state machine rejects. We auto-recover by
                // navigating to the canonical /manage URL.
                if (isPostCaptchaForbiddenRedirect()) {
                    recoverFromPostCaptchaRedirect();
                    return;
                }
                // Safety net: if DVSA changes the body ID we still detect
                // service-unavailable via title/heading text fallbacks.
                if (isServiceUnavailable()) {
                    log('Detected DVSA "Service unavailable" page (via fallback detection — body ID may have changed).');
                    scheduleWakeUp();
                    return;
                }
                const intervention = detectInterventionState();
                if (intervention) {
                    log(`Intervention required: ${intervention}`);
                    fireInterventionAlert(intervention);
                    return;
                }
                log('Not a recognised page state. Idling. (Error 15 or other unexpected page.)');
                return;
        }
    }

    // Give slot-picker JS time to initialise the calendar
    setTimeout(main, 2000);
})();