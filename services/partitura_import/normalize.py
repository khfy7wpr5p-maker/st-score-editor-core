from __future__ import annotations

from typing import Any

import numpy as np
import partitura
from partitura import score as ptscore


def _py(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def _point_t(obj: Any, attr: str) -> int | None:
    point = getattr(obj, attr, None)
    if point is None:
        return None
    value = getattr(point, "t", None)
    return None if value is None else int(value)


def _iter_score_parts(score: Any) -> list[Any]:
    if hasattr(score, "parts"):
        return list(score.parts)
    try:
        return list(score)
    except TypeError:
        return [score]


def _source_note_id(note: Any) -> str | None:
    value = getattr(note, "id", None)
    if value in (None, "", "None"):
        return None
    return str(value)


def _tuplet_from_symbolic_duration(note: Any) -> dict[str, int] | None:
    symbolic = getattr(note, "symbolic_duration", None)
    if not isinstance(symbolic, dict):
        return None
    actual = symbolic.get("actual_notes")
    normal = symbolic.get("normal_notes")
    if actual is None or normal is None:
        return None
    return {"actualNotes": int(actual), "normalNotes": int(normal)}


def _fingering_values(note: Any) -> list[str]:
    values: list[str] = []
    for technical in list(getattr(note, "technical", ()) or ()):
        if isinstance(technical, ptscore.Fingering):
            value = getattr(technical, "fingering", None)
            if value is not None:
                values.append(str(value))
    return values


def _articulation_values(note: Any) -> list[str]:
    return [str(value) for value in list(getattr(note, "articulations", ()) or ())]


def _ornament_values(note: Any) -> list[str]:
    return [str(value) for value in list(getattr(note, "ornaments", ()) or ())]

def _note_rows(part: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    beat_map = part.beat_map
    quarter_map = part.quarter_map
    quarter_duration_map = part.quarter_duration_map
    time_signature_map = part.time_signature_map
    key_signature_map = part.key_signature_map

    for note in list(getattr(part, "notes", ()) or ()):
        start_div = _point_t(note, "start")
        end_div = _point_t(note, "end")
        if start_div is None or end_div is None or end_div < start_div:
            raise ValueError("Partitura note has invalid timeline bounds.")

        source_note_id = _source_note_id(note)
        tie_prev = getattr(note, "tie_prev", None)
        tie_next = getattr(note, "tie_next", None)
        ts_beats, ts_beat_type, _ = time_signature_map(start_div)
        key_fifths, key_mode = key_signature_map(start_div)

        onset_beat = float(beat_map(start_div))
        end_beat = float(beat_map(end_div))
        onset_quarter = float(quarter_map(start_div))
        end_quarter = float(quarter_map(end_div))

        out.append(
            {
                "sourceNoteId": source_note_id,
                "pitch": int(note.midi_pitch),
                "step": str(note.step),
                "alter": 0 if note.alter is None else int(note.alter),
                "octave": int(note.octave),
                "onsetBeat": onset_beat,
                "durationBeat": end_beat - onset_beat,
                "onsetQuarter": onset_quarter,
                "durationQuarter": end_quarter - onset_quarter,
                "onsetDiv": start_div,
                "durationDiv": end_div - start_div,
                "voice": int(note.voice) if note.voice is not None else None,
                "staff": int(note.staff) if note.staff is not None else None,
                "divsPerQuarter": int(quarter_duration_map(start_div)),
                "keyFifths": int(key_fifths),
                "keyMode": None if key_mode is None else int(key_mode),
                "timeBeats": int(ts_beats),
                "timeBeatType": int(ts_beat_type),
                "ties": {
                    "start": tie_next is not None,
                    "stop": tie_prev is not None,
                },
                "tiePrevSourceNoteId": _source_note_id(tie_prev) if tie_prev is not None else None,
                "tieNextSourceNoteId": _source_note_id(tie_next) if tie_next is not None else None,
                "tuplet": _tuplet_from_symbolic_duration(note),
                "fingerings": _fingering_values(note),
                "articulations": _articulation_values(note),
                "ornaments": _ornament_values(note),
                "isGrace": isinstance(note, ptscore.GraceNote),
            }
        )
    return out


def _rest_rows(part: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    quarter_duration_map = getattr(part, "quarter_duration_map", None)
    for rest in list(getattr(part, "rests", ())):
        start_div = _point_t(rest, "start")
        end_div = _point_t(rest, "end")
        divs_pq = None
        if callable(quarter_duration_map) and start_div is not None:
            divs_pq = int(quarter_duration_map(start_div))
        out.append(
            {
                "sourceNoteId": getattr(rest, "id", None),
                "onsetDiv": start_div,
                "durationDiv": None if start_div is None or end_div is None else end_div - start_div,
                "voice": getattr(rest, "voice", None),
                "staff": getattr(rest, "staff", None),
                "divsPerQuarter": divs_pq,
                "symbolicDuration": getattr(rest, "symbolic_duration", None),
            }
        )
    return out


def _measures(part: Any) -> list[dict[str, Any]]:
    return [
        {
            "number": getattr(measure, "number", None),
            "name": getattr(measure, "name", None),
            "startDiv": _point_t(measure, "start"),
            "endDiv": _point_t(measure, "end"),
        }
        for measure in list(getattr(part, "measures", ()))
    ]


def _timed_objects(part: Any, cls: Any, mapper) -> list[dict[str, Any]]:
    return [mapper(item) for item in part.iter_all(cls)]


def normalize_score(score: Any, source_identity: str) -> dict[str, Any]:
    parts: list[dict[str, Any]] = []
    total_events = 0
    total_measures = 0

    for part in _iter_score_parts(score):
        notes = _note_rows(part)
        rests = _rest_rows(part)
        measures = _measures(part)
        total_events += len(notes) + len(rests)
        total_measures += len(measures)

        time_signatures = _timed_objects(
            part,
            ptscore.TimeSignature,
            lambda item: {
                "startDiv": _point_t(item, "start"),
                "beats": int(item.beats),
                "beatType": int(item.beat_type),
            },
        )
        key_signatures = _timed_objects(
            part,
            ptscore.KeySignature,
            lambda item: {
                "startDiv": _point_t(item, "start"),
                "fifths": int(item.fifths),
                "mode": getattr(item, "mode", None),
            },
        )
        clefs = _timed_objects(
            part,
            ptscore.Clef,
            lambda item: {
                "startDiv": _point_t(item, "start"),
                "staff": getattr(item, "staff", None),
                "sign": getattr(item, "sign", None),
                "line": getattr(item, "line", None),
                "octaveChange": getattr(item, "octave_change", None),
            },
        )

        parts.append(
            {
                "id": str(getattr(part, "id", "")),
                "name": getattr(part, "part_name", None),
                "staffCount": int(getattr(part, "number_of_staves", 1) or 1),
                "measureCount": len(measures),
                "noteCount": len(notes),
                "restCount": len(rests),
                "measures": measures,
                "notes": notes,
                "rests": rests,
                "timeSignatures": time_signatures,
                "keySignatures": key_signatures,
                "clefs": clefs,
            }
        )

    return {
        "parts": parts,
        "eventCount": total_events,
        "measureCount": total_measures,
        "provenance": {
            "parser": "partitura",
            "partituraVersion": partitura.__version__,
            "sourceIdentity": source_identity,
        },
    }
