import pathlib
import sys
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from services.partitura_import.app import import_musicxml_bytes
from services.partitura_import.contracts import NORMALIZED_IMPORT_ENVELOPE_VERSION

FIXTURE_ROOT = ROOT / "corpus" / "fixtures" / "musicxml-compatibility"

CASES = {
    "ses-90-musescore-style.musicxml": 4,
    "ses-90-audiveris-style.musicxml": 3,
    "ses-90-finale-style.musicxml": 4,
    "ses-90-sibelius-style.musicxml": 4,
    "ses-90-polyphonic.musicxml": 6,
    "ses-90-guitar-tab-technical.musicxml": 1,
}

class Ses90CompatibilityCorpusTest(unittest.TestCase):
    def test_ses91_partitura_import_timing_is_measured_in_its_own_domain(self):
        durations_ms = {}
        for filename in CASES:
            xml_bytes = (FIXTURE_ROOT / filename).read_bytes()
            started = time.perf_counter()
            import_musicxml_bytes(
                xml_bytes,
                source_identity=f"fixture:{filename}",
                contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
            )
            durations_ms[filename] = round((time.perf_counter() - started) * 1000, 3)

        self.assertEqual(set(durations_ms), set(CASES))
        self.assertTrue(all(value >= 0 for value in durations_ms.values()))
        print("SES91_PARTITURA_TIMING_MS", durations_ms)

    def test_partitura_normalizes_every_admitted_representative_fixture(self):
        for filename, expected_notes in CASES.items():
            with self.subTest(filename=filename):
                xml_bytes = (FIXTURE_ROOT / filename).read_bytes()
                result = import_musicxml_bytes(
                    xml_bytes,
                    source_identity=f"fixture:{filename}",
                    contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
                )
                self.assertEqual(result["version"], "1.0.0")
                self.assertEqual(result["diagnostics"], [])
                self.assertEqual(result["preservedSymbols"], [])
                self.assertEqual(result["provenance"]["parser"], "partitura")
                self.assertEqual(len(result["parts"]), 1)
                self.assertEqual(result["parts"][0]["noteCount"], expected_notes)
                self.assertGreaterEqual(result["parts"][0]["measureCount"], 1)

    def test_guitar_tab_fixture_retains_source_note_identity_in_partitura_semantics(self):
        filename = "ses-90-guitar-tab-technical.musicxml"
        result = import_musicxml_bytes(
            (FIXTURE_ROOT / filename).read_bytes(),
            source_identity=f"fixture:{filename}",
            contract_version=NORMALIZED_IMPORT_ENVELOPE_VERSION,
        )
        note = result["parts"][0]["notes"][0]
        self.assertEqual(note["sourceNoteId"], "g1")
        self.assertEqual(note["pitch"], 64)
        self.assertEqual(note["voice"], 1)
        self.assertEqual(note["staff"], 1)
        self.assertEqual(note["onsetDiv"], 0)
        self.assertEqual(note["durationDiv"], 4)

if __name__ == "__main__":
    unittest.main()
