import pytest

from moura_gestao.interfaces.http.errors import status_for

NEW_CODES = [
    *[
        (c, 409)
        for c in (
            "invalid_status_transition", "job_not_ready", "job_locked", "job_not_in_progress",
            "rig_not_allocated", "rig_unavailable", "invalid_operator", "measurement_locked",
            "diameter_not_contracted", "pending_measurements", "duplicate_pile",
            "duplicate_client_key",
        )
    ],
    ("line_exceeds_rig", 422),
    ("future_date", 422),
    ("file_too_large", 413),
    ("unsupported_media_type", 415),
    ("extraction_failed", 502),
    ("extraction_unavailable", 503),
]


@pytest.mark.parametrize(("code", "status"), NEW_CODES)
def test_new_codes_have_explicit_status(code, status):
    from moura_gestao.interfaces.http.errors import STATUS

    assert STATUS[code] == status
    assert status_for(code) == status


def test_fallbacks():
    assert status_for("duplicate_whatever") == 409
    assert status_for("unknown_code") == 400
