from pydantic_settings import BaseSettings, SettingsConfigDict
from cryptography.fernet import Fernet
from urllib.parse import quote_plus
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    MSSQL_USER: str = "sa"
    MSSQL_PASSWORD: str = "HrPortal@2024!"
    MSSQL_HOST: str = "localhost"
    MSSQL_PORT: int = 1433
    MSSQL_DB: str = "hrportal"

    SECRET_KEY: str = "supersecretkey-change-in-production-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ENCRYPTION_KEY: str = ""
    UPLOAD_DIR: str = "uploads"

    @property
    def DATABASE_URL(self) -> str:
        pwd = quote_plus(self.MSSQL_PASSWORD)
        driver = quote_plus("ODBC Driver 17 for SQL Server")
        return (
            f"mssql+pyodbc://{self.MSSQL_USER}:{pwd}"
            f"@{self.MSSQL_HOST}:{self.MSSQL_PORT}/{self.MSSQL_DB}"
            f"?driver={driver}&TrustServerCertificate=yes&Encrypt=yes"
        )


settings = Settings()


def get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        key = Fernet.generate_key().decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


fernet = get_fernet()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
