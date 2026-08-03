# Contributing

> [!CAUTION]
> **The project is retired as of v2.0.0 and closed to further work by the author.** Issues and pull requests will not be reviewed, responded to, or merged. Please don't wait on a reply. If you want to take the code further, fork it — see [Project status](README.md#project-status) and [DISCLAIMER §0](DISCLAIMER.md#0-retirement-notice).
>
> The rest of this file is kept as a record of how the project was set up and what its conventions were, for anyone reading or forking the source.

This is a personal project I built for myself to catch an earlier DVSA test cancellation, then shared publicly in case it helps anyone else in the same situation. It is not a team effort, a maintained product, or a community-led project.

**No commitment is made to ongoing maintenance, code review, response to issues, or merging of pull requests.** Any of those things may happen at the maintainer's discretion and availability, or may not. The repository may be archived or marked unmaintained at any time without notice. See [DISCLAIMER §15 (Discontinuation)](DISCLAIMER.md#15-modifications-discontinuation-and-changes-to-these-terms).

The rest of this file documents the project's conventions and how the local setup works, in case you'd like to contribute regardless.

## Filing an issue

Bug and feature templates live in [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE/). For security issues, see [SECURITY.md](SECURITY.md) — don't file those as public issues.

## Opening a PR

PRs go through the standard GitHub flow. There's no commitment that PRs will be read, reviewed, commented on, or merged. PRs that don't fit the project's scope may be closed without further discussion.

If you'd like to contribute anyway, the rest of this file covers the conventions.

## Getting set up locally

There's no build step or test framework, it's a single-file Tampermonkey userscript.

```bash
# Clone
git clone https://github.com/alchemycharlie/dvsa-earlier-slot-watcher.git
cd dvsa-earlier-slot-watcher

# Verify the public script parses cleanly
node --check dvsa-slot-watcher.user.js
```

To test changes:

1. Open Tampermonkey's dashboard
2. Disable the production install of the script (so the two don't conflict)
3. Create a new userscript and paste your local file's contents
4. Save and reload your DVSA booking page

Your real config (date window, test centre, instructor dates, login credentials) lives in the browser's `localStorage`, not in the script file. Use the in-page settings panel to set up your environment — never hardcode personal values into `dvsa-slot-watcher.user.js`. The `.gitignore` blocks `*.personal.user.js` for anyone who wants a local copy of the script with their own bundled defaults, but it's no longer required: the settings panel + JSON import/export are the supported way to configure.

## Coding conventions

This is a userscript, not a SPA, keep it simple:

- **One file**, no build step, no bundler, no transpilation. The script ships as-is.
- **Vanilla JS**, no jQuery, no React, no external libraries. Tampermonkey runs in many browser versions; stick to features supported in evergreen browsers from the last ~3 years.
- **No external network calls.** This is a hard rule. The script must not load fonts, icons, analytics, or anything else over the network beyond DVSA's own site. Inline SVGs, inline CSS, no CDNs.
- **CSS classes are `dvsa-` prefixed**, no chance of colliding with DVSA's own stylesheet.
- **No `eval`, no `new Function`**, both for security and because Tampermonkey's `unsafeWindow` access requires care.
- **Comments matter.** Explain *why*, particularly for anything that interacts with DVSA's quirks (Spring WebFlow URLs, cycle pacing, body IDs, etc.). The next maintainer will thank you.
- **Match existing patterns.** The script has consistent patterns for things like rendering panel sections, wiring handlers, status pill updates, and finding storage. New code should look like existing code.
- **Personal data must never appear in the public file.** Don't commit licence numbers, booking refs, real test centres in your config, dates from your booking, etc. Your config lives in the browser's `localStorage`, set it up via the in-page settings panel after install, or import a JSON config.

## Scope guidance

The following categories fit the project. Whether any individual PR within these categories is reviewed or merged is still entirely at the maintainer's discretion.

**Generally in scope:**

- Bug fixes to existing features
- Selector resilience, making the script more tolerant of DVSA page changes
- Accessibility improvements: ARIA labels, keyboard navigation, focus management
- Documentation improvements: clearer instructions, more troubleshooting tips, additional FAQ entries
- Performance improvements that don't introduce build steps

**Won't be accepted:**

- Bot-detection evasion beyond the existing human-pacing approach
- Fully automatic booking that clicks past the Confirm changes page
- Headless / server-side scanning
- Adding external network calls (analytics, Discord webhooks, etc.), even opt-in. Hard rule.
- Replacing the rendering layer (no React/Vue/Svelte/etc.)
- Build-system additions (no webpack, vite, rollup, etc.)
- Breaking the public install URL — renames or path changes break auto-update for everyone

## Pull request checklist

Before opening a PR:

- [ ] The public file (`dvsa-slot-watcher.user.js`) parses: `node --check dvsa-slot-watcher.user.js`
- [ ] You've tested the change manually in a real browser against the real DVSA flow (or noted in the PR description if you weren't able to)
- [ ] No personal data in the diff (no real licence numbers, booking refs, postcodes, instructor dates, or specific test centres beyond what's already there for examples)
- [ ] No new external network calls
- [ ] No new external dependencies / CDN references
- [ ] CSS changes are scoped (`dvsa-` prefix)
- [ ] You've updated the [CHANGELOG](CHANGELOG.md) under an `[Unreleased]` section (or the next version) if your change is user-visible
- [ ] You've kept the diff focused, one concern per PR. Refactors and feature additions in separate PRs.

## Commit messages

No strict format. Keep them clear:

```
Good:
  Fix instructor date pill removal on slow render
  Add per-day-of-week filter to settings panel
  Document Error 15 in troubleshooting

Less good:
  fix bug
  update
  changes
```

## Code of conduct

Be kind. Be patient. Assume good faith. Help newer contributors. If you can't, walk away.
