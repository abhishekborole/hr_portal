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

    payload = data.model_dump()
    payload["salary_mode"] = "ctc_driven"
    structure = SalaryStructure(
        tenant_id=current_user.tenant_id,
        **payload,
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

    updates = data.model_dump(exclude_none=True)
    if "salary_mode" in updates:
        updates["salary_mode"] = "ctc_driven"
    for k, v in updates.items():
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

    if data.component_type not in ("earning", "benefit", "deduction"):
        raise HTTPException(status_code=400, detail="component_type must be earning, benefit, or deduction")
    if data.calc_type not in ("fixed", "percentage_of_basic", "percentage_of_ctc", "percentage_of_annual_ctc", "remainder", "ctc_deduction"):
        raise HTTPException(status_code=400, detail="calc_type must be fixed, percentage_of_basic, percentage_of_ctc, percentage_of_annual_ctc, remainder, or ctc_deduction")

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

    if not structure.components:
        raise HTTPException(status_code=400, detail="No components defined. Add components to this structure first.")

    salary_mode = "ctc_driven"
    result      = compute_components_from_structure(structure.components, data.annual_ctc, salary_mode)
    fixed_pay   = sum(result["earnings"].values())
    employer_contributions = result.get("benefits", {})
    employee_deductions = result.get("deductions", {})
    gross_ctc   = fixed_pay + sum(employer_contributions.values())

    return {
        "annual_ctc":  float(data.annual_ctc),
        "monthly_ctc": float(data.annual_ctc / 12),
        "gross_ctc":   float(gross_ctc * 12),
        "monthly_gross_ctc": float(gross_ctc),
        "salary_mode": "ctc_driven",
        "earnings":    {k: float(v) for k, v in result["earnings"].items()},
        "employer_contributions":  {k: float(v) for k, v in employer_contributions.items()},
        "employee_deductions":  {k: float(v) for k, v in employee_deductions.items()},
        "fixed_pay":   float(fixed_pay),
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

    if not emp.annual_ctc:
        raise HTTPException(status_code=400, detail="Employee does not have an Annual CTC set. Set it in the employee profile first.")

    if not structure.components:
        raise HTTPException(status_code=400, detail="Structure has no components defined. Add components first.")

    result    = compute_components_from_structure(structure.components, emp.annual_ctc, "ctc_driven")
    earnings  = result["earnings"]
    benefits   = result.get("benefits", {})
    basic     = result["basic"]
    hra       = next((v for k, v in earnings.items() if "hra" in k.lower()), Decimal("0"))
    special   = next((v for k, v in earnings.items() if "special" in k.lower()), Decimal("0"))
    emp_pf    = next((v for k, v in benefits.items() if "employer" in k.lower() and "pf" in k.lower()), Decimal("0"))
    fixed_pay = sum(earnings.values())

    emp.structure_id        = data.structure_id
    emp.basic_salary        = basic
    emp.hra                 = hra
    emp.special_allowance   = special
    emp.employer_pf_monthly = emp_pf
    emp.fixed_pay_monthly   = fixed_pay

    db.commit()
    return {"message": f"Structure '{structure.name}' assigned to {emp.first_name} {emp.last_name}"}


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
