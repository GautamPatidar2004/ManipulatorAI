"""add message feedback table

Revision ID: 0004_add_message_feedback
Revises: 0003_add_memory_provenance
Create Date: 2026-10-11 01:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_add_message_feedback'
down_revision: Union[str, None] = '0003_add_memory_provenance'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'message_feedback',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('message_id', sa.String(length=36), sa.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_id', sa.String(length=36), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False, server_default='default_user'),
        sa.Column('rating', sa.String(length=16), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'message_id', name='uq_user_message_feedback'),
    )
    op.create_index(op.f('ix_message_feedback_id'), 'message_feedback', ['id'], unique=False)
    op.create_index(op.f('ix_message_feedback_message_id'), 'message_feedback', ['message_id'], unique=False)
    op.create_index(op.f('ix_message_feedback_conversation_id'), 'message_feedback', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_message_feedback_user_id'), 'message_feedback', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_message_feedback_user_id'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_conversation_id'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_message_id'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_id'), table_name='message_feedback')
    op.drop_table('message_feedback')
