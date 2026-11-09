from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_TWO = Decimal("0.01")


def parse_decimal_br(value: str | int | Decimal) -> Decimal:
    if isinstance(value, bool | float):
        raise ValueError("float não é aceito")  # noqa: TRY004
    if isinstance(value, int | Decimal):
        return Decimal(value)
    if not isinstance(value, str):
        raise ValueError("valor inválido")  # noqa: TRY004
    text = value.strip()
    if not text:
        raise ValueError("valor vazio")
    if "," in text:
        if text.count(",") > 1:
            raise ValueError("valor inválido")
        text = text.replace(".", "").replace(",", ".")
    try:
        result = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("valor inválido") from exc
    if not result.is_finite():
        raise ValueError("valor inválido")
    return result


def quantize_money(v: Decimal) -> Decimal:
    return v.quantize(_TWO, rounding=ROUND_HALF_UP)


def quantize_measure(v: Decimal) -> Decimal:
    return v.quantize(_TWO, rounding=ROUND_HALF_UP)
