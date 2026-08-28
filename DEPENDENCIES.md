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

Stages E7-A through E7-G add no new third-party runtime dependency. The editor shell, selection bridge, score intents, notation transactions/intents, unified history, accessibility model, session safety, session controller and ScoreMosaic browser host runtime use the existing first-party TypeScript packages plus the already admitted MusicXML parser dependencies.

E7-H admits exactly one additional **build-only** tool: `esbuild@0.28.2`, restricted to deterministic browser bundling. It does not execute as a runtime dependency and does not grant network, persistence, renderer, server-revision, approval, publication or production authority.

The core repository currently installs only:

- runtime: exact `saxes@6.0.0`, exact `xmlchars@2.2.0`;
- build/dev: exact `typescript@6.0.3`, exact `esbuild@0.28.2`.

No UI framework, renderer package, persistence SDK, analytics SDK, storage client, network service, AI/model runtime, telemetry package or production activation dependency is installed through E7-H.

The generated browser bundle may contain the admitted runtime parser dependencies, but it requires no external browser import and no remote browser fetch.

Any dependency introduced for E8 or later must satisfy the normal version/license/provenance/supply-chain review and may not change ScoreMosaic vs Guitar TAB authority ownership without a human decision.
