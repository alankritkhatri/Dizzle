from pydantic import BaseModel

class ProductBase(BaseModel):
    name: str
    sku: str
    description: str | None = None
    price: float
    active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int

    class Config:
        orm_mode = True
