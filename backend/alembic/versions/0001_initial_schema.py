"""initial schema for conversations, messages and user memories

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-10 00:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)

    # 2. Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('conversation_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='ready'),
        sa.Column('notice', sa.Text(), nullable=True),
        sa.Column('structured', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_messages_id'), 'messages', ['id'], unique=False)
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)

    # 3. Create user_memories table
    op.create_table(
        'user_memories',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('key', sa.String(length=128), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('source', sa.String(length=64), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_memories_id'), 'user_memories', ['id'], unique=False)
    op.create_index(op.f('ix_user_memories_user_id'), 'user_memories', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_memories_key'), 'user_memories', ['key'], unique=False)
    op.create_index(op.f('ix_user_memories_category'), 'user_memories', ['category'], unique=False)
    op.create_index(op.f('ix_user_memories_is_active'), 'user_memories', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_memories_is_active'), table_name='user_memories')
    op.drop_index(op.f('ix_user_memories_category'), table_name='user_memories')
    op.drop_index(op.f('ix_user_memories_key'), table_name='user_memories')
    op.drop_index(op.f('ix_user_memories_user_id'), table_name='user_memories')
    op.drop_index(op.f('ix_user_memories_id'), table_name='user_memories')
    op.drop_table('user_memories')

    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_id'), table_name='messages')
    op.drop_table('messages')

    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')
