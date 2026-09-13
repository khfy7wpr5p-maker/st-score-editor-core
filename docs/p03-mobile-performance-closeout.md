# P03 Mobile Workspace and Performance Closeout

Date: 2026-09-07
Branch: `p03-mobile-context-toolbar-v1`
PR: #144 (open; not merged)

## Scope result

P03 code-side scope is complete on the isolated work branch. This closeout does not authorize merge, release, deployment, or physical-device PASS.

### P03-MOBILE01 — semantic mobile teacher toolbar

Verified head: `a62c289566186709268e8fd62831e1f09ca23357`
CI: `34088228405`
Matrix: Node 18 / 20 / 22 PASS

Evidence:
- teacher commands use current-revision `SemanticAddressV3` selection;
- Copy and octave transpose use two distinct semantic event endpoints rather than weakening the P02 span contract;
- Paste/Insert continue to use semantic destinations and the existing `EditorSessionV4` authoring paths;
- minimum touch target is 44 CSS px;
- safe-area handling and touch-oriented toolbar behavior are explicit;
- no DOM/SVG/renderer coordinate authoring authority.

### P03-VIEWPORT01 — one-controller presentation viewport

Initial verified head: `ee7a04f444de6936573059c57fb8d03a4bcaf2e4`
CI: `34088598607`
Matrix: Node 18 / 20 / 22 PASS

The reusable presentation layer was then hardened during BUNDLE01. The first mobile composition instantiated an unnecessary second presentation viewport state even though the existing standalone capability chain already contained `viewport-enabled`. It did not create a second canonical controller, but it was redundant.

Final policy:
- reuse the existing `viewport-enabled` presentation state;
- one canonical/session controller only;
- zoom/pan/page state is presentation-only;
- zoom/pan does not create a canonical revision or history entry;
- semantic selection survives viewport operations;
- renderer/DOM coordinates remain non-authoritative for authoring.

### P03-PERF01 — measured interaction evidence

Verified head: `3b5d06e1d3b74d804e064f57c9e906d3c5a16c44`
CI: `34088774151`
Matrix: Node 18 / 20 / 22 PASS

CI-host benchmark measurements are informational only. PASS/FAIL is not tied to a runner-specific millisecond threshold. The deterministic performance contract is that presentation/selection interaction loops do not create unintended canonical revisions/history growth and retain semantic authority boundaries.

Example Node 22 CI-host measurement from the verified run:
- viewport: about 1.68 ms for the benchmark loop;
- semantic selection: about 503.58 ms for the benchmark loop.

These are not physical iPhone/iPad measurements.

### P03-BUNDLE01 — global standalone capability cutover

The standalone global runtime was changed from the prior `triplet-retiming` terminal wrapper to the verified teacher/mobile superset while preserving the earlier standalone capability chain.

Preserved global capabilities include:
- release hardening;
- renderer lifecycle and semantic renderer-hit bridge;
- viewport navigation;
- file/recovery;
- playback;
- export/print;
- prior authoring capabilities through triplet retiming.

Added global capabilities include:
- P02 bounded teacher workflow;
- P03 mobile teacher toolbar;
- existing-viewport reuse metadata and behavior.

#### CI failure and root cause

Initial BUNDLE01 build failed at the old APP-11F bundle cap:
- actual: `533716` bytes;
- old cap: `524288` bytes (512 KiB);
- CI: `34089296829`.

Removing the redundant second presentation viewport reduced the bundle to `533484` bytes but the old cap still failed:
- actual: `533484` bytes;
- old cap: `524288` bytes;
- CI: `34095704897`.

The remaining growth came from shipping the already-verified P02 teacher workflow in the actual standalone global runtime, not from a duplicate canonical controller or an accidental external dependency.

#### Bounded budget rebaseline

No fail-closed validation or completed teacher capability was removed just to satisfy an obsolete pre-P02 cap. The standalone budget was rebaselined by the smallest selected bounded increment:
- previous cap: `524288` bytes;
- new cap: `540672` bytes (528 KiB);
- increase: `16384` bytes (16 KiB);
- budget revision: `P03-TEACHER-MOBILE-1`.

The successful pre-closeout BUNDLE01 verification was:
- head: `1298e164fba7c48aa47d617edeba86dfc4abcc11`;
- CI: `34096327856`;
- Node 18 / 20 / 22 PASS;
- actual standalone bundle: `533484 / 540672` bytes;
- full suite: 636 tests PASS.

A final exact-head CI must still be recorded after closeout/roadmap documentation commits before the branch is called final.

## Safety and authority status

- Canonical authority remains unchanged.
- `EditorSessionV4` remains unified history authority.
- Renderer/DOM/SVG coordinates are not authoring authority.
- Network authority remains false for these local editing paths.
- `manualDeviceValidationRequired` remains true.
- `standaloneReleaseGatePassed` remains false.
- Physical device validation: NOT_RUN.
- PR #144 is open and must not be merged without separate authority.
- No release or production activation is authorized.
- SesliTab/Smoosic scope remains frozen and untouched.
- Existing pinned SesliTab ST Score Editor runtime/build dependency remains preserved as-is.

## Next autonomous package

After final exact-head CI for this closeout, continue with P04: file, recovery, MusicXML preservation, capability split, and partial/degraded support behavior. Keep physical-device validation as an explicit release/pilot gate rather than fabricating PASS from browser automation.
