-- HR Portal Database Schema — Microsoft SQL Server (T-SQL)
-- This script is for manual reference / local setup.
-- When using Docker, the schema is created automatically by SQLAlchemy on startup.

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'hrportal')
    CREATE DATABASE hrportal;
GO

USE hrportal;
GO

-- ============================================================
-- DEPARTMENTS
-- ============================================================
IF OBJECT_ID('dbo.departments', 'U') IS NULL
CREATE TABLE departments (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(MAX),
    created_at  DATETIME2 DEFAULT GETDATE()
);

INSERT INTO departments (name) VALUES
    ('Engineering'), ('Human Resources'), ('Finance'), ('Sales'),
    ('Marketing'), ('Operations'), ('Legal'), ('Admin');
GO

-- ============================================================
-- EMPLOYEES
-- ============================================================
IF OBJECT_ID('dbo.employees', 'U') IS NULL
CREATE TABLE employees (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    emp_code                NVARCHAR(20)  NOT NULL UNIQUE,
    first_name              NVARCHAR(100) NOT NULL,
    last_name               NVARCHAR(100) NOT NULL,
    email                   NVARCHAR(150) NOT NULL UNIQUE,
    phone                   NVARCHAR(15),
    gender                  NVARCHAR(10),
    date_of_birth           DATE,
    date_of_joining         DATE NOT NULL,
    department_id           INT REFERENCES departments(id),
    designation             NVARCHAR(100),
    employment_type         NVARCHAR(20)  DEFAULT 'full_time',
    -- Encrypted sensitive fields
    pan_encrypted           NVARCHAR(MAX),
    aadhaar_encrypted       NVARCHAR(MAX),
    uan                     NVARCHAR(12),
    bank_account_encrypted  NVARCHAR(MAX),
    ifsc_code               NVARCHAR(11),
    bank_name               NVARCHAR(100),
    -- Salary structure
    basic_salary            DECIMAL(12,2) DEFAULT 0,
    hra                     DECIMAL(12,2) DEFAULT 0,
    special_allowance       DECIMAL(12,2) DEFAULT 0,
    conveyance_allowance    DECIMAL(12,2) DEFAULT 0,
    medical_allowance       DECIMAL(12,2) DEFAULT 0,
    -- Status
    is_active               BIT DEFAULT 1,
    address                 NVARCHAR(MAX),
    city                    NVARCHAR(100),
    state                   NVARCHAR(100),
    pincode                 NVARCHAR(6),
    -- Leave balances
    cl_balance              INT DEFAULT 12,
    sl_balance              INT DEFAULT 12,
    el_balance              INT DEFAULT 15,
    created_at              DATETIME2 DEFAULT GETDATE(),
    updated_at              DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- USERS (authentication)
-- ============================================================
IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    username      NVARCHAR(100) NOT NULL UNIQUE,
    email         NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role          NVARCHAR(20)  NOT NULL DEFAULT 'employee',
    employee_id   INT REFERENCES employees(id) ON DELETE SET NULL,
    is_active     BIT DEFAULT 1,
    last_login    DATETIME2,
    created_at    DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- ATTENDANCE
-- ============================================================
IF OBJECT_ID('dbo.attendance', 'U') IS NULL
CREATE TABLE attendance (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    employee_id   INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    check_in      TIME,
    check_out     TIME,
    status        NVARCHAR(20) DEFAULT 'present',
    working_hours DECIMAL(5,2),
    remarks       NVARCHAR(MAX),
    marked_by     INT REFERENCES users(id),
    created_at    DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT uq_attendance_emp_date UNIQUE (employee_id, date)
);
GO

-- ============================================================
-- LEAVES
-- ============================================================
IF OBJECT_ID('dbo.leaves', 'U') IS NULL
CREATE TABLE leaves (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    employee_id      INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type       NVARCHAR(5) NOT NULL,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    days             INT NOT NULL,
    reason           NVARCHAR(MAX),
    status           NVARCHAR(20) DEFAULT 'pending',
    applied_on       DATETIME2 DEFAULT GETDATE(),
    approved_by      INT REFERENCES users(id),
    approved_on      DATETIME2,
    rejection_reason NVARCHAR(MAX),
    created_at       DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================
-- PAYROLL
-- ============================================================
IF OBJECT_ID('dbo.payroll', 'U') IS NULL
CREATE TABLE payroll (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    employee_id         INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month               INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                INT NOT NULL,
    -- Earnings
    basic               DECIMAL(12,2) DEFAULT 0,
    hra                 DECIMAL(12,2) DEFAULT 0,
    special_allowance   DECIMAL(12,2) DEFAULT 0,
    conveyance_allowance DECIMAL(12,2) DEFAULT 0,
    medical_allowance   DECIMAL(12,2) DEFAULT 0,
    other_earnings      DECIMAL(12,2) DEFAULT 0,
    gross_salary        DECIMAL(12,2) DEFAULT 0,
    -- Deductions
    pf_employee         DECIMAL(12,2) DEFAULT 0,
    pf_employer         DECIMAL(12,2) DEFAULT 0,
    esic_employee       DECIMAL(12,2) DEFAULT 0,
    esic_employer       DECIMAL(12,2) DEFAULT 0,
    professional_tax    DECIMAL(12,2) DEFAULT 0,
    tds                 DECIMAL(12,2) DEFAULT 0,
    other_deductions    DECIMAL(12,2) DEFAULT 0,
    total_deductions    DECIMAL(12,2) DEFAULT 0,
    net_salary          DECIMAL(12,2) DEFAULT 0,
    -- Attendance
    working_days        INT DEFAULT 26,
    present_days        INT DEFAULT 26,
    lop_days            INT DEFAULT 0,
    -- Metadata
    status              NVARCHAR(20) DEFAULT 'draft',
    generated_on        DATETIME2 DEFAULT GETDATE(),
    generated_by        INT REFERENCES users(id),
    paid_on             DATE,
    CONSTRAINT uq_payroll_emp_month UNIQUE (employee_id, month, year)
);
GO

-- ============================================================
-- DOCUMENTS
-- ============================================================
IF OBJECT_ID('dbo.documents', 'U') IS NULL
CREATE TABLE documents (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    employee_id   INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type NVARCHAR(50),
    file_name     NVARCHAR(255),
    file_path     NVARCHAR(500),
    uploaded_at   DATETIME2 DEFAULT GETDATE(),
    uploaded_by   INT REFERENCES users(id)
);
GO

-- ============================================================
-- HOLIDAYS
-- ============================================================
IF OBJECT_ID('dbo.holidays', 'U') IS NULL
CREATE TABLE holidays (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(150) NOT NULL,
    date         DATE NOT NULL UNIQUE,
    holiday_type NVARCHAR(20) DEFAULT 'national',
    created_at   DATETIME2 DEFAULT GETDATE()
);
GO

INSERT INTO holidays (name, date, holiday_type) VALUES
    ('Republic Day',      '2025-01-26', 'national'),
    ('Holi',              '2025-03-14', 'national'),
    ('Ambedkar Jayanti',  '2025-04-14', 'national'),
    ('Good Friday',       '2025-04-18', 'national'),
    ('Labour Day',        '2025-05-01', 'national'),
    ('Independence Day',  '2025-08-15', 'national'),
    ('Gandhi Jayanti',    '2025-10-02', 'national'),
    ('Diwali',            '2025-10-20', 'national'),
    ('Christmas',         '2025-12-25', 'national');
GO

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX idx_leaves_employee     ON leaves(employee_id);
CREATE INDEX idx_leaves_status       ON leaves(status);
CREATE INDEX idx_payroll_emp_month   ON payroll(employee_id, month, year);
CREATE INDEX idx_employees_dept      ON employees(department_id);
CREATE INDEX idx_employees_active    ON employees(is_active);
GO
