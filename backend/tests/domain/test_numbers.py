from decimal import Decimal

import pytest

from moura_gestao.domain.numbers import parse_decimal_br, quantize_measure, quantize_money


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("12,5", Decimal("12.5")),
        ("12.5", Decimal("12.5")),
        ("1.234,56", Decimal("1234.56")),
        (" 22,50 ", Decimal("22.50")),
        (15, Decimal("15")),
    ],
)
def test_parse_decimal_br_accepts(raw, expected):
    assert parse_decimal_br(raw) == expected


@pytest.mark.parametrize("raw", ["", "abc", "1,2,3", 1.5])
def test_parse_decimal_br_rejects(raw):
    with pytest.raises(ValueError):
        parse_decimal_br(raw)


def test_quantize_half_up():
    assert quantize_money(Decimal("10.005")) == Decimal("10.01")
    assert quantize_measure(Decimal("2.675")) == Decimal("2.68")
