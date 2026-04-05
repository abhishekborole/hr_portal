from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import io
from calendar import month_name
from datetime import date
from decimal import Decimal


def generate_payslip(payroll_data: dict, employee_data: dict, company_name: str = "Your Company Pvt. Ltd.") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm,
                             leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()

    BLUE = colors.HexColor("#1a3c6e")
    LIGHT_BLUE = colors.HexColor("#e8f0fe")
    GREY = colors.HexColor("#f5f5f5")

    title_style = ParagraphStyle("title", fontSize=16, textColor=colors.white,
                                  alignment=TA_CENTER, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("sub", fontSize=10, textColor=colors.white,
                                alignment=TA_CENTER, fontName="Helvetica")
    label_style = ParagraphStyle("label", fontSize=9, textColor=BLUE, fontName="Helvetica-Bold")
    normal_style = ParagraphStyle("normal", fontSize=9, fontName="Helvetica")
    right_style = ParagraphStyle("right", fontSize=9, fontName="Helvetica", alignment=TA_RIGHT)

    elements = []

    # Header
    header_data = [
        [Paragraph(company_name, title_style)],
        [Paragraph(f"Pay Slip for {month_name[payroll_data['month']]} {payroll_data['year']}", sub_style)],
    ]
    header_table = Table(header_data, colWidths=[180*mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 6*mm))

    # Employee details
    emp = employee_data
    emp_rows = [
        ["Employee Name", f"{emp.get('first_name','')} {emp.get('last_name','')}",
         "Employee Code", emp.get("emp_code", "")],
        ["Designation", emp.get("designation", ""), "Department", emp.get("department", "")],
        ["Date of Joining", str(emp.get("date_of_joining", "")), "PAN", emp.get("pan_masked", "****")],
        ["UAN", emp.get("uan", "N/A"), "Bank", emp.get("bank_name", "")],
    ]
    emp_table = Table(emp_rows, colWidths=[38*mm, 52*mm, 38*mm, 52*mm])
    emp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREY),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BLUE),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT_BLUE),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(emp_table)
    elements.append(Spacer(1, 4*mm))

    # Attendance summary
    att_rows = [
        [Paragraph("Working Days", label_style), str(payroll_data.get("working_days", 26)),
         Paragraph("Present Days", label_style), str(payroll_data.get("present_days", 26)),
         Paragraph("LOP Days", label_style), str(payroll_data.get("lop_days", 0))],
    ]
    att_table = Table(att_rows, colWidths=[32*mm, 28*mm, 32*mm, 28*mm, 28*mm, 32*mm])
    att_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BLUE),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("ALIGN", (3, 0), (3, 0), "CENTER"),
        ("ALIGN", (5, 0), (5, 0), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(att_table)
    elements.append(Spacer(1, 4*mm))

    # Earnings & Deductions
    def fmt(val):
        return f"₹ {float(val):,.2f}"

    earnings = [
        ["EARNINGS", "AMOUNT", "DEDUCTIONS", "AMOUNT"],
        ["Basic Salary", fmt(payroll_data.get("basic", 0)), "PF (Employee 12%)", fmt(payroll_data.get("pf_employee", 0))],
        ["HRA", fmt(payroll_data.get("hra", 0)), "ESIC (Employee 0.75%)", fmt(payroll_data.get("esic_employee", 0))],
        ["Special Allowance", fmt(payroll_data.get("special_allowance", 0)), "Professional Tax", fmt(payroll_data.get("professional_tax", 0))],
        ["Conveyance Allowance", fmt(payroll_data.get("conveyance_allowance", 0)), "TDS", fmt(payroll_data.get("tds", 0))],
        ["Medical Allowance", fmt(payroll_data.get("medical_allowance", 0)), "Other Deductions", fmt(payroll_data.get("other_deductions", 0))],
        ["Other Earnings", fmt(payroll_data.get("other_earnings", 0)), "", ""],
        [Paragraph("<b>Gross Salary</b>", label_style), Paragraph(f"<b>{fmt(payroll_data.get('gross_salary', 0))}</b>", right_style),
         Paragraph("<b>Total Deductions</b>", label_style), Paragraph(f"<b>{fmt(payroll_data.get('total_deductions', 0))}</b>", right_style)],
    ]
    sal_table = Table(earnings, colWidths=[52*mm, 38*mm, 52*mm, 38*mm])
    sal_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, GREY]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(sal_table)
    elements.append(Spacer(1, 4*mm))

    # Net salary box
    net_data = [
        [Paragraph(f"<b>NET SALARY (Take Home): {fmt(payroll_data.get('net_salary', 0))}</b>",
                   ParagraphStyle("net", fontSize=11, textColor=colors.white,
                                  fontName="Helvetica-Bold", alignment=TA_CENTER))]
    ]
    net_table = Table(net_data, colWidths=[180*mm])
    net_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(net_table)
    elements.append(Spacer(1, 4*mm))

    # Employer contribution note
    note = (
        f"Employer PF Contribution: {fmt(payroll_data.get('pf_employer', 0))}  |  "
        f"Employer ESIC Contribution: {fmt(payroll_data.get('esic_employer', 0))}  |  "
        f"CTC: {fmt(float(payroll_data.get('gross_salary', 0)) + float(payroll_data.get('pf_employer', 0)) + float(payroll_data.get('esic_employer', 0)))}"
    )
    elements.append(Paragraph(note, ParagraphStyle("note", fontSize=7.5, textColor=colors.grey, alignment=TA_CENTER)))
    elements.append(Spacer(1, 6*mm))
    elements.append(Paragraph("This is a computer-generated payslip and does not require a signature.",
                               ParagraphStyle("footer", fontSize=7, textColor=colors.grey, alignment=TA_CENTER)))

    doc.build(elements)
    return buffer.getvalue()


