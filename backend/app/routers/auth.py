import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional

from app.database import get_db
from app.models import User, Tenant, Department, Holiday
from app.schemas import Token, TokenData, UserCreate, UserOut, LoginRequest, TenantRegisterRequest
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        tenant_id: int = payload.get("tenant_id")
        if username is None or tenant_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(
        User.username == username,
        User.tenant_id == tenant_id,
        User.is_active == True,
    ).first()
    if user is None:
        raise credentials_exc
    return user


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency


def _slug_from_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80]


def _seed_tenant_defaults(tenant_id: int, db: Session):
    from datetime import date

    default_departments = [
        "Engineering", "Human Resources", "Finance", "Sales",
        "Marketing", "Operations", "Legal", "Admin",
    ]
    for dept_name in default_departments:
        db.add(Department(tenant_id=tenant_id, name=dept_name))

    holidays_2025 = [
        ("Republic Day", date(2025, 1, 26), "national"),
        ("Holi", date(2025, 3, 14), "national"),
        ("Ambedkar Jayanti", date(2025, 4, 14), "national"),
        ("Good Friday", date(2025, 4, 18), "national"),
        ("Labour Day", date(2025, 5, 1), "national"),
        ("Independence Day", date(2025, 8, 15), "national"),
        ("Gandhi Jayanti / Dussehra", date(2025, 10, 2), "national"),
        ("Diwali", date(2025, 10, 20), "national"),
        ("Christmas", date(2025, 12, 25), "national"),
    ]
    for h_name, h_date, h_type in holidays_2025:
        db.add(Holiday(tenant_id=tenant_id, name=h_name, date=h_date, holiday_type=h_type))


@router.get("/tenant/{slug}")
def get_tenant_by_slug(slug: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"id": tenant.id, "name": tenant.name, "slug": tenant.slug}


@router.post("/register-tenant", response_model=Token)
def register_tenant(data: TenantRegisterRequest, db: Session = Depends(get_db)):
    base_slug = _slug_from_name(data.company_name)
    slug = base_slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    tenant = Tenant(name=data.company_name, slug=slug)
    db.add(tenant)
    db.flush()

    if db.query(User).filter(User.username == data.admin_username, User.tenant_id == tenant.id).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    _seed_tenant_defaults(tenant.id, db)

    admin_user = User(
        tenant_id=tenant.id,
        username=data.admin_username,
        email=data.admin_email,
        password_hash=get_password_hash(data.password),
        role="admin",
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    token = create_access_token({
        "sub": admin_user.username,
        "role": admin_user.role,
        "tenant_id": tenant.id,
    })
    return Token(
        access_token=token,
        token_type="bearer",
        role=admin_user.role,
        username=admin_user.username,
        tenant_id=tenant.id,
        tenant_slug=slug,
        employee_id=None,
    )


@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username, User.is_active == True).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.username, "role": user.role, "tenant_id": user.tenant_id})
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        tenant_id=user.tenant_id,
        employee_id=user.employee_id,
    )


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.slug == request.tenant_slug, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=401, detail="Company not found")

    user = db.query(User).filter(
        User.username == request.username,
        User.tenant_id == tenant.id,
        User.is_active == True,
    ).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.username, "role": user.role, "tenant_id": user.tenant_id})
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        tenant_id=user.tenant_id,
        tenant_slug=tenant.slug,
        employee_id=user.employee_id,
    )


@router.post("/register", response_model=UserOut)
def register_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.username == data.username, User.tenant_id == current_user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == data.email, User.tenant_id == current_user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        tenant_id=current_user.tenant_id,
        username=data.username,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
        employee_id=data.employee_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
