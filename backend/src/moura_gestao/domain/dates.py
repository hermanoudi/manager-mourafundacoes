from datetime import date, datetime
from zoneinfo import ZoneInfo

BUSINESS_TZ = ZoneInfo("America/Sao_Paulo")


def today_sp(now: datetime) -> date:
    """Data de negócio (fuso de São Paulo) para um instante com fuso."""
    if now.tzinfo is None:
        raise ValueError("datetime sem fuso")
    return now.astimezone(BUSINESS_TZ).date()
