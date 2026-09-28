# P-MXML-REF-01 Partitura Reference MusicXML Compatibility Design

Status: **WRITTEN ARCHITECTURE SPEC / HUMAN REVIEW REQUIRED / IMPLEMENTATION PLAN NOT AUTHORIZED**

Date: 2026-09-27  
Repository: `khfy7wpr5p-maker/st-score-editor-core`  
Baseline main: `40e84d1fb9af4ad370adf99cb0f2e91df33d6e60`  
Target: **P-MXML-REF-01 — real-world MusicXML compatibility without weakening canonical or fail-closed boundaries**

## Purpose

P-MXML-REF-01 addresses the physical-device release blocker where multiple real-world MusicXML files fail to open with `UNSUPPORTED_MUSICXML` on Android Chrome and iPhone Safari even though independent notation software can open the same files.

The design does not replace the ST editor model with Partitura and does not make Partitura a production dependency. Partitura is used only as an independent reference parser/oracle and as a source of compatibility knowledge for test design.

The target user-visible behavior is:

```text
real-world MusicXML
        |
        v
secure bounded XML parsing
        |
        v
compatibility classification
        |
        +--> supported semantic content -> import
        |
        +--> ignorable presentation / metadata -> tolerate + record diagnostic
        |
        +--> unsupported musical meaning -> fail closed
        |
        v
ScoreDocumentV3 + NotationDocumentV4
```

The first tranche is compatibility hardening, not broad MusicXML feature expansion.

---

# 1. Current failure mechanism

## 1.1 Parser-level rejection happens too early

On baseline main, `packages/musicxml-v2/src/parser.ts` has a global `ELEMENTS` allowlist and a per-element `ATTRIBUTES` allowlist.

During SAX `opentag` handling it currently rejects:

- every element not present in `ELEMENTS`;
- every attribute not present in the exact element allowlist;
- every non-empty namespace URI.

All such cases become `UNSUPPORTED_MUSICXML` before semantic import classification can decide whether the information is musically required or merely presentation/metadata.

The legacy/current `packages/musicxml/src/importer.ts` path also contains strict allowed-child and allowed-attribute checks that produce the same error class.

## 1.2 Why this blocks ordinary files

Real-world MusicXML commonly contains information beyond the editor's current canonical authoring subset. Some of that information is harmless to canonical note meaning, such as document metadata, engraving defaults, credits, or page/system layout instructions.

A parser that treats every unknown item as equivalent to unknown musical semantics cannot distinguish:

```text
"we do not render this page-layout hint"
from
"we do not understand this note/timing/voice meaning"
```

Both currently collapse into the same fail-closed result.

## 1.3 Security behavior that must remain

The blocker must not be fixed by making the XML parser generally permissive.

The following existing protections remain mandatory:

- bounded input size;
- bounded XML depth;
- bounded element count;
- bounded attribute count;
- bounded text bytes;
- well-formed XML requirement;
- processing timeout/abort behavior;
- canonical validation after import;
- unsupported musical meaning fails closed;
- no renderer/browser state becomes canonical.

The design therefore separates **safe XML recognition** from **semantic compatibility admission** instead of removing either boundary.

---

# 2. Canonical authority and non-authority

The following architecture remains unchanged:

- `ScoreDocumentV3 + NotationDocumentV4` are canonical.
- `EditorSessionV4 / EditorHistoryV4` are the sole unified history authority.
- `SemanticAddressV3` is exact current-revision semantic identity.
- MusicXML remains exchange/projection data.
- Renderer DOM/SVG IDs, coordinates, geometry and viewport state are noncanonical.
- Browser file handles and recovery state are noncanonical.
- Partitura has no canonical mutation authority.
- Partitura has no history authority.
- Partitura has no production runtime authority.

P-MXML-REF-01 does not authorize schema version changes.

P-MXML-REF-01 does not authorize production/public-write authority.

---

# 3. Partitura reference boundary

## 3.1 Allowed role

Partitura may be used for:

- checking whether an independently maintained score parser accepts a fixture;
- identifying common MusicXML structures encountered in real scores;
- comparing ST rejection reasons against an independent parser;
- building a compatibility matrix;
- generating human-readable reference evidence for development and review.

