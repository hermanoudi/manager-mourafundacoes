from moura_gestao.application.ports import PriceTableRepository
from moura_gestao.domain.pricing import PriceTable, validate_items


async def get_price_table(repo: PriceTableRepository) -> PriceTable:
    return await repo.get()


async def replace_price_table(repo: PriceTableRepository, table: PriceTable) -> PriceTable:
    items = validate_items(list(table.items))
    return await repo.replace(
        PriceTable(table.mobilization_fee, table.minimum_amount, table.max_tabled_depth_m, items)
    )
