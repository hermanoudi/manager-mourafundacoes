from dataclasses import replace
from typing import Any

from moura_gestao.application.pagination import Page, PageParams
from moura_gestao.application.ports import CustomerRepository
from moura_gestao.domain.customers import Address, Customer, CustomerKind
from moura_gestao.domain.documents import document_kind, normalize_document
from moura_gestao.domain.errors import Conflict, NotFound


async def create_customer(
    repo: CustomerRepository, *, document: str, address: Address, **fields: Any
) -> Customer:
    doc = normalize_document(document)
    kind = CustomerKind(document_kind(doc))
    if await repo.get_by_document(doc) is not None:
        raise Conflict("duplicate_document", "Já existe um cliente com este CPF/CNPJ")
    return await repo.add(Customer(id=None, kind=kind, document=doc, address=address, **fields))


async def update_customer(
    repo: CustomerRepository,
    customer_id: int,
    *,
    document: str | None = None,
    address: Address | None = None,
    **fields: Any,
) -> Customer:
    customer = await repo.get(customer_id)
    if customer is None:
        raise NotFound("Cliente não encontrado")
    changes: dict[str, Any] = dict(fields)
    if document is not None:
        doc = normalize_document(document)
        kind = CustomerKind(document_kind(doc))
        other = await repo.get_by_document(doc)
        if other is not None and other.id != customer_id:
            raise Conflict("duplicate_document", "Já existe um cliente com este CPF/CNPJ")
        changes.update(document=doc, kind=kind)
    if address is not None:
        changes["address"] = address
    return await repo.update(replace(customer, **changes))


async def get_customer(repo: CustomerRepository, customer_id: int) -> Customer:
    customer = await repo.get(customer_id)
    if customer is None:
        raise NotFound("Cliente não encontrado")
    return customer


async def list_customers(repo: CustomerRepository, params: PageParams) -> Page[Customer]:
    return await repo.list(params)