## 3.2 Forbidden role

Partitura must not:

- run in the browser production path;
- become the canonical score model;
- produce authoritative ST event/note IDs;
- mutate `ScoreDocumentV3` or `NotationDocumentV4`;
- decide history revisions;
- silently repair invalid ST canonical data;
- be called over a network by the browser importer;
- become required for opening a score in production.

## 3.3 Dependency boundary

No Python, backend or network dependency may be introduced into the production browser path.

If a Partitura-based development harness is later approved, it must be dev/reference-only and separately record:

- exact version;
- upstream identity;
- license;
- installation scope;
- no production bundle inclusion;
- no runtime network/process authority;
- fixture/provenance rules.

Implementation planning must not invent a Partitura dependency version without fresh verification.

## 3.4 Source-use rule

Partitura source or fixtures are reference material only unless their license/provenance is explicitly reviewed for repository inclusion.

No rights-unclear score corpus is added to Git history.

---

# 4. Compatibility classification model

Every encountered MusicXML item that is outside the already-supported exact profile must be classified into one of exactly three categories.

## 4.1 SEMANTIC_REQUIRED

Meaning:

The element/attribute contributes musical meaning that ST must understand before it can safely create canonical score/notation state.

Examples include categories such as:

- pitch/rest identity;
- onset/timing;
- duration/divisions;
- Voice/staff ownership;
- part/measure topology;
- meter/key/clef information already required by the bounded importer;
- tuplets/ties/slurs/beam semantics where admitted;
- grace-note semantics where admitted;
- notation data that affects current canonical contracts.

Behavior:

```text
supported -> parse/import exactly
not supported -> UNSUPPORTED_MUSICXML
malformed/contradictory -> INVALID_MUSICXML_SEMANTICS
```

No semantic-required data may be silently ignored.

## 4.2 IGNORABLE_PRESENTATION_METADATA

Meaning:

The item does not alter canonical musical meaning inside the currently supported ST import profile and can be dropped without inventing or changing score semantics.

Candidate families include only explicitly reviewed items such as:

- document/work metadata;
- encoding/application metadata;
- credits;
- engraving defaults;
- page layout;
- system layout;
- print/layout hints.

This is an **allowlist**, not a heuristic.

Behavior:

- skip the admitted element/attribute/subtree;
- keep resource-limit accounting active;
- emit bounded noncanonical compatibility evidence;
- continue parsing/importing supported semantic content.

Ignorable does not mean "unknown". An item becomes ignorable only after explicit classification.

## 4.3 UNSUPPORTED_SEMANTIC_FAIL_CLOSED

Meaning:

The item carries musical/performance/notation meaning that is not safely represented by the current canonical import contract.

Candidate families can include unsupported:

- transposition/instrument semantics;
- directions whose meaning affects score or playback;
- harmony/figured-bass semantics;
- unmodeled noteheads/stems/notations where preservation is semantically relevant;
- cross-staff or relation semantics outside the current bounded importer;
- foreign extension namespaces with unknown musical meaning.

Behavior:

```text
throw MusicXmlError(
  ...,
  'UNSUPPORTED_MUSICXML',
  structured compatibility context
)
```

No fallback to "ignore all unknown tags" is permitted.

---

# 5. Parser architecture

## 5.1 Separate XML safety from compatibility policy

The SAX parser remains responsible for:

- XML well-formedness;
- resource bounds;
- node construction;
- namespace identity;
- parser checkpoints.

A new compatibility-policy layer becomes responsible for deciding whether a recognized-but-not-imported item is:

- semantic-required;
- ignorable presentation/metadata;
- unsupported semantic.

The parser may consult this policy while streaming so an ignorable subtree can be skipped without constructing an unnecessary full node tree.

## 5.2 Proposed policy interface

The implementation plan may refine exact file names, but the design requires a typed boundary equivalent to:

```ts
type MusicXmlCompatibilityClass =
  | 'SEMANTIC_REQUIRED'
  | 'IGNORABLE_PRESENTATION_METADATA'
  | 'UNSUPPORTED_SEMANTIC_FAIL_CLOSED';

interface MusicXmlCompatibilityDecision {
  readonly classification: MusicXmlCompatibilityClass;
  readonly reason: string;
}
```

