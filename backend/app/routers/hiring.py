from datetime import datetime
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Candidate, Employee, Offer, OnboardingRecord, Position, Requisition, SalaryStructure, Tenant, User
from app.routers.auth import require_role
from app.routers.positions import _to_position_out
from app.schemas import (
    CandidateCreate, CandidateOut, CandidateUpdate,
    EmployeeOut,
    OfferCreate, OfferOut, OfferStatusUpdate,
    OnboardingCancelRequest, OnboardingConvertRequest, OnboardingOut, OnboardingStartRequest,
    RequisitionCreate, RequisitionOut, RequisitionUpdate,
)
from app.utils.encryption import encrypt
from app.utils.pdf_generator import generate_offer_letter
from app.services.payroll_service import compute_components_from_structure

router = APIRouter(prefix="/hiring", tags=["hiring"])


def _generate_requisition_code(db: Session, tenant_id: int) -> str:
    base_count = db.query(Requisition).filter(Requisition.tenant_id == tenant_id).count() + 1
    return f"REQ-{base_count:04d}"


def _candidate_offer(candidate: Candidate) -> Optional[Offer]:
    offers = sorted(candidate.offers or [], key=lambda offer: (offer.created_at or datetime.utcnow(), offer.id), reverse=True)
    return offers[0] if offers else None


def _candidate_onboarding(candidate: Candidate) -> Optional[OnboardingRecord]:
    records = sorted(candidate.onboarding_records or [], key=lambda record: (record.created_at or datetime.utcnow(), record.id), reverse=True)
    return records[0] if records else None


def _candidate_position(candidate: Candidate) -> Optional[Position]:
    requisition = candidate.requisition
    return requisition.position if requisition else None


