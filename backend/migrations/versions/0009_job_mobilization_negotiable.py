"""mobilização da obra pode ficar a negociar (nula)

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-13 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0009'
down_revision: Union[str, None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'jobs', 'mobilization_fee',
        existing_type=sa.Numeric(precision=14, scale=2), nullable=True,
    )


def downgrade() -> None:
    # obras "a negociar" voltam com mobilização zero para caber no NOT NULL
    op.execute("UPDATE jobs SET mobilization_fee = 0 WHERE mobilization_fee IS NULL")
    op.alter_column(
        'jobs', 'mobilization_fee',
        existing_type=sa.Numeric(precision=14, scale=2), nullable=False,
    )