Classification must be deterministic from bounded parser context such as:

- element local name;
- namespace URI;
- parent path;
- attribute local name;
- attribute namespace URI.

No renderer state or network lookup participates.

## 5.3 Context-aware classification

A name alone is not always enough.

The policy must support parent/path context so the same local name cannot be assumed harmless everywhere.

Example principle:

```text
root-level metadata subtree
  !=
unknown child inside <note>
```

Unknown or unclassified context fails closed.

## 5.4 Ignored subtree handling

When an element is classified as `IGNORABLE_PRESENTATION_METADATA`:

1. the parser enters a bounded skip depth;
2. all nested bytes/elements/attributes/text still count against resource limits;
3. nested content is not imported into canonical structures;
4. XML well-formedness is still required;
5. skip depth exits only on the matching close tag;
6. a bounded diagnostic is recorded.

No ignored subtree may bypass parser limits.

## 5.5 Attribute handling

Attributes require the same three-way policy.

Rules:

- supported semantic attributes remain exact allowlisted inputs;
- explicitly ignorable presentation/metadata attributes may be ignored;
- unsupported semantic or unknown attributes fail closed;
- namespace declarations are handled as XML namespace mechanics rather than arbitrary musical data;
- foreign namespaced semantic extensions are not admitted by default.

## 5.6 Namespace policy

The current blanket `uri !== ''` rejection is too coarse for compatibility work.

The new policy must distinguish:

- no namespace;
- XML namespace mechanics;
- explicitly admitted MusicXML namespace form if verified against supported real-world fixtures;
- foreign/extension namespaces.

Foreign or unverified namespaces remain fail closed unless an individual item is explicitly classified as ignorable metadata.

The implementation plan must include namespace-specific regression fixtures before any namespace acceptance is added.

---

# 6. Compatibility evidence

## 6.1 Noncanonical diagnostics

Import may expose bounded compatibility diagnostics such as:

```ts
interface MusicXmlCompatibilityDiagnostic {
  readonly classification: 'IGNORABLE_PRESENTATION_METADATA';
  readonly element: string;
  readonly attribute: string | null;
  readonly pathClass: string;
  readonly reason: string;
}
```

This evidence is diagnostic only.

It must not enter:

- `ScoreDocumentV3`;
- `NotationDocumentV4`;
- `EditorHistoryV4`.

## 6.2 Bounded collection

Diagnostics must have an explicit maximum count.

After the maximum is reached, the importer records truncation rather than unboundedly accumulating entries.

This prevents metadata-heavy inputs from becoming a memory amplification path.

## 6.3 Error context

`UNSUPPORTED_MUSICXML` errors should identify, when safely available:

- element;
- attribute;
- namespace class;
- compatibility class;
- bounded structural path class.

User-facing surfaces may simplify this message, but developer diagnostics must be specific enough to extend the compatibility matrix without guessing.

---

# 7. Real-world compatibility corpus

## 7.1 Corpus purpose

Create a bounded repository-owned compatibility corpus that proves the difference between:

- safe ignorable metadata/presentation;
- supported musical semantics;
- unsupported musical semantics;
- invalid XML;
- invalid MusicXML semantics.

## 7.2 Fixture provenance

Fixtures must be one of:

- synthetic first-party fixtures;
- public-domain scores with recorded provenance;
- explicitly licensed fixtures approved for repository inclusion.

Do not commit private user uploads.

The physical failing user-supplied file may be used locally for diagnosis, but it is not automatically eligible for repository inclusion.

## 7.3 Fixture families

The implementation plan must include fixture coverage for at least:

1. minimal supported score-partwise input;
2. supported score plus root/document metadata;
3. supported score plus engraving defaults;
4. supported score plus credit information;
5. supported score plus page/system print-layout hints;
6. unsupported semantic child inside a note;
7. unsupported semantic score direction/performance structure;
8. foreign namespace semantic extension;
9. malformed XML;
10. semantic contradiction already rejected by current importer;
11. multi-part/multi-staff cases already inside the current profile;
12. a reduced reproduction derived from the physical `UNSUPPORTED_MUSICXML` blocker without copying rights-unclear material.

