# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 2.0.0-alpha.1 (2026-08-29)

### Features

* automate the version bump and forbid stray version literals ([805a370](https://github.com/mwgrant21/TokenMonitorV2/commit/805a3705efe4b680e39274918ae203d56c8a65c7))
* buildInfo.json as the single source of truth for build version ([8460a1b](https://github.com/mwgrant21/TokenMonitorV2/commit/8460a1bb661f6da1223645eeedcfb57dad94daa0))
* channel drives the version check, and cutting a build writes latest.json ([37084ca](https://github.com/mwgrant21/TokenMonitorV2/commit/37084ca6c748ed29d67fdab348fb690d54753005))
* COPY VERSION INFO in the footer popover and Settings ([659614e](https://github.com/mwgrant21/TokenMonitorV2/commit/659614ef1184d4604f7c0df31d05e61528779e5b))
* declare @tokenmonitor/core as a workspace dependency ([b9dc348](https://github.com/mwgrant21/TokenMonitorV2/commit/b9dc348df43a3ad34be7c92491346ed875381d50))
* fleet version column and an N-seats-behind chip ([73cecf0](https://github.com/mwgrant21/TokenMonitorV2/commit/73cecf05d263265370187d05478df2e3c421efbc))
* **reskin:** Aether token layer behind compatibility aliases ([1e06197](https://github.com/mwgrant21/TokenMonitorV2/commit/1e06197c44f3d6ed34c8b1295c1c178af4c3c934))
* **reskin:** agent lanes, task breakdown and treemap typography (Phase 5 slice 3) ([3c8882b](https://github.com/mwgrant21/TokenMonitorV2/commit/3c8882ba806dfaa28ea10486afc0d35fdda71788))
* **reskin:** hero tiles typography and accent bar (Phase 5 slice 1) ([a799a4d](https://github.com/mwgrant21/TokenMonitorV2/commit/a799a4d64dae387380c62f4aafd8b86c127e82d5))
* **reskin:** optimize card typography, recurring border driven by real state (Phase 5 slice 5) ([f294a32](https://github.com/mwgrant21/TokenMonitorV2/commit/f294a329c882a23754404283257cc27b1cae57ab))
* **reskin:** palette + mode controls, retire the legacy palette engine ([7037f4e](https://github.com/mwgrant21/TokenMonitorV2/commit/7037f4eff6ed1b1fc5a32c6df702168e9f8bf34e))
* **reskin:** persist palette and light/dark mode ([d0d1c8f](https://github.com/mwgrant21/TokenMonitorV2/commit/d0d1c8f58c8e7ad75b33598d33a1d4e6ca4b5b0c))
* **reskin:** self-host Rajdhani and Space Mono ([fe3f333](https://github.com/mwgrant21/TokenMonitorV2/commit/fe3f3335929249be74731a44424049dcb3ab70f3))
* **reskin:** translate the seven remaining legacy palettes, audited ([fa8fafd](https://github.com/mwgrant21/TokenMonitorV2/commit/fa8fafd04cbab3550e42dec424b9ea30e918fc4b))
* **reskin:** unify the 78% warn threshold into alertEngine's tier output (Phase 5 slice 2) ([86e2960](https://github.com/mwgrant21/TokenMonitorV2/commit/86e2960345046a1142c39cce382cb7da48a394c1))
* transplant the v1 Electron application into this repo ([d20cad9](https://github.com/mwgrant21/TokenMonitorV2/commit/d20cad93ab26fbd3af6e586254febe484f4ccae9))
* wire the shared-folder version check (Tasks 2-4) ([3b5388e](https://github.com/mwgrant21/TokenMonitorV2/commit/3b5388e24efb35128ce8e9966d87247ca36268a1))

### Bug Fixes

* actually apply Rajdhani/Space Mono via --f-ui/--f-mono ([4f53574](https://github.com/mwgrant21/TokenMonitorV2/commit/4f53574b423653c7291ce880abfc936276d7e6e7))
* **alerts:** memoize the banner and toast render for real ([a532810](https://github.com/mwgrant21/TokenMonitorV2/commit/a532810383dbac563aa2d0c755caf2632e0a0421))
* barrel re-export support in CJS build, and a test glob hiding 40 assertions ([8390630](https://github.com/mwgrant21/TokenMonitorV2/commit/83906308e181ad973dae7d48cafec5009e22d84e))
* clarify alarm-colour deviation and track light-mode contrast follow-up ([aa73296](https://github.com/mwgrant21/TokenMonitorV2/commit/aa73296e7290ba9389949a6ed69af3cd689093cc))
* emit resultLength per tool result so findUncappedBashOutput can fire ([dbd079f](https://github.com/mwgrant21/TokenMonitorV2/commit/dbd079ff51bb9363397fae8c75752e9e5c1f4bc5))
* give light mode its own alarm triple (closes follow-up 5) ([cb4e12c](https://github.com/mwgrant21/TokenMonitorV2/commit/cb4e12cc6001fe1fdc5a4debfe1e4c3bdfced476))
* keep @tokenmonitor/core private, drop public publishConfig ([98112eb](https://github.com/mwgrant21/TokenMonitorV2/commit/98112eb5d2725d418b780d215b84296f95b5b88b))
* re-poll version status instead of fetching it once at mount ([852fe34](https://github.com/mwgrant21/TokenMonitorV2/commit/852fe34ce21a50a0836ceac1f00d1ad64b4be1de))
* **reskin:** alert banner - distinguish critical from warning, adopt alarm-border language (Phase 5 slice 4) ([f8fdf60](https://github.com/mwgrant21/TokenMonitorV2/commit/f8fdf608a33ab07790c308adab2f5fa8bbca31b6))
* **reskin:** close the three palette escapes ([93f76b3](https://github.com/mwgrant21/TokenMonitorV2/commit/93f76b3e1d05ed9e5ae75caa9aa5cb8e85a477c5))
* **reskin:** correct the --alarm token misuse and the alert fix-panel seam ([5768f3c](https://github.com/mwgrant21/TokenMonitorV2/commit/5768f3c2473d74bfb7c043d93e06ca5fc1920242))
* **reskin:** mode pill reflects rendered mode, not stored mode, on legacy palettes ([229221b](https://github.com/mwgrant21/TokenMonitorV2/commit/229221be6b1d6f732994104ab240caa8bb7f5f78))
* **reskin:** restore planBar's amber tier, accidentally deleted by Task 2 ([43d93f2](https://github.com/mwgrant21/TokenMonitorV2/commit/43d93f202a4edc3a51aa085967e51a6d464ece7e))
* **reskin:** restore treemap label ink, stop the alert banner re-animating ([d12a6fe](https://github.com/mwgrant21/TokenMonitorV2/commit/d12a6fe89aa70c0fbf6a64b36082b9da6dca92fe))
* **reskin:** revert unrequested body-background token swap ([1713765](https://github.com/mwgrant21/TokenMonitorV2/commit/1713765c1dba501a2541a2c5fbbdea9adf01e3bd))
* retire the auto-updater and the credential it bundled ([ccbff25](https://github.com/mwgrant21/TokenMonitorV2/commit/ccbff250f608b9faf50b538e4267042f71816327))
* stop the generated changelog inventing issue links ([90a74a0](https://github.com/mwgrant21/TokenMonitorV2/commit/90a74a0ed48a17373c280e13a843c4f0b069b148))
