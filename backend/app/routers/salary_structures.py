from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.database import get_db
from app.models import SalaryStructure, SalaryComponent, Employee, User
from app.schemas import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureOut,
    SalaryComponentCreate, SalaryComponentUpdate, SalaryComponentOut,
    SalaryAssignRequest, SalaryPreviewRequest,
)
from app.routers.auth import get_current_user, require_role
from app.services.payroll_service import compute_components_from_structure

router = APIRouter(prefix="/salary-structures", tags=["salary-structures"])


# ── Structures ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SalaryStructureOut])
def list_structures(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return (
        db.query(SalaryStructure)
        .filter(SalaryStructure.tenant_id == current_user.tenant_id)
        .order_by(SalaryStructure.name)
        .all()
    )


@router.post("/", response_model=SalaryStructureOut)
def create_structure(
    data: SalaryStructureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = db.query(SalaryStructure).filter(
        SalaryStructure.tenant_id == current_user.tenant_id,
        SalaryStructure.name == data.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Structure name already exists")

    structure = SalaryStructure(
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(structure)
    db.commit()
    db.refresh(structure)
    return structure


@router.get("/{structure_id}", response_model=SalaryStructureOut)
def get_structure(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")
    return structure


@router.put("/{structure_id}", response_model=SalaryStructureOut)
def update_structure(
    structure_id: int,
    data: SalaryStructureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(structure, k, v)
    db.commit()
    db.refresh(structure)
    return structure


@router.delete("/{structure_id}")
def delete_structure(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    # Check if any employees use this structure
    assigned = db.query(Employee).filter(
        Employee.structure_id == structure_id,
        Employee.tenant_id == current_user.tenant_id,
    ).count()
    if assigned > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {assigned} employee(s) are using this structure. Reassign them first.",
        )

    db.delete(structure)
    db.commit()
    return {"message": "Deleted"}


# ── Components ─────────────────────────────────────────────────────────────────

@router.post("/{structure_id}/components", response_model=SalaryComponentOut)
def add_component(
    structure_id: int,
    data: SalaryComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    if data.component_type not in ("earning", "deduction"):
        raise HTTPException(status_code=400, detail="component_type must be earning or deduction")
    if data.calc_type not in ("fixed", "percentage_of_basic", "percentage_of_ctc"):
        raise HTTPException(status_code=400, detail="calc_type must be fixed, percentage_of_basic, or percentage_of_ctc")

    component = SalaryComponent(
        structure_id=structure_id,
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.put("/{structure_id}/components/{component_id}", response_model=SalaryComponentOut)
def update_component(
    structure_id: int,
    component_id: int,
    data: SalaryComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    comp = db.query(SalaryComponent).filter(
        SalaryComponent.id == component_id,
        SalaryComponent.structure_id == structure_id,
        SalaryComponent.tenant_id == current_user.tenant_id,
    ).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(comp, k, v)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{structure_id}/components/{component_id}")
def delete_component(
    structure_id: int,
    component_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    comp = db.query(SalaryComponent).filter(
        SalaryComponent.id == component_id,
        SalaryComponent.structure_id == structure_id,
        SalaryComponent.tenant_id == current_user.tenant_id,
    ).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    db.delete(comp)
    db.commit()
    return {"message": "Deleted"}


# ── Preview ────────────────────────────────────────────────────────────────────

@router.post("/{structure_id}/preview")
def preview_structure(
    structure_id: int,
    data: SalaryPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    result = compute_components_from_structure(structure.components, data.annual_ctc)
    gross = sum(v for v in result["earnings"].values())
    total_deductions = sum(v for v in result["deductions"].values())

    return {
        "annual_ctc": float(data.annual_ctc),
        "monthly_ctc": float(data.annual_ctc / 12),
        "earnings": {k: float(v) for k, v in result["earnings"].items()},
        "deductions": {k: float(v) for k, v in result["deductions"].items()},
        "gross_monthly": float(gross),
        "total_deductions": float(total_deductions),
        "estimated_net": float(gross - total_deductions),
    }


# ── Assign to employee ─────────────────────────────────────────────────────────

@router.post("/assign")
def assign_structure(
    data: SalaryAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    structure = db.query(SalaryStructure).filter(
        SalaryStructure.id == data.structure_id,
        SalaryStructure.tenant_id == current_user.tenant_id,
        SalaryStructure.is_active == True,
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    emp = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp.structure_id = data.structure_id
    emp.annual_ctc = data.annual_ctc

    # Sync legacy salary fields from structure so they show correctly in profile
    result = compute_components_from_structure(structure.components, data.annual_ctc)
    name_map = {
        "basic": "basic_salary",
        "hra": "hra",
        "special allowance": "special_allowance",
        "conveyance": "conveyance_allowance",
        "conveyance allowance": "conveyance_allowance",
        "medical": "medical_allowance",
        "medical allowance": "medical_allowance",
    }
    for comp_name, amount in result["earnings"].items():
        col = name_map.get(comp_name.lower())
        if col:
            setattr(emp, col, amount)

    db.commit()
    return {"message": f"Structure '{structure.name}' assigned to {emp.first_name} {emp.last_name} with CTC ₹{data.annual_ctc:,.2f}"}


@router.delete("/assign/{employee_id}")
def remove_assignment(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.structure_id = None
    emp.annual_ctc = None
    db.commit()
    return {"message": "Assignment removed"}
