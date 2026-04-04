from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import csv, io
from calendar import monthrange

from app.database import get_db
from app.models import Payroll, Attendance, Leave, Employee, User
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/payroll-summary")
def payroll_summary_report(
    month: int = Query(...),
    year: int = Query(...),
    department_id: Optional[int] = None,
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    query = (
        db.query(Payroll)
        .join(Employee, Payroll.employee_id == Employee.id)
        .filter(
            Payroll.tenant_id == current_user.tenant_id,
            Payroll.month == month,
            Payroll.year == year,
        )
    )
    if department_id:
        query = query.filter(Employee.department_id == department_id)

    records = query.all()

    data = []
    for p in records:
        emp = p.employee
        data.append({
            "emp_code": emp.emp_code,
            "name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department.name if emp.department else "",
            "designation": emp.designation or "",
            "basic": float(p.basic),
            "hra": float(p.hra),
            "gross_salary": float(p.gross_salary),
            "pf_employee": float(p.pf_employee),
            "esic_employee": float(p.esic_employee),
            "professional_tax": float(p.professional_tax),
            "tds": float(p.tds),
            "total_deductions": float(p.total_deductions),
            "net_salary": float(p.net_salary),
            "status": p.status,
        })

    if format == "csv":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        output.seek(0)
        filename = f"payroll_summary_{year}_{month:02d}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    totals = {
        "total_employees": len(data),
        "total_gross": sum(r["gross_salary"] for r in data),
        "total_net": sum(r["net_salary"] for r in data),
        "total_pf": sum(r["pf_employee"] for r in data),
        "total_esic": sum(r["esic_employee"] for r in data),
        "total_tds": sum(r["tds"] for r in data),
    }
    return {"month": month, "year": year, "summary": totals, "records": data}


@router.get("/attendance-summary")
def attendance_summary_report(
    month: int = Query(...),
    year: int = Query(...),
    department_id: Optional[int] = None,
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    _, days_in_month = monthrange(year, month)
    from datetime import date
    start = date(year, month, 1)
    end = date(year, month, days_in_month)

    emp_query = db.query(Employee).filter(
        Employee.tenant_id == current_user.tenant_id,
        Employee.is_active == True,
    )
    if department_id:
        emp_query = emp_query.filter(Employee.department_id == department_id)
    employees = emp_query.all()

    data = []
    for emp in employees:
        records = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.tenant_id == current_user.tenant_id,
            Attendance.date >= start,
            Attendance.date <= end,
        ).all()

        counts = {"present": 0, "absent": 0, "half_day": 0, "holiday": 0, "weekend": 0}
        for r in records:
            counts[r.status] = counts.get(r.status, 0) + 1

        data.append({
            "emp_code": emp.emp_code,
            "name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department.name if emp.department else "",
            **counts,
            "total_marked": len(records),
        })

    if format == "csv":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        output.seek(0)
        filename = f"attendance_summary_{year}_{month:02d}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    return {"month": month, "year": year, "records": data}


@router.get("/leave-summary")
def leave_summary_report(
    year: int = Query(...),
    department_id: Optional[int] = None,
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    from datetime import date
    query = (
        db.query(Leave)
        .join(Employee, Leave.employee_id == Employee.id)
        .filter(
            Leave.tenant_id == current_user.tenant_id,
            Leave.start_date >= date(year, 1, 1),
            Leave.end_date <= date(year, 12, 31),
            Leave.status == "approved",
        )
    )
    if department_id:
        query = query.filter(Employee.department_id == department_id)

    leaves = query.all()

    emp_map: dict = {}
    for leave in leaves:
        emp = leave.employee
        key = emp.id
        if key not in emp_map:
            emp_map[key] = {
                "emp_code": emp.emp_code,
                "name": f"{emp.first_name} {emp.last_name}",
                "department": emp.department.name if emp.department else "",
                "CL": 0, "SL": 0, "EL": 0, "LOP": 0, "total": 0,
                "cl_balance": emp.cl_balance, "sl_balance": emp.sl_balance, "el_balance": emp.el_balance,
            }
        emp_map[key][leave.leave_type] = emp_map[key].get(leave.leave_type, 0) + leave.days
        emp_map[key]["total"] += leave.days

    data = list(emp_map.values())

    if format == "csv":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        output.seek(0)
        filename = f"leave_summary_{year}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    return {"year": year, "records": data}
