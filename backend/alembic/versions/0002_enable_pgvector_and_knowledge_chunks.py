"""enable pgvector and create knowledge_chunks table

Revision ID: 0002_enable_pgvector
Revises: 0001_initial_schema
Create Date: 2026-10-10 00:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_enable_pgvector'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension in PostgreSQL
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create knowledge_chunks table
    op.create_table(
        'knowledge_chunks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('source_id', sa.String(length=128), nullable=False),
        sa.Column('source_title', sa.String(length=255), nullable=False),
        sa.Column('source_url', sa.String(length=512), nullable=True),
        sa.Column('source_metadata', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=False),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('embedding', Vector(), nullable=False),
        sa.Column('embedding_model', sa.String(length=128), nullable=False),
        sa.Column('embedding_dim', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_id', 'content_hash', name='uq_knowledge_chunks_source_content')
    )
    op.create_index(op.f('ix_knowledge_chunks_id'), 'knowledge_chunks', ['id'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_source_id'), 'knowledge_chunks', ['source_id'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_content_hash'), 'knowledge_chunks', ['content_hash'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_embedding_model'), 'knowledge_chunks', ['embedding_model'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_knowledge_chunks_embedding_model'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_content_hash'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_source_id'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_id'), table_name='knowledge_chunks')
    op.drop_table('knowledge_chunks')
    # Note: dropping extension is omitted by default to avoid impacting other schemas
