from app.database import engine

sql_queries = """
-- Add any custom SQL here
-- For example:
-- CREATE INDEX IF NOT EXISTS idx_product_sku ON products(sku_lower);
-- CREATE INDEX IF NOT EXISTS idx_webhook_enabled ON webhooks(enabled);
"""

with engine.connect() as conn:
    conn.execute(sql_queries)
    conn.commit()
    print("SQL queries executed successfully!")
