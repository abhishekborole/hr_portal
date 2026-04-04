from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime, time
from decimal import Decimal


# ── Auth ──────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    tenant_id: int
    tenant_slug: str
    employee_id: Optional[int] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    tenant_id: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_slug: str


class TenantRegisterRequest(BaseModel):
    company_name: str
    admin_username: str
    admin_email: EmailStr
    password: str


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ── Department ────────────────────────────────────────────────────────────────
class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    class Config:
        from_attributes = True


# ── Employee ──────────────────────────────────────────────────────────────────
class EmployeeBase(BaseModel):
    emp_code: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_joining: date
    department_id: Optional[int] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = "full_time"
    uan: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    basic_salary: Optional[Decimal] = Decimal("0")
    hra: Optional[Decimal] = Decimal("0")
    special_allowance: Optional[Decimal] = Decimal("0")
    conveyance_allowance: Optional[Decimal] = Decimal("0")
    medical_allowance: Optional[Decimal] = Decimal("0")
    is_active: Optional[bool] = True
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    bank_account: Optional[str] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    uan: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    basic_salary: Optional[Decimal] = None
    hra: Optional[Decimal] = None
    special_allowance: Optional[Decimal] = None
    conveyance_allowance: Optional[Decimal] = None
    medical_allowance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class EmployeeOut(EmployeeBase):
    id: int
    cl_balance: int
    sl_balance: int
    el_balance: int
    department: Optional[DepartmentOut] = None
    structure_id: Optional[int] = None
    annual_ctc: Optional[Decimal] = None
    created_at: datetime
    class Config:
        from_attributes = True


class EmployeeWithSensitive(EmployeeOut):
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    bank_account: Optional[str] = None


# ── User ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "employee"
    employee_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    tenant_id: int
    username: str
    email: str
    role: str
    employee_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ── Attendance ────────────────────────────────────────────────────────────────
class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: str = "present"
    remarks: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    date: date
    records: List[AttendanceCreate]


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: str
    working_hours: Optional[Decimal] = None
    remarks: Optional[str] = None
    employee: Optional[EmployeeOut] = None
    class Config:
        from_attributes = True


# ── Leave ─────────────────────────────────────────────────────────────────────
class LeaveCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveApproval(BaseModel):
    status: str  # approved / rejected
    rejection_reason: Optional[str] = None


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    days: int
    reason: Optional[str] = None
    status: str
    applied_on: datetime
    approved_on: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    employee: Optional[EmployeeOut] = None
    class Config:
        from_attributes = True


# ── Payroll ───────────────────────────────────────────────────────────────────
class PayrollGenerate(BaseModel):
    employee_id: int
    month: int
    year: int
    present_days: Optional[int] = None
    lop_days: Optional[int] = 0
    other_earnings: Optional[Decimal] = Decimal("0")
    other_deductions: Optional[Decimal] = Decimal("0")


class PayrollBulkGenerate(BaseModel):
    month: int
    year: int
    department_id: Optional[int] = None


class PayrollOut(BaseModel):
    id: int
    employee_id: int
    month: int
    year: int
    basic: Decimal
    hra: Decimal
    special_allowance: Decimal
    conveyance_allowance: Decimal
    medical_allowance: Decimal
    other_earnings: Decimal
    gross_salary: Decimal
    pf_employee: Decimal
    pf_employer: Decimal
    esic_employee: Decimal
    esic_employer: Decimal
    professional_tax: Decimal
    tds: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    working_days: int
    present_days: int
    lop_days: int
    status: str
    generated_on: datetime
    paid_on: Optional[date] = None
    employee: Optional[EmployeeOut] = None
    class Config:
        from_attributes = True


# ── Holiday ───────────────────────────────────────────────────────────────────
class HolidayOut(BaseModel):
    id: int
    name: str
    date: date
    holiday_type: str
    class Config:
        from_attributes = True


# ── Salary Structure ──────────────────────────────────────────────────────────
class SalaryComponentCreate(BaseModel):
    name: str
    component_type: str = "earning"    # earning | deduction
    calc_type: str = "fixed"           # fixed | percentage_of_basic | percentage_of_ctc
    value: Decimal = Decimal("0")
    is_taxable: bool = True
    sort_order: int = 0


class SalaryComponentUpdate(BaseModel):
    name: Optional[str] = None
    component_type: Optional[str] = None
    calc_type: Optional[str] = None
    value: Optional[Decimal] = None
    is_taxable: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SalaryComponentOut(BaseModel):
    id: int
    name: str
    component_type: str
    calc_type: str
    value: Decimal
    is_taxable: bool
    sort_order: int
    is_active: bool
    class Config:
        from_attributes = True


class SalaryStructureCreate(BaseModel):
    name: str
    description: Optional[str] = None


class SalaryStructureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SalaryStructureOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    components: List[SalaryComponentOut] = []
    created_at: datetime
    class Config:
        from_attributes = True


class SalaryAssignRequest(BaseModel):
    employee_id: int
    structure_id: int
    annual_ctc: Decimal


class SalaryPreviewRequest(BaseModel):
    annual_ctc: Decimal


# ── Employee self-update (limited fields) ────────────────────────────────────
class EmployeeProfileUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None


# ── Reimbursement ─────────────────────────────────────────────────────────────
class ReimbursementCreate(BaseModel):
    category: str
    amount: Decimal
    date: date
    description: Optional[str] = None


class ReimbursementReview(BaseModel):
    status: str
    reviewer_comments: Optional[str] = None


class ReimbursementOut(BaseModel):
    id: int
    employee_id: int
    category: str
    amount: Decimal
    date: date
    description: Optional[str] = None
    status: str
    applied_on: datetime
    reviewed_on: Optional[datetime] = None
    reviewer_comments: Optional[str] = None
    employee: Optional[EmployeeOut] = None
    class Config:
        from_attributes = True


# ── Notification ──────────────────────────────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    title: str
    message: Optional[str] = None
    notif_type: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True