## 7.4 Compatibility matrix

Each fixture receives an expected matrix entry:

```text
fixture
ST baseline result
Partitura reference result
classification
expected ST post-change result
canonical-equivalence assertion
notes/provenance
```

Partitura acceptance alone never proves ST should accept a file.

The matrix decision is based on the ST canonical contract.

## 7.5 Canonical equivalence

For every fixture accepted only because ignorable content is tolerated, tests must prove:

```text
import(full fixture)
==
import(semantically equivalent fixture with ignorable content removed)
```

for canonical score/notation meaning.

Diagnostics may differ; canonical content must not.

---

# 8. Import path integration

## 8.1 One compatibility policy

The repository must not grow separate contradictory tolerance policies for:

- `packages/musicxml/src/*`;
- `packages/musicxml-v2/src/*`.

The implementation must identify the active browser import path and provide one reusable compatibility classification authority where possible.

If both import paths must remain supported, their classification tables must be derived from the same policy source or tested for exact parity.

## 8.2 No parallel canonical importer

P-MXML-REF-01 does not create a second "lenient importer" that bypasses existing canonical validation.

The intended flow is:

```text
existing secure importer
        +
bounded compatibility classification
        ->
existing canonical validation
```

not:

```text
strict importer fails
        ->
fallback parser guesses score
```

## 8.3 No automatic semantic repair

P-MXML-REF-01 may tolerate ignorable noncanonical data.

It may not:

- infer missing pitches;
- guess Voice ownership;
- repair broken durations;
- drop unsupported ties/tuplets/directions silently;
- normalize contradictory measure semantics into guessed canonical state.

Invalid or unsupported musical semantics remain explicit failures.

---

# 9. Test and verification gates

## 9.1 Required RED evidence

Before implementation, at least one reduced fixture representing the physical blocker must fail on baseline main for the intended reason:

```text
MusicXmlError.code === 'UNSUPPORTED_MUSICXML'
```

The failure context must identify the rejected element/attribute family.

## 9.2 Focused GREEN evidence

After each compatibility slice, focused tests must prove:

- the new explicitly ignorable family imports;
- canonical output equals the stripped-semantic-equivalent fixture;
- a nearby semantic-unknown case still fails closed;
- resource limits remain active through skipped subtrees.

## 9.3 Regression evidence

The implementation head must retain existing MusicXML hardening tests, including rejection expectations that represent real unsupported musical meaning.

Existing tests may be changed only when the design explicitly reclassifies the tested item as ignorable presentation/metadata and a canonical-equivalence test replaces the old rejection assertion.

No blanket weakening of `UNSUPPORTED_MUSICXML` tests is permitted.

## 9.4 Full repository checks

Before implementation completion:

```text
npm run validate
npm run build
npm test
npm run ci
```

must pass using the repository-supported environment/matrix.

Implementation planning must inspect current GitHub Actions rather than assume an obsolete CI matrix.

## 9.5 Sonar

Do not claim Sonar PASS from local reasoning.

Retain the repository's active Sonar integration and report live service status separately.

Do not add duplicate scanning infrastructure merely for this tranche.

## 9.6 Physical browser verification

Automated tests are insufficient for release closure because the blocker was discovered on physical devices.

After implementation and CI are green, repeat at minimum:

- Android Chrome: open the previously failing compatibility-class fixture;
- iPhone Safari: open the same compatibility-class fixture;
- confirm score renders;
- confirm no `UNSUPPORTED_MUSICXML` for the newly admitted ignorable family;
- confirm semantic unsupported fixture still fails closed;
- confirm normal editing/history behavior remains unchanged after successful import.

APP-09 release gate remains false until the required physical matrix is explicitly passed.

---

# 10. Security review focus

Implementation review must explicitly examine:

1. skip-depth correctness for nested ignored subtrees;
2. resource limits while skipping;
3. namespace confusion and prefix/local-name collisions;
4. attribute classification bypasses;
5. entity/DTD behavior under the existing parser;
6. oversized metadata diagnostics;
7. path-context ambiguity;
8. canonical-equivalence of tolerated inputs;
9. semantic data accidentally classified as presentation;
10. duplicate or divergent policy tables across importer versions.

