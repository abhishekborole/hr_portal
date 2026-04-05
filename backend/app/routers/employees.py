from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os, shutil

from app.database import get_db
from app.models import Employee, Department, Document, User, Tenant, SalaryStructure
from app.schemas import (
    EmployeeCreate, EmployeeUpdate, EmployeeOut, EmployeeWithSensitive,
    DepartmentOut, EmployeeProfileUpdate, EmployeeLifecycleUpdate, OfferActionRequest,
    OfferLetterGenerateRequest, OfferLetterGenerateResponse, DocumentOut,
)
from app.routers.auth import get_current_user, require_role
from app.utils.encryption import encrypt, decrypt, mask_pan, mask_aadhaar, mask_account
from app.config import settings
from app.utils.pdf_generator import generate_offer_letter
from app.services.payroll_service import compute_components_from_structure

router = APIRouter(prefix="/employees", tags=["employees"])
VALID_LIFECYCLE_STAGES = {"hiring", "onboarding", "active", "exit_initiated", "exited"}
VALID_OFFER_STATUSES = {"draft", "released", "accepted", "declined"}


def _get_employee_or_404(db: Session, tenant_id: int, employee_id: int) -> Employee:
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


def _build_offer_payload(
    db: Session,
    emp: Employee,
    tenant_id: int,
    prepared_by: str,
    data: OfferLetterGenerateRequest,
):
    structure = None
    if data.structure_id:
        structure = db.query(SalaryStructure).filter(
            SalaryStructure.id == data.structure_id,
            SalaryStructure.tenant_id == tenant_id,
            SalaryStructure.is_active == True,
        ).first()
        if not structure:
            raise HTTPException(status_code=404, detail="Salary structure not found")
    elif emp.structure_id:
        structure = db.query(SalaryStructure).filter(
            SalaryStructure.id == emp.structure_id,
            SalaryStructure.tenant_id == tenant_id,
        ).first()

    annual_ctc = data.annual_ctc if data.annual_ctc is not None else emp.annual_ctc
    if structure and annual_ctc and structure.components:
        result = compute_components_from_structure(structure.components, annual_ctc, "ctc_driven")
        monthly_breakup = {
            "earnings": {k: float(v) for k, v in result["earnings"].items()},
            "employer_contributions": {k: float(v) for k, v in result.get("benefits", {}).items()},
            "employee_deductions": {k: float(v) for k, v in result.get("deductions", {}).items()},
            "gross_salary": float(sum(result["earnings"].values())),
            "annual_ctc": float(annual_ctc),
            "monthly_ctc": float(annual_ctc / 12),
        }
    else:
        monthly_breakup = None

    return {
        "candidate_name": f"{emp.first_name} {emp.last_name}",
        "designation": data.designation or emp.designation or "Team Member",
        "department_name": data.department_name or (emp.department.name if emp.department else "General"),
        "annual_ctc": annual_ctc or 0,
        "joining_date": data.joining_date or emp.date_of_joining,
        "reporting_manager": data.reporting_manager,
        "work_location": data.work_location,
        "probation_months": data.probation_months or 6,
        "additional_terms": data.additional_terms,
        "prepared_by": prepared_by,
        "issue_date": datetime.utcnow().date(),
        "salary_structure_name": structure.name if structure else None,
        "salary_breakup": monthly_breakup,
        "structure_id": structure.id if structure else None,
    }