def generate_offer_letter(offer_data: dict, company_name: str = "Your Company Pvt. Ltd.") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )

    BLUE = colors.HexColor("#153b68")
    LIGHT = colors.HexColor("#eef4fb")
    GREY = colors.HexColor("#5b6573")
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("offer_title", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, textColor=BLUE, leading=22)
    section_style = ParagraphStyle("offer_section", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10, textColor=BLUE, uppercase=True, spaceAfter=6)
    body_style = ParagraphStyle("offer_body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=15, textColor=colors.black)
    label_style = ParagraphStyle("offer_label", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9, textColor=GREY)
    footer_style = ParagraphStyle("offer_footer", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=12, textColor=GREY, alignment=TA_CENTER)

    def fmt_date(value):
        if isinstance(value, date):
            return value.strftime("%d %B %Y")
        return str(value or "-")

    def fmt_money(value):
        try:
            amount = float(value or 0)
        except (TypeError, ValueError):
            amount = 0.0
        return f"Rs. {amount:,.2f} per annum"

    candidate_name = offer_data.get("candidate_name", "Candidate")
    designation = offer_data.get("designation", "Team Member")
    department = offer_data.get("department_name", "General")
    joining_date = fmt_date(offer_data.get("joining_date"))
    annual_ctc = fmt_money(offer_data.get("annual_ctc"))
    salary_structure_name = offer_data.get("salary_structure_name") or "Not specified"
    salary_breakup = offer_data.get("salary_breakup")
    work_location = offer_data.get("work_location") or "Company location"
    reporting_manager = offer_data.get("reporting_manager") or "Reporting manager will be assigned on joining"
    probation_months = offer_data.get("probation_months") or 6
    additional_terms = offer_data.get("additional_terms") or "This offer is subject to completion of joining documents, background checks, and company policy acceptance."

    elements = []
    header = Table([[Paragraph(company_name, ParagraphStyle("company", fontName="Helvetica-Bold", fontSize=16, textColor=colors.white, alignment=TA_CENTER))]], colWidths=[174 * mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(header)
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph("Offer of Employment", title_style))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(f"Date: {fmt_date(offer_data.get('issue_date'))}", body_style))
    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph(f"Dear {candidate_name},", body_style))
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph(
        f"We are pleased to offer you the position of <b>{designation}</b> in the <b>{department}</b> team at <b>{company_name}</b>. "
        f"Your proposed date of joining is <b>{joining_date}</b> and your annual Cost to Company will be <b>{annual_ctc}</b>.",
        body_style,
    ))
    elements.append(Spacer(1, 6 * mm))

    elements.append(Paragraph("Offer Summary", section_style))
    summary = Table([
        [Paragraph("Designation", label_style), Paragraph(designation, body_style)],
        [Paragraph("Department", label_style), Paragraph(department, body_style)],
        [Paragraph("Joining Date", label_style), Paragraph(joining_date, body_style)],
        [Paragraph("Annual CTC", label_style), Paragraph(annual_ctc, body_style)],
        [Paragraph("Salary Structure", label_style), Paragraph(salary_structure_name, body_style)],
        [Paragraph("Work Location", label_style), Paragraph(work_location, body_style)],
        [Paragraph("Reporting To", label_style), Paragraph(reporting_manager, body_style)],
        [Paragraph("Probation Period", label_style), Paragraph(f"{probation_months} months", body_style)],
    ], colWidths=[45 * mm, 129 * mm])
    summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8e2ef")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary)
    elements.append(Spacer(1, 6 * mm))

    elements.append(Paragraph("Terms", section_style))
    elements.append(Paragraph(additional_terms, body_style))
    elements.append(Spacer(1, 4 * mm))
    if salary_breakup:
        elements.append(Paragraph("Compensation Snapshot", section_style))
        rows = [["Monthly Component", "Amount"]]
        for name, amount in salary_breakup.get("earnings", {}).items():
            rows.append([name, f"Rs. {float(amount):,.2f}"])
        for name, amount in salary_breakup.get("employer_contributions", {}).items():
            rows.append([f"{name} (Employer Contribution)", f"Rs. {float(amount):,.2f}"])
        rows.append(["Gross Salary", f"Rs. {float(salary_breakup.get('gross_salary', 0)):,.2f}"])
        rows.append(["Monthly CTC", f"Rs. {float(salary_breakup.get('monthly_ctc', 0)):,.2f}"])
        comp_table = Table(rows, colWidths=[110 * mm, 64 * mm])
        comp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8e2ef")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(comp_table)
        elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph(
        "Please confirm your acceptance of this offer by signing and returning a copy of this letter or by acknowledging it through the company onboarding process.",
        body_style,
    ))
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#d8e2ef")))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(f"For {company_name}", body_style))
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph(offer_data.get("prepared_by") or "Authorized Signatory", body_style))
    elements.append(Spacer(1, 10 * mm))
    elements.append(Paragraph("This is a system-generated offer letter.", footer_style))

    doc.build(elements)
    return buffer.getvalue()
