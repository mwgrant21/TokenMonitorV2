# Cutting a release

Rollout is manual by design. There is no update server, no outbound version check, and
no bundled credential — a build is an installer you hand out, plus one small file you
drop on a share. See `docs/design/aether-convergence-plan.md` for why.

Two steps here are silent when missed: the `latest.json` copy (nobody is told a new
build exists) and the AppContainer ACE (the app dies on launch with an error that names
the GPU process, not the cause). Neither fails loudly. Both are called out below.

## Before you start

- **Signing material.** `codesign/tokentracker-codesign.pfx` and
  `codesign/pfx-password.txt` must exist. `codesign/` is gitignored, so a fresh clone
  has neither — copy them from a machine that already builds. `npm run dist` checks for
  the password file before it bumps anything, so a missing cert costs you nothing but a
  re-run.
- **Do not generate a new cert to get past a missing one.**
  `scripts/generate-codesign-cert.ps1` will make a matched pair, but a new self-signed
  cert is a *different publisher identity* from the one every existing install was
  signed with. Windows treats the result as unrelated software. Transport the existing
  `.pfx` instead unless you are deliberately changing identity.
- **Clean tree.** The bump commits and tags, so anything uncommitted gets tangled in the
  release commit.
- **Tests green.** `npm test`.

## Cutting it

```
npm run dist
```

That is bump → changelog → commit → tag → build → `latest.json`, in that order:

1. **Checks the signing material** before touching git. A missing cert discovered after
   the tag would leave a released version number on a build that was never cut.
2. **Bumps the version** with `commit-and-tag-version`, derived from the conventional
   commit prefixes since the last tag. No number is typed by hand anywhere.
   - A build cut from a prerelease **stays on that channel** — `2.0.0-alpha.0` becomes
     `2.0.0-alpha.1`, not `2.0.0`. Graduating a channel is a decision you type:
     `npm run dist -- --release-as minor`, or `-- --prerelease beta`.
3. **Writes `buildInfo.json`** — version, commit, build timestamp, channel. This is the
   only thing the running app consults for its own version; `app.getVersion()` is not
   used anywhere. It is generated, never committed.
4. **Builds and signs** via electron-builder into `dist/`.
5. **Writes `dist/latest.json`** — only if the build succeeded, because a `latest.json`
   naming a version whose installer does not exist points the whole fleet at nothing.

## Publishing it

### 1. Copy `latest.json` to the fleet share — silent when missed

```
copy dist\latest.json <fleet share>\latest.json
```

The share is the folder seats point at under Settings. Every seat reads `latest.json`
from it on a 60s tick; that read is the entire update check. Until the file is there,
nobody is told the new build exists — no error, no chip, just silence. Seats already
running keep saying "up to date", which is the one failure mode this whole feature was
built to prevent.

`latest.json` supports an optional `notes` string. `npm run dist` omits it; add one by
hand if the release is worth a sentence.

### 2. Hand out the installer

`dist/Claude Token Tracker Setup <version>.exe`, a per-machine NSIS installer.

The certificate is self-signed, so on a machine that has never seen it Windows reports
*"a certificate chain processed, but terminated in a root certificate which is not
trusted"* and SmartScreen will warn. Import `codesign/tokentracker-codesign.cer` into
Trusted Root on target machines, or accept the prompt.

### 3. The AppContainer ACE — silent when missed

Electron's GPU and renderer children run in a Windows AppContainer, which can only map
DLLs from a directory granting read+execute to `ALL APPLICATION PACKAGES` (S-1-15-2-1).
Without it the app dies on first launch with `exit_code=-1073741515`
(STATUS_DLL_NOT_FOUND), reported as *"GPU process isn't usable. Goodbye."* — an error
that names the symptom and not the cause.

- **Installed builds:** handled. `build/installer.nsh`'s `customInstall` macro grants it
  on `$INSTDIR`. Verify with
  `icacls "C:\Program Files\Claude Token Tracker"` — look for
  `ALL APPLICATION PACKAGES:(OI)(CI)(RX)`.
- **`dist/win-unpacked`:** *not* handled. electron-builder writes that directory without
  the ACE, so running the unpacked build directly fails where the installed one works.
  If you want to test it:

  ```
  icacls "dist\win-unpacked" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T /C
  ```

- **Dev checkouts:** handled by `scripts/grant-appcontainer-acl.js` on postinstall. Do
  not drop the `install-electron &&` half of that script — without it the grant silently
  finds nothing to grant.

## Verifying a cut build

1. Launch the installed app. The footer chip must read the version you just cut. If it
   reads `unknown`, `buildInfo.json` did not make it into the package — check the
   `files` list in `electron-builder.yml`.
2. Click the chip, then **COPY VERSION INFO**, and paste it. One line, naming the
   product, the version and the build sha.
3. Point a seat at a share whose `latest.json` names a higher version. Within a minute
   the footer shows an amber `UPDATE AVAILABLE · v<version>` chip. Two of the three
   states render no chip at all: silence is the reward for being current, and `unknown`
   must never look like an error.
4. Team view shows a **Version** column and, when seats disagree, an `N seats behind`
   chip. Seats whose snapshot predates the field read `unknown` — never a version.

## Pushing

The bump commits and tags locally and pushes nothing:

```
git push --follow-tags origin main
```
