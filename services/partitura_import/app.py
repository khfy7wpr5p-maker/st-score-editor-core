from __future__ import annotations

import os
import signal
import tempfile
from contextlib import contextmanager
from typing import Any, Iterator

import partitura

from .contracts import (
    MAX_EVENTS,
    MAX_MEASURES,
    MAX_MUSICXML_BYTES,
    MAX_PARSE_SECONDS,
    NORMALIZED_IMPORT_ENVELOPE_VERSION,
)
from .normalize import normalize_score


class ImportBoundaryError(ValueError):
    pass


@contextmanager
def _parse_deadline(seconds: int) -> Iterator[None]:
    if not hasattr(signal, "SIGALRM"):
        yield
        return

    def handle_timeout(_signum, _frame):
        raise TimeoutError("Partitura MusicXML parse exceeded configured deadline.")

    previous_handler = signal.signal(signal.SIGALRM, handle_timeout)
    previous_timer = signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, *previous_timer)
        signal.signal(signal.SIGALRM, previous_handler)


def _validate_source(xml_bytes: bytes) -> None:
    if not isinstance(xml_bytes, bytes):
        raise ImportBoundaryError("MusicXML source must be bytes.")
    if len(xml_bytes) == 0:
        raise ImportBoundaryError("MusicXML source must not be empty.")
    if len(xml_bytes) > MAX_MUSICXML_BYTES:
        raise ImportBoundaryError("MusicXML source size exceeds configured limit.")

    prefix = xml_bytes[: min(len(xml_bytes), 16_384)].upper()
    if b"<!DOCTYPE" in prefix or b"<!ENTITY" in prefix:
        raise ImportBoundaryError("MusicXML source contains prohibited document type or entity declaration.")


@contextmanager
def _private_musicxml_file(xml_bytes: bytes) -> Iterator[str]:
    fd, path = tempfile.mkstemp(prefix="st-partitura-import-", suffix=".musicxml")
    try:
        with os.fdopen(fd, "wb") as source:
            source.write(xml_bytes)
        yield path
    finally:
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass


def import_musicxml_bytes(
    xml_bytes: bytes,
    *,
    source_identity: str,
    contract_version: str,
) -> dict[str, Any]:
    if contract_version != NORMALIZED_IMPORT_ENVELOPE_VERSION:
        raise ImportBoundaryError("Unsupported normalized import contract version.")
    if not isinstance(source_identity, str) or not source_identity:
        raise ImportBoundaryError("MusicXML source identity must be a non-empty string.")

    _validate_source(xml_bytes)

    try:
        with _private_musicxml_file(xml_bytes) as path:
            with _parse_deadline(MAX_PARSE_SECONDS):
                score = partitura.load_musicxml(path)
                normalized = normalize_score(score, source_identity)
    except ImportBoundaryError:
        raise
    except TimeoutError as exc:
        raise ImportBoundaryError(str(exc)) from exc
    except Exception as exc:
        raise ImportBoundaryError(f"Partitura MusicXML import failed: {type(exc).__name__}") from exc

    if normalized["measureCount"] > MAX_MEASURES:
        raise ImportBoundaryError("MusicXML measure count exceeds configured limit.")
    if normalized["eventCount"] > MAX_EVENTS:
        raise ImportBoundaryError("MusicXML event count exceeds configured limit.")

    return {
        "version": NORMALIZED_IMPORT_ENVELOPE_VERSION,
        "sourceIdentity": source_identity,
        "parts": normalized["parts"],
        "preservedSymbols": [],
        "diagnostics": [],
        "provenance": normalized["provenance"],
    }
