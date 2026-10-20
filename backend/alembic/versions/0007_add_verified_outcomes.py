"""add verified_outcomes table

Revision ID: 0007_add_verified_outcomes
Revises: 0006_add_escalation_cases
Create Date: 2026-10-17 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0007_add_verified_outcomes'
down_revision: Union[str, None] = '0006_add_escalation_cases'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'verified_outcomes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('trade', sa.String(length=128), nullable=False),
        sa.Column('training_provider', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=128), nullable=False),
        sa.Column('nsqf_level', sa.String(length=64), nullable=False),
        sa.Column('placement_rate', sa.Float(), nullable=False),
        sa.Column('post_training_earnings_range', sa.String(length=128), nullable=False),
        sa.Column('reporting_period', sa.String(length=64), nullable=False),
        sa.Column('sample_size', sa.Integer(), nullable=False),
        sa.Column('progression_pathways', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(length=512), nullable=False),
        sa.Column('verification_status', sa.String(length=32), server_default='unverified', nullable=False),
        sa.Column('last_verified_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('verified_by', sa.String(length=36), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_verified_outcomes_id'), 'verified_outcomes', ['id'], unique=False)
    op.create_index(op.f('ix_verified_outcomes_trade'), 'verified_outcomes', ['trade'], unique=False)
    op.create_index(op.f('ix_verified_outcomes_training_provider'), 'verified_outcomes', ['training_provider'], unique=False)
    op.create_index(op.f('ix_verified_outcomes_location'), 'verified_outcomes', ['location'], unique=False)
    op.create_index(op.f('ix_verified_outcomes_verification_status'), 'verified_outcomes', ['verification_status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_verified_outcomes_verification_status'), table_name='verified_outcomes')
    op.drop_index(op.f('ix_verified_outcomes_location'), table_name='verified_outcomes')
    op.drop_index(op.f('ix_verified_outcomes_training_provider'), table_name='verified_outcomes')
    op.drop_index(op.f('ix_verified_outcomes_trade'), table_name='verified_outcomes')
    op.drop_index(op.f('ix_verified_outcomes_id'), table_name='verified_outcomes')
    op.drop_table('verified_outcomes')
