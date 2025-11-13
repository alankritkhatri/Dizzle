"""
add task_id to import_jobs

Revision ID: b3c1a1d2e3f4
Revises: 3b8c8f6b0a9e
Create Date: 2025-11-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b3c1a1d2e3f4'
down_revision = '3b8c8f6b0a9e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL for IF NOT EXISTS to be idempotent across environments
    op.execute("""
        ALTER TABLE import_jobs
        ADD COLUMN IF NOT EXISTS task_id VARCHAR(128)
    """)


def downgrade() -> None:
    # Safe drop if exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='import_jobs' AND column_name='task_id'
            ) THEN
                ALTER TABLE import_jobs DROP COLUMN task_id;
            END IF;
        END$$;
    """)
