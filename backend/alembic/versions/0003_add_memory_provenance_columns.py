"""add memory provenance columns

Revision ID: 0003_add_memory_provenance
Revises: 0002_enable_pgvector
Create Date: 2026-10-11 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_add_memory_provenance'
down_revision: Union[str, None] = '0002_enable_pgvector'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_memories', sa.Column('source_conversation_id', sa.String(length=64), nullable=True))
    op.add_column('user_memories', sa.Column('source_message_id', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_user_memories_source_conversation_id'), 'user_memories', ['source_conversation_id'], unique=False)
    op.create_index(op.f('ix_user_memories_source_message_id'), 'user_memories', ['source_message_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_memories_source_message_id'), table_name='user_memories')
    op.drop_index(op.f('ix_user_memories_source_conversation_id'), table_name='user_memories')
    op.drop_column('user_memories', 'source_message_id')
    op.drop_column('user_memories', 'source_conversation_id')
