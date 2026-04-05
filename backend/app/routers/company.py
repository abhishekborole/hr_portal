from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tenant, User
from app.routers.auth import get_current_user, require_role
from app.schemas import CompanyProfileOut, CompanyProfileUpdate

router = APIRouter(prefix="/company", tags=["company"])


def _get_company_or_404(db: Session, tenant_id: int) -> Tenant:
    company = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/", response_model=CompanyProfileOut)
def get_company_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_company_or_404(db, current_user.tenant_id)


@router.put("/", response_model=CompanyProfileOut)
def update_company_profile(
    data: CompanyProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    company = _get_company_or_404(db, current_user.tenant_id)
    payload = data.model_dump()
    for field, value in payload.items():
        setattr(company, field, value)
    company.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(company)
    return company
