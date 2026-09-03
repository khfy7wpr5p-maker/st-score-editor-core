# APP-05D — Explicit recovery apply

Status: IMPLEMENTATION IN PROGRESS

Bounded contract:
- recovery is never auto-applied;
- prepare captures the active document/revision guard;
- apply fails closed if live canonical state changed after prepare;
- recovered `ScoreDocumentV3 + NotationDocumentV4` is revalidated before adoption;
- adoption starts a fresh V4 history at the recovered snapshot;
- stale local file-handle association is cleared after successful apply;
- consumed recovery cache cleanup is noncanonical;
- no network, cloud, server revision or SesliTab authority is introduced.

The temporary hidden scope marker is superseded by this explicit contract document and must not be included in the final merged diff.
