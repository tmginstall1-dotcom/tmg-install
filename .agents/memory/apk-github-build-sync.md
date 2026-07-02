---
name: Android APK build depends on GitHub main sync
description: Why staff-app UI changes silently fail to reach installed Android apps
---

The staff Android app is a Capacitor build with `webDir: "dist/public"` and **no** `server.url` — every screen is baked into the APK at build time. Only API calls hit the live server; the UI is frozen at whatever web bundle was compiled into the installed APK.

New APKs are produced ONLY by the GitHub Actions workflow `.github/workflows/build-android.yml`, which builds from the **GitHub repo's `main` branch** (repo: `tmginstall1-dotcom/tmg-install`). Triggers: push to GitHub main touching `client/**`/`shared/**`/`android/**`/`capacitor.config.ts`, or manual `workflow_dispatch`. On success it publishes a signed APK to the `latest-build` GitHub Release and pings `/api/system/build-complete` so staff apps show an update banner.

**The trap:** Replit "Publish/Deploy" updates the WEB app only — it does NOT push to GitHub and does NOT build the APK. GitHub main is a *separate* sync. If the GitHub push credential expires, recent Replit code never reaches GitHub, so:
- the APK build pipeline keeps compiling stale code, and
- staff installed apps silently stop getting any UI change (e.g. the break button).

**Why:** discovered when a clocked-in staff phone showed no break button though the code was correct and committed locally. GitHub main was months behind (stuck at an old commit) and its `Dashboard.tsx` lacked `button-start-break`; the token in `.git/config` returned 401 and `listConnections('github')` was empty.

**How to apply:** any staff-app (client/**) UI change reaches phones only after (1) the current code is pushed to GitHub main with a *valid* credential, (2) the Android workflow runs, (3) staff update/reinstall. Verify GitHub main is current (check latest commit date + grep the changed file via the GitHub API) before assuming a rebuild will include the change.

**Pushing from the sandbox IS possible** (contrary to the earlier "can't do git here" note) once GITHUB_TOKEN is valid: inject it inline — `git push "https://x-access-token:${GITHUB_TOKEN}@github.com/tmginstall1-dotcom/tmg-install.git" <sha>:main`. Two traps: (1) the repo is ~1.6GB with heavy binary history, so an all-at-once 1000+ commit push times out / dies; push in **checkpoints** (`git rev-list --reverse OLD..HEAD`, pick every ~150th + HEAD, push each `sha:main` synchronously in the foreground — each landed checkpoint persists on GitHub so it's resumable). Background/nohup pushes get killed when the tool call returns — use foreground. (2) The PAT MUST have **both `repo` AND `workflow` scopes** — commits that touch `.github/workflows/*.yml` are remote-rejected ("without `workflow` scope") if the token lacks `workflow`. Editing a classic token's scopes keeps the same value, so the stored secret stays valid.
