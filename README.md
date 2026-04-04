# HR Portal — Indian HR Management System

A full-stack HRMS built for Indian SMEs, featuring Indian statutory compliance (PF, ESIC, PT, TDS).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Streamlit (Python) |
| Backend API | FastAPI |
| Database | Microsoft SQL Server |
| Auth | JWT (python-jose) |
| PDF | ReportLab |

---

## Project Structure

```
hr_portal/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (env vars)
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── auth.py          # Login, register, JWT
│   │   │   ├── employees.py     # Employee CRUD
│   │   │   ├── attendance.py    # Attendance management
│   │   │   ├── leaves.py        # Leave workflow
│   │   │   ├── payroll.py       # Payroll generation + payslip PDF
│   │   │   └── reports.py       # CSV/JSON reports
│   │   ├── services/
│   │   │   └── payroll_service.py  # PF/ESIC/PT/TDS calculations
│   │   └── utils/
│   │       ├── encryption.py    # Fernet encrypt/decrypt (PAN, Aadhaar)
│   │       └── pdf_generator.py # ReportLab payslip PDF
│   └── requirements.txt
├── frontend/
│   ├── app.py                   # Streamlit main app + login
│   ├── pages/
│   │   ├── dashboard.py
│   │   ├── employees.py
│   │   ├── attendance.py
│   │   ├── leaves.py
│   │   ├── payroll.py
│   │   └── reports.py
│   ├── utils/
│   │   └── api_client.py        # httpx wrapper for all API calls
│   └── requirements.txt
├── database/
│   └── init.sql                 # T-SQL schema (manual reference)
├── .env.example
└── README.md
```

---

## Prerequisites

- Python 3.11+
- Microsoft SQL Server 2019 / 2022 (Express or higher)
- pip

---

## Setup

### 1. Configure environment

```bash
cd hr_portal
cp .env.example .env
```

Edit `.env` and set your MSSQL credentials:

```
MSSQL_SA_PASSWORD=YourPassword@123
MSSQL_USER=sa
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DB=hrportal
```

### 2. Generate an encryption key (for PAN / Aadhaar)

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the output as `ENCRYPTION_KEY=` in `.env`.

---

### 3. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

Copy `.env.example` to `backend/.env` (or set env vars in your shell), then:

```bash
uvicorn app.main:app --reload --port 8000
```

The first run automatically:
- Creates the `hrportal` database on your SQL Server instance
- Creates all tables via SQLAlchemy
- Seeds departments, holidays, and the default admin user

### 4. Frontend

Open a second terminal:

```bash
cd frontend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

```bash
# Windows
set API_BASE_URL=http://localhost:8000
streamlit run app.py

# macOS / Linux
API_BASE_URL=http://localhost:8000 streamlit run app.py
```

---

## Access

| Service | URL |
|---------|-----|
| Streamlit UI | http://localhost:8501 |
| FastAPI Swagger | http://localhost:8000/docs |
| FastAPI ReDoc | http://localhost:8000/redoc |

### Default Login

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@123 | Admin (HR) |

---

## User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full access — employees, payroll, reports, approvals |
| **Manager** | View employees, attendance, approve leaves, view reports |
| **Employee** | Own attendance, own leaves, own payslips |

---

## Indian Compliance Calculations

### Provident Fund (PF)
- **Employee**: 12% of Basic (capped at Rs.15,000 basic)
- **Employer**: 12% of Basic (matching contribution)

### ESIC
- Applicable when Gross Salary <= Rs.21,000/month
- **Employee**: 0.75% of Gross
- **Employer**: 3.25% of Gross

### Professional Tax (Maharashtra slabs)
| Monthly Gross | PT |
|--------------|-----|
| <= Rs.7,500 | Rs.0 |
| Rs.7,501 – Rs.10,000 | Rs.175 |
| > Rs.10,000 | Rs.200 |

### TDS (New Tax Regime FY 2024-25)
| Annual Taxable Income | Rate |
|-----------------------|------|
| <= Rs.3,00,000 | Nil |
| Rs.3,00,001 – Rs.7,00,000 | 5% |
| Rs.7,00,001 – Rs.10,00,000 | 10% |
| Rs.10,00,001 – Rs.12,00,000 | 15% |
| Rs.12,00,001 – Rs.15,00,000 | 20% |
| > Rs.15,00,000 | 30% |

Standard deduction Rs.75,000 and rebate u/s 87A (income <= Rs.7L) applied automatically.

---

## API Endpoints

```
POST   /auth/login                   Login
POST   /auth/register                Create user (Admin only)
GET    /auth/me                      Current user info

GET    /employees/                   List employees
POST   /employees/                   Create employee
PUT    /employees/{id}               Update employee
DELETE /employees/{id}               Deactivate employee
POST   /employees/{id}/documents     Upload document
GET    /employees/departments/list   List departments

GET    /attendance/                  List attendance
POST   /attendance/                  Mark attendance
POST   /attendance/bulk              Bulk mark attendance
GET    /attendance/summary/{emp_id}  Monthly summary

GET    /leaves/                      List leaves
POST   /leaves/                      Apply leave (employee)
POST   /leaves/admin/apply           Apply on behalf (admin)
PUT    /leaves/{id}/approve          Approve/reject leave

GET    /payroll/                     List payroll
POST   /payroll/generate             Generate for one employee
POST   /payroll/bulk-generate        Generate for all employees
PUT    /payroll/{id}/finalize        Finalize payroll
GET    /payroll/{id}/payslip         Download payslip PDF

GET    /reports/payroll-summary      Payroll report (JSON/CSV)
GET    /reports/attendance-summary   Attendance report (JSON/CSV)
GET    /reports/leave-summary        Leave report (JSON/CSV)
```

---

## Security

- **JWT tokens** with configurable expiry
- **Fernet symmetric encryption** for PAN, Aadhaar, bank account numbers
- **Role-based access control** enforced at API level
- Sensitive fields masked in list views (e.g., XXXX XXXX 1234)

---

## Database Tables

| Table | Description |
|-------|-------------|
| `departments` | Department master |
| `employees` | Employee records with encrypted PII |
| `users` | Authentication with bcrypt passwords |
| `attendance` | Daily attendance with check-in/out times |
| `leaves` | Leave requests with approval workflow |
| `payroll` | Monthly payroll with full salary breakdown |
| `documents` | Uploaded employee documents |
| `holidays` | Indian public holiday calendar |
