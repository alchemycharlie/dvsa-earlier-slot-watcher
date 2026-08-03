# Disclaimer and Limitation of Liability

> [!CAUTION]
> **The Software is retired and unmaintained as of version 2.0.0. Its monitoring behaviour is disabled and will not be re-enabled by the author. See [§0](#0-retirement-notice) below, and [Project status](README.md#project-status).**

**Please read this document carefully before installing or using this script. By installing, copying, modifying, or using this software (the "Software"), you ("the user") acknowledge that you have read, understood, and agreed to the terms set out below. If you do not agree, do not install or use the Software.**

---

## 0. Retirement Notice

### 0.1 The Software is retired

As of version 2.0.0, the Software is **retired, deprecated, and unmaintained**. Its automated monitoring behaviour is disabled: on load it displays a notice and performs no further action against any DVSA page.

The author has ceased development permanently. The author no longer holds a DVSA practical driving test booking and therefore no longer has access to the DVSA booking management service against which the Software operated. The author will not update, amend, fix, or otherwise maintain the Software, and makes no commitment to review, respond to, or merge anything filed against the project.

### 0.2 Why the Software was retired

Two developments, either sufficient on its own:

**(a) DVSA rules on unofficial slot-scanning services.** From 12 May 2026, DVSA guidance states that candidates must not use unofficial services that scan the driving test booking service for appointments. DVSA's booking terms and conditions separately prohibit the use of robotic applications ("bots"), third-party applications or websites, data mining, and similar tools to search for available test slots. DVSA state that where bot activity is detected against a licence they may cancel the booking or restrict the account holder's online booking access. The Software automated checking of the booking service for earlier slots, which falls within the description of that prohibited activity.

**(b) Removal of the test centre search.** From 9 June 2026, a car practical test may only be moved to one of the three test centres nearest to where the test is booked, or back to the centre originally booked. DVSA's change-test-centre journey correspondingly no longer presents the free-text search the Software's multi-centre flow depended on.

### 0.3 Continued use is at your sole risk

Nothing in this Notice grants permission to use the Software in breach of DVSA's terms and conditions, and §3.2(4) of this Disclaimer continues to prohibit such use. Any person who re-enables the Software's monitoring behaviour, in this repository or in any fork, does so entirely at their own risk and on their own responsibility, including the risk that DVSA cancels their driving test booking or restricts their access to the online booking service. The author accepts no liability for any such consequence. The limitations in §7 (Limitation of Liability) apply in full.

### 0.4 Forks

The Software remains available under the MIT licence and may be forked accordingly (see §4). The author does not endorse, support, or take responsibility for any fork, and specifically does not endorse forks that restore or continue automated scanning of the DVSA booking service. Any fork is the sole responsibility of whoever operates it.

---

## 1. No Affiliation

This Software is an independent, unofficial tool. It is not affiliated with, endorsed by, sponsored by, or in any way connected to:

- The Driver and Vehicle Standards Agency (DVSA);
- gov.uk or any agency of the UK Government;
- The Driver and Vehicle Licensing Agency (DVLA);
- Tampermonkey or any browser-extension vendor;
- Any test centre, driving instructor, or instructor-association.

References to "DVSA" or any related entity are descriptive only and are used solely to identify the public website the Software interacts with.

---

## 2. Scope of Operation: Existing Bookings Only

The Software is designed for, and operates only on, the **existing-booking management flow** of the DVSA practical driving test website. Specifically, it is intended to help users who:

- Already hold a paid, confirmed DVSA practical driving test booking, and
- Wish to change that existing booking to an earlier available date within DVSA's normal rescheduling rules, including the limit on the number of reschedules per booking.

The Software **does not** and is **not capable of**:

- Booking a new test from scratch;
- Skipping or bypassing the standard DVSA application or payment flow;
- Helping any user obtain a booking they do not already have;
- Snapping up, hoarding, or otherwise interfering with the supply of newly-released test slots on DVSA's public booking page;
- Operating on any URL other than `driverpracticaltest.dvsa.gov.uk/manage*` and `driverpracticaltest.dvsa.gov.uk/login*` (the "Change your test" management pages and the associated login page).

The Software's `@match` directives in its Tampermonkey userscript header, visible at the top of the source file, define its operational scope. It is technically incapable of injecting into, or interacting with, any other DVSA URL, the DVSA application form, the DVSA payment flow, or any unrelated website.

Users without an existing booking will find the Software has no effect for them. Such users should obtain a test booking through DVSA's standard process before installing or using this Software.

---

## 3. Acceptable Use Policy

This section sets out how the Software may and may not be used. It applies in addition to the MIT licence terms. Where the MIT licence grants broad rights and this Acceptable Use Policy asks more of users, this Policy reflects the author's expectations of how the community should treat the project. Users who choose to ignore this Policy retain whatever rights the MIT licence formally grants them, but the author reserves the right to publicly note such use as contrary to the project's stated terms.

### 3.1 Permitted Use

The Software is intended for, and may be used by, individuals who:

1. Hold a paid, confirmed DVSA practical driving test booking in their own name.
2. Are personally eligible to take the booked test (correct age, valid provisional licence, completed theory test, and any other DVSA requirements).
3. Wish to find an earlier cancellation slot at the same test centre and reschedule that booking, subject to DVSA's own rescheduling rules and limits.
4. Are using the Software solely for their own benefit, on their own device, with their own DVSA login credentials.
5. Are located in, or interacting with, the UK DVSA testing system.

### 3.2 Prohibited Use

The Software must not be used for any of the following:

1. **Use on behalf of another person.** The Software must not be used to manage, monitor, reschedule, or otherwise interact with any DVSA booking that does not belong to the user running the Software. This includes running the Software for friends, family, pupils, clients, or any third party.
2. **Use across multiple DVSA accounts.** A single user installation must only ever be associated with a single DVSA account and a single booking at any one time. Running the Software in rotation across multiple accounts is prohibited.
3. **Commercial use of any kind.** The Software, in whole or in part, must not be used to provide a paid service, to charge users for access to its functionality, to bundle it into a commercial product, or otherwise to derive financial gain from its operation. Driving instructors, schools, and other commercial entities must not run the Software on behalf of their pupils, customers, or clients.
4. **Malicious or unlawful use.** The Software must not be used for any purpose that breaches:
   a. The DVSA's terms and conditions;
   b. The DVLA's terms and conditions;
   c. The Computer Misuse Act 1990 or any other applicable UK statute;
   d. The Digital Economy Act 2017 (including but not limited to its provisions on automated ticket purchasing, where analogous reasoning may be applied to booking systems);
   e. The laws of any jurisdiction in which the user is located or in which the user's actions have effect;
   f. The rights of any other person.
5. **Reverse engineering with intent to circumvent security.** The Software's source is public, and security research that aims to identify and responsibly report vulnerabilities is welcome (see [SECURITY.md](SECURITY.md)). Reverse engineering to identify ways of circumventing DVSA's anti-automation measures, defeating their bot-protection systems, or otherwise harming the integrity of the DVSA booking service is prohibited.
6. **Use inside automated frameworks.** The Software is designed to run inside an authenticated browser tab operated interactively by the user. Wrapping the Software in headless browsers, automation frameworks (such as Selenium, Puppeteer, Playwright), server-side cron jobs, or any other unattended automation context is prohibited.
7. **Use outside the UK.** The DVSA operates the UK practical driving test system. The Software is not designed for, supported in, or appropriate for use in any other jurisdiction's test booking systems. Users outside the UK are responsible for any consequences of their use of the Software in jurisdictions where its use may be unlawful or unauthorised.

### 3.3 Security Research

Independent security review of the Software's source is permitted and encouraged. Findings should be reported responsibly via the channels in [SECURITY.md](SECURITY.md), not via public disclosure that could enable abuse before a fix is available.

---

## 4. Distribution, Modification and Forks

### 4.1 The MIT Licence

The Software is released under the MIT licence (see [LICENSE](LICENSE)). The MIT licence is permissive and grants every recipient broad rights, including the rights to copy, modify, merge, publish, distribute, sublicense, and sell copies of the Software, subject to the terms in that licence.

### 4.2 The Author's Request

The author asks, but does not legally require beyond what the MIT licence enforces, that:

1. **Copies, distributions, and modifications should be coordinated with the author.** Anyone who wishes to copy, fork, or modify the Software in a way that is more than a private personal change is asked to contact the author first via the project's GitHub issues. This allows the author to ensure consistency, identify duplicated effort, and maintain a coherent community around the project.
2. **Forks and derivatives should not be used for commercial gain.** Even though the MIT licence formally permits commercial use, the project exists to help individuals manage their own DVSA bookings free of charge. Forks that monetise the Software (paid versions, paywalls, subscription wrappers, advertising-supported variants, etc.) work directly against the project's purpose and are not endorsed by the author.
3. **Forks should preserve the project's purpose.** Forks intended to break, weaponise, or maliciously alter the Software's behaviour are not endorsed.
4. **Forks should be clearly distinguished from the original.** Any redistributed copy or fork must make it clear in its userscript header, README, and any user-facing surface that it is a fork, who maintains it, and that it is not the original work of the author.

### 4.3 Authenticity and Verification

The single canonical install URL for the original Software is:

`https://raw.githubusercontent.com/alchemycharlie/dvsa-earlier-slot-watcher/main/dvsa-slot-watcher.user.js`

Users should:

1. Install only from this URL or from a clearly-labelled GitHub release on the canonical repository.
2. Verify that the userscript header shows `@author alchemycharlie` and `@namespace https://github.com/alchemycharlie/dvsa-earlier-slot-watcher` before installation.
3. Treat any installation source other than the canonical URL with caution. A maliciously-forked variant could harvest credentials, alter behaviour, or otherwise compromise the user.

The author makes no representations, warranties, or endorsements regarding any fork, derivative, or copy of the Software distributed by any party other than the author. Users install forks at their own risk.

---

## 5. Project Philosophy

The author created the Software to help a single specific need (an individual in the UK rescheduling their own driving test to an earlier date) and is sharing it because the same need affects many other learner drivers in the UK. The project rests on a small number of principles which the author intends to maintain for as long as the project is active:

1. **The Software is, and will remain, free for all genuine individual users.** No paid tier, no advertising, no premium features, no telemetry, no data collection.
2. **The source code is, and will remain, publicly visible.** Users can read what the Software does before installing it. Security researchers can audit it. The author will not release a closed-source version.
3. **The Software exists to help individuals, not to be commercialised.** Anyone wishing to use, fork, or build upon the Software in a way that aligns with this principle is welcome. Anyone wishing to monetise the Software's functionality is asked to look elsewhere.
4. **The author benefits, if at all, only through voluntary thanks.** A "Buy Me a Coffee" link is provided for users who wish to express thanks. No user is ever required, prompted, or pressured to give anything. The Software is fully functional without any payment.
5. **The author retains the right to discontinue the Software.** The Software may be archived, marked unmaintained, or withdrawn from public availability at any time without notice. Users are responsible for finding alternatives if the project is no longer maintained.

These principles are statements of intent. They are not legally binding in the way the MIT licence is, but they reflect the spirit in which the project is offered and the spirit in which it should be used. The principle on circumventing DVSA's security measures is held as its own sub-section below for ease of reference.

### 5.6 No Circumvention of DVSA Security Measures

**The Software exists to remove manual effort, not to gain technical advantage.** The Software's purpose is to save the user the time and tedium of repeatedly refreshing the DVSA "Change your test" page in search of an earlier cancellation slot. It is **not** designed to, and will not be designed to, circumvent, evade, interfere with, or otherwise work around any of DVSA's security measures, including CAPTCHA challenges, rate-limiting responses (such as Error 15), bot-detection systems, account-protection systems, or session-handling rules. When DVSA's site presents any such challenge or response, the Software pauses and hands control back to the user. Every individual interaction the Software performs is one a logged-in human user could perform manually through the same site, at a cadence (default 7-12 minutes between page checks) intended to remain comparable to a person checking the page periodically. The Software's value is entirely in saving the user's time; it provides no technical advantage over another human user on the same site. The long-form treatment, including how the Software behaves in specific situations (CAPTCHA, Error 15, layout changes, session expiry), is documented in [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md).

### 5.7 No Third-Party Endorsement

Nothing about the Software implies endorsement by, or affiliation with, the user's driving instructor, driving school, examiner, the DVSA, the DVLA, the UK Government, gov.uk, Tampermonkey, the user's browser vendor, or any other third party. Where third parties are mentioned in the Software's documentation or output, those mentions are descriptive only.

---

## 6. "As Is" with No Warranty

The Software is provided **"AS IS" and "AS AVAILABLE"**, without warranty of any kind, express or implied. To the fullest extent permitted by law, the author disclaims all warranties, including but not limited to:

- Warranties of merchantability;
- Warranties of fitness for a particular purpose;
- Warranties of non-infringement;
- Warranties that the Software will be uninterrupted, error-free, secure, or free of harmful components;
- Warranties that any defects will be corrected.

No advice or information, whether oral or written, obtained from the author or through the Software, creates any warranty not expressly stated in this document.

---

## 7. Limitation of Liability

To the maximum extent permitted by applicable law, **in no event shall the author be liable for any direct, indirect, incidental, special, consequential, exemplary, or punitive damages** arising out of or related to your use of, or inability to use, the Software. This limitation applies regardless of the legal theory (contract, tort, negligence, strict liability, or otherwise) and applies even if the author has been advised of the possibility of such damages.

This includes, without limitation, damages for:

- Lost or missed test bookings;
- Loss of an existing or previously-secured test date;
- Suspension, restriction, or termination of any DVSA account;
- Booking of an incorrect date, time, or test centre;
- Failure or delay of any alert, notification, or auto-book action;
- Loss of data, including configuration and scan history stored in your browser;
- Costs of substitute services or workarounds;
- Travel costs, instructor fees, or lost wages relating to a missed or rescheduled test;
- Indirect or consequential personal or professional impact arising from any of the above.

Some jurisdictions do not allow the exclusion or limitation of incidental or consequential damages, so the above limitation may not apply to you. In such jurisdictions, the author's total liability is limited to the maximum extent permitted by law.

Nothing in this document is intended to limit or exclude liability for fraud, fraudulent misrepresentation, gross negligence, or death or personal injury caused by negligence, or any other liability that cannot lawfully be limited or excluded.

---

## 8. User Responsibilities

By using the Software, you accept sole responsibility for all of the following. None of these responsibilities transfers to the author, the contributors, or any third party.

1. **Compliance with DVSA terms.** Ensuring your use of the Software complies with the [DVSA's terms and conditions](https://www.gov.uk/government/organisations/driver-and-vehicle-standards-agency), any guidance issued by DVSA regarding automation or third-party tools, and all applicable laws of England and Wales (or your local jurisdiction).
2. **Compliance with the Acceptable Use Policy.** Ensuring your use of the Software falls within Section 3 of this Disclaimer. Use in breach of Section 3 is at your own risk and exposure, not the author's.
3. **Eligibility.** Ensuring that you are personally eligible to take the DVSA practical driving test in respect of which you are using the Software (correct age, valid provisional licence, completed theory test, and any other DVSA requirements). The Software performs no eligibility checks.
4. **Use with your own booking only.** Ensuring that the Software is used only in connection with your own DVSA test booking, your own DVSA account, and your own credentials. Using the Software on behalf of any other person is your responsibility and at your own risk.
5. **Account integrity.** Any consequence to your DVSA account, including suspension, restriction, fraud-flagging, or termination, arising from your use of the Software. The author has no influence over DVSA's enforcement decisions and accepts no liability for them.
6. **Booking accuracy.** Verifying every detail of any booking (date, time, centre, type of test) before clicking the final "Confirm changes" button. The Software's auto-book feature deliberately stops short of this final commit; the verification and final click are entirely your responsibility.
7. **Credential security.** Any credentials (driving licence number, booking reference) you choose to store in the Software's settings are stored locally in your browser's `localStorage`. You are responsible for the physical and digital security of the device(s) on which they are stored. Do not enable credential storage on shared, public, or untrusted devices.
8. **Backups.** Any export of your configuration or scan history is your own responsibility to store securely. Exported files may contain personal information depending on the options you select at export time.
9. **Browser and platform compatibility.** Verifying that the Software works correctly in your specific browser, Tampermonkey version, operating system, and DVSA page version. Updates to any of these may cause the Software to behave unexpectedly.
10. **Monitoring use.** Reviewing the Software's behaviour periodically to confirm it is operating as expected. The author makes no guarantee of continuous, uninterrupted operation.
11. **Authenticity of installation.** Verifying that the Software you are running was obtained from the canonical install URL listed in Section 4.3 and that the `@author` field in the userscript header matches the original author. Use of any fork, derivative, or modified copy is at your own risk.
12. **Acceptance of project lifecycle.** Acknowledging that the Software may be modified, archived, or discontinued at any time without notice (see Section 15), and finding alternatives if the project is no longer maintained in a way that meets your needs.

---

## 9. No Guarantees

The author makes **no guarantee, representation, or warranty** that:

- The Software will find an earlier slot, find any slot, or find one within any particular timeframe;
- Cancellations or earlier slots will be detected before they are taken by another user or another tool;
- Alerts (banner, audio chime, browser notification, tab title) will fire reliably on any given device, browser, or OS configuration;
- The Software will continue to function if DVSA changes its website's structure, URLs, page IDs, CSS class names, form fields, anti-bot mechanisms, session handling, or any other technical aspect;
- The Software will avoid triggering DVSA's bot-detection mechanisms. Use of the Software may, at any time and without warning, result in your IP address or account being temporarily or permanently blocked;
- Auto-book actions will select the intended slot, the correct time, or any slot at all;
- The Software will be free from defects, vulnerabilities, or unintended behaviour;
- Future versions of the Software will remain backwards-compatible with your existing configuration.

---

## 10. Assumption of Risk

You acknowledge that automation of any kind carries inherent risks. By installing and using the Software, you **knowingly and voluntarily assume all risks** associated with its use, including but not limited to:

- **Losing your existing test booking.** DVSA's rebooking flow requires you to release your current slot before securing the replacement. A failure, mistimed action, or selector mismatch can result in your current slot being released without a replacement being secured.
- **DVSA account action.** DVSA may at its sole discretion take action against accounts that interact with the booking site in ways it considers automated or abusive. The Software is designed to operate at human-comparable pacing, but no design decision can guarantee an account will not be flagged.
- **Booking the wrong slot.** Auto-book makes decisions based on visible page elements that may shift, mis-render, or be misinterpreted. Although the Software stops before the final commit step, you alone are responsible for verifying the slot is correct before confirming.
- **Two-reschedule limit.** DVSA permits a limited number of reschedules per booking. A wasted reschedule due to incorrect Software behaviour is your responsibility.
- **Missed slots.** The Software's randomised cycle pacing means it may not detect a cancellation before it is taken by another user.
- **Notification failures.** Browser notifications, audio chimes, and tab title flashes are subject to OS, browser, hardware, and Do-Not-Disturb settings. The Software cannot override these.
- **Credential compromise.** If your device is compromised, any credentials stored locally by the Software may be accessed by an attacker.
- **Tampermonkey or browser bugs.** The Software operates within Tampermonkey, which operates within your browser. Bugs, updates, or misconfiguration of either may cause unexpected behaviour.

---

## 11. Auto-Book Feature: Specific Waiver

The Software's auto-book feature is **opt-in, disabled by default**, and carries elevated risk. When enabled, the Software will automatically click date, time, and continue buttons through DVSA's booking flow on your behalf, up to (but not including) the final "Confirm changes" page.

You acknowledge and accept that:

1. Auto-book operates based on page elements (HTML selectors) that may change without notice;
2. A selector mismatch or page change may cause the Software to click an unintended element, navigate to an unintended page, or take an unintended action;
3. The Software cannot reliably detect every edge case in DVSA's UI;
4. The final commit (the "Confirm changes" click) is deliberately left manual to give you a chance to verify the booking;
5. **You alone are responsible for verifying the date, time, and test centre before clicking Confirm changes.** The Software's behaviour up to that point does not constitute, and must not be relied upon as, a verification of the booking's correctness.

If you are not comfortable with these risks, **do not enable auto-book**. The Software is fully functional as an alert-only tool with auto-book disabled.

---

## 12. Credentials and Sensitive Data

If you choose to enable the Software's optional auto-login feature, the Software will store your driving licence number and booking reference in your browser's `localStorage`. You acknowledge that:

- `localStorage` is not encrypted at rest;
- Any program with access to your browser profile can read these values;
- Browser extensions, malware, or another user of the same browser profile may be able to retrieve them;
- Clearing browser data, switching browsers, or using a different device requires re-entering the credentials;
- The author has no way to recover, reset, or access your stored credentials.

You are responsible for understanding these implications before enabling auto-login, and for keeping your device, browser profile, and operating system secure.

---

## 13. No Endorsement of Methods

Nothing in this Software, its documentation, or any related materials constitutes:

- Advice on how to circumvent DVSA's terms and conditions;
- An endorsement of any particular automation practice;
- A representation that automated booking interactions are permitted by DVSA;
- Legal advice of any kind.

If you are unsure whether your use of the Software complies with DVSA's terms or applicable law, you should seek independent legal advice before installing or using the Software.

---

## 14. Indemnification

To the maximum extent permitted by law, you agree to indemnify, defend, and hold harmless the author and any contributors from and against any and all claims, demands, suits, actions, damages, losses, costs, expenses (including reasonable legal fees and the costs of investigating any claim), and liabilities, arising out of or in any way connected with:

- Your use, misuse, or inability to use the Software;
- Your violation of DVSA's terms and conditions, the DVLA's terms and conditions, or any other applicable law, regulation, or contractual obligation;
- Your breach of Section 3 (Acceptable Use Policy), including but not limited to use on behalf of another person, use across multiple accounts, commercial use, or use inside an automation framework;
- Your breach of Section 4 (Distribution, Modification and Forks), including unauthorised redistribution or commercialisation of forks;
- Your violation of any third party's rights, including intellectual property, privacy, and contractual rights;
- Any content, configuration, or credentials you input into, store within, or export from the Software;
- Any consequence to your DVSA account, your driving test booking, or your standing with the DVSA arising from your use of the Software;
- Any decision you make in reliance on the Software's output, including any decision to confirm or abandon a test booking change.

This indemnification obligation survives any termination of your use of the Software.

---

## 15. Modifications, Discontinuation, and Changes to these Terms

### 15.1 Changes to the Software

The author may modify, update, or restructure the Software at any time without notice. New versions may introduce new behaviour, change existing behaviour, remove features, or alter the way the Software interacts with the DVSA booking site. Users running auto-update via Tampermonkey will receive these changes automatically and are responsible for reviewing them.

### 15.2 Discontinuation

The author may, at any time and without notice, archive the project, mark it unmaintained, withdraw it from public availability, or cease responding to issues and pull requests. Users have no claim against the author arising from such discontinuation. Users requiring continuity of service from a similar tool are responsible for finding alternatives.

**This has now occurred.** The Software was retired at version 2.0.0 and its monitoring behaviour permanently disabled by the author. See [§0 (Retirement Notice)](#0-retirement-notice).

### 15.3 Changes to these Terms

The author may modify the terms of this Disclaimer in future versions of the Software. Continued use of any updated version constitutes acceptance of the updated terms in their entirety. It is your responsibility to review the version of this Disclaimer included with the version of the Software you are using.

The author has no obligation to maintain backwards compatibility in either the Software's behaviour or these terms.

---

## 16. Severability

If any provision of this Disclaimer is held to be invalid, illegal, or unenforceable in any jurisdiction, the remaining provisions shall remain in full force and effect, and the invalid provision shall be replaced with a valid provision that most closely reflects the original intent.

---

## 17. Governing Law and Jurisdiction

This Disclaimer is governed by and construed in accordance with the laws of **England and Wales**. Any dispute arising out of or in connection with this Disclaimer or the Software shall be subject to the exclusive jurisdiction of the courts of England and Wales.

This choice of law and jurisdiction applies to the fullest extent permitted by law, without prejudice to any mandatory consumer-protection rights you may have under the laws of your country of habitual residence.

---

## 18. Entire Agreement

This Disclaimer, together with the [LICENSE](LICENSE) file, constitutes the entire agreement between you and the author regarding the Software, and supersedes any prior agreements, communications, or understandings, whether written or oral.

---

## 19. Acceptance

**Installing, copying, modifying, distributing, or using the Software constitutes your acceptance of these terms in full.** If you do not agree to any part of this Disclaimer, you must not install or use the Software, and you must delete any copies of it from your devices.

---

## Contact

Questions about this Disclaimer can be raised as an issue on the project's GitHub repository:

<https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/issues>

The author makes no commitment to respond to questions, requests for legal advice, or requests to vary these terms.

---

*Last updated: 3 August 2026*
