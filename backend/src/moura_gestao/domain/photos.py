import uuid
from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}


class RawLine(BaseModel):
    """Linha lida da foto, exatamente como escrita. A IA só extrai: nenhum campo de valor."""

    pile_code: str
    diameter: str
    depth: str


@dataclass
class Photo:
    id: uuid.UUID
    job_id: int
    uploaded_by: int
    storage_key: str
    content_type: str
    size_bytes: int
    created_at: datetime | None = None


def photo_key(job_id: int, photo_id: uuid.UUID, content_type: str) -> str:
    return f"photos/{job_id}/{photo_id}.{ALLOWED_CONTENT_TYPES[content_type]}"
