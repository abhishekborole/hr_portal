from sqlalchemy import (
    Column, Integer, String, Boolean, Date, DateTime, Numeric,
    Text, Time, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    departments = relationship("Department", back_populates="tenant")
    employees = relationship("Employee", back_populates="tenant")
    users = relationship("User", back_populates="tenant")
    holidays = relationship("Holiday", back_populates="tenant")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_dept_tenant_name"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=func.now())

    tenant = relationship("Tenant", back_populates="departments")
    employees = relationship("Employee", back_populates="department")


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "emp_code", name="uq_emp_tenant_code"),
        UniqueConstraint("tenant_id", "email", name="uq_emp_tenant_email"),
    )
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    emp_code = Column(String(20), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(15))
    gender = Column(String(10))
    date_of_birth = Column(Date)
    date_of_joining = Column(Date, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    designation = Column(String(100))
    employment_type = Column(String(20), default="full_time")
    pan_encrypted = Column(Text)
    aadhaar_encrypted = Column(Text)
    uan = Column(String(12))
    bank_account_encrypted = Column(Text)
    ifsc_code = Column(String(11))
    bank_name = Column(String(100))
    basic_salary = Column(Numeric(12, 2), default=0)
    hra = Column(Numeric(12, 2), default=0)
    special_allowance = Column(Numeric(12, 2), default=0)
    conveyance_allowance = Column(Numeric(12, 2), default=0)
    medical_allowance = Column(Numeric(12, 2), default=0)
    is_active = Column(Boolean, default=True)
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(6))
    profile_photo_url = Column(String(500))
    structure_id = Column(Integer, ForeignKey("salary_structures.id"), nullable=True)
    annual_ctc = Column(Numeric(14, 2), nullable=True)
    cl_balance = Column(Integer, default=12)
    sl_balance = Column(Integer, default=12)
    el_balance = Column(Integer, default=15)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="employees")
    department = relationship("Department", back_populates="employees")
    user = relationship("User", back_populates="employee", uselist=False)
    attendance = relationship("Attendance", back_populates="employee")
    leaves = relationship("Leave", back_populates="employee")
    payroll = relationship("Payroll", back_populates="employee")
    documents = relationship("Document", back_populates="employee")
    reimbursements = relationship("Reimbursement", back_populates="employee")
    salary_structure = relationship("SalaryStructure", foreign_keys=[structure_id])


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_user_tenant_username"),
        UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
    )
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    username = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="employee")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

    tenant = relationship("Tenant", back_populates="users")
    employee = relationship("Employee", back_populates="user")


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(Time)
    check_out = Column(Time)
    status = Column(String(20), default="present")
    working_hours = Column(Numeric(5, 2))
    remarks = Column(Text)
    marked_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="attendance")


class Leave(Base):
    __tablename__ = "leaves"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String(5), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer, nullable=False)
    reason = Column(Text)
    status = Column(String(20), default="pending")
    applied_on = Column(DateTime, default=func.now())
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_on = Column(DateTime)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="leaves")


class Payroll(Base):
    __tablename__ = "payroll"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    basic = Column(Numeric(12, 2), default=0)
    hra = Column(Numeric(12, 2), default=0)
    special_allowance = Column(Numeric(12, 2), default=0)
    conveyance_allowance = Column(Numeric(12, 2), default=0)
    medical_allowance = Column(Numeric(12, 2), default=0)
    other_earnings = Column(Numeric(12, 2), default=0)
    gross_salary = Column(Numeric(12, 2), default=0)
    pf_employee = Column(Numeric(12, 2), default=0)
    pf_employer = Column(Numeric(12, 2), default=0)
    esic_employee = Column(Numeric(12, 2), default=0)
    esic_employer = Column(Numeric(12, 2), default=0)
    professional_tax = Column(Numeric(12, 2), default=0)
    tds = Column(Numeric(12, 2), default=0)
    other_deductions = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    net_salary = Column(Numeric(12, 2), default=0)
    working_days = Column(Integer, default=26)
    present_days = Column(Integer, default=26)
    lop_days = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    components_json = Column(Text, nullable=True)   # stores dynamic component breakdown as JSON
    generated_on = Column(DateTime, default=func.now())
    generated_by = Column(Integer, ForeignKey("users.id"))
    paid_on = Column(Date)

    employee = relationship("Employee", back_populates="payroll")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    document_type = Column(String(50))
    file_name = Column(String(255))
    file_path = Column(String(500))
    uploaded_at = Column(DateTime, default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"))

    employee = relationship("Employee", back_populates="documents")


class Holiday(Base):
    __tablename__ = "holidays"
    __table_args__ = (UniqueConstraint("tenant_id", "date", name="uq_holiday_tenant_date"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(150), nullable=False)
    date = Column(Date, nullable=False)
    holiday_type = Column(String(20), default="national")
    created_at = Column(DateTime, default=func.now())

    tenant = relationship("Tenant", back_populates="holidays")


class SalaryStructure(Base):
    __tablename__ = "salary_structures"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_structure_tenant_name"),)
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    components = relationship(
        "SalaryComponent", back_populates="structure",
        order_by="SalaryComponent.sort_order",
        cascade="all, delete-orphan",
    )


class SalaryComponent(Base):
    __tablename__ = "salary_components"
    id = Column(Integer, primary_key=True)
    structure_id = Column(Integer, ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    component_type = Column(String(20), nullable=False, default="earning")   # earning | deduction
    calc_type = Column(String(30), nullable=False, default="fixed")          # fixed | percentage_of_basic | percentage_of_ctc
    value = Column(Numeric(12, 4), nullable=False, default=0)
    is_taxable = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    structure = relationship("SalaryStructure", back_populates="components")


class Reimbursement(Base):
    __tablename__ = "reimbursements"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    category = Column(String(50), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text)
    status = Column(String(20), default="pending")
    applied_on = Column(DateTime, default=func.now())
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_on = Column(DateTime)
    reviewer_comments = Column(Text)
    created_at = Column(DateTime, default=func.now())

    employee = relationship("Employee", back_populates="reimbursements")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    notif_type = Column(String(50), default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
