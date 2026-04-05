"""
Safe column-add migrations for MSSQL.
Each migration is idempotent — runs only if the column/table doesn't exist yet.
Called once at application startup from main.py lifespan.
"""
from sqlalchemy import text
from sqlalchemy.engine import Engine


def _col_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(:t) AND name = :c"),
        {"t": table, "c": column},
    ).fetchone()
    return row is not None


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM sys.tables WHERE name = :t"),
        {"t": table},
    ).fetchone()
    return row is not None


def _fk_exists(conn, table: str, name: str) -> bool:
    row = conn.execute(text("""
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(:t)
          AND name = :n
    """), {"t": table, "n": name}).fetchone()
    return row is not None


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        tenant_columns = {
            "legal_name": "ALTER TABLE tenants ADD legal_name NVARCHAR(200) NULL",
            "gstin": "ALTER TABLE tenants ADD gstin NVARCHAR(20) NULL",
            "pan": "ALTER TABLE tenants ADD pan NVARCHAR(20) NULL",
            "tan": "ALTER TABLE tenants ADD tan NVARCHAR(20) NULL",
            "cin": "ALTER TABLE tenants ADD cin NVARCHAR(30) NULL",
            "pf_registration_no": "ALTER TABLE tenants ADD pf_registration_no NVARCHAR(50) NULL",
            "esi_registration_no": "ALTER TABLE tenants ADD esi_registration_no NVARCHAR(50) NULL",
            "professional_tax_no": "ALTER TABLE tenants ADD professional_tax_no NVARCHAR(50) NULL",
            "phone": "ALTER TABLE tenants ADD phone NVARCHAR(30) NULL",
            "email": "ALTER TABLE tenants ADD email NVARCHAR(150) NULL",
            "website": "ALTER TABLE tenants ADD website NVARCHAR(200) NULL",
            "registered_address": "ALTER TABLE tenants ADD registered_address NVARCHAR(MAX) NULL",
            "corporate_address": "ALTER TABLE tenants ADD corporate_address NVARCHAR(MAX) NULL",
            "city": "ALTER TABLE tenants ADD city NVARCHAR(100) NULL",
            "state": "ALTER TABLE tenants ADD state NVARCHAR(100) NULL",
            "pincode": "ALTER TABLE tenants ADD pincode NVARCHAR(20) NULL",
            "country": "ALTER TABLE tenants ADD country NVARCHAR(100) NULL",
            "authorized_signatory": "ALTER TABLE tenants ADD authorized_signatory NVARCHAR(150) NULL",
            "signatory_designation": "ALTER TABLE tenants ADD signatory_designation NVARCHAR(150) NULL",
            "updated_at": "ALTER TABLE tenants ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE()",
        }
        for column, ddl in tenant_columns.items():
            if not _col_exists(conn, "tenants", column):
                conn.execute(text(ddl))
        # ── employees: new columns ────────────────────────────────────────────
        if not _col_exists(conn, "employees", "profile_photo_url"):
            conn.execute(text("ALTER TABLE employees ADD profile_photo_url NVARCHAR(500) NULL"))

        if not _col_exists(conn, "employees", "structure_id"):
            conn.execute(text("ALTER TABLE employees ADD structure_id INT NULL"))
        if not _col_exists(conn, "employees", "position_id"):
            conn.execute(text("ALTER TABLE employees ADD position_id INT NULL"))

        if not _col_exists(conn, "employees", "annual_ctc"):
            conn.execute(text("ALTER TABLE employees ADD annual_ctc NUMERIC(14, 2) NULL"))
        if not _col_exists(conn, "employees", "lifecycle_stage"):
            conn.execute(text("ALTER TABLE employees ADD lifecycle_stage NVARCHAR(30) NOT NULL DEFAULT 'hiring'"))
        if not _col_exists(conn, "employees", "offer_status"):
            conn.execute(text("ALTER TABLE employees ADD offer_status NVARCHAR(20) NOT NULL DEFAULT 'draft'"))
        if not _col_exists(conn, "employees", "offer_released_on"):
            conn.execute(text("ALTER TABLE employees ADD offer_released_on DATETIME2 NULL"))
        if not _col_exists(conn, "employees", "offer_accepted_on"):
            conn.execute(text("ALTER TABLE employees ADD offer_accepted_on DATETIME2 NULL"))
        if not _col_exists(conn, "employees", "onboarding_started_on"):
            conn.execute(text("ALTER TABLE employees ADD onboarding_started_on DATETIME2 NULL"))
        if not _col_exists(conn, "employees", "onboarding_completed_on"):
            conn.execute(text("ALTER TABLE employees ADD onboarding_completed_on DATETIME2 NULL"))
        if not _col_exists(conn, "employees", "exit_initiated_on"):
            conn.execute(text("ALTER TABLE employees ADD exit_initiated_on DATETIME2 NULL"))
        if not _col_exists(conn, "employees", "exit_date"):
            conn.execute(text("ALTER TABLE employees ADD exit_date DATE NULL"))
        if not _col_exists(conn, "employees", "exit_reason"):
            conn.execute(text("ALTER TABLE employees ADD exit_reason NVARCHAR(MAX) NULL"))

        # ── payroll: components_json ──────────────────────────────────────────
        if not _col_exists(conn, "payroll", "components_json"):
            conn.execute(text("ALTER TABLE payroll ADD components_json NVARCHAR(MAX) NULL"))

        # ── salary_structures table ───────────────────────────────────────────
        if not _table_exists(conn, "salary_structures"):
            conn.execute(text("""
                CREATE TABLE salary_structures (
                    id          INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id   INT NOT NULL REFERENCES tenants(id),
                    name        NVARCHAR(100) NOT NULL,
                    description NVARCHAR(MAX) NULL,
                    is_active   BIT NOT NULL DEFAULT 1,
                    created_at  DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT uq_structure_tenant_name UNIQUE (tenant_id, name)
                )
            """))

        if not _table_exists(conn, "hr_policies"):
            conn.execute(text("""
                CREATE TABLE hr_policies (
                    id                           INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id                    INT NOT NULL REFERENCES tenants(id),
                    casual_leave_days            INT NOT NULL DEFAULT 12,
                    sick_leave_days              INT NOT NULL DEFAULT 12,
                    earned_leave_days            INT NOT NULL DEFAULT 15,
                    comp_off_enabled             BIT NOT NULL DEFAULT 0,
                    maternity_leave_days         INT NOT NULL DEFAULT 182,
                    paternity_leave_days         INT NOT NULL DEFAULT 7,
                    leave_accrual_mode           NVARCHAR(20) NOT NULL DEFAULT 'monthly',
                    carry_forward_max_days       INT NOT NULL DEFAULT 10,
                    leave_encashment_enabled     BIT NOT NULL DEFAULT 0,
                    half_day_leave_allowed       BIT NOT NULL DEFAULT 1,
                    sandwich_leave_enabled       BIT NOT NULL DEFAULT 0,
                    weekend_days                 NVARCHAR(50) NOT NULL DEFAULT 'saturday,sunday',
                    weekly_working_days          INT NOT NULL DEFAULT 5,
                    holiday_calendar_name        NVARCHAR(100) NULL,
                    payroll_cutoff_day           INT NOT NULL DEFAULT 25,
                    payroll_payout_day           INT NOT NULL DEFAULT 30,
                    lop_enabled                  BIT NOT NULL DEFAULT 1,
                    late_grace_minutes           INT NOT NULL DEFAULT 15,
                    half_day_threshold_minutes   INT NOT NULL DEFAULT 240,
                    probation_months             INT NOT NULL DEFAULT 6,
                    notice_period_days           INT NOT NULL DEFAULT 30,
                    onboarding_checklist         NVARCHAR(MAX) NULL,
                    exit_notice_recovery_enabled BIT NOT NULL DEFAULT 1,
                    leave_encashment_on_exit     BIT NOT NULL DEFAULT 1,
                    fnf_settlement_days          INT NOT NULL DEFAULT 45,
                    created_at                   DATETIME2 DEFAULT GETDATE(),
                    updated_at                   DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT uq_hr_policy_tenant UNIQUE (tenant_id)
                )
            """))

        if not _table_exists(conn, "positions"):
            conn.execute(text("""
                CREATE TABLE positions (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id       INT NOT NULL REFERENCES tenants(id),
                    code            NVARCHAR(30) NOT NULL,
                    title           NVARCHAR(150) NOT NULL,
                    department_id   INT NULL REFERENCES departments(id),
                    employment_type NVARCHAR(20) NOT NULL DEFAULT 'permanent',
                    location        NVARCHAR(150) NULL,
                    openings        INT NOT NULL DEFAULT 1,
                    status          NVARCHAR(20) NOT NULL DEFAULT 'open',
                    description     NVARCHAR(MAX) NULL,
                    created_at      DATETIME2 DEFAULT GETDATE(),
                    updated_at      DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT uq_position_tenant_title_department UNIQUE (tenant_id, title, department_id),
                    CONSTRAINT uq_position_tenant_code UNIQUE (tenant_id, code)
                )
            """))
        if not _col_exists(conn, "positions", "code"):
            conn.execute(text("ALTER TABLE positions ADD code NVARCHAR(30) NULL"))
            conn.execute(text("""
                UPDATE positions
                SET code = CONCAT('POS-', RIGHT(CONCAT('0000', id), 4))
                WHERE code IS NULL
            """))
            conn.execute(text("ALTER TABLE positions ALTER COLUMN code NVARCHAR(30) NOT NULL"))
        if not _fk_exists(conn, "positions", "uq_position_tenant_code"):
            row = conn.execute(text("""
                SELECT 1 FROM sys.key_constraints
                WHERE [type] = 'UQ'
                  AND parent_object_id = OBJECT_ID('positions')
                  AND name = 'uq_position_tenant_code'
            """)).fetchone()
            if row is None:
                conn.execute(text("ALTER TABLE positions ADD CONSTRAINT uq_position_tenant_code UNIQUE (tenant_id, code)"))

        if not _table_exists(conn, "requisitions"):
            conn.execute(text("""
                CREATE TABLE requisitions (
                    id                  INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id           INT NOT NULL REFERENCES tenants(id),
                    position_id         INT NOT NULL REFERENCES positions(id),
                    code                NVARCHAR(30) NOT NULL,
                    title               NVARCHAR(150) NOT NULL,
                    openings            INT NOT NULL DEFAULT 1,
                    status              NVARCHAR(20) NOT NULL DEFAULT 'open',
                    reason              NVARCHAR(50) NULL,
                    target_hire_date    DATE NULL,
                    recruiter_name      NVARCHAR(150) NULL,
                    hiring_manager_name NVARCHAR(150) NULL,
                    description         NVARCHAR(MAX) NULL,
                    created_at          DATETIME2 DEFAULT GETDATE(),
                    updated_at          DATETIME2 DEFAULT GETDATE()
                )
            """))

        if not _table_exists(conn, "candidates"):
            conn.execute(text("""
                CREATE TABLE candidates (
                    id                    INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id             INT NOT NULL REFERENCES tenants(id),
                    requisition_id        INT NOT NULL REFERENCES requisitions(id),
                    first_name            NVARCHAR(100) NOT NULL,
                    last_name             NVARCHAR(100) NOT NULL,
                    email                 NVARCHAR(150) NOT NULL,
                    phone                 NVARCHAR(20) NULL,
                    source                NVARCHAR(100) NULL,
                    stage                 NVARCHAR(30) NOT NULL DEFAULT 'applied',
                    current_ctc           NUMERIC(14, 2) NULL,
                    expected_ctc          NUMERIC(14, 2) NULL,
                    notice_period_days    INT NULL,
                    proposed_joining_date DATE NULL,
                    designation           NVARCHAR(150) NULL,
                    notes                 NVARCHAR(MAX) NULL,
                    created_at            DATETIME2 DEFAULT GETDATE(),
                    updated_at            DATETIME2 DEFAULT GETDATE()
                )
            """))

        if not _table_exists(conn, "offers"):
            conn.execute(text("""
                CREATE TABLE offers (
                    id                 INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id          INT NOT NULL REFERENCES tenants(id),
                    candidate_id       INT NOT NULL REFERENCES candidates(id),
                    annual_ctc         NUMERIC(14, 2) NULL,
                    structure_id       INT NULL REFERENCES salary_structures(id),
                    joining_date       DATE NULL,
                    reporting_manager  NVARCHAR(150) NULL,
                    work_location      NVARCHAR(150) NULL,
                    probation_months   INT NOT NULL DEFAULT 6,
                    additional_terms   NVARCHAR(MAX) NULL,
                    status             NVARCHAR(20) NOT NULL DEFAULT 'draft',
                    issue_date         DATE NULL,
                    released_on        DATETIME2 NULL,
                    accepted_on        DATETIME2 NULL,
                    declined_on        DATETIME2 NULL,
                    document_file_name NVARCHAR(255) NULL,
                    document_path      NVARCHAR(500) NULL,
                    created_at         DATETIME2 DEFAULT GETDATE(),
                    updated_at         DATETIME2 DEFAULT GETDATE()
                )
            """))

        if not _table_exists(conn, "onboarding_records"):
            conn.execute(text("""
                CREATE TABLE onboarding_records (
                    id             INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id      INT NOT NULL REFERENCES tenants(id),
                    candidate_id   INT NOT NULL REFERENCES candidates(id),
                    offer_id       INT NOT NULL REFERENCES offers(id),
                    status         NVARCHAR(20) NOT NULL DEFAULT 'pending',
                    checklist_json NVARCHAR(MAX) NULL,
                    started_on     DATETIME2 NULL,
                    completed_on   DATETIME2 NULL,
                    employee_id    INT NULL,
                    created_at     DATETIME2 DEFAULT GETDATE(),
                    updated_at     DATETIME2 DEFAULT GETDATE()
                )
            """))

        # ── salary_components table ───────────────────────────────────────────
        if not _table_exists(conn, "salary_components"):
            conn.execute(text("""
                CREATE TABLE salary_components (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    structure_id    INT NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
                    tenant_id       INT NOT NULL REFERENCES tenants(id),
                    name            NVARCHAR(100) NOT NULL,
                    component_type  NVARCHAR(20) NOT NULL DEFAULT 'earning',
                    calc_type       NVARCHAR(30) NOT NULL DEFAULT 'fixed',
                    value           NUMERIC(12, 4) NOT NULL DEFAULT 0,
                    is_taxable      BIT NOT NULL DEFAULT 1,
                    sort_order      INT NOT NULL DEFAULT 0,
                    is_active       BIT NOT NULL DEFAULT 1
                )
            """))

        # ── reimbursements table ──────────────────────────────────────────────
        if not _table_exists(conn, "reimbursements"):
            conn.execute(text("""
                CREATE TABLE reimbursements (
                    id                  INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id           INT NOT NULL REFERENCES tenants(id),
                    employee_id         INT NOT NULL REFERENCES employees(id),
                    category            NVARCHAR(50) NOT NULL,
                    amount              NUMERIC(12, 2) NOT NULL,
                    date                DATE NOT NULL,
                    description         NVARCHAR(MAX) NULL,
                    status              NVARCHAR(20) NOT NULL DEFAULT 'pending',
                    applied_on          DATETIME2 DEFAULT GETDATE(),
                    reviewed_by         INT NULL REFERENCES users(id),
                    reviewed_on         DATETIME2 NULL,
                    reviewer_comments   NVARCHAR(MAX) NULL,
                    created_at          DATETIME2 DEFAULT GETDATE()
                )
            """))

        # ── notifications table ───────────────────────────────────────────────
        if not _table_exists(conn, "notifications"):
            conn.execute(text("""
                CREATE TABLE notifications (
                    id          INT IDENTITY(1,1) PRIMARY KEY,
                    tenant_id   INT NOT NULL REFERENCES tenants(id),
                    user_id     INT NOT NULL REFERENCES users(id),
                    title       NVARCHAR(255) NOT NULL,
                    message     NVARCHAR(MAX) NULL,
                    notif_type  NVARCHAR(50) NOT NULL DEFAULT 'info',
                    is_read     BIT NOT NULL DEFAULT 0,
                    created_at  DATETIME2 DEFAULT GETDATE()
                )
            """))

        # ── salary_components: min/max cap columns ───────────────────────────────
        if not _col_exists(conn, "salary_components", "min_value"):
            conn.execute(text("ALTER TABLE salary_components ADD min_value NUMERIC(12, 2) NULL"))

        if not _col_exists(conn, "salary_components", "max_value"):
            conn.execute(text("ALTER TABLE salary_components ADD max_value NUMERIC(12, 2) NULL"))

        # ── FK: employees.structure_id → salary_structures ─────────��─────────
        # Add FK only if the salary_structures table now exists and FK not present
        fk_exists = conn.execute(text("""
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID('employees')
              AND name = 'fk_emp_structure'
        """)).fetchone()
        if not fk_exists and _table_exists(conn, "salary_structures"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_structure
                FOREIGN KEY (structure_id) REFERENCES salary_structures(id)
            """))

        position_fk_exists = conn.execute(text("""
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID('employees')
              AND name = 'fk_emp_position'
        """)).fetchone()
        if not position_fk_exists and _table_exists(conn, "positions") and _col_exists(conn, "employees", "position_id"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_position
                FOREIGN KEY (position_id) REFERENCES positions(id)
            """))

        if not _col_exists(conn, "salary_structures", "salary_mode"):
            conn.execute(text(
                "ALTER TABLE salary_structures ADD salary_mode NVARCHAR(20) NOT NULL DEFAULT 'ctc_driven'"
            ))

        if not _col_exists(conn, "salary_structures", "mode_config"):
            conn.execute(text("ALTER TABLE salary_structures ADD mode_config NVARCHAR(MAX) NULL"))

        if _table_exists(conn, "salary_structures") and _col_exists(conn, "salary_structures", "salary_mode"):
            conn.execute(text("UPDATE salary_structures SET salary_mode = 'ctc_driven'"))

        if _table_exists(conn, "salary_components") and _col_exists(conn, "salary_components", "component_type"):
            conn.execute(text("""
                UPDATE salary_components
                SET component_type = 'benefit'
                WHERE component_type = 'deduction'
                  AND (
                    LOWER(name) LIKE '%employer pf%'
                    OR LOWER(name) LIKE '%gratuity%'
                    OR LOWER(name) LIKE '%insurance%'
                    OR LOWER(name) LIKE '%employer esic%'
                    OR LOWER(name) LIKE '%esic employer%'
                    OR LOWER(name) LIKE '%edli%'
                  )
            """))

        # scenario_type column is deprecated; salary_mode is used instead

        if not _col_exists(conn, "employees", "employer_pf_monthly"):
            conn.execute(text("ALTER TABLE employees ADD employer_pf_monthly NUMERIC(12, 2) NULL"))

        if not _col_exists(conn, "employees", "fixed_pay_monthly"):
            conn.execute(text("ALTER TABLE employees ADD fixed_pay_monthly NUMERIC(12, 2) NULL"))

        if not _col_exists(conn, "employees", "requisition_id"):
            conn.execute(text("ALTER TABLE employees ADD requisition_id INT NULL"))
        if not _col_exists(conn, "employees", "candidate_id"):
            conn.execute(text("ALTER TABLE employees ADD candidate_id INT NULL"))
        if not _col_exists(conn, "employees", "offer_id"):
            conn.execute(text("ALTER TABLE employees ADD offer_id INT NULL"))
        if not _col_exists(conn, "employees", "onboarding_id"):
            conn.execute(text("ALTER TABLE employees ADD onboarding_id INT NULL"))

        if _table_exists(conn, "requisitions") and not _fk_exists(conn, "employees", "fk_emp_requisition"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_requisition
                FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
            """))

        if _table_exists(conn, "candidates") and not _fk_exists(conn, "employees", "fk_emp_candidate"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_candidate
                FOREIGN KEY (candidate_id) REFERENCES candidates(id)
            """))

        if _table_exists(conn, "offers") and not _fk_exists(conn, "employees", "fk_emp_offer"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_offer
                FOREIGN KEY (offer_id) REFERENCES offers(id)
            """))

        if _table_exists(conn, "onboarding_records") and not _fk_exists(conn, "employees", "fk_emp_onboarding"):
            conn.execute(text("""
                ALTER TABLE employees
                ADD CONSTRAINT fk_emp_onboarding
                FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id)
            """))

        if _table_exists(conn, "onboarding_records") and not _fk_exists(conn, "onboarding_records", "fk_onboarding_employee"):
            conn.execute(text("""
                ALTER TABLE onboarding_records
                ADD CONSTRAINT fk_onboarding_employee
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            """))
