from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from calendar import monthrange

from app.database import get_db
from app.models import Leave, Employee, User
from app.schemas import LeaveCreate, LeaveApproval, LeaveOut
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/leaves", tags=["leaves"])

LEAVE_TYPES = ("CL", "SL", "EL", "LOP")


def _working_days(start: date, end: date) -> int:
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        from datetime import timedelta
        current = current + timedelta(days=1)
    return days


@router.get("/", response_model=List[LeaveOut])
def list_leaves(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Leave).filter(Leave.tenant_id == current_user.tenant_id)

    if current_user.role == "employee":
        query = query.filter(Leave.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.filter(Leave.employee_id == employee_id)

    if status:
        query = query.filter(Leave.status == status)

    if month and year:
        _, days = monthrange(year, month)
        query = query.filter(
            Leave.start_date <= date(year, month, days),
            Leave.end_date >= date(year, month, 1),
        )

    return query.order_by(Leave.applied_on.desc()).all()


@router.post("/", response_model=LeaveOut)
def apply_leave(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee":
        employee_id = current_user.employee_id
        if not employee_id:
            raise HTTPException(status_code=400, detail="No employee profile linked")
    else:
        raise HTTPException(status_code=403, detail="Only employees can apply for leave through this endpoint")

    if data.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid leave type. Allowed: {LEAVE_TYPES}")

    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    days = _working_days(data.start_date, data.end_date)

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if data.leave_type == "CL" and emp.cl_balance < days:
        raise HTTPException(status_code=400, detail=f"Insufficient CL balance. Available: {emp.cl_balance}")
    if data.leave_type == "SL" and emp.sl_balance < days:
        raise HTTPException(status_code=400, detail=f"Insufficient SL balance. Available: {emp.sl_balance}")
    if data.leave_type == "EL" and emp.el_balance < days:
        raise HTTPException(status_code=400, detail=f"Insufficient EL balance. Available: {emp.el_balance}")

    leave = Leave(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=days,
        reason=data.reason,
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


@router.post("/admin/apply", response_model=LeaveOut)
def admin_apply_leave(
    employee_id: int,
    data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    if data.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid leave type")

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    days = _working_days(data.start_date, data.end_date)

    leave = Leave(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=days,
        reason=data.reason,
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


@router.put("/{leave_id}/approve", response_model=LeaveOut)
def approve_leave(
    leave_id: int,
    data: LeaveApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == current_user.tenant_id,
    ).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail=f"Leave is already {leave.status}")

    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    leave.status = data.status
    leave.approved_by = current_user.id
    leave.approved_on = datetime.utcnow()

    if data.status == "rejected":
        leave.rejection_reason = data.rejection_reason
    else:
        emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
        if emp:
            if leave.leave_type == "CL":
                emp.cl_balance = max(0, emp.cl_balance - leave.days)
            elif leave.leave_type == "SL":
                emp.sl_balance = max(0, emp.sl_balance - leave.days)
            elif leave.leave_type == "EL":
                emp.el_balance = max(0, emp.el_balance - leave.days)

    db.commit()
    db.refresh(leave)
    return leave


@router.put("/{leave_id}/cancel")
def cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == current_user.tenant_id,
    ).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    if current_user.role == "employee" and current_user.employee_id != leave.employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if leave.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending leaves can be cancelled")

    leave.status = "cancelled"
    db.commit()
    return {"message": "Leave cancelled"}
