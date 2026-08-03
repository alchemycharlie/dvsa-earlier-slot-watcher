# Security Policy

> [!CAUTION]
> **The project is retired as of v2.0.0 and is no longer maintained.** No security fixes will be issued. As of v2.0.0 the script performs no automated action against any DVSA page, which removes most of its former attack surface, but nothing here should be read as a commitment to assess or fix anything. See [DISCLAIMER §0](DISCLAIMER.md#0-retirement-notice).

This is a personal open-source userscript. **The maintainer makes no commitment to ongoing security maintenance, no commitment to reviewing reports, and no commitment to releasing fixes.** The project may be unmaintained at any given time, without notice. See [DISCLAIMER §15 (Discontinuation)](DISCLAIMER.md#15-modifications-discontinuation-and-changes-to-these-terms).

If you'd like to report a security issue responsibly anyway, this document covers the channel and what's in scope.

## Don't post security details in a public issue

If you've found something that could be exploited against other users of the script, **don't post the details in a public issue**. The responsible disclosure channel is GitHub's private vulnerability reporting:

<https://github.com/alchemycharlie/dvsa-earlier-slot-watcher/security/advisories/new>

A useful report includes:

- A description of the issue and what an attacker could do with it
- Step-by-step reproduction
- The script version tested against (`@version` line in the userscript header)
- Your browser and Tampermonkey version
- Any proof-of-concept code or screenshots

If GitHub's private reporting is unavailable to you, file a public issue with `[Security]` in the title and **non-sensitive** details only.

## What may be a security issue

For the avoidance of doubt:

- **Credential exposure**: licence number, booking reference, or any other personal data leaking into the DOM, console, network requests, exports, or the panel UI
- **XSS** in the settings or history panels (e.g. unsanitised user-supplied strings reaching `innerHTML`)
- **Config import attacks**: a crafted JSON file causing arbitrary `localStorage` writes outside the allow-listed keys
- **Supply-chain risks**: anything that would let an attacker substitute or modify the script as installed by Tampermonkey users (excluding compromise of the GitHub repo itself)
- **Sensitive information disclosure** in scan history exports or auto-discovered test centres

## What isn't a security issue here

- Anything on DVSA's actual website. Report those to DVSA directly.
- Requests to bypass DVSA's bot-protection layer, captcha challenges, rate limits, or any other DVSA security mechanism. These are explicitly out of scope (see [docs/SECURITY-POSTURE.md](docs/SECURITY-POSTURE.md)) and won't be entertained.
- Bugs in Tampermonkey, the browser, or the OS.
- Social engineering or phishing of the maintainer or users.
- Issues that require the user to first install a hostile script. The threat model assumes installation via the canonical install link in this repo.

## What happens after you report

That depends entirely on the maintainer's availability and inclination at the time. There is no commitment that reports will be acknowledged, triaged, investigated, or fixed. No timeline applies. The maintainer may respond, fix the issue, archive the project, or take no action at all.

The source is public. If a security issue you've reported matters to you and nothing happens, you're free to fork the repository and address it yourself, or to encourage others to do so.
