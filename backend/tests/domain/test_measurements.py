from decimal import Decimal

import pytest

from moura_gestao.domain.measurements import (
    MeasurementLine,
    normalize_pile_code,
    pile_key,
    totals_by_diameter,
)


def test_pile_key_ignores_punctuation_and_case():
    assert pile_key("E-12") == pile_key(" e 12 ") == "E12"
    assert normalize_pile_code("  e-12 ") == "E-12"
    assert normalize_pile_code("e   12") == "E 12"
    with pytest.raises(ValueError):
        normalize_pile_code("")
    with pytest.raises(ValueError):
        normalize_pile_code("   ")
    with pytest.raises(ValueError):
        normalize_pile_code("E" * 21)


def test_totals_by_diameter():
    lines = [
        MeasurementLine("E1", 30, Decimal("8.50")),
        MeasurementLine("E2", 30, Decimal("12.00")),
        MeasurementLine("E3", 40, Decimal("10.25")),
    ]
    assert totals_by_diameter(lines) == [
        (30, 2, Decimal("20.50")),
        (40, 1, Decimal("10.25")),
    ]
