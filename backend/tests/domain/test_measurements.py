from decimal import Decimal

import pytest

from moura_gestao.domain.measurements import (
    MeasurementLine,
    normalize_pile_code,
    total_meters,
    total_piles,
    totals_by_diameter,
)


def test_normalize_pile_code():
    assert normalize_pile_code("  e-12 ") == "E-12"
    assert normalize_pile_code("e   12") == "E 12"
    with pytest.raises(ValueError):
        normalize_pile_code("")
    with pytest.raises(ValueError):
        normalize_pile_code("   ")
    with pytest.raises(ValueError):
        normalize_pile_code("E" * 21)


def test_totals_multiply_quantity():
    lines = [
        MeasurementLine(30, 30, Decimal("8.00")),
        MeasurementLine(10, 35, Decimal("10.00")),
        MeasurementLine(2, 30, Decimal("8.50")),
    ]
    assert totals_by_diameter(lines) == [
        (30, 32, Decimal("257.00")),
        (35, 10, Decimal("100.00")),
    ]
    assert total_meters(lines) == Decimal("357.00")
    assert total_piles(lines) == 42


def test_legacy_line_keeps_code():
    line = MeasurementLine(1, 30, Decimal("8"), "E-1")
    assert line.pile_code == "E-1"
    assert MeasurementLine(1, 30, Decimal("8")).pile_code is None
