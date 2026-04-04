from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Reimbursement, Employee, User, Notification
from app.schemas import ReimbursementCreate, ReimbursementReview, ReimbursementOut
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/reimbursements", tags=["reimbursements"])

CATEGORIES = ["Travel", "Food", "Medical", "Accommodation", "Communication", "Office Supplies", "Other"]


@router.get("/categories")
def get_categories():
    return CATEGORIES


@router.get("/", response_model=List[ReimbursementOut])
def list_reimbursements(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Reimbursement).filter(Reimbursement.tenant_id == current_user.tenant_id)

    if current_user.role == "employee":
        query = query.filter(Reimbursement.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.filter(Reimbursement.employee_id == employee_id)

    if status:
        query = query.filter(Reimbursement.status == status)

    return query.order_by(Reimbursement.id.desc()).all()


@router.post("/", response_model=ReimbursementOut)
def create_reimbursement(
    data: ReimbursementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="No employee profile linked to this account")

    reimbursement = Reimbursement(
        tenant_id=current_user.tenant_id,
        employee_id=current_user.employee_id,
        **data.model_dump(),
    )
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return reimbursement


@router.put("/{reimbursement_id}/review", response_model=ReimbursementOut)
def review_reimbursement(
    reimbursement_id: int,
    data: ReimbursementReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")

    reimbursement = db.query(Reimbursement).filter(
        Reimbursement.id == reimbursement_id,
        Reimbursement.tenant_id == current_user.tenant_id,
    ).first()
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    if reimbursement.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")

    reimbursement.status = data.status
    reimbursement.reviewer_comments = data.reviewer_comments
    reimbursement.reviewed_by = current_user.id
    reimbursement.reviewed_on = datetime.now()

    emp = db.query(Employee).filter(Employee.id == reimbursement.employee_id).first()
    if emp and emp.user:
        notif = Notification(
            tenant_id=current_user.tenant_id,
            user_id=emp.user.id,
            title=f"Reimbursement {data.status.capitalize()}",
            message=f"Your ₹{reimbursement.amount} {reimbursement.category} reimbursement has been {data.status}.",
            notif_type="success" if data.status == "approved" else "error",
        )
        db.add(notif)

    db.commit()
    db.refresh(reimbursement)
    return reimbursement


@router.delete("/{reimbursement_id}")
def cancel_reimbursement(
    reimbursement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reimbursement = db.query(Reimbursement).filter(
        Reimbursement.id == reimbursement_id,
        Reimbursement.tenant_id == current_user.tenant_id,
    ).first()
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Not found")
    if current_user.role == "employee" and reimbursement.employee_id != current_user.employee_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if reimbursement.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot cancel an already reviewed request")

    db.delete(reimbursement)
    db.commit()
    return {"message": "Cancelled"}
