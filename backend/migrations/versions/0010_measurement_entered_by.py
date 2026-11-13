"""quem digitou a medição (o admin pode lançar no nome do operador)

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-13 14:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0010'
down_revision: Union[str, None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('measurements', sa.Column('entered_by', sa.Integer(), nullable=True))
    # medições antigas foram digitadas pelo próprio autor
    op.execute("UPDATE measurements SET entered_by = created_by")
    op.alter_column('measurements', 'entered_by', existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        op.f('fk_measurements_entered_by_users'), 'measurements', 'users',
        ['entered_by'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('fk_measurements_entered_by_users'), 'measurements', type_='foreignkey'
    )
    op.drop_column('measurements', 'entered_by')
