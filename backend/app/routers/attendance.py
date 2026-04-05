from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, time
from decimal import Decimal

from app.database import get_db
from app.models import Attendance, Employee, User, Holiday
from app.schemas import AttendanceCreate, AttendanceBulkCreate, AttendanceOut, HolidayCreate, HolidayOut
from app.routers.auth import get_current_user, require_role

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _compute_hours(check_in: Optional[time], check_out: Optional[time]) -> Optional[Decimal]:
    if check_in and check_out:
        ci = datetime.combine(date.today(), check_in)
        co = datetime.combine(date.today(), check_out)
        diff = (co - ci).seconds / 3600
        return Decimal(str(round(diff, 2)))
    return None


@router.get("/", response_model=List[AttendanceOut])
def list_attendance(
    employee_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Attendance).filter(Attendance.tenant_id == current_user.tenant_id)

    if current_user.role == "employee":
        query = query.filter(Attendance.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.filter(Attendance.employee_id == employee_id)

    if month and year:
        query = query.filter(
            Attendance.date >= date(year, month, 1),
            Attendance.date <= date(year, month, 28 if month == 2 else 30 if month in (4, 6, 9, 11) else 31),
        )
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    return query.order_by(Attendance.date.desc()).all()


@router.post("/", response_model=AttendanceOut)
def mark_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee":
        if current_user.employee_id != data.employee_id:
            raise HTTPException(status_code=403, detail="Cannot mark attendance for others")

    # Verify the employee belongs to the same tenant
    emp = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.tenant_id == current_user.tenant_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(Attendance).filter(
        Attendance.employee_id == data.employee_id,
        Attendance.date == data.date,
        Attendance.tenant_id == current_user.tenant_id,
    ).first()

    working_hours = _compute_hours(data.check_in, data.check_out)

    if existing:
        existing.check_in = data.check_in
        existing.check_out = data.check_out
        existing.status = data.status
        existing.working_hours = working_hours
        existing.remarks = data.remarks
        existing.marked_by = current_user.id
        db.commit()
        db.refresh(existing)
        return existing

    attendance = Attendance(
        tenant_id=current_user.tenant_id,
        employee_id=data.employee_id,
        date=data.date,
        check_in=data.check_in,
        check_out=data.check_out,
        status=data.status,
        working_hours=working_hours,
        remarks=data.remarks,
        marked_by=current_user.id,
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


@router.post("/bulk", response_model=List[AttendanceOut])
def bulk_mark_attendance(
    data: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager")),
):
    results = []
    for record in data.records:
        existing = db.query(Attendance).filter(
            Attendance.employee_id == record.employee_id,
            Attendance.date == data.date,
            Attendance.tenant_id == current_user.tenant_id,
        ).first()

        hours = _compute_hours(record.check_in, record.check_out)

        if existing:
            existing.check_in = record.check_in
            existing.check_out = record.check_out
            existing.status = record.status
            existing.working_hours = hours
            existing.remarks = record.remarks
            existing.marked_by = current_user.id
            results.append(existing)
        else:
            att = Attendance(
                tenant_id=current_user.tenant_id,
                employee_id=record.employee_id,
                date=data.date,
                check_in=record.check_in,
                check_out=record.check_out,
                status=record.status,
                working_hours=hours,
                remarks=record.remarks,
                marked_by=current_user.id,
            )
            db.add(att)
            results.append(att)

    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/summary/{employee_id}")
def attendance_summary(
    employee_id: int,
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee" and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)

    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.tenant_id == current_user.tenant_id,
        Attendance.date >= start,
        Attendance.date <= end,
    ).all()

    summary = {"present": 0, "absent": 0, "half_day": 0, "holiday": 0, "weekend": 0, "lop": 0}
    for r in records:
        summary[r.status] = summary.get(r.status, 0) + 1

    return {
        "employee_id": employee_id,
        "month": month,
        "year": year,
        "total_days": days_in_month,
        "records_marked": len(records),
        **summary,
    }


@router.get("/holidays/", response_model=List[HolidayOut])
def list_holidays(
    year: int = Query(default=2025),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holidays = db.query(Holiday).filter(
        Holiday.tenant_id == current_user.tenant_id,
        Holiday.date >= date(year, 1, 1),
        Holiday.date <= date(year, 12, 31),
    ).order_by(Holiday.date).all()
    return holidays


@router.post("/holidays/", response_model=HolidayOut)
def create_holiday(
    data: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = db.query(Holiday).filter(
        Holiday.tenant_id == current_user.tenant_id,
        Holiday.date == data.date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")

    holiday = Holiday(
        tenant_id=current_user.tenant_id,
        name=data.name,
        date=data.date,
        holiday_type=data.holiday_type,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    holiday = db.query(Holiday).filter(
        Holiday.id == holiday_id,
        Holiday.tenant_id == current_user.tenant_id,
    ).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"message": "Holiday deleted"}
