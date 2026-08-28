# Dependency Register

## Installed dependencies

### TypeScript
- package: `typescript`
- admitted version: `6.0.3` (exact pin)
- scope: development/build only
- runtime authority: none
- license: Apache-2.0
- upstream: `microsoft/TypeScript`
- install policy: ignore lifecycle scripts; `skipLibCheck` remains `false`

### esbuild
- package: `esbuild`
- admitted version: `0.28.2` (exact pin)
- scope: development/build only
- authority: browser bundling only
- runtime authority: none
- license: MIT
- upstream: `evanw/esbuild`
- admission stage: E7-H
- packaging target: deterministic IIFE browser artifact, ES2022
- external browser imports: forbidden by repository contract

### saxes
- package: `saxes`
- admitted version: `6.0.0` (exact pin)
- scope: MusicXML XML well-formedness / SAX parsing only
- runtime authority: parser only; never canonical score authority
- license: ISC
- upstream: `lddubeau/saxes`
- upstream tag: `v6.0.0` → commit `211fa0ebec9b628affc09219199639887174bfc3`
- TypeScript 6 compatibility uses the narrow local declaration `types/saxes-6.0.0-compat.d.ts`; the runtime package is unchanged

### xmlchars
- package: `xmlchars`
- admitted version: `2.2.0` (exact direct pin)
- scope: support dependency required by `saxes@6.0.0`
- runtime authority: none
- license: MIT

## Host renderer integration targets

### OpenSheetMusicDisplay
- package: `opensheetmusicdisplay`
- admitted integration version: `2.1.1`
- license: BSD-3-Clause
- upstream tag commit: `c54770de13368a4f5c9150bffb16f099b7b8537b`
- role: classical score presentation
- repository dependency: **no**
- authority: presentation only
- host owns exact dependency pin/lock

### alphaTab
- package: `@coderline/alphatab`
- admitted integration version: `1.8.4`
- license: MPL-2.0
- upstream tag commit: `022a45c8e42370f9e12e68949d11eada370da83d`
- role: guitar notation/TAB presentation
- repository dependency: **no**
- authority: presentation only
- host owns exact dependency pin/lock

## E7 dependency rule

Stages E7-A through E7-G add no new third-party runtime dependency. E7-H admits exactly one additional **build-only** tool: `esbuild@0.28.2`, restricted to deterministic browser bundling.

## E8 dependency rule

E8-A adds `guitar-workspace-contract`, E8-B adds `guitar-workspace-projection`, and E8-C adds `guitar-workspace-result` as first-party TypeScript packages. **None adds a third-party dependency.**

The external repository `khfy7wpr5p-maker/musicxml-to-guitar-tab-engine` is reviewed as a contract/reference boundary at main SHA `93abe9735a4ed70ad8362ac24ec39869ea34607f`.

Through E8-C it is still:

- not installed as a package dependency;
- not vendored;
- not fetched at runtime by core;
- not invoked by core;
- not granted network/process authority;
- not granted canonical score mutation authority.

E8-C accepts only a host/test-supplied bounded JSON representation of the reviewed `CanonicalTabResult 2.0.0` contract and revalidates it against the current locally derived E8-B projection. JSON parsing uses platform `JSON.parse`; no new parser package is admitted.

The core repository currently installs only:

- runtime: exact `saxes@6.0.0`, exact `xmlchars@2.2.0`;
- build/dev: exact `typescript@6.0.3`, exact `esbuild@0.28.2`.

No UI framework, renderer package, persistence SDK, analytics SDK, storage client, network service, AI/model runtime, telemetry package, external-engine client, subprocess library or production activation dependency is installed through E8-C.

A future E8-D host invocation boundary must undergo a separate dependency/provenance/security review. It may not be inferred from E8-C and remains human-gated.
