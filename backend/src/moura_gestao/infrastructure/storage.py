import asyncio
from pathlib import Path, PurePosixPath

import boto3
from botocore.exceptions import ClientError
from pydantic import SecretStr

from moura_gestao.application.ports import FileStorage
from moura_gestao.domain.errors import NotFound
from moura_gestao.infrastructure.config import Settings

_MISSING = "Arquivo não encontrado"


def _safe_parts(key: str) -> tuple[str, ...]:
    path = PurePosixPath(key)
    if not key or path.is_absolute() or any(p in ("..", ".", "") for p in key.split("/")):
        raise ValueError(f"chave de arquivo inválida: {key!r}")
    return path.parts


class LocalFileStorage:
    """Disco local (dev/teste; no compose, um volume em /app/var/uploads)."""

    def __init__(self, base_dir: str | Path) -> None:
        self._base = Path(base_dir)

    def _path(self, key: str) -> Path:
        return self._base.joinpath(*_safe_parts(key))

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

        await asyncio.to_thread(_write)

    async def get(self, key: str) -> bytes:
        path = self._path(key)
        try:
            return await asyncio.to_thread(path.read_bytes)
        except FileNotFoundError:
            raise NotFound(_MISSING) from None


class S3FileStorage:
    """S3-compatível (Railway Bucket, Cloudflare R2): o disco do Railway é efêmero."""

    def __init__(
        self, *, bucket: str, endpoint_url: str | None, region: str, access_key_id: str,
        secret_access_key: SecretStr,
    ) -> None:
        self._bucket = bucket
        self._client = boto3.client(
            "s3", endpoint_url=endpoint_url, region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key.get_secret_value(),
        )

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self._client.put_object, Bucket=self._bucket, Key=key, Body=data,
            ContentType=content_type,
        )

    async def get(self, key: str) -> bytes:
        def _read() -> bytes:
            try:
                obj = self._client.get_object(Bucket=self._bucket, Key=key)
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                    raise NotFound(_MISSING) from None
                raise
            return obj["Body"].read()

        return await asyncio.to_thread(_read)


def make_storage(settings: Settings) -> FileStorage:
    if settings.storage_backend == "s3":
        # o validator de Settings já exige bucket e credenciais com s3
        assert settings.s3_bucket and settings.s3_access_key_id and settings.s3_secret_access_key
        return S3FileStorage(
            bucket=settings.s3_bucket, endpoint_url=settings.s3_endpoint_url or None,
            region=settings.s3_region, access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
        )
    return LocalFileStorage(settings.storage_local_dir)
