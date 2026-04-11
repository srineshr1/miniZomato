from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./smartroute.db"
    JWT_SECRET: str = "smartroute-secret-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440
    QR_SECRET: str = "qr-secret-key-change-in-production"
    SPEED_LIMIT_KMH: int = 60
    MAX_ORDERS_PER_BATCH: int = 4

    class Config:
        env_file = ".env"


settings = Settings()