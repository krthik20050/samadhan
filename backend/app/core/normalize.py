"""Canonical name normalisation — mirrors dataset/scraper/normalize.py.

The dataset pipeline folds, noise-strips and alias-resolves every place name.
The backend reuses the SAME rules so a passenger-typed spelling resolves to
the same canonical key the dataset uses (same folding, same noise tokens,
same alias table, same key). Raw values are never rewritten; this is a
parallel canonical form for matching only.
"""
from __future__ import annotations

import re
import unicodedata

_WS = re.compile(r"\s+")
_NON_WORD = re.compile(r"[^\w\u0d00-\u0d7f ]+")  # keep latin+digits+malayalam
_PARENS = re.compile(r"\([^)]*\)")
_DOUBLE_RE = re.compile(r"(.)\1+")

def fold(value: str | None) -> str:
    """Unicode-normalise, upper-case and collapse whitespace."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("\xa0", " ").replace("\u2013", "-").replace("\u2014", "-")
    text = _WS.sub(" ", text).strip()
    return text.upper()


def slug_key(value: str | None) -> str:
    """Matching key: no punctuation, single spaces."""
    text = _NON_WORD.sub(" ", fold(value))
    return _WS.sub(" ", text).strip()


# Tokens that carry no identity information in a place name.
NOISE_SUFFIXES = (
    "BUS STAND", "BUS STATION", "BUSSTAND", "BUSSTATION", "KSRTC BUS STAND",
    "KSRTC BUS STATION", "KSRTC", "BS", "STAND", "STATION", "DEPOT", "UNIT",
    "OFFICE", "CENTRAL OFFICE", "DEPOT OFFICE",
)

SPELLING_VARIANT = "SPELLING_VARIANT"
ABBREVIATION = "ABBREVIATION"
OFFICIAL_CODE = "OFFICIAL_CODE"

ALIASES: dict[str, dict[str, str]] = {}


def _alias(variant: str, canonical: str, kind: str, evidence: str) -> None:
    ALIASES[slug_key(variant)] = {"canonical": canonical, "kind": kind, "evidence": evidence}


# -- variants observed between the KSRTC EDP station list and everyday usage --
_alias("GURUVAYOOR", "GURUVAYUR", SPELLING_VARIANT,
       "KSRTC EDP station list spells the station GURUVAYOOR; the hackathon brief uses Guruvayur")
_alias("KOZHIKKODE", "KOZHIKODE", SPELLING_VARIANT,
       "KSRTC EDP station list spells the station KOZHIKKODE")
_alias("KOZHIKKODU", "KOZHIKODE", SPELLING_VARIANT, "observed transliteration variant")
_alias("TRIVANDRUM", "THIRUVANANTHAPURAM", ABBREVIATION,
       "TRIVANDRUM appears as a station name in the KSRTC EDP list; THIRUVANANTHAPURAM is the district name")
_alias("THIRUVANANTHAPURAM", "THIRUVANANTHAPURAM", SPELLING_VARIANT, "canonical district name")
_alias("CALICUT", "KOZHIKODE", ABBREVIATION, "English exonym of Kozhikode (no longer official)")
_alias("ALLEPPEY", "ALAPPUZHA", ABBREVIATION, "English exonym of Alappuzha")
_alias("COCHIN", "ERNAKULAM", ABBREVIATION, "English exonym of Ernakulam")
_alias("KOCHI", "ERNAKULAM", ABBREVIATION,
       "everyday short form of Kochi city; KSRTC EDP publishes the stop as ERNAKULAM")
_alias("QUILON", "KOLLAM", ABBREVIATION, "English exonym of Kollam")
_alias("TRICHUR", "THRISSUR", ABBREVIATION, "English exonym of Thrissur")
_alias("CANNANORE", "KANNUR", ABBREVIATION, "English exonym of Kannur")
_alias("PALGHAT", "PALAKKAD", ABBREVIATION, "English exonym of Palakkad")
_alias("THIRUVANANTHAPURAM CENTRAL", "THIRUVANANTHAPURAM", SPELLING_VARIANT,
       "KSRTC depot naming: <city> CENTRAL denotes the central unit of that city")

# -- official district/zone codes published by KSRTC --------------------------
# Codes whose district name is provable from the official depot enquiry page
# alone are derived (mirrors register_official_codes()); the remaining three
# are added with explicit evidence because the page names no office after the
# district itself.
_alias("TVM", "THIRUVANANTHAPURAM", OFFICIAL_CODE,
       "code TVM appears as Dist: TVM on the official depot enquiry page and in the official "
       "office names 'TVM CENTRAL'/'TVM CITY'; THIRUVANANTHAPURAM is the district name")
_alias("IDK", "IDUKKI", OFFICIAL_CODE,
       "code IDK appears as Dist: IDK on the official depot enquiry page (offices KATTAPPANA, "
       "NEDUMKANDAM, THODUPUZHA); IDUKKI is the district name")
_alias("WND", "WAYANAD", OFFICIAL_CODE,
       "code WND appears as Dist: WND on the official depot enquiry page (offices KALPETTA, "
       "MANANTHAVADY, SULTHAN BATHERY); WAYANAD is the district name")

# Derived codes (data/processed/district_codes.csv — evidence: official page).
_alias("ALP", "ALAPPUZHA", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("EKM", "ERNAKULAM", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("KGD", "KASARAGOD", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("KKD", "KOZHIKODE", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("KLM", "KOLLAM", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("KNR", "KANNUR", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("KTM", "KOTTAYAM", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("MLP", "MALAPPURAM", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("PLK", "PALAKKAD", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("PTA", "PATHANAMTHITTA", OFFICIAL_CODE, "derived from official depot enquiry page office names")
_alias("TSR", "THRISSUR", OFFICIAL_CODE, "derived from official depot enquiry page office names")


def strip_noise(value: str) -> str:
    text = fold(value)
    text = _PARENS.sub(" ", text)
    tokens = text.split()
    # Strip noise tokens from the end and the start (e.g. "KSRTC ADOOR").
    changed = True
    while changed and tokens:
        changed = False
        for noise in sorted(NOISE_SUFFIXES, key=len, reverse=True):
            parts = noise.split()
            if len(tokens) >= len(parts) and tokens[-len(parts):] == parts:
                tokens = tokens[: -len(parts)]
                changed = True
            if len(tokens) >= len(parts) and tokens[: len(parts)] == parts:
                tokens = tokens[len(parts):]
                changed = True
    return " ".join(tokens)


def canonical_name(value: str | None) -> str:
    """Apply alias resolution to a folded, noise-stripped name."""
    base = strip_noise(value)
    if not base:
        return ""
    entry = ALIASES.get(slug_key(base))
    if entry:
        return entry["canonical"]
    # Fall back to a non-alias match so "KSRTC GURUVAYOOR" style noise still folds.
    return base


def normalize_component(value: str | None) -> str:
    """Canonical key used inside deterministic IDs and lookups."""
    return slug_key(canonical_name(value))


def collapse_doubles(value: str) -> str:
    """Collapse runs of a repeated letter: KATTAKKADA -> KATAKADA.

    Used purely as an auditable spelling-variant test; never rewrites display
    forms.
    """
    return _DOUBLE_RE.sub(r"\1", value or "")


def depot_match_key(value: str | None) -> str:
    """Match key for offices/depots: alias-resolved, punctuation-free,
    space-free, duplicated letters collapsed. Display forms are never
    rewritten by this."""
    key = normalize_component(value)
    return collapse_doubles(key.replace(" ", ""))


def route_match_key(origin: str | None, destination: str | None) -> str:
    """Canonical lookup key for a route: 'ORIGIN|DESTINATION'."""
    return f"{normalize_component(origin)}|{normalize_component(destination)}"


def route_text_match_key(text: str | None) -> str:
    """Canonical key for free-typed route text ('Guruvayoor to Kozhikode',
    'Origin → Destination via X - Y' — the arrow form the web form submits).

    The 'via …' clause is dropped first (dataset route names never carry
    one), then the remainder splits on arrow / TO / spaced dash and both
    halves resolve through the canonical pipeline.
    """
    folded = strip_noise(text)
    if not folded:
        return ""
    cut = re.split(r"\s+VIA\s+", folded, maxsplit=1)[0]
    for pattern in (r"\s*(?:→|->|—|–)\s*", r"\s+TO\s+", r"\s+-\s+", r"-"):
        parts = re.split(pattern, cut, maxsplit=1)
        if len(parts) == 2 and parts[0].strip() and parts[1].strip():
            return route_match_key(parts[0], parts[1])
    # Single token: an alias row may still hit (e.g. a published route name).
    return slug_key(cut)
    if len(parts) == 2:
        return route_match_key(parts[0], parts[1])
    # Single token: an alias row may still hit (e.g. a published route name).
    return slug_key(folded)