def _get_or_create_position_requisition(db: Session, tenant_id: int, position_id: int) -> Requisition:
    requisition = (
        db.query(Requisition)
        .filter(
            Requisition.tenant_id == tenant_id,
            Requisition.position_id == position_id,
            Requisition.reason == "system_position_pipeline",
            Requisition.status.in_(["open", "on_hold"]),
        )
        .order_by(Requisition.id.desc())
        .first()
    )
    if requisition:
        return requisition

    position = db.query(Position).filter(Position.id == position_id, Position.tenant_id == tenant_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    requisition = Requisition(
        tenant_id=tenant_id,
        position_id=position_id,
        code=_generate_requisition_code(db, tenant_id),
        title=position.title,
        openings=position.openings or 1,
        status="open",
        reason="system_position_pipeline",
        description="System requisition created for direct position-to-candidate hiring flow.",
    )
    db.add(requisition)
    db.flush()
    return requisition


def _to_requisition_out(requisition: Requisition) -> dict:
    candidates = requisition.candidates or []
    offer_count = sum(1 for candidate in candidates if _candidate_offer(candidate))
    onboarding_count = sum(1 for candidate in candidates if _candidate_onboarding(candidate))
    joined_count = sum(1 for candidate in candidates if candidate.stage == "joined")
    return {
        "id": requisition.id,
        "position_id": requisition.position_id,
        "code": requisition.code,
        "title": requisition.title,
        "openings": requisition.openings,
        "status": requisition.status,
        "reason": requisition.reason,
        "target_hire_date": requisition.target_hire_date,
        "recruiter_name": requisition.recruiter_name,
        "hiring_manager_name": requisition.hiring_manager_name,
        "description": requisition.description,
        "position": _to_position_out(requisition.position) if requisition.position else None,
        "candidate_count": len(candidates),
        "offer_count": offer_count,
        "onboarding_count": onboarding_count,
        "joined_count": joined_count,
        "open_slots": max((requisition.openings or 0) - joined_count, 0),
        "created_at": requisition.created_at or datetime.utcnow(),
    }


def _to_candidate_out(candidate: Candidate) -> dict:
    active_offer = _candidate_offer(candidate)
    onboarding = _candidate_onboarding(candidate)
    position = _candidate_position(candidate)
    return {
        "id": candidate.id,
        "requisition_id": candidate.requisition_id,
        "position_id": position.id if position else None,
        "first_name": candidate.first_name,
        "last_name": candidate.last_name,
        "email": candidate.email,
        "phone": candidate.phone,
        "source": candidate.source,
        "stage": candidate.stage,
        "current_ctc": candidate.current_ctc,
        "expected_ctc": candidate.expected_ctc,
        "notice_period_days": candidate.notice_period_days,
        "proposed_joining_date": candidate.proposed_joining_date,
        "designation": candidate.designation,
        "notes": candidate.notes,
        "requisition": _to_requisition_out(candidate.requisition) if candidate.requisition else None,
        "position": _to_position_out(position) if position else None,
        "active_offer_status": active_offer.status if active_offer else None,
        "onboarding_status": onboarding.status if onboarding else None,
        "created_at": candidate.created_at or datetime.utcnow(),
    }


def _to_offer_out(offer: Offer) -> dict:
    return {
        "id": offer.id,
        "candidate_id": offer.candidate_id,
        "annual_ctc": offer.annual_ctc,
        "structure_id": offer.structure_id,
        "joining_date": offer.joining_date,
        "reporting_manager": offer.reporting_manager,
        "work_location": offer.work_location,
        "probation_months": offer.probation_months,
        "additional_terms": offer.additional_terms,
        "candidate": _to_candidate_out(offer.candidate) if offer.candidate else None,
        "status": offer.status,
        "issue_date": offer.issue_date,
        "released_on": offer.released_on,
        "accepted_on": offer.accepted_on,
        "declined_on": offer.declined_on,
        "document_file_name": offer.document_file_name,
        "created_at": offer.created_at or datetime.utcnow(),
    }


def _to_onboarding_out(record: OnboardingRecord) -> dict:
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "candidate_id": record.candidate_id,
        "offer_id": record.offer_id,
        "status": record.status,
        "checklist_json": record.checklist_json,
        "started_on": record.started_on,
        "completed_on": record.completed_on,
        "employee_id": record.employee_id,
        "candidate": _to_candidate_out(record.candidate) if record.candidate else None,
        "offer": _to_offer_out(record.offer) if record.offer else None,
        "created_at": record.created_at or datetime.utcnow(),
    }


def _build_offer_payload(db: Session, tenant_id: int, candidate: Candidate, offer: Offer, prepared_by: str):
    structure = None
    if offer.structure_id:
        structure = db.query(SalaryStructure).filter(
            SalaryStructure.id == offer.structure_id,
            SalaryStructure.tenant_id == tenant_id,
            SalaryStructure.is_active == True,
        ).first()
    annual_ctc = offer.annual_ctc
    monthly_breakup = None
    if structure and annual_ctc and structure.components:
        result = compute_components_from_structure(structure.components, annual_ctc, "ctc_driven")
        monthly_breakup = {
            "earnings": {k: float(v) for k, v in result["earnings"].items()},
            "employer_contributions": {k: float(v) for k, v in result.get("benefits", {}).items()},
            "employee_deductions": {k: float(v) for k, v in result.get("deductions", {}).items()},
            "gross_salary": float(sum(result["earnings"].values())),
            "annual_ctc": float(annual_ctc),
            "monthly_ctc": float(annual_ctc / 12),
        }

    requisition = candidate.requisition
    position = requisition.position if requisition else None
    return {
        "candidate_name": f"{candidate.first_name} {candidate.last_name}",
        "designation": candidate.designation or (position.title if position else "Team Member"),
        "department_name": position.department.name if position and position.department else "General",
        "annual_ctc": annual_ctc or 0,
        "joining_date": offer.joining_date or candidate.proposed_joining_date,
        "reporting_manager": offer.reporting_manager,
        "work_location": offer.work_location or (position.location if position else None),
        "probation_months": offer.probation_months or 6,
        "additional_terms": offer.additional_terms,
        "prepared_by": prepared_by,
        "issue_date": offer.issue_date or datetime.utcnow().date(),
        "salary_structure_name": structure.name if structure else None,
        "salary_breakup": monthly_breakup,
        "structure_id": structure.id if structure else None,
    }