def _to_out(emp: Employee, sensitive: bool = False) -> dict:
    salary_structure = emp.salary_structure
    salary_breakup = None
    if salary_structure and emp.annual_ctc and salary_structure.components:
        result = compute_components_from_structure(salary_structure.components, emp.annual_ctc, "ctc_driven")
        salary_breakup = {
            "earnings": {k: float(v) for k, v in result.get("earnings", {}).items()},
            "employer_contributions": {k: float(v) for k, v in result.get("benefits", {}).items()},
            "employee_deductions": {k: float(v) for k, v in result.get("deductions", {}).items()},
            "gross_salary": float(sum(result.get("earnings", {}).values())),
            "annual_ctc": float(emp.annual_ctc),
            "monthly_ctc": float(emp.annual_ctc / 12),
        }

    data = {
        "id": emp.id,
        "emp_code": emp.emp_code,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "email": emp.email,
        "phone": emp.phone,
        "gender": emp.gender,
        "date_of_birth": emp.date_of_birth,
        "date_of_joining": emp.date_of_joining,
        "department_id": emp.department_id,
        "position_id": emp.position_id,
        "requisition_id": emp.requisition_id,
        "candidate_id": emp.candidate_id,
        "offer_id": emp.offer_id,
        "onboarding_id": emp.onboarding_id,
        "designation": emp.designation,
        "employment_type": emp.employment_type,
        "structure_id": emp.structure_id,
        "annual_ctc": emp.annual_ctc,
        "lifecycle_stage": emp.lifecycle_stage,
        "offer_status": emp.offer_status,
        "offer_released_on": emp.offer_released_on,
        "offer_accepted_on": emp.offer_accepted_on,
        "onboarding_started_on": emp.onboarding_started_on,
        "onboarding_completed_on": emp.onboarding_completed_on,
        "exit_initiated_on": emp.exit_initiated_on,
        "exit_date": emp.exit_date,
        "exit_reason": emp.exit_reason,
        "uan": emp.uan,
        "ifsc_code": emp.ifsc_code,
        "bank_name": emp.bank_name,
        "basic_salary": emp.basic_salary,
        "hra": emp.hra,
        "special_allowance": emp.special_allowance,
        "conveyance_allowance": emp.conveyance_allowance,
        "medical_allowance": emp.medical_allowance,
        "is_active": emp.is_active,
        "address": emp.address,
        "city": emp.city,
        "state": emp.state,
        "pincode": emp.pincode,
        "cl_balance": emp.cl_balance,
        "sl_balance": emp.sl_balance,
        "el_balance": emp.el_balance,
        "created_at": emp.created_at,
        "department": emp.department,
        "position": emp.position,
        "requisition": emp.requisition,
        "candidate": emp.candidate,
        "offer": emp.offer,
        "salary_structure_name": salary_structure.name if salary_structure else None,
        "salary_breakup": salary_breakup,
    }
    if sensitive:
        data["pan"] = decrypt(emp.pan_encrypted) if emp.pan_encrypted else None
        data["aadhaar"] = decrypt(emp.aadhaar_encrypted) if emp.aadhaar_encrypted else None
        data["bank_account"] = decrypt(emp.bank_account_encrypted) if emp.bank_account_encrypted else None
    else:
        data["pan"] = mask_pan(decrypt(emp.pan_encrypted)) if emp.pan_encrypted else None
        data["aadhaar"] = mask_aadhaar(decrypt(emp.aadhaar_encrypted)) if emp.aadhaar_encrypted else None
        data["bank_account"] = mask_account(decrypt(emp.bank_account_encrypted)) if emp.bank_account_encrypted else None
    return data


@router.get("/departments/list", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Department).filter(Department.tenant_id == current_user.tenant_id).all()


