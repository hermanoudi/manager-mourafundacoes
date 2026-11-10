from datetime import UTC, date, datetime

import pytest

from moura_gestao.domain.dates import today_sp


def test_today_sp_late_night():
    assert today_sp(datetime(2026, 11, 11, 2, 30, tzinfo=UTC)) == date(2026, 11, 10)
    assert today_sp(datetime(2026, 11, 11, 3, 0, tzinfo=UTC)) == date(2026, 11, 11)


def test_today_sp_requires_aware_datetime():
    with pytest.raises(ValueError):
        today_sp(datetime(2026, 11, 11, 2, 30))
