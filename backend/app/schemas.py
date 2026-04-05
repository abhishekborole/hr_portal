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


class CompanyProfileBase(BaseModel):
    name: str
    legal_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    tan: Optional[str] = None
    cin: Optional[str] = None
    pf_registration_no: Optional[str] = None
    esi_registration_no: Optional[str] = None
    professional_tax_no: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    registered_address: Optional[str] = None
    corporate_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    authorized_signatory: Optional[str] = None
    signatory_designation: Optional[str] = None


class CompanyProfileUpdate(CompanyProfileBase):
    pass


class CompanyProfileOut(CompanyProfileBase):
    id: int
    slug: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
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


class PositionBase(BaseModel):
    title: str
    department_id: Optional[int] = None
    employment_type: Optional[str] = "permanent"
    location: Optional[str] = None
    openings: Optional[int] = 1
    status: Optional[str] = "open"
    description: Optional[str] = None


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    title: Optional[str] = None
    department_id: Optional[int] = None
    employment_type: Optional[str] = None
    location: Optional[str] = None
    openings: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None


class PositionEmployeeSummary(BaseModel):
    id: int
    emp_code: str
    first_name: str
    last_name: str
    email: EmailStr
    date_of_joining: date
    designation: Optional[str] = None
    lifecycle_stage: str
    offer_status: str
    is_active: bool
    class Config:
        from_attributes = True


class PositionOut(PositionBase):
    id: int
    code: str
    filled_count: int = 0
    hiring_count: int = 0
    active_employee_count: int = 0
    open_vacancies: int = 0
    department: Optional[DepartmentOut] = None
    created_at: datetime
    linked_hires: List[PositionEmployeeSummary] = []
    class Config:
        from_attributes = True


class RequisitionBase(BaseModel):
    position_id: int
    title: str
    openings: int = 1
    status: str = "open"
    reason: Optional[str] = None
    target_hire_date: Optional[date] = None
    recruiter_name: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    description: Optional[str] = None


class RequisitionCreate(RequisitionBase):
    pass


class RequisitionUpdate(BaseModel):
    title: Optional[str] = None
    openings: Optional[int] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    target_hire_date: Optional[date] = None
    recruiter_name: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    description: Optional[str] = None


class RequisitionOut(RequisitionBase):
    id: int
    code: str
    position: Optional[PositionOut] = None
    candidate_count: int = 0
    offer_count: int = 0
    onboarding_count: int = 0
    joined_count: int = 0
    open_slots: int = 0
    created_at: datetime
    class Config:
        from_attributes = True


class CandidateBase(BaseModel):
    requisition_id: Optional[int] = None
    position_id: Optional[int] = None
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    source: Optional[str] = None
    stage: str = "applied"
    current_ctc: Optional[Decimal] = None
    expected_ctc: Optional[Decimal] = None
    notice_period_days: Optional[int] = None
    proposed_joining_date: Optional[date] = None
    designation: Optional[str] = None
    notes: Optional[str] = None


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    stage: Optional[str] = None
    current_ctc: Optional[Decimal] = None
    expected_ctc: Optional[Decimal] = None
    notice_period_days: Optional[int] = None
    proposed_joining_date: Optional[date] = None
    designation: Optional[str] = None
    notes: Optional[str] = None


class CandidateOut(CandidateBase):
    id: int
    requisition: Optional[RequisitionOut] = None
    position: Optional[PositionOut] = None
    active_offer_status: Optional[str] = None
    onboarding_status: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class OfferBase(BaseModel):
    annual_ctc: Optional[Decimal] = None
    structure_id: Optional[int] = None
    joining_date: Optional[date] = None
    reporting_manager: Optional[str] = None
    work_location: Optional[str] = None
    probation_months: Optional[int] = 6
    additional_terms: Optional[str] = None


class OfferCreate(OfferBase):
    release_offer: bool = True


class OfferStatusUpdate(BaseModel):
    status: str


class OfferOut(OfferBase):
    id: int
    candidate_id: int
    candidate: Optional[CandidateOut] = None
    status: str
    issue_date: Optional[date] = None
    released_on: Optional[datetime] = None
    accepted_on: Optional[datetime] = None
    declined_on: Optional[datetime] = None
    document_file_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


class OnboardingStartRequest(BaseModel):
    checklist_json: Optional[str] = None


class OnboardingCancelRequest(BaseModel):
    decline_offer: bool = False


