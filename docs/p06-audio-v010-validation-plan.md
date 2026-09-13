# P06 Audio v0.1.0 Validation Plan

Required before this branch can be called integration-green:

1. consume the official `@st/score-audio-contracts@0.1.0` type surface directly;
2. do not duplicate `AuditionRequest` or sample data inside Editor Core;
3. retain revision-bound fail-closed behavior;
4. expose audio capability only when an external runtime is actually available;
5. keep optional audio rollout default-off;
6. run Node CI on the exact branch head;
7. run the existing APP-09B/P05 WebKit validation on the exact branch head through a validation-only P05-base PR if required by workflow triggers;
8. keep physical iPhone evidence separate from automation.

A passing release workflow in the audio repository proves distribution identity, not Editor Core integration correctness.
