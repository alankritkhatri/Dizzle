from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer,primary_key=True)
    sku = Column(String(128), nullable=False)               # original SKU (case preserved)
    sku_lower = Column(String(128), nullable=False)         # normalized lowercase SKU
    name = Column(String(512), nullable=False)
    description = Column(Text)
    price_cents = Column(Integer, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('sku_lower', name='uq_products_sku_lower'),
        Index('ix_products_sku_lower', 'sku_lower'),
    )
class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(Integer, primary_key=True)
    url = Column(String(1024), nullable=False)
    event = Column(String(64), nullable=False)  # e.g. 'import.completed', 'product.created'
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class ImportJob(Base):
    __tablename__ = "import_jobs"
    id = Column(Integer, primary_key=True)
    status = Column(String(32), nullable=False, default='queued')  # queued, running, failed, complete
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    file_path = Column(String(1024), nullable=True)  # stored until success or manual cleanup
    original_filename = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
