"""GeminiNotesExtractor testado só por um cliente falso injetado: nenhum acesso à rede."""
import asyncio
from types import SimpleNamespace

import pytest
from google.genai import types

from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.photos import RawLine
from moura_gestao.infrastructure.extractors import GeminiNotesExtractor


class FakeModels:
    def __init__(self, result=None, exc: Exception | None = None, delay: float = 0) -> None:
        self.result, self.exc, self.delay = result, exc, delay
        self.calls: list[dict] = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.exc:
            raise self.exc
        return self.result


def _client(models: FakeModels):
    return SimpleNamespace(aio=SimpleNamespace(models=models))


def _extractor(models: FakeModels, timeout_s: float = 5) -> GeminiNotesExtractor:
    return GeminiNotesExtractor(
        api_key="chave", model="modelo-x", timeout_s=timeout_s, client=_client(models)
    )


async def test_sends_image_and_structured_schema():
    lines = [RawLine(pile_code="E-1", diameter="30", depth="8,5")]
    models = FakeModels(SimpleNamespace(parsed=lines, text=None))
    assert await _extractor(models).extract(b"img", "image/jpeg") == lines
    (call,) = models.calls
    assert call["model"] == "modelo-x"
    part = next(p for p in call["contents"] if isinstance(p, types.Part))
    assert part.inline_data.data == b"img"
    assert part.inline_data.mime_type == "image/jpeg"
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].response_schema == list[RawLine]


async def test_falls_back_to_json_text_when_not_parsed():
    text = '[{"pile_code": "E-1", "diameter": "30", "depth": "8,5"}]'
    models = FakeModels(SimpleNamespace(parsed=None, text=text))
    assert await _extractor(models).extract(b"img", "image/png") == [
        RawLine(pile_code="E-1", diameter="30", depth="8,5")
    ]


@pytest.mark.parametrize(
    "models",
    [
        FakeModels(exc=RuntimeError("falha de rede")),
        FakeModels(SimpleNamespace(parsed=None, text="não é json")),
        FakeModels(SimpleNamespace(parsed=None, text=None)),
    ],
)
async def test_errors_become_extraction_failed(models):
    with pytest.raises(DomainError) as exc:
        await _extractor(models).extract(b"img", "image/jpeg")
    assert exc.value.code == "extraction_failed"


async def test_timeout_becomes_extraction_failed():
    models = FakeModels(SimpleNamespace(parsed=[], text="[]"), delay=1)
    with pytest.raises(DomainError) as exc:
        await _extractor(models, timeout_s=0.05).extract(b"img", "image/jpeg")
    assert exc.value.code == "extraction_failed"


@pytest.mark.parametrize("key", [None, ""])
async def test_without_key_is_unavailable(key):
    with pytest.raises(DomainError) as exc:
        await GeminiNotesExtractor(api_key=key, model="m", timeout_s=5).extract(b"i", "image/jpeg")
    assert exc.value.code == "extraction_unavailable"
