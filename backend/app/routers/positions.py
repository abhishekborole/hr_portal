from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Position, Employee, User, SalaryStructure
from app.schemas import PositionCreate, PositionUpdate, PositionOut, PositionHireCreate, EmployeeOut
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/positions", tags=["positions"])


def _position_employees(position: Position) -> List[Employee]:
    employees = position.employees or []
    return [
        employee
        for employee in employees
        if employee.offer_status != "declined" and employee.lifecycle_stage != "exited"
    ]


def _to_position_out(position: Position) -> dict:
    employees = _position_employees(position)
    hiring_count = len([employee for employee in employees if employee.lifecycle_stage in {"hiring", "onboarding"}])
    active_employee_count = len([employee for employee in employees if employee.lifecycle_stage == "active"])
    filled_count = len(employees)
    openings = position.openings or 0

    return {
        "id": position.id,
        "code": position.code,
        "title": position.title,
        "department_id": position.department_id,
        "employment_type": position.employment_type,
        "location": position.location,
        "openings": position.openings,
        "status": position.status,
        "description": position.description,
        "filled_count": filled_count,
        "hiring_count": hiring_count,
        "active_employee_count": active_employee_count,
        "open_vacancies": max(openings - filled_count, 0),
        "department": position.department,
        "created_at": position.created_at or datetime.utcnow(),
        "linked_hires": [
            {
                "id": employee.id,
                "emp_code": employee.emp_code,
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "email": employee.email,
                "date_of_joining": employee.date_of_joining,
                "designation": employee.designation,
                "lifecycle_stage": employee.lifecycle_stage,
                "offer_status": employee.offer_status,
                "is_active": employee.is_active,
            }
            for employee in sorted(
                employees,
                key=lambda employee: (employee.created_at or datetime.utcnow(), employee.id),
                reverse=True,
            )[:5]
        ],
    }


def _generate_position_code(db: Session, tenant_id: int) -> str:
    base_count = db.query(Position).filter(Position.tenant_id == tenant_id).count() + 1
    candidate = f"POS-{base_count:04d}"
    suffix = 1
    while db.query(Position).filter(Position.tenant_id == tenant_id, Position.code == candidate).first():
        candidate = f"POS-{base_count + suffix:04d}"
        suffix += 1
    return candidate


def _ensure_position_code(db: Session, position: Position) -> Position:
    if position.code:
        return position
    position.code = _generate_position_code(db, position.tenant_id)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def _generate_emp_code(db: Session, tenant_id: int) -> str:
    base_count = db.query(Employee).filter(Employee.tenant_id == tenant_id).count() + 1
    candidate = f"HIR-{base_count:04d}"
    suffix = 1
    while db.query(Employee).filter(Employee.tenant_id == tenant_id, Employee.emp_code == candidate).first():
        candidate = f"HIR-{base_count + suffix:04d}"
        suffix += 1
    return candidate


@router.get("/", response_model=List[PositionOut])
def list_positions(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    query = db.query(Position).filter(Position.tenant_id == current_user.tenant_id)
    if status:
        query = query.filter(Position.status == status)
    positions = query.order_by(Position.created_at.desc(), Position.id.desc()).all()
    normalized_positions = [_ensure_position_code(db, position) for position in positions]
    return [_to_position_out(position) for position in normalized_positions]


@router.post("/", response_model=PositionOut)
def create_position(
    data: PositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    position = Position(
        tenant_id=current_user.tenant_id,
        code=_generate_position_code(db, current_user.tenant_id),
        **data.model_dump(),
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return _to_position_out(position)


@router.put("/{position_id}", response_model=PositionOut)
def update_position(
    position_id: int,
    data: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    position = db.query(Position).filter(
        Position.id == position_id,
        Position.tenant_id == current_user.tenant_id,
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    position = _ensure_position_code(db, position)

    for key, value in data.model_dump(exclude_none=True).items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return _to_position_out(position)


@router.delete("/{position_id}")
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    position = db.query(Position).filter(
        Position.id == position_id,
        Position.tenant_id == current_user.tenant_id,
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    assigned = db.query(Employee).filter(
        Employee.position_id == position_id,
        Employee.tenant_id == current_user.tenant_id,
    ).count()
    if assigned:
        raise HTTPException(status_code=400, detail="Position is linked to employees. Reassign them first.")
    db.delete(position)
    db.commit()
    return {"message": "Position deleted"}


@router.post("/{position_id}/hire", response_model=EmployeeOut)
def create_hire_against_position(
    position_id: int,
    data: PositionHireCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    position = db.query(Position).filter(
        Position.id == position_id,
        Position.tenant_id == current_user.tenant_id,
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    if position.status != "open":
        raise HTTPException(status_code=400, detail="Only open positions can be hired against")

    position_snapshot = _to_position_out(position)
    if position_snapshot["open_vacancies"] <= 0:
        raise HTTPException(status_code=400, detail="This position has no open vacancies")

    if db.query(Employee).filter(
        Employee.tenant_id == current_user.tenant_id,
        Employee.email == data.email,
    ).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    structure_id = data.structure_id
    if structure_id:
        structure = db.query(SalaryStructure).filter(
            SalaryStructure.id == structure_id,
            SalaryStructure.tenant_id == current_user.tenant_id,
            SalaryStructure.is_active == True,
        ).first()
        if not structure:
            raise HTTPException(status_code=404, detail="Salary structure not found")

    employee = Employee(
        tenant_id=current_user.tenant_id,
        emp_code=_generate_emp_code(db, current_user.tenant_id),
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        date_of_joining=data.date_of_joining,
        department_id=position.department_id,
        position_id=position.id,
        designation=data.designation or position.title,
        employment_type=position.employment_type or "permanent",
        lifecycle_stage="hiring",
        offer_status="draft",
        annual_ctc=data.annual_ctc,
        structure_id=structure_id,
        is_active=True,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee
