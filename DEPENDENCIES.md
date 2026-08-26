# Dependency Register

## TypeScript

- package: `typescript`
- admitted version: `6.0.3` (exact pin)
- scope: development/build only
- runtime authority: none
- license: Apache-2.0
- upstream: `microsoft/TypeScript`
- reason: compile the strict TypeScript core
- install policy: ignore lifecycle scripts; no audit/fund network side effects in CI

## saxes

- package: `saxes`
- admitted version: `6.0.0` (exact pin)
- scope: MusicXML XML well-formedness / SAX parsing only
- runtime authority: parser only; never canonical score authority
- license: ISC
- upstream: `lddubeau/saxes`
- upstream tag: `v6.0.0` → commit `211fa0ebec9b628affc09219199639887174bfc3`
- reason: strict namespace-aware single-pass XML parser
- provenance: also used as exact `6.0.0` by `musicxml-to-guitar-tab-engine`
- TypeScript 6 compatibility: runtime package remains unchanged; compile-time resolution uses `types/saxes-6.0.0-compat.d.ts`
- compiler safety: `skipLibCheck` remains `false`

## xmlchars

- package: `xmlchars`
- admitted version: `2.2.0` (exact direct pin)
- scope: transitive support dependency required by `saxes@6.0.0`
- runtime authority: none
- license: MIT
- reason: exact root pin prevents the `saxes` semver range from drifting during resolution

## OpenSheetMusicDisplay — E6 host integration target

- package: `opensheetmusicdisplay`
- admitted integration version: `2.1.1`
- license: BSD-3-Clause
- upstream: `opensheetmusicdisplay/opensheetmusicdisplay`
- upstream release date: 2026-07-29
- role: classical score presentation in ScoreMosaic host
- repository dependency: **no**
- authority: presentation only
- adapter surface: host-injected `load(string)` + `render()` (+ optional `clear()`)
- reason not installed in core: OSMD 2.1.1 declares several semver-range transitive dependencies. Without a core lockfile, installing it here would weaken reproducible supply-chain control. ScoreMosaic should pin/lock it at the product boundary.

## alphaTab — E6 host integration target

- package: `@coderline/alphatab`
- admitted integration version: `1.8.4`
- license: MPL-2.0
- upstream: `CoderLine/alphaTab`
- upstream release date: 2026-07-05
- role: guitar notation/TAB presentation in Guitar TAB host
- repository dependency: **no**
- authority: presentation only
- adapter surface: host-injected `api.load(Uint8Array)` (+ optional `destroy()`)
- provenance: `musicxml-to-guitar-tab-engine` already pins `@coderline/alphatab` exactly at `1.8.4` and has browser compatibility evidence for this load path

## E6 supply-chain rule

The renderer integrations are explicit **host integration targets**, not dependencies of `st-score-editor-core`. This repository still installs only the exact parser dependency set plus the exact build-only TypeScript compiler. Renderer hosts must independently pin/lock the admitted version and satisfy the adapter profile before rendering.

No renderer can mutate canonical score state, authorize an edit from coordinates/DOM state, or bypass E3 semantic addressing / E4 transaction validation.

AI/model, UI framework, storage, network service, and production activation dependencies remain unadmitted through E6.
