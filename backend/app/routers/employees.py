from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os, shutil

from app.database import get_db
from app.models import Employee, Department, Document, User
from app.schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut, EmployeeWithSensitive, DepartmentOut, EmployeeProfileUpdate
from app.routers.auth import get_current_user, require_role
from app.utils.encryption import encrypt, decrypt, mask_pan, mask_aadhaar, mask_account
from app.config import settings

router = APIRouter(prefix="/employees", tags=["employees"])


def _to_out(emp: Employee, sensitive: bool = False) -> dict:
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
        "designation": emp.designation,
        "employment_type": emp.employment_type,
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
    is_active: Optional[bool] = True,
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
