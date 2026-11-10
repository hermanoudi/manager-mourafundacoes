import boto3
import pytest
from moto import mock_aws
from pydantic import SecretStr

from moura_gestao.domain.errors import NotFound
from moura_gestao.infrastructure.storage import LocalFileStorage, S3FileStorage


async def test_local_put_get(tmp_path):
    storage = LocalFileStorage(tmp_path)
    await storage.put("photos/1/a.jpg", b"abc", "image/jpeg")
    assert await storage.get("photos/1/a.jpg") == b"abc"
    assert (tmp_path / "photos" / "1" / "a.jpg").read_bytes() == b"abc"


@pytest.mark.parametrize("key", ["../x", "photos/../../x", "/etc/passwd", ""])
async def test_local_rejects_unsafe_keys(tmp_path, key):
    storage = LocalFileStorage(tmp_path / "base")
    with pytest.raises(ValueError):
        await storage.put(key, b"abc", "image/jpeg")
    with pytest.raises(ValueError):
        await storage.get(key)


async def test_local_missing_key_not_found(tmp_path):
    with pytest.raises(NotFound):
        await LocalFileStorage(tmp_path).get("photos/1/nada.jpg")


async def test_s3_put_get():
    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="fotos")
        storage = S3FileStorage(
            bucket="fotos", endpoint_url=None, region="us-east-1",
            access_key_id="test", secret_access_key=SecretStr("test"),
        )
        await storage.put("photos/1/a.jpg", b"abc", "image/jpeg")
        assert await storage.get("photos/1/a.jpg") == b"abc"
        head = boto3.client("s3", region_name="us-east-1").head_object(
            Bucket="fotos", Key="photos/1/a.jpg"
        )
        assert head["ContentType"] == "image/jpeg"
        with pytest.raises(NotFound):
            await storage.get("photos/1/nada.jpg")
