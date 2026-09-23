"""Offline tests for the dataset normalisation port (app/core/normalize.py).

These mirror the dataset pipeline's contract: passenger-typed spellings must
resolve to the same canonical keys the dataset's routes carry (od_match_key),
without any database.
"""
from app.core.normalize import (
    canonical_name,
    depot_match_key,
    normalize_component,
    route_match_key,
    route_text_match_key,
)


def test_alias_resolution():
    assert canonical_name("Guruvayoor") == "GURUVAYUR"
    assert canonical_name("Kozhikkode") == "KOZHIKODE"
    assert canonical_name("Trivandrum") == "THIRUVANANTHAPURAM"
    assert canonical_name("Calicut") == "KOZHIKODE"
    assert canonical_name("Kochi") == "ERNAKULAM"
    assert canonical_name("Cochin") == "ERNAKULAM"


def test_noise_tokens_strip():
    assert canonical_name("KSRTC Guruvayoor Bus Stand") == "GURUVAYUR"
    assert canonical_name("Ernakulam Depot") == "ERNAKULAM"


def test_od_key_matches_dataset_display_names():
    # routes.csv stores 'Guruvayur - Kozhikode'; the typed alias form must
    # produce the identical key.
    assert route_text_match_key("Guruvayur - Kozhikode") == "GURUVAYUR|KOZHIKODE"
    assert route_text_match_key("Guruvayoor to Kozhikode") == "GURUVAYUR|KOZHIKODE"


def test_od_key_arrow_form_from_web_form():
    # The frontend submits 'Origin → Destination via X - Y'.
    assert (
        route_text_match_key("Guruvayur → Kozhikode via Ponnani - Tirur")
        == "GURUVAYUR|KOZHIKODE"
    )


def test_od_key_aliases_both_ends():
    assert route_text_match_key("Trivandrum-Kochi") == "THIRUVANANTHAPURAM|ERNAKULAM"


def test_od_key_empty_safety():
    assert route_text_match_key("") == ""
    assert route_text_match_key(None) == ""
    assert route_text_match_key("   ") == ""


def test_route_match_key_and_components():
    assert route_match_key("Guruvayoor", "Kozhikkode") == "GURUVAYUR|KOZHIKODE"
    assert normalize_component("KSRTC ADOOR") == "ADOOR"


def test_depot_match_key_collapses_doubles():
    # KATTAKKADA/KATTAKADA are audited spelling variants in the dataset.
    assert depot_match_key("Kattakkada") == depot_match_key("Kattakada")
