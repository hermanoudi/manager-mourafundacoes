import re
import uuid
from collections.abc import AsyncIterable
from dataclasses import dataclass, field
from decimal import Decimal

from moura_gestao.application.jobs import get_job_for
from moura_gestao.application.ports import (
    FileStorage,
    JobRepository,
    NotesExtractor,
    PhotoRepository,
)
from moura_gestao.domain.errors import Conflict, DomainError, NotFound
from moura_gestao.domain.jobs import Job, JobStatus
from moura_gestao.domain.measurements import normalize_pile_code
from moura_gestao.domain.numbers import parse_decimal_br, quantize_measure
from moura_gestao.domain.photos import ALLOWED_CONTENT_TYPES, Photo, RawLine, photo_key
from moura_gestao.domain.users import Role, User

MAX_EXTRACTED_LINES = 200
EXTRACTION_ERRORS = frozenset({"extraction_failed", "extraction_unavailable"})
_NOT_FOUND = "Foto não encontrada"
_DIAMETER = re.compile(r"^[ØøΦφ⌀]?\s*(\d+)\s*(?:cm)?$", re.IGNORECASE)
_DEPTH_UNIT = re.compile(r"\s*m$", re.IGNORECASE)


@dataclass(frozen=True)
class ExtractedLine:
    pile_code: str
    diameter_cm: int | None
    depth_m: Decimal | None
    valid: bool
    error: str | None = None


@dataclass(frozen=True)
class Extraction:
    lines: list[ExtractedLine]
    warnings: list[str] = field(default_factory=list)


def _diameter(raw: str) -> int:
    match = _DIAMETER.match(raw.strip())
    if not match:
        raise ValueError(f"diâmetro não reconhecido ({raw.strip() or 'vazio'})")
    return int(match.group(1))


def _depth(raw: str) -> Decimal:
    try:
        value = parse_decimal_br(_DEPTH_UNIT.sub("", raw.strip()))
    except ValueError:
        raise ValueError(f"profundidade não reconhecida ({raw.strip() or 'vazia'})") from None
    if value <= 0:
        raise ValueError("profundidade deve ser maior que zero")
    return quantize_measure(value)


def _normalize_line(raw: RawLine) -> ExtractedLine:
    errors: list[str] = []
    pile_code, diameter, depth = raw.pile_code.strip(), None, None
    try:
        pile_code = normalize_pile_code(raw.pile_code)
    except ValueError as exc:
        errors.append(str(exc))
    try:
        diameter = _diameter(raw.diameter)
    except ValueError as exc:
        errors.append(str(exc))
    try:
        depth = _depth(raw.depth)
    except ValueError as exc:
        errors.append(str(exc))
    error = None
    if errors:
        joined = "; ".join(errors)
        error = joined[0].upper() + joined[1:]
    return ExtractedLine(pile_code, diameter, depth, valid=not errors, error=error)


def normalize_extracted(raw: list[RawLine]) -> Extraction:
    """Converte o texto lido pela IA; linha que não se entende vira valid=False e as outras seguem."""
    warnings: list[str] = []
    if len(raw) > MAX_EXTRACTED_LINES:
        warnings.append(
            f"A foto tem {len(raw)} linhas; só as primeiras {MAX_EXTRACTED_LINES} foram lidas"
        )
        raw = raw[:MAX_EXTRACTED_LINES]
    return Extraction([_normalize_line(r) for r in raw], warnings)


def _check_in_progress(job: Job) -> None:
    if job.status != JobStatus.IN_PROGRESS:
        raise Conflict("job_not_in_progress", "A obra não está em execução")


async def job_for_upload(jobs: JobRepository, user: User, job_id: int) -> Job:
    """Quem pode medir na obra: obra visível (operador alocado) e em execução."""
    job = await get_job_for(jobs, user, job_id)
    _check_in_progress(job)
    return job


def file_too_large(max_bytes: int) -> DomainError:
    return DomainError(
        f"A foto passa do limite de {max_bytes // (1024 * 1024)} MB", code="file_too_large"
    )


async def read_limited(chunks: AsyncIterable[bytes], max_bytes: int) -> bytes:
    """Lê em blocos e para assim que passar do limite."""
    data = bytearray()
    async for chunk in chunks:
        data.extend(chunk)
        if len(data) > max_bytes:
            raise file_too_large(max_bytes)
    return bytes(data)


async def _try_extract(
    extractor: NotesExtractor, data: bytes, content_type: str
) -> tuple[Extraction | None, str | None]:
    try:
        return normalize_extracted(await extractor.extract(data, content_type)), None
    except DomainError as exc:
        if exc.code not in EXTRACTION_ERRORS:
            raise
        return None, exc.code


async def upload_photo(
    photos: PhotoRepository, jobs: JobRepository, storage: FileStorage,
    extractor: NotesExtractor, user: User, *, job_id: int, content_type: str,
    chunks: AsyncIterable[bytes], max_bytes: int,
) -> tuple[Photo, Extraction | None, str | None]:
    """Grava a foto e depois tenta extrair; falha da extração não desfaz a foto.

    Devolve (foto, extração ou None, código do erro de extração ou None).
    """
    await job_for_upload(jobs, user, job_id)
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise DomainError(
            "Formato não aceito; envie uma foto JPEG, PNG, WebP ou HEIC",
            code="unsupported_media_type",
        )
    data = await read_limited(chunks, max_bytes)
    if not data:
        raise DomainError("A foto está vazia", code="validation_error")
    photo_id = uuid.uuid4()
    key = photo_key(job_id, photo_id, content_type)
    await storage.put(key, data, content_type)
    photo = await photos.add(
        Photo(
            id=photo_id, job_id=job_id, uploaded_by=user.id, storage_key=key,
            content_type=content_type, size_bytes=len(data),
        )
    )
    extraction, error = await _try_extract(extractor, data, content_type)
    return photo, extraction, error


async def get_photo_for(
    photos: PhotoRepository, jobs: JobRepository, user: User, photo_id: uuid.UUID
) -> Photo:
    """Foto visível; operador não alocado na obra recebe NotFound (não vaza existência)."""
    photo = await photos.get(photo_id)
    if photo is None:
        raise NotFound(_NOT_FOUND)
    if user.role == Role.OPERATOR and not await jobs.is_operator_allocated(photo.job_id, user.id):
        raise NotFound(_NOT_FOUND)
    return photo


async def read_photo(
    photos: PhotoRepository, jobs: JobRepository, storage: FileStorage, user: User,
    photo_id: uuid.UUID,
) -> tuple[Photo, bytes]:
    photo = await get_photo_for(photos, jobs, user, photo_id)
    return photo, await storage.get(photo.storage_key)


async def extract_photo(
    photos: PhotoRepository, jobs: JobRepository, storage: FileStorage,
    extractor: NotesExtractor, user: User, photo_id: uuid.UUID,
) -> Extraction:
    """Lê de novo uma foto já enviada (ex.: depois de falha da IA), sem reenviar."""
    photo = await get_photo_for(photos, jobs, user, photo_id)
    await job_for_upload(jobs, user, photo.job_id)
    data = await storage.get(photo.storage_key)
    return normalize_extracted(await extractor.extract(data, photo.content_type))
