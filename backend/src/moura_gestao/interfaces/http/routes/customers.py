from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from moura_gestao.application import customers as uc
from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.domain.customers import Address, Customer
from moura_gestao.domain.users import Role
from moura_gestao.infrastructure.repositories import SqlCustomerRepository
from moura_gestao.interfaces.http.deps import get_session, require_roles
from moura_gestao.interfaces.http.schemas import CustomerIn, CustomerOut, CustomerPatch

router = APIRouter(
    prefix="/api/customers",
    tags=["customers"],
    dependencies=[Depends(require_roles(Role.ADMIN, Role.OFFICE))],
)


def get_repo(session: AsyncSession = Depends(get_session)) -> SqlCustomerRepository:
    return SqlCustomerRepository(session)


def _out(c: Customer) -> CustomerOut:
    data = asdict(c)
    data["kind"] = c.kind.value
    return CustomerOut(**data)


@router.get("", response_model=Page[CustomerOut])
async def list_customers(params: PageParams = Depends(), repo=Depends(get_repo)):
    page = await uc.list_customers(repo, params)
    return Page[CustomerOut](
        items=[_out(c) for c in page.items], total=page.total, page=page.page,
        page_size=page.page_size,
    )


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerIn, repo=Depends(get_repo)):
    fields = body.model_dump(exclude={"document", "address"})
    customer = await uc.create_customer(
        repo, document=body.document, address=Address(**body.address.model_dump()), **fields
    )
    return _out(customer)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, repo=Depends(get_repo)):
    return _out(await uc.get_customer(repo, customer_id))


@router.patch("/{customer_id}", response_model=CustomerOut)
async def patch_customer(customer_id: int, body: CustomerPatch, repo=Depends(get_repo)):
    data = body.model_dump(exclude_unset=True, exclude={"address"})
    address = Address(**body.address.model_dump()) if body.address is not None else None
    return _out(await uc.update_customer(repo, customer_id, address=address, **data))
