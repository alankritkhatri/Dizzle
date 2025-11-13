"""add file_path and original_filename to import_jobs

Revision ID: 3b8c8f6b0a9e
Revises:
Create Date: 2025-11-13
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3b8c8f6b0a9e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Idempotent: use raw SQL with IF NOT EXISTS to avoid failing if columns already exist.
    op.execute("ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS file_path VARCHAR(1024)")
    op.execute("ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS original_filename VARCHAR(512)")


def downgrade():
    # Downgrade attempts plain drops; if columns were absent it will error.
    op.drop_column('import_jobs', 'original_filename')
    op.drop_column('import_jobs', 'file_path')