Any uncertainty about whether an item carries musical meaning resolves to `UNSUPPORTED_SEMANTIC_FAIL_CLOSED`.

---

# 11. Proposed repository direction

This design intentionally does not freeze exact implementation files beyond the existing boundaries, but the implementation plan should evaluate a minimal structure similar to:

```text
packages/musicxml/src/compatibilityPolicy.ts
packages/musicxml/src/compatibilityDiagnostics.ts
packages/musicxml-v2/src/parser.ts
packages/musicxml/src/parsedXml.ts
packages/musicxml/src/importer.ts
test/musicxml-compatibility-policy.test.mjs
test/musicxml-real-world-compatibility.test.mjs
corpus/fixtures/musicxml-compatibility/
docs/musicxml-compatibility-matrix.md
```

A dev-only Partitura reference harness, if admitted after dependency/provenance review, belongs outside the production browser graph and is not required to ship in the runtime bundle.

Exact files, interfaces, test sequencing and commits belong to the separately approved implementation plan.

---

# 12. Explicit non-goals

P-MXML-REF-01 does not authorize:

- replacing the ST importer with Partitura;
- a Python production service;
- a new backend;
- runtime network parsing;
- a generic "ignore unknown MusicXML" mode;
- silent loss of musical semantics;
- schema expansion merely to accept every MusicXML feature;
- automatic repair/guessing;
- canonical authority for renderer/Partitura/browser state;
- a new Render service or URL;
- deploy;
- merge;
- release;
- production/public-write cutover.

---

# 13. Acceptance criteria for the later implementation

The later implementation is acceptable only when all are true:

- the blocker is reduced to exact rejected families;
- every newly tolerated family is explicitly allowlisted as `IGNORABLE_PRESENTATION_METADATA`;
- canonical-equivalence tests prove tolerated data does not change ST musical meaning;
- nearby unsupported semantic cases remain fail closed;
- parser resource limits remain enforced while skipping;
- no Python/backend/network code is present in the production browser path;
- Partitura remains reference-only;
- existing canonical/history authority is unchanged;
- fresh CI passes;
- live Sonar status is reported truthfully;
- Android Chrome and iPhone Safari physical evidence is refreshed;
- APP-09 is not marked released without its required gate evidence.

---

# Design self-review

## Spec coverage

Covered:

- Partitura reference-only boundary;
- real-world compatibility matrix;
- three required compatibility classes;
- bounded tolerance policy;
- canonical authority preservation;
- fail-closed unsupported semantics;
- no production Python/backend/network dependency;
- RED -> GREEN -> refactor evidence;
- fresh CI/Sonar/device evidence;
- no new Render service.

No implementation authority is granted.

## High-risk ambiguity resolved

The key design decision is that **unknown is not the same as ignorable**.

Only explicitly classified presentation/metadata may be skipped. Anything unclassified or semantically meaningful continues to fail closed.

## Remaining implementation-plan questions

The implementation plan must resolve from fresh repository evidence:

- which MusicXML importer path the browser uses at the current head;
- the minimal initial ignorable allowlist needed to fix the physical blocker;
- exact namespace forms present in the reduced failing fixtures;
- whether shared policy extraction can cover both current importer generations without widening behavior;
- whether a Partitura probe is stored in this repo, run externally, or represented only by checked compatibility evidence;
- exact diagnostic caps and bundle impact.

These are implementation-plan decisions, not permission to broaden scope.

---

# Design completion gate

This file is the written architecture specification required by the P-MXML-REF-01 gate.

It authorizes only **human review of this design**.

It does **not** authorize:

- implementation-plan creation;
- production code changes;
- merge;
- deploy;
- release;
- new Render service/URL.

After explicit human approval of this written spec, the next allowed step is to use the Superpowers planning workflow to create:

```text
docs/superpowers/plans/2026-09-27-partitura-reference-musicxml-compatibility.md
```

That implementation plan must then stop for a second explicit human approval before any production implementation begins.
