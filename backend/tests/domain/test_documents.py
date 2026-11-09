import pytest

from moura_gestao.domain.documents import document_kind, normalize_document


def test_cpf_valid_formatted():
    assert document_kind("529.982.247-25") == "PF"


def test_cnpj_numeric_formatted():
    assert document_kind("11.222.333/0001-81") == "PJ"


def test_cnpj_alphanumeric():
    assert document_kind("12.ABC.345/01DE-35") == "PJ"


def test_cnpj_alphanumeric_lowercase_normalized():
    assert normalize_document("12.abc.345/01de-35") == "12ABC34501DE35"


@pytest.mark.parametrize(
    "bad",
    ["111.111.111-11", "529.982.247-24", "00.000.000/0000-00", "11.222.333/0001-82", "12345"],
)
def test_invalid_documents(bad):
    with pytest.raises(ValueError):
        document_kind(bad)
