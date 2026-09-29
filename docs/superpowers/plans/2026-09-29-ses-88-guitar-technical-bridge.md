# SES-88 Guitar Technical Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deterministically join Partitura-imported note identity with preserved MusicXML guitar/TAB technical evidence and validated ST Guitar Workspace result evidence without changing canonical score/history authority.

**Architecture:** The bridge consumes the SES-87 canonical import result inputs plus the raw preservation sidecar. Explicit MusicXML string/fret evidence is mapped to current `SemanticAddressV3` note identity and always wins over derivative engine suggestions. Optional Guitar Workspace `CanonicalTabResult` evidence is accepted only through the existing read-only validator and may fill positions only when source TAB evidence is absent.

**Tech Stack:** TypeScript, ScoreDocumentV3, NotationDocumentV4, SemanticAddressV3, existing schema downgrades, existing Guitar Workspace result validator.

**Spec:** P-MXML-REF-03 implementation plan Task 5 / Linear SES-88.

## Global Constraints

- ScoreDocumentV3 + NotationDocumentV4 remain canonical.
- EditorSessionV4 / EditorHistoryV4 remain sole mutation/history authority.
- Explicit source MusicXML TAB evidence is preserved and never overwritten by generated/engine evidence.
- Direct external Guitar Engine invocation remains disabled and human-gated.
- No generic ignore-unknown behavior and no silent technical-data loss.
- No merge, deploy, release, cutover, or Render change.

## Review Focus

1. Chord tones with distinct source note IDs retain distinct string/fret evidence.
2. Incomplete string/fret pairs fail closed rather than inventing the missing value.
3. Explicit string/fret that contradicts an available source tuning and canonical pitch fails closed.
4. Valid engine evidence may fill missing positions but cannot replace explicit source evidence.
5. Sidecar symbols with no joinable source note identity remain preserved and are reported as unjoined evidence.

---

### Task 1: Source-note technical join

**Files:**
- Create: `packages/musicxml-partitura-mapper/src/guitarTechnicalBridge.ts`
- Test: `test/p-mxml-ref-03-guitar-technical-bridge.test.mjs`

**Interfaces:**
- Consumes: `ValidatedPartituraEnvelopeV1`, preservation sidecar, `ScoreDocumentV3`, `NotationDocumentV4`.
- Produces: immutable derivative bridge result containing current V3 note targets, source positions, optional engine positions, effective positions, technical symbols, tuning evidence, unjoined symbols, and diagnostics.

- [ ] Write RED tests for explicit string/fret preservation, polyphonic chord identity, incomplete pairs, impossible tuning conflicts, unjoined symbols, and source-priority behavior.
- [ ] Verify RED fails because `guitarTechnicalBridge.ts` does not exist.
- [ ] Implement deterministic normalized-note -> canonical V3 note identity traversal and exact sidecar parsing.
- [ ] Verify focused tests pass.

### Task 2: Existing Guitar Workspace evidence adapter

**Files:**
- Modify: `packages/musicxml-partitura-mapper/src/guitarTechnicalBridge.ts`
- Test: `test/p-mxml-ref-03-guitar-technical-bridge.test.mjs`

**Interfaces:**
- Consumes optional `canonicalTabResultJson`.
- Uses lossless V4->V3 notation, V3->V2 score/notation, V2->V1 score/notation downgrades and existing `createGuitarWorkspaceResult`.
- Produces engine-generated derivative positions rebound to current V3 note addresses.

- [ ] Write RED test proving missing source TAB can be filled by validated engine evidence.
- [ ] Verify RED fails because engine evidence is not yet consumed.
- [ ] Implement read-only validation/rebind; do not invoke an external engine.
- [ ] Verify source evidence still wins when engine chooses a different valid position.

### Task 3: Fresh verification

- [ ] Run repository validation and full Node 18/20/22 CI.
- [ ] Run Python Partitura boundary regression.
- [ ] Run MusicXML and APP WebKit retained regression workflows.
- [ ] Compare the SES-88 delta against SES-87 head and confirm no router/history/deploy/Render changes.
