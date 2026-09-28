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
    array = part.note_array(
        include_pitch_spelling=True,
        include_staff=True,
        include_divs_per_quarter=True,
        include_key_signature=True,
        include_time_signature=True,
        include_grace_notes=True,
    )
    names = set(array.dtype.names or ())
    note_objects = {
        source_id: note
        for note in list(getattr(part, "notes", ()) or ())
        if (source_id := _source_note_id(note)) is not None
    }
    out: list[dict[str, Any]] = []
    for row in array:
        def get(name: str, default: Any = None) -> Any:
            return _py(row[name]) if name in names else default

        source_note_id = str(get("id")) if get("id") not in (None, "None", "") else None
        note_object = note_objects.get(source_note_id) if source_note_id is not None else None
        tie_prev = getattr(note_object, "tie_prev", None) if note_object is not None else None
        tie_next = getattr(note_object, "tie_next", None) if note_object is not None else None

        out.append(
            {
                "sourceNoteId": source_note_id,
                "pitch": int(get("pitch")),
                "step": str(get("step")) if get("step") is not None else None,
                "alter": int(get("alter")) if get("alter") is not None else 0,
                "octave": int(get("octave")) if get("octave") is not None else None,
                "onsetBeat": float(get("onset_beat")) if get("onset_beat") is not None else None,
                "durationBeat": float(get("duration_beat")) if get("duration_beat") is not None else None,
                "onsetQuarter": float(get("onset_quarter")) if get("onset_quarter") is not None else None,
                "durationQuarter": float(get("duration_quarter")) if get("duration_quarter") is not None else None,
                "onsetDiv": int(get("onset_div")) if get("onset_div") is not None else None,
                "durationDiv": int(get("duration_div")) if get("duration_div") is not None else None,
                "voice": int(get("voice")) if get("voice") is not None else None,
                "staff": int(get("staff")) if get("staff") is not None else None,
                "divsPerQuarter": int(get("divs_pq")) if get("divs_pq") is not None else None,
                "keyFifths": int(get("ks_fifths")) if get("ks_fifths") is not None else None,
                "keyMode": int(get("ks_mode")) if get("ks_mode") is not None else None,
                "timeBeats": int(get("ts_beats")) if get("ts_beats") is not None else None,
                "timeBeatType": int(get("ts_beat_type")) if get("ts_beat_type") is not None else None,
                "ties": {
                    "start": tie_next is not None,
                    "stop": tie_prev is not None,
                },
                "tiePrevSourceNoteId": _source_note_id(tie_prev) if tie_prev is not None else None,
                "tieNextSourceNoteId": _source_note_id(tie_next) if tie_next is not None else None,
                "tuplet": _tuplet_from_symbolic_duration(note_object) if note_object is not None else None,
                "fingerings": _fingering_values(note_object) if note_object is not None else [],
                "articulations": _articulation_values(note_object) if note_object is not None else [],
                "ornaments": _ornament_values(note_object) if note_object is not None else [],
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
