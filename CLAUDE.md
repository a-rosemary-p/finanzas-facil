@AGENTS.md

## Changelog protocol (project-level rule)

There is a **changelog file outside the repo** at:

```
C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_CHANGELOG.md
```

**You must update it** every time you ship a meaningful change to the product
or the spec. "Meaningful" = anything that would be worth mentioning if a teammate
asked "what changed since last week?". Bug fixes that move user-visible behavior
count. Pure typo fixes don't.

When to write to it:
- After landing a feature or refactor (post-push is fine; before push is fine).
- When iterating on something that's still WIP, append to the in-progress
  version block. Don't wait for a final spec bump to record entries — the
  changelog is the running memory.
- When bumping the spec to a new version, finalize the in-progress block and
  start a fresh one for the next version.

Format:
- Top of file shows the current published spec version + the in-progress
  version (if any).
- Each version has sub-blocks by area (Navigation, Charts, IA endpoints, etc.).
- Bullets concise. Reference file paths and feature names; don't re-explain
  decisions already in commit messages or the spec.
- Do not commit this file. It lives on the user's machine and is intentionally
  not tracked. Path is outside the repo so `git add` won't pick it up by
  default; keep it that way.

Why it lives outside the repo: it's project-internal memory for the engineer
+ agent, not product. Mixing it into the repo would confuse future contributors
into thinking it's a public release notes document.
