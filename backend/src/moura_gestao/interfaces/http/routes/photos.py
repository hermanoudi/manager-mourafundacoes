import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile
from starlette.types import Message, Receive

from moura_gestao.application import photos as uc
from moura_gestao.application.photos import Extraction
from moura_gestao.application.ports import FileStorage, NotesExtractor
from moura_gestao.domain.errors import DomainError
from moura_gestao.domain.users import User
from moura_gestao.infrastructure.repositories import SqlJobRepository, SqlPhotoRepository
from moura_gestao.interfaces.http.deps import current_user, get_extractor, get_session, get_storage
from moura_gestao.interfaces.http.schemas import ExtractedLineOut, ExtractionOut, PhotoUploadOut

router = APIRouter(prefix="/api", tags=["photos"])

CHUNK = 64 * 1024
MULTIPART_SLACK = 64 * 1024  # cabeçalhos/fronteiras do multipart além da própria foto


@dataclass
class Repos:
    photos: SqlPhotoRepository
    jobs: SqlJobRepository


def get_repos(session: AsyncSession = Depends(get_session)) -> Repos:
    return Repos(SqlPhotoRepository(session), SqlJobRepository(session))


def _limited(receive: Receive, limit: int, max_bytes: int) -> Receive:
    """Corta o corpo da requisição assim que passar do limite (vale sem Content-Length)."""
    received = 0

    async def _receive() -> Message:
        nonlocal received
        message = await receive()
        if message["type"] == "http.request":
            received += len(message.get("body", b""))
            if received > limit:
                raise uc.file_too_large(max_bytes)
        return message

    return _receive


async def _chunks(file: UploadFile) -> AsyncIterator[bytes]:
    while chunk := await file.read(CHUNK):
        yield chunk


def _extraction_out(ex: Extraction) -> ExtractionOut:
    return ExtractionOut(
        lines=[
            ExtractedLineOut(
                pile_code=ln.pile_code, diameter_cm=ln.diameter_cm, depth_m=ln.depth_m,
                valid=ln.valid, error=ln.error,
            )
            for ln in ex.lines
        ],
        warnings=ex.warnings,
    )


@router.post(
    "/jobs/{job_id}/photos", response_model=PhotoUploadOut, status_code=201,
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object", "required": ["file"],
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            }
        }
    },
)
async def upload_photo(
    job_id: int, request: Request, user: User = Depends(current_user),
    r: Repos = Depends(get_repos), storage: FileStorage = Depends(get_storage),
    extractor: NotesExtractor = Depends(get_extractor),
):
    max_bytes = request.app.state.settings.max_upload_mb * 1024 * 1024
    # acesso antes de ler o corpo: operador não alocado recebe 404, não 413/415
    await uc.job_for_upload(r.jobs, user, job_id)
    limit = max_bytes + MULTIPART_SLACK
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > limit:
        raise uc.file_too_large(max_bytes)
    limited = Request(request.scope, _limited(request.receive, limit, max_bytes))
    async with limited.form(max_files=1, max_fields=5) as form:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise DomainError("Envie a foto no campo 'file'", code="validation_error")
        photo, extraction, error = await uc.upload_photo(
            r.photos, r.jobs, storage, extractor, user, job_id=job_id,
            content_type=file.content_type or "", chunks=_chunks(file), max_bytes=max_bytes,
        )
    return PhotoUploadOut(
        photo_id=photo.id,
        extraction=_extraction_out(extraction) if extraction else None,
        extraction_error=error,
    )


@router.post("/photos/{photo_id}/extract", response_model=ExtractionOut)
async def extract_photo(
    photo_id: uuid.UUID, user: User = Depends(current_user), r: Repos = Depends(get_repos),
    storage: FileStorage = Depends(get_storage),
    extractor: NotesExtractor = Depends(get_extractor),
):
    return _extraction_out(
        await uc.extract_photo(r.photos, r.jobs, storage, extractor, user, photo_id)
    )


@router.get("/photos/{photo_id}")
async def get_photo(
    photo_id: uuid.UUID, user: User = Depends(current_user), r: Repos = Depends(get_repos),
    storage: FileStorage = Depends(get_storage),
):
    photo, data = await uc.read_photo(r.photos, r.jobs, storage, user, photo_id)
    return Response(
        content=data, media_type=photo.content_type,
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )
