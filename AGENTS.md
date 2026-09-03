# Nourish — notes for agents

> **Current state lives in [SPEC.md](SPEC.md), not here.** Start with **§6.1 Session
> state**, then §7 Known Issues. This file is conventions only — it deliberately does
> not keep its own running log, because two progress logs always disagree within a week.
> `.claude/CLAUDE.md` holds the enforceable project rules; read it before editing.

## What this is

A private, local-first nutrition app for one household. Next.js 16 + React 19 through
vinext/Vite, TypeScript, Tailwind. No cloud backend. Runs on KP's Mac Mini and is reached
over Tailscale. KP is not an engineer — explain in plain English and verify things
yourself rather than asking him to check.

## The one thing that will catch you out

**Nourish is served over plain HTTP on a private Tailscale IP, so the browser treats it as
an INSECURE context.** `localhost` is the single origin browsers exempt from that rule —
which means the dev server and the whole test suite run in a *more* permissive environment
than every real device.

A whole family of Web APIs silently does not exist on the real thing:
`crypto.randomUUID`, `crypto.subtle`, `navigator.clipboard`, `navigator.share`,
`navigator.mediaDevices`, `navigator.geolocation`, `navigator.storage`, the file-picker
APIs. On 2026-08-30 one call to `randomUUID` during render blanked the entire app on every
phone for weeks, while working perfectly in every test.

- Ids come from `app/ids.ts`. Never call `randomUUID`.
- `tests/insecure-context.test.ts` scans client source and will fail the build if any of
  these appear. Do not weaken it; add to its list if you find another.
- **Verifying on `localhost` proves almost nothing about this app.** To test as a real
  device does, bind the front door to `0.0.0.0` and open it at the machine's Tailscale IP,
  then confirm `isSecureContext === false` in the console before trusting the result.

## Testing

```bash
npm test    # build + 196 checks
npm run lint
```

`npm test` chains with `&&`, so a failure in the first file aborts the rest — read the
final pass/fail counts, never assume silence means green.

House rules that are actually enforced in review:

- **A test that passes against the old code is worse than no test.** Reintroduce the bug,
  watch the test fail, restore, watch it pass. Both `tests/insecure-context.test.ts` and
  the food-photo sweep test in `tests/log-photos.test.mjs` were built this way.
- Any change to matching, classification, or macro data ships with a test that fails
  against the previous behaviour.
- Reading code is not verifying behaviour. Drive the real app.

## Deploying

The Mac Mini runs the `launchd` service `com.kanwar.nourish` on **port 3902** — this
project is the exception to the usual pm2 rule. `npm run release` is the only sanctioned
deploy: it builds, snapshots, swaps, restarts, verifies the live page and every asset, and
rolls back automatically. `git push` alone is not a deploy.

Only the Mac Mini should run the service. KP's laptop is for editing; if you find a
`com.kanwar.nourish` LaunchAgent installed there, it is drift — it caused a duplicate
instance on 2026-08-29.

## Non-negotiables

Full list in `.claude/CLAUDE.md`. The ones most easily broken by accident:

- Port 3902 only, no fallback. 3903 is internal and never exposed.
- Never show a guessed macro as if it were known; every displayed value carries its
  provenance tier. A missing number beats a wrong one.
- Never claim something saved to the Mac Mini unless the write actually succeeded — and
  don't imply it visually either (an image preview left on screen after a failed upload is
  the same lie).
- The diary keeps every day; only today's slice is rewritten. `withDayLogs()` is the only
  sanctioned way to write a day.
- Restore merges and never deletes; sync must carry deletions. They are different
  functions on purpose.
- Nothing reads, writes or syncs a diary until that profile's own load has finished.
- Anything the desktop sidebar hosts must also be reachable on mobile, where it is hidden.

<!-- BEGIN:hq-continuity — generated block, do not hand-edit.
     Source: AI HQ/System/project-claude-template.md
     Propagate: python3 ~/"AI HQ/System/bin/sync-project-rules" -->

## Continuity — if your session dies mid-task

KP runs several agents (Claude, Codex, ChatGPT, Grok) and **credits expire
mid-task**. This section is here because you may be an agent that never reads
KP's global rulebook — do not assume someone else is handling continuity.

**Before you start**, check whether a previous session was cut off:

```bash
python3 ~/"AI HQ/System/bin/resume"          # add --json if you parse it
```

Exit 3 means nothing to resume. Otherwise it prints what the last agent was
doing, what it had landed, what failed, and what not to redo. **Report that to
KP and wait** — do not silently continue someone else's plan.

**While you work**, leave a trail so the next agent can pick up from any
instant. Claude Code does this automatically via hooks; **every other agent
must do it by hand**:

```bash
FR=~/"AI HQ/System/flight-recorder.py"
python3 "$FR" --session "<your-session-id>" --cwd "$PWD" --prompt "<what KP asked>"
python3 "$FR" --session "<your-session-id>" --note "Edit ok path/to/file.ts"
python3 "$FR" --session "<your-session-id>" --note "Bash FAIL npm run build"
python3 "$FR" --session "<your-session-id>" --intent "next=<the very next step>"
python3 "$FR" --session "<your-session-id>" --close   # only on a clean finish
```

Update `--intent` every ~15 meaningful actions, and always before a risky or
long-running step. A journal with no `--close` is what marks the session as
interrupted, so **never close a session you did not actually finish**.

**Durability:** the journal is ephemeral (14 days) and is for handoff only.
Anything worth keeping goes in `SPEC.md` §9 at session end — git and SPEC.md
are the permanent record, the journal is not.

<!-- END:hq-continuity -->
