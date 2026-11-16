"""linha da medição vira grupo: quantidade de estacas; código da estaca opcional (legado)

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-16 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0011'
down_revision: Union[str, None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        'measurement_lines',
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
    )
    op.alter_column('measurement_lines', 'quantity', server_default=None)
    op.create_check_constraint(
        op.f('ck_measurement_lines_quantity_range'), 'measurement_lines',
        'quantity BETWEEN 1 AND 999',
    )
    op.alter_column(
        'measurement_lines', 'pile_code', existing_type=sa.String(20), nullable=True
    )

def downgrade() -> None:
    # Cada grupo volta a ser uma linha por estaca; estacas sem código ganham "L<id>".
    op.execute(
        """
        INSERT INTO measurement_lines
            (measurement_id, position, pile_code, diameter_cm, depth_m, quantity)
        SELECT measurement_id, position, NULL, diameter_cm, depth_m, 1
        FROM measurement_lines, generate_series(2, quantity)
        """
    )
    # O código antigo compara estacas por letras e dígitos ("L-12" == "L12"): o código
    # gerado ganha "X" até não bater com nenhuma outra estaca da mesma obra.
    op.execute(
        """
        CREATE TEMP TABLE _generated ON COMMIT DROP AS
            SELECT id FROM measurement_lines WHERE pile_code IS NULL;
        UPDATE measurement_lines SET pile_code = 'L' || id WHERE pile_code IS NULL;
        DO $$
        BEGIN
            LOOP
                UPDATE measurement_lines g SET pile_code = g.pile_code || 'X'
                FROM measurements gm
                WHERE gm.id = g.measurement_id
                  AND g.id IN (SELECT id FROM _generated)
                  AND EXISTS (
                      SELECT 1 FROM measurement_lines o
                      JOIN measurements om ON om.id = o.measurement_id
                      WHERE om.job_id = gm.job_id AND o.id <> g.id
                        AND (o.id NOT IN (SELECT id FROM _generated) OR o.id < g.id)
                        AND regexp_replace(upper(o.pile_code), '[^A-Z0-9]', '', 'g')
                          = regexp_replace(upper(g.pile_code), '[^A-Z0-9]', '', 'g')
                  );
                EXIT WHEN NOT FOUND;
            END LOOP;
        END $$;
        """
    )
    op.alter_column(
        'measurement_lines', 'pile_code', existing_type=sa.String(20), nullable=False
    )
    op.drop_constraint(
        op.f('ck_measurement_lines_quantity_range'), 'measurement_lines', type_='check'
    )
    op.drop_column('measurement_lines', 'quantity')
