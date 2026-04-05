from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HRPolicy, User
from app.routers.auth import require_role
from app.schemas import HRPolicyOut, HRPolicyUpdate

router = APIRouter(prefix="/hr-policy", tags=["hr-policy"])


def _get_or_create_policy(db: Session, tenant_id: int) -> HRPolicy:
    policy = db.query(HRPolicy).filter(HRPolicy.tenant_id == tenant_id).first()
    if policy:
        return policy
    policy = HRPolicy(tenant_id=tenant_id)
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/", response_model=HRPolicyOut)
def get_hr_policy(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return _get_or_create_policy(db, current_user.tenant_id)


@router.put("/", response_model=HRPolicyOut)
def update_hr_policy(
    data: HRPolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    policy = _get_or_create_policy(db, current_user.tenant_id)
    for field, value in data.model_dump().items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    return policy
