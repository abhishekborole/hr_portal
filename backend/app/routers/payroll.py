from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
import io

from app.database import get_db
from app.models import Payroll, Employee, User, Attendance
from app.schemas import PayrollGenerate, PayrollBulkGenerate, PayrollOut
from app.routers.auth import get_current_user, require_role
from app.services.payroll_service import calculate_payroll, calculate_payroll_from_structure
from app.utils.pdf_generator import generate_payslip
from app.utils.encryption import decrypt, mask_pan

router = APIRouter(prefix="/payroll", tags=["payroll"])


def _present_days_from_attendance(employee_id: int, month: int, year: int, tenant_id: int, db: Session) -> int:
    from datetime import date
    from calendar import monthrange
    _, days = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days)

    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.tenant_id == tenant_id,
        Attendance.date >= start,
        Attendance.date <= end,
        Attendance.status.in_(["present", "half_day"]),
    ).all()

    present = sum(1 if r.status == "present" else 0.5 for r in records)
    return int(present) if present else 26


@router.get("/", response_model=List[PayrollOut])
def list_payroll(
    employee_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Payroll).filter(Payroll.tenant_id == current_user.tenant_id)

    if current_user.role == "employee":
        query = query.filter(Payroll.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.filter(Payroll.employee_id == employee_id)

    if month:
        query = query.filter(Payroll.month == month)
    if year:
        query = query.filter(Payroll.year == year)
    if status:
        query = query.filter(Payroll.status == status)

    return query.order_by(Payroll.year.desc(), Payroll.month.desc()).all()


@router.post("/generate", response_model=PayrollOut)
def generate_payroll(
    data: PayrollGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    emp = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(Payroll).filter(
        Payroll.employee_id == data.employee_id,
        Payroll.tenant_id == current_user.tenant_id,
        Payroll.month == data.month,
        Payroll.year == data.year,
    ).first()
    if existing and existing.status == "finalized":
        raise HTTPException(status_code=400, detail="Payroll already finalized for this month")

    present_days = data.present_days
    if present_days is None:
        present_days = _present_days_from_attendance(
            data.employee_id, data.month, data.year, current_user.tenant_id, db
        )

    lop_days = data.lop_days or 0
    working_days = 26

    if emp.structure_id and emp.annual_ctc and emp.salary_structure:
        calc = calculate_payroll_from_structure(
            structure_components=emp.salary_structure.components,
            annual_ctc=emp.annual_ctc,
            other_earnings=data.other_earnings or Decimal("0"),
            other_deductions=data.other_deductions or Decimal("0"),
            working_days=working_days,
            present_days=present_days,
            lop_days=lop_days,
            state=emp.state or "Maharashtra",
        )
    else:
        calc = calculate_payroll(
            basic=emp.basic_salary or Decimal("0"),
            hra=emp.hra or Decimal("0"),
            special_allowance=emp.special_allowance or Decimal("0"),
            conveyance_allowance=emp.conveyance_allowance or Decimal("0"),
            medical_allowance=emp.medical_allowance or Decimal("0"),
            other_earnings=data.other_earnings or Decimal("0"),
            other_deductions=data.other_deductions or Decimal("0"),
            working_days=working_days,
            present_days=present_days,
            lop_days=lop_days,
            state=emp.state or "Maharashtra",
        )

    if existing:
        for k, v in calc.items():
            setattr(existing, k, v)
        existing.working_days = working_days
        existing.present_days = present_days
        existing.lop_days = lop_days
        existing.generated_by = current_user.id
        existing.status = "draft"
        db.commit()
        db.refresh(existing)
        return existing

    payroll = Payroll(
        tenant_id=current_user.tenant_id,
        employee_id=data.employee_id,
        month=data.month,
        year=data.year,
        working_days=working_days,
        present_days=present_days,
        lop_days=lop_days,
        generated_by=current_user.id,
        **calc,
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return payroll


@router.post("/bulk-generate")
def bulk_generate_payroll(
    data: PayrollBulkGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(Employee).filter(
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True,
    )
    if data.department_id:
        query = query.filter(Employee.department_id == data.department_id)
    employees = query.all()

    generated = []
    errors = []
    for emp in employees:
        try:
            present_days = _present_days_from_attendance(
                emp.id, data.month, data.year, current_user.tenant_id, db
            )
            if emp.structure_id and emp.annual_ctc and emp.salary_structure:
                calc = calculate_payroll_from_structure(
                    structure_components=emp.salary_structure.components,
                    annual_ctc=emp.annual_ctc,
                    working_days=26,
                    present_days=present_days,
                    state=emp.state or "Maharashtra",
                )
            else:
                calc = calculate_payroll(
                    basic=emp.basic_salary or Decimal("0"),
                    hra=emp.hra or Decimal("0"),
                    special_allowance=emp.special_allowance or Decimal("0"),
                    conveyance_allowance=emp.conveyance_allowance or Decimal("0"),
                    medical_allowance=emp.medical_allowance or Decimal("0"),
                    state=emp.state or "Maharashtra",
                    present_days=present_days,
                )
            existing = db.query(Payroll).filter(
                Payroll.employee_id == emp.id,
                Payroll.tenant_id == current_user.tenant_id,
                Payroll.month == data.month,
                Payroll.year == data.year,
            ).first()

            if existing and existing.status == "finalized":
                continue

            if existing:
                for k, v in calc.items():
                    setattr(existing, k, v)
                existing.present_days = present_days
                existing.generated_by = current_user.id
            else:
                payroll = Payroll(
                    tenant_id=current_user.tenant_id,
                    employee_id=emp.id,
                    month=data.month,
                    year=data.year,
                    present_days=present_days,
                    generated_by=current_user.id,
                    **calc,
                )
                db.add(payroll)
            generated.append(emp.emp_code)
        except Exception as e:
            errors.append({"emp_code": emp.emp_code, "error": str(e)})

    db.commit()
    return {"generated": len(generated), "errors": errors, "employees": generated}


@router.put("/{payroll_id}/finalize")
def finalize_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    payroll = db.query(Payroll).filter(
        Payroll.id == payroll_id,
        Payroll.tenant_id == current_user.tenant_id,
    ).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    payroll.status = "finalized"
    db.commit()
    return {"message": "Payroll finalized"}


@router.get("/{payroll_id}/payslip")
def download_payslip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payroll = db.query(Payroll).filter(
        Payroll.id == payroll_id,
        Payroll.tenant_id == current_user.tenant_id,
    ).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    if current_user.role == "employee" and current_user.employee_id != payroll.employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    emp = payroll.employee
    pan_plain = decrypt(emp.pan_encrypted) if emp.pan_encrypted else None

    employee_data = {
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "emp_code": emp.emp_code,
        "designation": emp.designation,
        "department": emp.department.name if emp.department else "",
        "date_of_joining": str(emp.date_of_joining),
        "pan_masked": mask_pan(pan_plain) if pan_plain else "****",
        "uan": emp.uan or "N/A",
        "bank_name": emp.bank_name or "",
    }
    payroll_data = {
        "month": payroll.month, "year": payroll.year,
        "basic": payroll.basic, "hra": payroll.hra,
        "special_allowance": payroll.special_allowance,
        "conveyance_allowance": payroll.conveyance_allowance,
        "medical_allowance": payroll.medical_allowance,
        "other_earnings": payroll.other_earnings,
        "gross_salary": payroll.gross_salary,
        "pf_employee": payroll.pf_employee,
        "pf_employer": payroll.pf_employer,
        "esic_employee": payroll.esic_employee,
        "esic_employer": payroll.esic_employer,
        "professional_tax": payroll.professional_tax,
        "tds": payroll.tds,
        "other_deductions": payroll.other_deductions,
        "total_deductions": payroll.total_deductions,
        "net_salary": payroll.net_salary,
        "working_days": payroll.working_days,
        "present_days": payroll.present_days,
        "lop_days": payroll.lop_days,
    }

    pdf_bytes = generate_payslip(payroll_data, employee_data)
    filename = f"payslip_{emp.emp_code}_{payroll.year}_{payroll.month:02d}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
