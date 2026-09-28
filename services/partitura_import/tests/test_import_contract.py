import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from services.partitura_import.app import ImportBoundaryError, import_musicxml_bytes
from services.partitura_import.contracts import (
    MAX_MUSICXML_BYTES,
    MAX_PARSE_SECONDS,
    NORMALIZED_IMPORT_ENVELOPE_VERSION,
)

SIMPLE_MUSICXML = b"""<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note id="n1">
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration><voice>1</voice><staff>1</staff>
      </note>
      <note id="r1">
        <rest/><duration>4</duration><voice>2</voice><staff>1</staff>
      </note>
    </measure>
  </part>
</score-partwise>
"""

class PartituraImportBoundaryTest(unittest.TestCase):
    def test_import_returns_versioned_json_safe_semantics(self):
        result = import_musicxml_bytes(
            SIMPLE_MUSICXML,
            source_identity="fixture:simple.musicxml",
            contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
        )
        json.dumps(result)

        self.assertEqual(result["version"], "1.0.0")
        self.assertEqual(result["sourceIdentity"], "fixture:simple.musicxml")
        self.assertEqual(len(result["parts"]), 1)
        part = result["parts"][0]
        self.assertEqual(part["id"], "P1")
        self.assertEqual(part["name"], "Guitar")
        self.assertEqual(part["measureCount"], 1)
        self.assertEqual(part["noteCount"], 1)
        self.assertEqual(part["restCount"], 1)

        note = part["notes"][0]
        self.assertEqual(note["sourceNoteId"], "n1")
        self.assertEqual(note["pitch"], 64)
        self.assertEqual(note["step"], "E")
        self.assertEqual(note["octave"], 4)
        self.assertEqual(note["voice"], 1)
        self.assertEqual(note["staff"], 1)
        self.assertEqual(note["onsetDiv"], 0)
        self.assertEqual(note["durationDiv"], 4)
        self.assertEqual(note["divsPerQuarter"], 4)

        rest = part["rests"][0]
        self.assertEqual(rest["sourceNoteId"], "r1")
        self.assertEqual(rest["voice"], 2)
        self.assertEqual(rest["staff"], 1)
        self.assertEqual(rest["durationDiv"], 4)

        self.assertEqual(result["preservedSymbols"], [])
        self.assertEqual(result["diagnostics"], [])
        self.assertEqual(result["provenance"]["parser"], "partitura")
        self.assertEqual(result["provenance"]["partituraVersion"], "1.9.0")

    def test_contract_version_mismatch_fails_before_parse(self):
        with self.assertRaisesRegex(ImportBoundaryError, "contract version"):
            import_musicxml_bytes(
                SIMPLE_MUSICXML,
                source_identity="fixture:simple.musicxml",
                contract_version="2.0.0",
            )

    def test_oversized_input_fails_before_partitura(self):
        self.assertEqual(MAX_MUSICXML_BYTES, 5 * 1024 * 1024)
        self.assertEqual(MAX_PARSE_SECONDS, 10)
        with self.assertRaisesRegex(ImportBoundaryError, "source size"):
            import_musicxml_bytes(
                b"x" * (MAX_MUSICXML_BYTES + 1),
                source_identity="fixture:oversized.musicxml",
                contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
            )

    def test_source_identity_is_data_not_a_filesystem_path(self):
        result = import_musicxml_bytes(
            SIMPLE_MUSICXML,
            source_identity="../../outside/score.musicxml",
            contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
        )
        self.assertEqual(result["sourceIdentity"], "../../outside/score.musicxml")

    def test_partitura_semantics_include_ties_tuplets_fingering_and_articulation(self):
        xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
    <note id="tie-start">
      <pitch><step>E</step><octave>4</octave></pitch>
      <duration>2</duration><voice>1</voice><type>eighth</type>
      <tie type="start"/>
      <notations>
        <tied type="start"/>
        <articulations><staccato/></articulations>
        <technical><fingering>1</fingering></technical>
      </notations>
    </note>
    <note id="tie-stop">
      <pitch><step>E</step><octave>4</octave></pitch>
      <duration>2</duration><voice>1</voice><type>eighth</type>
      <tie type="stop"/>
      <notations><tied type="stop"/></notations>
    </note>
    <note id="triplet">
      <pitch><step>G</step><octave>4</octave></pitch>
      <duration>1</duration><voice>1</voice><type>eighth</type>
      <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
    </note>
  </measure></part>
</score-partwise>
"""
        result = import_musicxml_bytes(
            xml,
            source_identity="fixture:semantics.musicxml",
            contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
        )
        notes = {note["sourceNoteId"]: note for note in result["parts"][0]["notes"]}

        self.assertEqual(notes["tie-start"]["ties"], {"start": True, "stop": False})
        self.assertEqual(notes["tie-start"]["tieNextSourceNoteId"], "tie-stop")
        self.assertIsNone(notes["tie-start"]["tiePrevSourceNoteId"])
        self.assertEqual(notes["tie-stop"]["ties"], {"start": False, "stop": True})
        self.assertEqual(notes["tie-stop"]["tiePrevSourceNoteId"], "tie-start")
        self.assertIsNone(notes["tie-stop"]["tieNextSourceNoteId"])
        self.assertEqual(notes["tie-start"]["fingerings"], ["1"])
        self.assertIn("staccato", notes["tie-start"]["articulations"])
        self.assertEqual(notes["triplet"]["tuplet"], {"actualNotes": 3, "normalNotes": 2})

if __name__ == "__main__":
    unittest.main()
