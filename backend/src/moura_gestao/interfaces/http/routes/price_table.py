from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import pricing as uc
from moura_gestao.domain.pricing import PriceItem, PriceTable
from moura_gestao.domain.users import Role
from moura_gestao.infrastructure.repositories import SqlPriceTableRepository
from moura_gestao.interfaces.http.deps import get_session, require_roles
from moura_gestao.interfaces.http.schemas import PriceItemIO, PriceTableIO

router = APIRouter(prefix="/api/price-table", tags=["price-table"])


def get_repo(session: AsyncSession = Depends(get_session)) -> SqlPriceTableRepository:
    return SqlPriceTableRepository(session)


def _out(t: PriceTable) -> PriceTableIO:
    return PriceTableIO(
        mobilization_fee=t.mobilization_fee,
        minimum_amount=t.minimum_amount,
        max_tabled_depth_m=t.max_tabled_depth_m,
        items=[PriceItemIO(diameter_cm=i.diameter_cm, price_per_m=i.price_per_m) for i in t.items],
    )


@router.get(
    "", response_model=PriceTableIO,
    dependencies=[Depends(require_roles(Role.ADMIN, Role.OFFICE))],
)
async def get_price_table(repo=Depends(get_repo)):
    return _out(await uc.get_price_table(repo))


@router.put(
    "", response_model=PriceTableIO,
    dependencies=[Depends(require_roles(Role.ADMIN, Role.OFFICE))],
)
async def replace_price_table(body: PriceTableIO, repo=Depends(get_repo)):
    table = PriceTable(
        mobilization_fee=body.mobilization_fee,
        minimum_amount=body.minimum_amount,
        max_tabled_depth_m=body.max_tabled_depth_m,
        items=[PriceItem(i.diameter_cm, i.price_per_m) for i in body.items],
    )
    return _out(await uc.replace_price_table(repo, table))