@router.get("/me", response_model=EmployeeWithSensitive)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.employee_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No employee profile linked")
    emp = db.query(Employee).filter(
        Employee.id == current_user.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Employee not found")
    return _to_out(emp, sensitive=True)


@router.put("/me", response_model=EmployeeWithSensitive)
def update_my_profile(
    data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.employee_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No employee profile linked")
    emp = db.query(Employee).filter(
        Employee.id == current_user.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = data.model_dump(exclude_none=True, exclude={"bank_account"})
    for k, v in update_data.items():
        setattr(emp, k, v)
    if data.bank_account is not None:
        emp.bank_account_encrypted = encrypt(data.bank_account)

    db.commit()
    db.refresh(emp)
    return _to_out(emp, sensitive=True)


@router.get("/", response_model=List[EmployeeOut])
def list_employees(
    is_active: Optional[bool] = None,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Employee).filter(Employee.tenant_id == current_user.tenant_id)
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if search:
        query = query.filter(
            (Employee.first_name.ilike(f"%{search}%")) |
            (Employee.last_name.ilike(f"%{search}%")) |
            (Employee.emp_code.ilike(f"%{search}%")) |
            (Employee.email.ilike(f"%{search}%"))
        )
    return query.order_by(Employee.id).offset(skip).limit(limit).all()


@router.get("/{employee_id}", response_model=EmployeeWithSensitive)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_user.role == "employee" and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    is_admin = current_user.role == "admin"
    return _to_out(emp, sensitive=is_admin)


@router.post("/", response_model=EmployeeOut)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if db.query(Employee).filter(Employee.email == data.email, Employee.tenant_id == current_user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    if db.query(Employee).filter(Employee.emp_code == data.emp_code, Employee.tenant_id == current_user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Employee code already exists")

    emp_data = data.model_dump(exclude={"pan", "aadhaar", "bank_account"})
    emp = Employee(tenant_id=current_user.tenant_id, **emp_data)
    if data.pan:
        emp.pan_encrypted = encrypt(data.pan)
    if data.aadhaar:
        emp.aadhaar_encrypted = encrypt(data.aadhaar)
    if data.bank_account:
        emp.bank_account_encrypted = encrypt(data.bank_account)

    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = data.model_dump(exclude_none=True, exclude={"pan", "aadhaar", "bank_account"})
    for k, v in update_data.items():
        setattr(emp, k, v)

    if data.pan is not None:
        emp.pan_encrypted = encrypt(data.pan)
    if data.aadhaar is not None:
        emp.aadhaar_encrypted = encrypt(data.aadhaar)
    if data.bank_account is not None:
        emp.bank_account_encrypted = encrypt(data.bank_account)

    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}")
def delete_employee(
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
    emp.is_active = False
    db.commit()
    return {"message": "Employee deactivated successfully"}


@router.get("/{employee_id}/documents", response_model=List[DocumentOut])
def list_employee_documents(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_employee_or_404(db, current_user.tenant_id, employee_id)
    return (
        db.query(Document)
        .filter(Document.employee_id == employee_id, Document.tenant_id == current_user.tenant_id)
        .order_by(Document.uploaded_at.desc(), Document.id.desc())
        .all()
    )


@router.get("/{employee_id}/documents/{document_id}")
def download_document(
    employee_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_employee_or_404(db, current_user.tenant_id, employee_id)
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.employee_id == employee_id,
            Document.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(doc.file_path, filename=doc.file_name or os.path.basename(doc.file_path))


@router.post("/{employee_id}/offer-letter", response_model=OfferLetterGenerateResponse)
def generate_and_release_offer_letter(
    employee_id: int,
    data: OfferLetterGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    emp = _get_employee_or_404(db, current_user.tenant_id, employee_id)
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    now = datetime.utcnow()
    offer_payload = _build_offer_payload(db, emp, current_user.tenant_id, current_user.username, data)
    pdf_bytes = generate_offer_letter(offer_payload, company_name=tenant.name if tenant else "Your Company Pvt. Ltd.")

    emp_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.tenant_id), str(employee_id))
    os.makedirs(emp_dir, exist_ok=True)
    safe_name = f"offer_letter_{emp.emp_code}_{now.strftime('%Y%m%d_%H%M%S')}.pdf"
    file_path = os.path.join(emp_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    doc = Document(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        document_type="offer_letter",
        file_name=safe_name,
        file_path=file_path,
        uploaded_by=current_user.id,
    )
    db.add(doc)

    if offer_payload.get("structure_id"):
        emp.structure_id = offer_payload["structure_id"]

    if data.release_offer:
        emp.offer_status = "released"
        emp.offer_released_on = now
        emp.lifecycle_stage = "hiring"

    db.commit()
    db.refresh(doc)
    db.refresh(emp)
    return {
        "employee_id": employee_id,
        "document": doc,
        "offer_status": emp.offer_status,
        "offer_released_on": emp.offer_released_on,
    }


@router.post("/{employee_id}/offer-letter/preview")
def preview_offer_letter(
    employee_id: int,
    data: OfferLetterGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    emp = _get_employee_or_404(db, current_user.tenant_id, employee_id)
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    offer_payload = _build_offer_payload(db, emp, current_user.tenant_id, current_user.username, data)
    pdf_bytes = generate_offer_letter(offer_payload, company_name=tenant.name if tenant else "Your Company Pvt. Ltd.")
    filename = f"offer_preview_{emp.emp_code}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/{employee_id}/offer", response_model=EmployeeOut)
def manage_offer_status(
    employee_id: int,
    data: OfferActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    if data.status not in VALID_OFFER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid offer status")

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    now = datetime.utcnow()
    emp.offer_status = data.status

    if data.status == "released":
        emp.offer_released_on = now
        emp.lifecycle_stage = "hiring"
    elif data.status == "accepted":
        emp.offer_accepted_on = now
        if emp.lifecycle_stage == "hiring":
            emp.lifecycle_stage = "onboarding"
        emp.is_active = True
    elif data.status == "declined":
        emp.is_active = False

    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{employee_id}/lifecycle", response_model=EmployeeOut)
def update_employee_lifecycle(
    employee_id: int,
    data: EmployeeLifecycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    if data.lifecycle_stage not in VALID_LIFECYCLE_STAGES:
        raise HTTPException(status_code=400, detail="Invalid lifecycle stage")

    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    effective_dt = datetime.combine(data.effective_date, datetime.min.time()) if data.effective_date else datetime.utcnow()
    emp.lifecycle_stage = data.lifecycle_stage

    if data.lifecycle_stage == "hiring":
        emp.is_active = True
        emp.exit_date = None
        emp.exit_reason = None
    elif data.lifecycle_stage == "onboarding":
        emp.onboarding_started_on = effective_dt
        emp.offer_status = "accepted" if emp.offer_status in {"draft", "released"} else emp.offer_status
        emp.offer_accepted_on = emp.offer_accepted_on or effective_dt
        emp.is_active = True
    elif data.lifecycle_stage == "active":
        emp.onboarding_started_on = emp.onboarding_started_on or effective_dt
        emp.onboarding_completed_on = effective_dt
        emp.offer_status = "accepted" if emp.offer_status in {"draft", "released"} else emp.offer_status
        emp.offer_accepted_on = emp.offer_accepted_on or effective_dt
        emp.is_active = True
    elif data.lifecycle_stage == "exit_initiated":
        emp.exit_initiated_on = effective_dt
        if data.exit_reason is not None:
            emp.exit_reason = data.exit_reason
        emp.is_active = True
    elif data.lifecycle_stage == "exited":
        emp.exit_initiated_on = emp.exit_initiated_on or effective_dt
        emp.exit_date = data.effective_date or effective_dt.date()
        if data.exit_reason is not None:
            emp.exit_reason = data.exit_reason
        emp.is_active = False

    db.commit()
    db.refresh(emp)
    return emp


@router.post("/{employee_id}/documents")
def upload_document(
    employee_id: int,
    document_type: str = Query("other"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.tenant_id), str(employee_id))
    os.makedirs(emp_dir, exist_ok=True)
    file_path = os.path.join(emp_dir, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = Document(
        tenant_id=current_user.tenant_id,
        employee_id=employee_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=file_path,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    return {"message": "Document uploaded", "file_name": file.filename}
