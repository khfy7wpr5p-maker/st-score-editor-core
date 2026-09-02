# ST Score Editor Core — Architecture

Status: **SEC-NE and SSE-00–08 are merged. SSE-09 bounded V3 staff/part topology runtime is implemented on this merge candidate.**

## Canonical authority

A session owns exactly one versioned canonical score+notation pair. V2 sessions remain supported; a V3 session owns exactly one `ScoreDocumentV3 + NotationDocumentV3` pair. V2 input may be migrated once into V3, but mutable V2 and V3 copies are never kept in parallel.

MusicXML is exchange/projection data. Renderer, DOM/SVG, SesliTab host state and Guitar derivative state remain noncanonical.

## V3 topology

```text
ScoreDocumentV3
  -> measureFrames[]             # document-global aligned sequence
  -> parts[]
       -> id + ordinal
       -> instrument {id,name,shortName}
       -> staves[]
            -> standard/percussion
                 -> StaffMeasureV3(frameId)[]
                      -> voices/events/graceGroups
            -> tablature-linked
                 -> sourceStaffId
                 -> TabProfileV3
                 -> measures=[]
```

`measureFrames` are the sole aligned measure-sequence authority. Standard/percussion staffs have exactly one measure per frame. Linked TAB is presentation topology only and cannot own canonical voices/events/notes. String/fret/fingering/voicing remains derivative Guitar state.

## V3 notation ownership

`NotationDocumentV3` separates structural notation ownership:

- frame: controlling time signature and barlines;
- staff measure: key signature and clef;
- event/note/grace: the admitted V2 semantic notation set.

Notation is sparse, same-document and same-revision. A topology edit that would remove a still-notated entity rejects rather than silently dropping its notation.

## Migration

V2 -> V3:

- preserves existing canonical entity IDs;
- creates deterministic noncolliding frame/instrument identities;
- requires equal staff measure counts and matching ordinal/display-number alignment;
- rejects conflicting aligned time/barline ownership;
- never infers linked TAB merely from a TAB clef.

V3 -> V2 is lossless-only. Linked TAB, non-standard topology or custom V3 topology metadata that would disappear blocks downgrade.

## SSE-09 topology authoring

Admitted operations:

- add/remove/reorder part;
- add/remove/reorder standard or percussion staff;
- add/remove linked TAB presentation staff;
- rename part/instrument display metadata.

Every operation uses exact revision-bound semantic targets and caller-supplied fresh identity plans. Adding content topology requires effective meter on every frame and initializes exactly one explicit full-frame rest voice per new staff/frame. It does not copy or infer rhythmic content from another staff.

Removing the final part or final content staff is forbidden. Removing a source standard staff while linked TAB exists is rejected; the linked TAB must be removed explicitly first. No cascading deletion or nearest retarget is admitted.

## V3 history/session

`editor-history-v3` stores atomic score+notation snapshots and accepts only direct-child revisions. `editor-session-controller-v3` composes migration, topology commits, selection, render request regeneration and undo/redo without introducing host authority.

## Renderer boundary

`RendererRequestV3` is additive:

```text
V3 canonical pair
  -> guarded lossless V3 -> V2 downgrade
       -> proven V2 renderer projection succeeds -> V2_COMPATIBLE_XML
       -> semantic loss / known unsupported MusicXML projection -> V3_XML_PENDING + null XML
```

Pending projection never invalidates the canonical V3 edit/history; it only prevents lossy rendering. V3-native topology MusicXML serialization is not claimed by SSE-09.

## Product boundary

SSE-09 does not activate SesliTab V3 product cutover, persistence, network/server revisions, publication or production write authority. Existing SesliTab v2 host integration remains current.

## Next gate

**SSE-10 is HUMAN-GATED DESIGN** for cross-staff canonical relation ownership. Cross-staff beam/note relocation/tie/slur/tuplet/ornament semantics, polymeter/non-controlling topology, part groups, arbitrary transposition, percussion maps, layout geometry and playback routing remain outside SSE-09.
