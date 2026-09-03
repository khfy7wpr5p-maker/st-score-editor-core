# APP-09B OSMD host compatibility boundary

Status: bounded compatibility fix for real-device release testing.

## Problem

The renderer contract already admits the ST Score Rendering Layer exact OSMD profile `opensheetmusicdisplay@2.1.2`, while the legacy direct OSMD adapter host type remained narrowed to `2.1.1`. This prevented the already-reviewed ST Rendering Layer profile from being attached through the browser renderer lifecycle.

## Change

- Preserve legacy `OSMD_INTEGRATION_VERSION = 2.1.1` behavior.
- Admit the exact ST Rendering Layer host version `2.1.2` in the OSMD adapter.
- Continue validating every host through the renderer contract admitted-profile list.
- Require request and host package/version/license to match exactly.
- Keep unknown versions fail-closed.

## Authority boundary

This change grants no renderer canonical authority, edit authority, network authority, persistence authority, server authority, publication authority, Stage release authority or SesliTab cutover authority.

It does not add `opensheetmusicdisplay` as a repository runtime/build dependency and does not bundle a renderer implementation into the standalone app.

## APP-09B consequence

This resolves the exact-version adapter mismatch found during iPhone Safari release testing, but it does not by itself close Issue #91. The isolated APP-09B host still needs to supply the real ST Rendering Layer/OSMD implementation and then rerun the manual device matrix.
