# P-MXML-REF-03 SES-91 Physical Device Qualification Matrix

Status: **AUTOMATED PASS / PHYSICAL DEVICE RERUN PENDING**

This matrix is the manual evidence gate for the Partitura-assisted MusicXML fallback. Automated WebKit is regression evidence only and must not be recorded as a physical-device pass.

## Exact build under qualification

- PR: #214 (draft / unmerged)
- Merge authority: not granted by SES-91
- Deploy authority: not granted by SES-91
- Render: existing services only; no new service or URL
- Production release: not authorized
- SesliTab cutover: not authorized

## Required provider wiring

The ST Score Editor Core file workflow accepts a host-supplied MusicXML import loader. Core does not hardcode a Partitura endpoint or network provider. Before physical testing, the qualifying host/application must wire the approved bounded Partitura provider into the file-enabled controller's `musicXmlImportLoader` option.

Provider wiring is a prerequisite for claiming fallback-path physical PASS. It is not evidence of canonical authority: Partitura output must still pass the ST mapper/validator.

## Required files

1. Exact private/reference file: `sorf_op35_no13-let.musicxml` — keep outside Git.
2. First-party synthetic MuseScore-style fixture.
3. First-party synthetic polyphonic fixture.
4. First-party synthetic Guitar/TAB technical fixture.
5. Unsupported-semantic fixture for fail-closed validation.

## Android Chrome

Status: **PENDING**

Record:
- device model;
- Android version;
- Chrome version;
- exact build/head;
- fallback provider identity/version;
- each file PASS/FAIL;
- open/render result;
- canonical note/voice count sanity;
- Guitar/TAB source technical evidence visibility/retention where applicable;
- unsupported fixture remains fail-closed;
- edit → Undo → Redo after fallback open;
- no second Partitura call during edit/history/render;
- orientation/lifecycle behavior.

## iPhone Safari

Status: **PENDING**

Record:
- device model;
- iOS version;
- Safari version;
- exact build/head;
- fallback provider identity/version;
- each file PASS/FAIL;
- open/render result;
- canonical note/voice count sanity;
- Guitar/TAB source technical evidence visibility/retention where applicable;
- unsupported fixture remains fail-closed;
- edit → Undo → Redo after fallback open;
- no second Partitura call during edit/history/render;
- portrait → landscape → portrait;
- background → foreground return.

## Pass rule

SES-91 may close only after:

- automated Node 18/20/22 and Python gates are green on the same exact head;
- dedicated MusicXML WebKit and retained APP/P08/P10 WebKit gates are green;
- static/security boundary test is green;
- import timing is recorded separately from interaction timing;
- fallback call count during selection/edit/Undo/Redo/render is exactly zero after initial open;
- Android Chrome exact-reference rerun is PASS;
- iPhone Safari exact-reference rerun is PASS.

Until both physical reruns are recorded:

```text
manualDeviceValidationRequired = true
productionReleaseAuthorized = false
seslitabCutoverAuthorized = false
mergeAuthorizedBySes91 = false
```