@router.get("/requisitions", response_model=List[RequisitionOut])
def list_requisitions(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    requisitions = (
        db.query(Requisition)
        .filter(Requisition.tenant_id == current_user.tenant_id)
        .order_by(Requisition.created_at.desc(), Requisition.id.desc())
        .all()
    )
    return [_to_requisition_out(requisition) for requisition in requisitions]


@router.post("/requisitions", response_model=RequisitionOut)
def create_requisition(data: RequisitionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    requisition = Requisition(tenant_id=current_user.tenant_id, code=_generate_requisition_code(db, current_user.tenant_id), **data.model_dump())
    db.add(requisition)
    db.commit()
    db.refresh(requisition)
    return _to_requisition_out(requisition)


@router.put("/requisitions/{requisition_id}", response_model=RequisitionOut)
def update_requisition(requisition_id: int, data: RequisitionUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    requisition = db.query(Requisition).filter(Requisition.id == requisition_id, Requisition.tenant_id == current_user.tenant_id).first()
    if not requisition:
        raise HTTPException(status_code=404, detail="Requisition not found")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(requisition, key, value)
    db.commit()
    db.refresh(requisition)
    return _to_requisition_out(requisition)


@router.get("/candidates", response_model=List[CandidateOut])
def list_candidates(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    candidates = (
        db.query(Candidate)
        .filter(Candidate.tenant_id == current_user.tenant_id)
        .order_by(Candidate.created_at.desc(), Candidate.id.desc())
        .all()
    )
    return [_to_candidate_out(candidate) for candidate in candidates]


@router.post("/candidates", response_model=CandidateOut)
def create_candidate(data: CandidateCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    requisition_id = data.requisition_id
    if not requisition_id:
        if not data.position_id:
            raise HTTPException(status_code=400, detail="position_id is required when requisition_id is not provided")
        requisition = _get_or_create_position_requisition(db, current_user.tenant_id, data.position_id)
        requisition_id = requisition.id
    candidate_payload = data.model_dump(exclude={"position_id"})
    candidate_payload["requisition_id"] = requisition_id
    candidate = Candidate(tenant_id=current_user.tenant_id, **candidate_payload)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return _to_candidate_out(candidate)


@router.put("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, data: CandidateUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(candidate, key, value)
    db.commit()
    db.refresh(candidate)
    return _to_candidate_out(candidate)


@router.get("/offers", response_model=List[OfferOut])
def list_offers(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    offers = db.query(Offer).filter(Offer.tenant_id == current_user.tenant_id).order_by(Offer.created_at.desc(), Offer.id.desc()).all()
    return [_to_offer_out(offer) for offer in offers]


@router.post("/candidates/{candidate_id}/offer/preview")
def preview_offer(candidate_id: int, data: OfferCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    draft_offer = Offer(tenant_id=current_user.tenant_id, candidate_id=candidate_id, issue_date=datetime.utcnow().date(), status="draft", **data.model_dump(exclude={"release_offer"}))
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    offer_payload = _build_offer_payload(db, current_user.tenant_id, candidate, draft_offer, current_user.username)
    pdf_bytes = generate_offer_letter(offer_payload, company_name=tenant.name if tenant else "Your Company Pvt. Ltd.")
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="offer_preview_candidate_{candidate_id}.pdf"'})


@router.post("/candidates/{candidate_id}/offer", response_model=OfferOut)
def create_or_release_offer(candidate_id: int, data: OfferCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    offer = _candidate_offer(candidate)
    if offer and offer.status in {"released", "accepted"}:
        raise HTTPException(status_code=400, detail="An active offer already exists for this candidate")

    if not offer or offer.status == "declined":
        offer = Offer(tenant_id=current_user.tenant_id, candidate_id=candidate_id)
        db.add(offer)

    for key, value in data.model_dump(exclude_none=True, exclude={"release_offer"}).items():
        setattr(offer, key, value)
    offer.issue_date = datetime.utcnow().date()

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    offer_payload = _build_offer_payload(db, current_user.tenant_id, candidate, offer, current_user.username)
    pdf_bytes = generate_offer_letter(offer_payload, company_name=tenant.name if tenant else "Your Company Pvt. Ltd.")
    candidate_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.tenant_id), "hiring", str(candidate.id))
    os.makedirs(candidate_dir, exist_ok=True)
    safe_name = f"offer_letter_candidate_{candidate.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    file_path = os.path.join(candidate_dir, safe_name)
    with open(file_path, "wb") as handle:
        handle.write(pdf_bytes)

    offer.document_file_name = safe_name
    offer.document_path = file_path
    if data.release_offer:
        offer.status = "released"
        offer.released_on = datetime.utcnow()
        candidate.stage = "offer_released"

    db.commit()
    db.refresh(offer)
    return _to_offer_out(offer)


@router.get("/offers/{offer_id}/document")
def download_offer_document(offer_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer or not offer.document_path or not os.path.exists(offer.document_path):
        raise HTTPException(status_code=404, detail="Offer document not found")
    return FileResponse(offer.document_path, filename=offer.document_file_name or os.path.basename(offer.document_path))


@router.post("/offers/{offer_id}/status", response_model=OfferOut)
def update_offer_status(offer_id: int, data: OfferStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    candidate = offer.candidate
    if offer.status == "declined" and data.status != "declined":
        raise HTTPException(status_code=400, detail="Declined offers cannot be changed")
    if offer.status == "accepted" and data.status == "declined":
        raise HTTPException(status_code=400, detail="Accepted offers cannot be declined")
    offer.status = data.status
    now = datetime.utcnow()
    if data.status == "accepted":
        offer.accepted_on = now
        candidate.stage = "offer_accepted"
    elif data.status == "declined":
        offer.declined_on = now
        candidate.stage = "offer_declined"
    elif data.status == "released":
        offer.released_on = now
        candidate.stage = "offer_released"
    db.commit()
    db.refresh(offer)
    return _to_offer_out(offer)


@router.get("/onboarding", response_model=List[OnboardingOut])
def list_onboarding(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    records = (
        db.query(OnboardingRecord)
        .filter(OnboardingRecord.tenant_id == current_user.tenant_id)
        .order_by(OnboardingRecord.created_at.desc(), OnboardingRecord.id.desc())
        .all()
    )
    return [_to_onboarding_out(record) for record in records]


@router.post("/offers/{offer_id}/onboarding", response_model=OnboardingOut)
def start_onboarding(offer_id: int, data: OnboardingStartRequest, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != "accepted":
        raise HTTPException(status_code=400, detail="Only accepted offers can move to onboarding")

    existing = db.query(OnboardingRecord).filter(OnboardingRecord.offer_id == offer_id, OnboardingRecord.tenant_id == current_user.tenant_id).first()
    if existing:
        if existing.status == "cancelled":
            existing.status = "in_progress"
            existing.started_on = datetime.utcnow()
            existing.completed_on = None
            offer.candidate.stage = "onboarding"
            db.commit()
            db.refresh(existing)
        return _to_onboarding_out(existing)

    record = OnboardingRecord(
        tenant_id=current_user.tenant_id,
        candidate_id=offer.candidate_id,
        offer_id=offer.id,
        status="in_progress",
        checklist_json=data.checklist_json,
        started_on=datetime.utcnow(),
    )
    offer.candidate.stage = "onboarding"
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_onboarding_out(record)


@router.post("/onboarding/{onboarding_id}/cancel", response_model=OnboardingOut)
def cancel_onboarding(onboarding_id: int, data: OnboardingCancelRequest, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    record = db.query(OnboardingRecord).filter(OnboardingRecord.id == onboarding_id, OnboardingRecord.tenant_id == current_user.tenant_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    if record.employee_id:
        raise HTTPException(status_code=400, detail="Converted onboarding cannot be cancelled")
    if record.status == "completed":
        raise HTTPException(status_code=400, detail="Completed onboarding cannot be cancelled")

    record.status = "cancelled"
    record.completed_on = datetime.utcnow()
    if data.decline_offer and record.offer:
        record.offer.status = "declined"
        record.offer.declined_on = datetime.utcnow()
        if record.candidate:
            record.candidate.stage = "offer_declined"
    elif record.candidate:
        record.candidate.stage = "onboarding_cancelled"
    db.commit()
    db.refresh(record)
    return _to_onboarding_out(record)


@router.post("/onboarding/{onboarding_id}/convert", response_model=EmployeeOut)
def convert_onboarding_to_employee(onboarding_id: int, data: OnboardingConvertRequest, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "manager"))):
    record = db.query(OnboardingRecord).filter(OnboardingRecord.id == onboarding_id, OnboardingRecord.tenant_id == current_user.tenant_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Onboarding record not found")

    if record.employee_id:
        employee = db.query(Employee).filter(Employee.id == record.employee_id, Employee.tenant_id == current_user.tenant_id).first()
        if employee:
            return employee

    candidate = record.candidate
    requisition = candidate.requisition
    position = requisition.position if requisition else None
    offer = record.offer

    if db.query(Employee).filter(Employee.tenant_id == current_user.tenant_id, Employee.emp_code == data.emp_code).first():
        raise HTTPException(status_code=400, detail="Employee code already exists")
    if db.query(Employee).filter(Employee.tenant_id == current_user.tenant_id, Employee.email == candidate.email).first():
        raise HTTPException(status_code=400, detail="Employee email already exists")

    employee = Employee(
        tenant_id=current_user.tenant_id,
        emp_code=data.emp_code,
        first_name=candidate.first_name,
        last_name=candidate.last_name,
        email=candidate.email,
        phone=data.phone or candidate.phone,
        date_of_birth=data.date_of_birth,
        date_of_joining=offer.joining_date or candidate.proposed_joining_date or datetime.utcnow().date(),
        department_id=position.department_id if position else None,
        position_id=position.id if position else None,
        requisition_id=requisition.id if requisition else None,
        candidate_id=candidate.id,
        offer_id=offer.id,
        designation=candidate.designation or (position.title if position else None),
        employment_type=position.employment_type if position else "permanent",
        lifecycle_stage="active",
        offer_status="accepted",
        offer_released_on=offer.released_on,
        offer_accepted_on=offer.accepted_on or datetime.utcnow(),
        onboarding_started_on=record.started_on or datetime.utcnow(),
        onboarding_completed_on=datetime.utcnow(),
        structure_id=offer.structure_id,
        annual_ctc=offer.annual_ctc,
        uan=data.uan,
        ifsc_code=data.ifsc_code,
        bank_name=data.bank_name,
        is_active=True,
        address=data.address,
        city=data.city,
        state=data.state,
        pincode=data.pincode,
        onboarding_id=record.id,
    )
    if data.pan:
        employee.pan_encrypted = encrypt(data.pan)
    if data.aadhaar:
        employee.aadhaar_encrypted = encrypt(data.aadhaar)
    if data.bank_account:
        employee.bank_account_encrypted = encrypt(data.bank_account)

    db.add(employee)
    db.flush()
    record.employee_id = employee.id
    record.status = "completed"
    record.completed_on = datetime.utcnow()
    candidate.stage = "joined"
    db.commit()
    db.refresh(employee)
    return employee
