import asyncio
import logging
from typing import Any

from google import genai
from google.genai import types
from pydantic import TypeAdapter

from moura_gestao.application.ports import NotesExtractor
from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.photos import RawLine
from moura_gestao.infrastructure.config import Settings

log = logging.getLogger(__name__)

PROMPT = """\
A imagem é a foto de uma folha de anotações de um operador de perfuratriz de estacas.
Para cada estaca anotada, extraia exatamente como está escrito:
- pile_code: o identificador da estaca (ex.: "E-12", "P3");
- diameter: o diâmetro em centímetros (ex.: "30", "Ø40");
- depth: a profundidade em metros (ex.: "12,5").
Não calcule, não some, não converta unidades e não corrija valores.
Não invente linhas: ignore linhas ilegíveis por inteiro; se só um campo estiver ilegível,
escreva "ilegível" nesse campo.
Responda com a lista de linhas na ordem em que aparecem na folha."""

_LINES = TypeAdapter(list[RawLine])


def _failed() -> DomainError:
    return DomainError("Não foi possível ler a foto", code="extraction_failed")


class GeminiNotesExtractor:
    """Extrai as linhas com o Gemini (google-genai, cliente assíncrono, saída estruturada)."""

    def __init__(
        self, api_key: str | None, model: str, timeout_s: float, client: Any | None = None
    ) -> None:
        self._model = model
        self._timeout_s = timeout_s
        self._client = client
        if self._client is None and api_key:
            self._client = genai.Client(api_key=api_key)

    async def extract(self, image: bytes, content_type: str) -> list[RawLine]:
        if self._client is None:
            raise DomainError(
                "Leitura de fotos indisponível no momento", code="extraction_unavailable"
            )
        try:
            async with asyncio.timeout(self._timeout_s):
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=[PROMPT, types.Part.from_bytes(data=image, mime_type=content_type)],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=list[RawLine],
                    ),
                )
            if isinstance(response.parsed, list):
                return _LINES.validate_python(response.parsed)
            if response.text:
                return _LINES.validate_json(response.text)
        except Exception:
            log.exception("falha na extração com o Gemini")
            raise _failed() from None
        log.error("Gemini respondeu sem linhas estruturadas")
        raise _failed()


class FakeNotesExtractor:
    """Extrator determinístico para e2e/CI (NOTES_EXTRACTOR=fake)."""

    async def extract(self, image: bytes, content_type: str) -> list[RawLine]:
        return [
            RawLine(pile_code="E-1", diameter="30", depth="8,5"),
            RawLine(pile_code="E-2", diameter="30", depth="12,0"),
            RawLine(pile_code="E-3", diameter="40", depth="ilegível"),
        ]


def make_extractor(settings: Settings) -> NotesExtractor:
    if settings.notes_extractor == "fake":
        return FakeNotesExtractor()
    return GeminiNotesExtractor(
        settings.gemini_key, settings.gemini_model, settings.extraction_timeout_s
    )
