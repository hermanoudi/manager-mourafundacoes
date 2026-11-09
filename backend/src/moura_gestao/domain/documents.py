import re
from typing import Literal

_CNPJ_W1 = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
_CNPJ_W2 = (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)


def normalize_document(raw: str) -> str:
    return re.sub(r"[.\-/\s]", "", raw).upper()


def _dv(values: list[int], weights: tuple[int, ...]) -> int:
    rest = sum(v * w for v, w in zip(values, weights, strict=True)) % 11
    return 0 if rest < 2 else 11 - rest


def is_valid_cpf(doc: str) -> bool:
    if not re.fullmatch(r"\d{11}", doc) or len(set(doc)) == 1:
        return False
    nums = [int(c) for c in doc]
    for n in (9, 10):
        rest = sum(nums[i] * (n + 1 - i) for i in range(n)) % 11
        if nums[n] != (0 if rest < 2 else 11 - rest):
            return False
    return True


def is_valid_cnpj(doc: str) -> bool:
    if not re.fullmatch(r"[0-9A-Z]{12}\d{2}", doc) or len(set(doc)) == 1:
        return False
    values = [ord(c) - 48 for c in doc[:12]]
    d1 = _dv(values, _CNPJ_W1)
    d2 = _dv([*values, d1], _CNPJ_W2)
    return doc[12:] == f"{d1}{d2}"


def document_kind(doc: str) -> Literal["PF", "PJ"]:
    doc = normalize_document(doc)
    if is_valid_cpf(doc):
        return "PF"
    if is_valid_cnpj(doc):
        return "PJ"
    raise ValueError("documento inválido")
