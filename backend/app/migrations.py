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


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        # ── employees: new columns ────────────────────────────────────────────
        if not _col_exists(conn, "employees", "profile_photo_url"):
            conn.execute(text("ALTER TABLE employees ADD profile_photo_url NVARCHAR(500) NULL"))

        if not _col_exists(conn, "employees", "structure_id"):
            conn.execute(text("ALTER TABLE employees ADD structure_id INT NULL"))

        if not _col_exists(conn, "employees", "annual_ctc"):
            conn.execute(text("ALTER TABLE employees ADD annual_ctc NUMERIC(14, 2) NULL"))

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
