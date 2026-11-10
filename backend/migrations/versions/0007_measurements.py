"""measurements

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-10 10:39:02.334254
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('measurements',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_key', sa.Uuid(), nullable=False),
    sa.Column('job_id', sa.Integer(), nullable=False),
    sa.Column('rig_id', sa.Integer(), nullable=False),
    sa.Column('work_date', sa.Date(), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reviewed_by', sa.Integer(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft','submitted','approved','rejected')", name=op.f('ck_measurements_status_valid')),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_measurements_created_by_users')),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_measurements_job_id_jobs')),
    sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name=op.f('fk_measurements_reviewed_by_users')),
    sa.ForeignKeyConstraint(['rig_id'], ['drill_rigs.id'], name=op.f('fk_measurements_rig_id_drill_rigs')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_measurements')),
    sa.UniqueConstraint('client_key', name=op.f('uq_measurements_client_key'))
    )
    op.create_index('ix_measurements_job_id_status', 'measurements', ['job_id', 'status'], unique=False)
    op.create_table('measurement_lines',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('measurement_id', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('pile_code', sa.String(length=20), nullable=False),
    sa.Column('diameter_cm', sa.Integer(), nullable=False),
    sa.Column('depth_m', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.CheckConstraint('depth_m > 0', name=op.f('ck_measurement_lines_depth_positive')),
    sa.CheckConstraint('diameter_cm BETWEEN 20 AND 120', name=op.f('ck_measurement_lines_diameter_range')),
    sa.ForeignKeyConstraint(['measurement_id'], ['measurements.id'], name=op.f('fk_measurement_lines_measurement_id_measurements'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_measurement_lines'))
    )
    op.create_index(op.f('ix_measurement_lines_measurement_id'), 'measurement_lines', ['measurement_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_measurement_lines_measurement_id'), table_name='measurement_lines')
    op.drop_table('measurement_lines')
    op.drop_index('ix_measurements_job_id_status', table_name='measurements')
    op.drop_table('measurements')
