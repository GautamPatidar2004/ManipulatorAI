"""add escalation_cases table

Revision ID: 0006_add_escalation_cases
Revises: 0005_add_users_table_and_auth
Create Date: 2026-10-17 00:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0006_add_escalation_cases'
down_revision: Union[str, None] = '0005_add_users_table_and_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'escalation_cases',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('conversation_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), server_default='default_user', nullable=False),
        sa.Column('trigger_type', sa.String(length=64), server_default='explicit_request', nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=20), server_default='medium', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='pending', nullable=False),
        sa.Column('user_notes', sa.Text(), nullable=True),
        sa.Column('assigned_to', sa.String(length=36), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_escalation_cases_id'), 'escalation_cases', ['id'], unique=False)
    op.create_index(op.f('ix_escalation_cases_conversation_id'), 'escalation_cases', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_escalation_cases_user_id'), 'escalation_cases', ['user_id'], unique=False)
    op.create_index(op.f('ix_escalation_cases_status'), 'escalation_cases', ['status'], unique=False)
    op.create_index(op.f('ix_escalation_cases_priority'), 'escalation_cases', ['priority'], unique=False)
    op.create_index(op.f('ix_escalation_cases_assigned_to'), 'escalation_cases', ['assigned_to'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_escalation_cases_assigned_to'), table_name='escalation_cases')
    op.drop_index(op.f('ix_escalation_cases_priority'), table_name='escalation_cases')
    op.drop_index(op.f('ix_escalation_cases_status'), table_name='escalation_cases')
    op.drop_index(op.f('ix_escalation_cases_user_id'), table_name='escalation_cases')
    op.drop_index(op.f('ix_escalation_cases_conversation_id'), table_name='escalation_cases')
    op.drop_index(op.f('ix_escalation_cases_id'), table_name='escalation_cases')
    op.drop_table('escalation_cases')