class OnboardingConvertRequest(BaseModel):
    emp_code: str
    personal_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    uan: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class OnboardingOut(BaseModel):
    id: int
    tenant_id: int
    candidate_id: int
    offer_id: int
    status: str
    checklist_json: Optional[str] = None
    started_on: Optional[datetime] = None
    completed_on: Optional[datetime] = None
    employee_id: Optional[int] = None
    candidate: Optional[CandidateOut] = None
    offer: Optional[OfferOut] = None
    created_at: datetime
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
    position_id: Optional[int] = None
    requisition_id: Optional[int] = None
    candidate_id: Optional[int] = None
    offer_id: Optional[int] = None
    onboarding_id: Optional[int] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = "permanent"
    lifecycle_stage: Optional[str] = "hiring"
    offer_status: Optional[str] = "draft"
    uan: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    annual_ctc: Optional[Decimal] = None
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
    position_id: Optional[int] = None
    requisition_id: Optional[int] = None
    candidate_id: Optional[int] = None
    offer_id: Optional[int] = None
    onboarding_id: Optional[int] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = None
    lifecycle_stage: Optional[str] = None
    offer_status: Optional[str] = None
    offer_released_on: Optional[datetime] = None
    offer_accepted_on: Optional[datetime] = None
    onboarding_started_on: Optional[datetime] = None
    onboarding_completed_on: Optional[datetime] = None
    exit_initiated_on: Optional[datetime] = None
    exit_date: Optional[date] = None
    exit_reason: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    uan: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    annual_ctc: Optional[Decimal] = None
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
    position: Optional[PositionOut] = None
    requisition: Optional[RequisitionOut] = None
    candidate: Optional[CandidateOut] = None
    offer: Optional[OfferOut] = None
    structure_id: Optional[int] = None
    annual_ctc: Optional[Decimal] = None
    offer_released_on: Optional[datetime] = None
    offer_accepted_on: Optional[datetime] = None
    onboarding_started_on: Optional[datetime] = None
    onboarding_completed_on: Optional[datetime] = None
    exit_initiated_on: Optional[datetime] = None
    exit_date: Optional[date] = None
    exit_reason: Optional[str] = None
    salary_structure_name: Optional[str] = None
    salary_breakup: Optional[dict] = None
    created_at: datetime
    class Config:
        from_attributes = True


class EmployeeWithSensitive(EmployeeOut):
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    bank_account: Optional[str] = None


class DocumentOut(BaseModel):
    id: int
    employee_id: int
    document_type: Optional[str] = None
    file_name: Optional[str] = None
    uploaded_at: datetime
    class Config:
        from_attributes = True


class EmployeeLifecycleUpdate(BaseModel):
    lifecycle_stage: str
    effective_date: Optional[date] = None
    exit_reason: Optional[str] = None


class OfferActionRequest(BaseModel):
    status: str


class OfferLetterGenerateRequest(BaseModel):
    designation: Optional[str] = None
    department_name: Optional[str] = None
    annual_ctc: Optional[Decimal] = None
    structure_id: Optional[int] = None
    joining_date: Optional[date] = None
    reporting_manager: Optional[str] = None
    work_location: Optional[str] = None
    probation_months: Optional[int] = 6
    additional_terms: Optional[str] = None
    release_offer: bool = True


class OfferLetterGenerateResponse(BaseModel):
    employee_id: int
    document: DocumentOut
    offer_status: str
    offer_released_on: Optional[datetime] = None


class PositionHireCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    date_of_joining: date
    designation: Optional[str] = None
    annual_ctc: Optional[Decimal] = None
    structure_id: Optional[int] = None


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


class HolidayCreate(BaseModel):
    name: str
    date: date
    holiday_type: str = "national"


# ── Salary Structure ──────────────────────────────────────────────────────────
class SalaryComponentCreate(BaseModel):
    name: str
    component_type: str = "earning"    # earning | benefit | deduction
    calc_type: str = "fixed"           # fixed | percentage_of_basic | percentage_of_ctc
    value: Decimal = Decimal("0")
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    is_taxable: bool = True
    sort_order: int = 0


class SalaryComponentUpdate(BaseModel):
    name: Optional[str] = None
    component_type: Optional[str] = None
    calc_type: Optional[str] = None
    value: Optional[Decimal] = None
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    is_taxable: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SalaryComponentOut(BaseModel):
    id: int
    name: str
    component_type: str
    calc_type: str
    value: Decimal
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    is_taxable: bool
    sort_order: int
    is_active: bool
    class Config:
        from_attributes = True


class SalaryStructureCreate(BaseModel):
    name: str
    description: Optional[str] = None
    salary_mode: str = 'ctc_driven'
    mode_config: Optional[str] = None


class SalaryStructureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    salary_mode: Optional[str] = None
    mode_config: Optional[str] = None


class SalaryStructureOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    salary_mode: str = 'ctc_driven'
    mode_config: Optional[str] = None
    components: List[SalaryComponentOut] = []
    created_at: datetime
    class Config:
        from_attributes = True


class SalaryAssignRequest(BaseModel):
    employee_id: int
    structure_id: int


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


class HRPolicyBase(BaseModel):
    casual_leave_days: int = 12
    sick_leave_days: int = 12
    earned_leave_days: int = 15
    comp_off_enabled: bool = False
    maternity_leave_days: int = 182
    paternity_leave_days: int = 7
    leave_accrual_mode: str = "monthly"
    carry_forward_max_days: int = 10
    leave_encashment_enabled: bool = False
    half_day_leave_allowed: bool = True
    sandwich_leave_enabled: bool = False
    weekend_days: str = "saturday,sunday"
    weekly_working_days: int = 5
    holiday_calendar_name: Optional[str] = None
    payroll_cutoff_day: int = 25
    payroll_payout_day: int = 30
    lop_enabled: bool = True
    late_grace_minutes: int = 15
    half_day_threshold_minutes: int = 240
    probation_months: int = 6
    notice_period_days: int = 30
    onboarding_checklist: Optional[str] = None
    exit_notice_recovery_enabled: bool = True
    leave_encashment_on_exit: bool = True
    fnf_settlement_days: int = 45


class HRPolicyUpdate(HRPolicyBase):
    pass


class HRPolicyOut(HRPolicyBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


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
