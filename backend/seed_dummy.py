"""
Dummy data seeder for HR Portal.
Run from backend/ directory:
    python seed_dummy.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, datetime, timedelta
import random
from decimal import Decimal

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Tenant, Department, Employee, User, Attendance, Leave, Payroll, Holiday
from app.routers.auth import get_password_hash
from app.utils.encryption import encrypt
from app.services.payroll_service import calculate_payroll

Base.metadata.create_all(bind=engine)

db: Session = SessionLocal()

# ── Helpers ────────────────────────────────────────────────────────────────────

def rand_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))

def rand_phone() -> str:
    return f"9{random.randint(100000000, 999999999)}"

# ── Employee definitions ───────────────────────────────────────────────────────

EMPLOYEES = [
    # (first, last, gender, dept_name, designation, emp_type, basic)
    ("Rahul",     "Sharma",    "male",   "Engineering",      "Senior Software Engineer",  "full_time", 85000),
    ("Priya",     "Mehta",     "female", "Engineering",      "Software Engineer",         "full_time", 65000),
    ("Arjun",     "Nair",      "male",   "Engineering",      "DevOps Engineer",           "full_time", 75000),
    ("Sneha",     "Iyer",      "female", "Engineering",      "QA Engineer",               "full_time", 60000),
    ("Vikram",    "Rao",       "male",   "Engineering",      "Tech Lead",                 "full_time", 110000),
    ("Anjali",    "Gupta",     "female", "Human Resources",  "HR Manager",                "full_time", 70000),
    ("Deepak",    "Verma",     "male",   "Human Resources",  "HR Executive",              "full_time", 45000),
    ("Kavya",     "Pillai",    "female", "Human Resources",  "Recruiter",                 "full_time", 42000),
    ("Suresh",    "Reddy",     "male",   "Finance",          "Finance Manager",           "full_time", 90000),
    ("Lakshmi",   "Nair",      "female", "Finance",          "Accountant",                "full_time", 55000),
    ("Mohan",     "Kumar",     "male",   "Finance",          "Senior Accountant",         "full_time", 65000),
    ("Divya",     "Singh",     "female", "Sales",            "Sales Manager",             "full_time", 80000),
    ("Rohit",     "Joshi",     "male",   "Sales",            "Sales Executive",           "full_time", 48000),
    ("Pooja",     "Desai",     "female", "Sales",            "Business Development Exec", "full_time", 50000),
    ("Amit",      "Patel",     "male",   "Marketing",        "Marketing Manager",         "full_time", 78000),
    ("Neha",      "Shah",      "female", "Marketing",        "Content Strategist",        "full_time", 52000),
    ("Kiran",     "Menon",     "male",   "Operations",       "Operations Manager",        "full_time", 85000),
    ("Swati",     "Tiwari",    "female", "Operations",       "Operations Executive",      "full_time", 46000),
    ("Rajesh",    "Kulkarni",  "male",   "Legal",            "Legal Counsel",             "full_time", 95000),
    ("Meera",     "Bhat",      "female", "Admin",            "Admin Executive",           "full_time", 38000),
    ("Sanjay",    "Chopra",    "male",   "Engineering",      "Junior Developer",          "full_time", 45000),
    ("Tanvi",     "Mishra",    "female", "Engineering",      "Frontend Developer",        "full_time", 58000),
    ("Aditya",    "Ghosh",     "male",   "Sales",            "Sales Executive",           "contract",  40000),
    ("Ritu",      "Kapoor",    "female", "Marketing",        "Social Media Exec",         "full_time", 44000),
    ("Nikhil",    "Saxena",    "male",   "Finance",          "Finance Analyst",           "full_time", 60000),
]

STATES = ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Telangana",
          "Gujarat", "West Bengal", "Rajasthan"]
CITIES = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
    "Karnataka":   ["Bangalore", "Mysore"],
    "Tamil Nadu":  ["Chennai", "Coimbatore"],
    "Delhi":       ["New Delhi"],
    "Telangana":   ["Hyderabad"],
    "Gujarat":     ["Ahmedabad", "Surat"],
    "West Bengal": ["Kolkata"],
    "Rajasthan":   ["Jaipur"],
}

def make_salary(basic: int) -> dict:
    hra = int(basic * 0.4)
    special = int(basic * 0.15)
    conveyance = 1600
    medical = 1250
    return {
        "basic_salary": Decimal(basic),
        "hra": Decimal(hra),
        "special_allowance": Decimal(special),
        "conveyance_allowance": Decimal(conveyance),
        "medical_allowance": Decimal(medical),
    }

# ── Main seed ──────────────────────────────────────────────────────────────────

tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
print(f"Found {len(tenants)} tenant(s): {[t.name for t in tenants]}")

for tenant in tenants:
    print(f"\n── Seeding tenant: {tenant.name} (id={tenant.id}) ──")

    dept_map = {d.name: d.id for d in db.query(Department).filter(Department.tenant_id == tenant.id).all()}

    # ── Employees ──────────────────────────────────────────────────────────────
    created_employees = []
    for i, (first, last, gender, dept_name, designation, emp_type, basic) in enumerate(EMPLOYEES, start=1):
        emp_code = f"T{tenant.id}E{i:03d}"
        email = f"{first.lower()}.{last.lower()}{i}@{tenant.slug.replace('-','')}.com"
        dob = rand_date(date(1985, 1, 1), date(2000, 12, 31))
        doj = rand_date(date(2019, 1, 1), date(2024, 6, 30))
        state = random.choice(STATES)
        city = random.choice(CITIES[state])
        sal = make_salary(basic)

        emp = Employee(
            tenant_id=tenant.id,
            emp_code=emp_code,
            first_name=first,
            last_name=last,
            email=email,
            phone=rand_phone(),
            gender=gender,
            date_of_birth=dob,
            date_of_joining=doj,
            department_id=dept_map.get(dept_name),
            designation=designation,
            employment_type=emp_type,
            pan_encrypted=encrypt(f"ABCDE{1234+i:04d}F"),
            aadhaar_encrypted=encrypt(f"{random.randint(200000000000, 999999999999)}"),
            uan=f"{random.randint(100000000000, 999999999999)}",
            bank_account_encrypted=encrypt(f"{random.randint(10000000000, 99999999999)}"),
            ifsc_code=f"SBIN000{random.randint(1000, 9999)}",
            bank_name=random.choice(["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Bank"]),
            address=f"{random.randint(1,999)}, {random.choice(['MG Road','Park Street','Anna Salai','Linking Road'])}",
            city=city,
            state=state,
            pincode=f"{random.randint(100000, 999999)}",
            is_active=True,
            cl_balance=12,
            sl_balance=12,
            el_balance=15,
            **sal,
        )
        db.add(emp)
        db.flush()
        created_employees.append(emp)

        # Create employee user account
        existing_user = db.query(User).filter(User.username == emp_code.lower(), User.tenant_id == tenant.id).first()
        if not existing_user:
            role = "manager" if "Manager" in designation or "Lead" in designation or "Counsel" in designation else "employee"
            db.add(User(
                tenant_id=tenant.id,
                username=emp_code.lower(),
                email=email,
                password_hash=get_password_hash("Password@123"),
                role=role,
                employee_id=emp.id,
            ))

    db.flush()
    print(f"  ✓ {len(created_employees)} employees created")

    # ── Attendance (last 3 months) ─────────────────────────────────────────────
    today = date.today()
    att_count = 0
    for emp in created_employees:
        for month_offset in range(3):
            month_date = today.replace(day=1) - timedelta(days=month_offset * 28)
            year, month = month_date.year, month_date.month
            import calendar
            _, days_in_month = calendar.monthrange(year, month)

            for day in range(1, days_in_month + 1):
                d = date(year, month, day)
                if d > today:
                    continue
                weekday = d.weekday()

                # Check if it's a holiday
                is_holiday = db.query(Holiday).filter(
                    Holiday.tenant_id == tenant.id,
                    Holiday.date == d,
                ).first()

                if is_holiday:
                    status = "holiday"
                    check_in = check_out = None
                elif weekday >= 5:  # Sat/Sun
                    status = "weekend"
                    check_in = check_out = None
                else:
                    r = random.random()
                    if r < 0.82:
                        status = "present"
                        h_in = random.randint(8, 10)
                        m_in = random.randint(0, 59)
                        check_in = f"{h_in:02d}:{m_in:02d}:00"
                        h_out = h_in + random.randint(8, 10)
                        check_out = f"{min(h_out,22):02d}:{random.randint(0,59):02d}:00"
                    elif r < 0.90:
                        status = "half_day"
                        check_in = f"09:{random.randint(0,59):02d}:00"
                        check_out = f"13:{random.randint(0,59):02d}:00"
                    elif r < 0.96:
                        status = "absent"
                        check_in = check_out = None
                    else:
                        status = "lop"
                        check_in = check_out = None

                from datetime import time as dtime
                from decimal import Decimal as D
                wh = None
                if check_in and check_out:
                    ci = datetime.strptime(check_in, "%H:%M:%S")
                    co = datetime.strptime(check_out, "%H:%M:%S")
                    wh = D(str(round((co - ci).seconds / 3600, 2)))

                db.add(Attendance(
                    tenant_id=tenant.id,
                    employee_id=emp.id,
                    date=d,
                    check_in=dtime.fromisoformat(check_in) if check_in else None,
                    check_out=dtime.fromisoformat(check_out) if check_out else None,
                    status=status,
                    working_hours=wh,
                ))
                att_count += 1

    db.flush()
    print(f"  ✓ {att_count} attendance records created")

    # ── Leaves ────────────────────────────────────────────────────────────────
    leave_count = 0
    import calendar as cal_mod
    for emp in created_employees:
        # 2-5 leaves per employee across the year
        for _ in range(random.randint(2, 5)):
            leave_type = random.choice(["CL", "SL", "EL", "CL", "SL"])
            start = rand_date(date(today.year, 1, 1), today - timedelta(days=10))
            days = random.randint(1, 3)
            end = start + timedelta(days=days - 1)
            status = random.choice(["approved", "approved", "approved", "rejected", "pending"])

            leave = Leave(
                tenant_id=tenant.id,
                employee_id=emp.id,
                leave_type=leave_type,
                start_date=start,
                end_date=end,
                days=days,
                reason=random.choice([
                    "Personal work", "Medical appointment", "Family function",
                    "Festival", "Not feeling well", "Travel", "Home emergency",
                ]),
                status=status,
                applied_on=datetime.combine(start - timedelta(days=random.randint(1, 5)), datetime.min.time()),
            )
            db.add(leave)

            if status == "approved" and leave_type != "LOP":
                if leave_type == "CL":
                    emp.cl_balance = max(0, emp.cl_balance - days)
                elif leave_type == "SL":
                    emp.sl_balance = max(0, emp.sl_balance - days)
                elif leave_type == "EL":
                    emp.el_balance = max(0, emp.el_balance - days)

            leave_count += 1

    db.flush()
    print(f"  ✓ {leave_count} leave records created")

    # ── Payroll (last 3 months) ───────────────────────────────────────────────
    payroll_count = 0
    admin_user = db.query(User).filter(User.tenant_id == tenant.id, User.role == "admin").first()

    for emp in created_employees:
        for month_offset in range(1, 4):  # last 3 completed months
            ref = today.replace(day=1) - timedelta(days=month_offset * 28)
            year, month = ref.year, ref.month
            _, days_in_month = calendar.monthrange(year, month)

            # Count attendance
            att_records = db.query(Attendance).filter(
                Attendance.tenant_id == tenant.id,
                Attendance.employee_id == emp.id,
                Attendance.date >= date(year, month, 1),
                Attendance.date <= date(year, month, days_in_month),
                Attendance.status.in_(["present", "half_day"]),
            ).all()
            present_days = int(sum(1 if a.status == "present" else 0.5 for a in att_records)) or 22
            lop_days = max(0, 26 - present_days - 4)  # rough LOP

            calc = calculate_payroll(
                basic=emp.basic_salary or Decimal("0"),
                hra=emp.hra or Decimal("0"),
                special_allowance=emp.special_allowance or Decimal("0"),
                conveyance_allowance=emp.conveyance_allowance or Decimal("0"),
                medical_allowance=emp.medical_allowance or Decimal("0"),
                present_days=present_days,
                lop_days=lop_days,
                state=emp.state or "Maharashtra",
            )

            status = "finalized" if month_offset > 1 else "draft"
            db.add(Payroll(
                tenant_id=tenant.id,
                employee_id=emp.id,
                month=month,
                year=year,
                working_days=26,
                present_days=present_days,
                lop_days=lop_days,
                generated_by=admin_user.id if admin_user else None,
                status=status,
                **calc,
            ))
            payroll_count += 1

    db.flush()
    print(f"  ✓ {payroll_count} payroll records created")

db.commit()
db.close()
print("\n✅ All dummy data seeded successfully!")
print("Employee login: username = emp code (e.g. t1e001), password = Password@123")
