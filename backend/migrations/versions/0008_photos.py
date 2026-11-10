"""photos

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-10 14:21:36.019167
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0008'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('photos',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('job_id', sa.Integer(), nullable=False),
    sa.Column('uploaded_by', sa.Integer(), nullable=False),
    sa.Column('storage_key', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.String(length=50), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_photos_job_id_jobs')),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_photos_uploaded_by_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_photos')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_photos_storage_key'))
    )
    op.create_index(op.f('ix_photos_job_id'), 'photos', ['job_id'], unique=False)
    op.add_column('measurements', sa.Column('photo_id', sa.Uuid(), nullable=True))
    op.create_index(op.f('ix_measurements_photo_id'), 'measurements', ['photo_id'], unique=False)
    op.create_foreign_key(op.f('fk_measurements_photo_id_photos'), 'measurements', 'photos', ['photo_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(op.f('fk_measurements_photo_id_photos'), 'measurements', type_='foreignkey')
    op.drop_index(op.f('ix_measurements_photo_id'), table_name='measurements')
    op.drop_column('measurements', 'photo_id')
    op.drop_index(op.f('ix_photos_job_id'), table_name='photos')
    op.drop_table('photos')
