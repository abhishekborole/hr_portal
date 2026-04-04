from app.config import fernet


def encrypt(value: str) -> str:
    if not value:
        return ""
    return fernet.encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return fernet.decrypt(token.encode()).decode()
    except Exception:
        return ""


def mask_pan(pan: str) -> str:
    if not pan or len(pan) < 4:
        return "****"
    return "****" + pan[-4:]


def mask_aadhaar(aadhaar: str) -> str:
    if not aadhaar or len(aadhaar) < 4:
        return "XXXX XXXX XXXX"
    return "XXXX XXXX " + aadhaar[-4:]


def mask_account(account: str) -> str:
    if not account or len(account) < 4:
        return "****"
    return "X" * (len(account) - 4) + account[-4:]
