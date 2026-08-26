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
- scope: E2 MusicXML XML well-formedness / SAX parsing only
- runtime authority: parser only; never canonical score authority
- license: ISC
- upstream: `lddubeau/saxes`
- upstream tag: `v6.0.0` → commit `211fa0ebec9b628affc09219199639887174bfc3`
- reason: strict namespace-aware single-pass XML parser
- provenance: already used as exact `6.0.0` by `musicxml-to-guitar-tab-engine`; E2 adapts the first-party safety pattern rather than copying product authority
- constraints: entity/doctype/encoding/size safety is enforced before SAX; structural and deadline limits are enforced around the SAX pass
- TypeScript 6 compatibility: the runtime package remains unchanged; compile-time resolution is deliberately routed through `types/saxes-6.0.0-compat.d.ts`, a narrow local declaration of only the API surface used by E2
- compiler safety: `skipLibCheck` remains `false`; CI locks the compatibility facade path so upstream declaration incompatibility cannot be hidden by globally weakening type checking

## xmlchars

- package: `xmlchars`
- admitted version: `2.2.0` (exact direct pin)
- scope: transitive support dependency required by `saxes@6.0.0`
- runtime authority: none
- license: MIT
- reason: exact root pin prevents the `saxes` semver range from drifting during resolution

No renderer, AI/model, UI framework, storage, network, or production dependency is admitted at Stage E2.

Any later dependency requires a separate license/provenance/compatibility review and must remain behind the authority boundaries in `contracts/authority-boundary-v1.json`.
