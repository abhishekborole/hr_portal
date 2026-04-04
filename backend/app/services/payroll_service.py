import json
from decimal import Decimal
from typing import List


PF_WAGE_LIMIT = Decimal("15000")
ESIC_WAGE_LIMIT = Decimal("21000")
PF_RATE = Decimal("0.12")
ESIC_EMPLOYEE_RATE = Decimal("0.0075")
ESIC_EMPLOYER_RATE = Decimal("0.0325")

# Canonical names that map to fixed Payroll columns
_COLUMN_MAP = {
    "basic": "basic",
    "hra": "hra",
    "special allowance": "special_allowance",
    "special_allowance": "special_allowance",
    "conveyance": "conveyance_allowance",
    "conveyance allowance": "conveyance_allowance",
    "conveyance_allowance": "conveyance_allowance",
    "medical": "medical_allowance",
    "medical allowance": "medical_allowance",
    "medical_allowance": "medical_allowance",
}


def calc_professional_tax(gross: Decimal, state: str = "Maharashtra") -> Decimal:
    """Maharashtra PT slabs (monthly gross)."""
    g = float(gross)
    if g <= 7500:
        return Decimal("0")
    elif g <= 10000:
        return Decimal("175")
    else:
        return Decimal("200")


def calc_tds_monthly(annual_taxable: Decimal) -> Decimal:
    """New tax regime slabs FY 2024-25 (annual), returns monthly TDS."""
    a = float(annual_taxable)
    if a <= 300000:
        tax = 0
    elif a <= 700000:
        tax = (a - 300000) * 0.05
    elif a <= 1000000:
        tax = 20000 + (a - 700000) * 0.10
    elif a <= 1200000:
        tax = 50000 + (a - 1000000) * 0.15
    elif a <= 1500000:
        tax = 80000 + (a - 1200000) * 0.20
    else:
        tax = 140000 + (a - 1500000) * 0.30

    tax_with_cess = tax * 1.04
    if a <= 700000:
        tax_with_cess = 0
    return Decimal(str(round(tax_with_cess / 12, 2)))


def compute_components_from_structure(components: List, annual_ctc: Decimal) -> dict:
    """
    Evaluate salary components from a structure definition.

    Returns:
        {
          "earnings":   { name: Decimal, ... },   # ordered
          "deductions": { name: Decimal, ... },
          "basic": Decimal,
        }
    """
    monthly_ctc = (annual_ctc / 12).quantize(Decimal("0.01"))
    basic = Decimal("0")
    earnings: dict = {}
    deductions: dict = {}

    active = sorted([c for c in components if c.is_active], key=lambda c: c.sort_order)

    for comp in active:
        val = Decimal(str(comp.value))

        if comp.calc_type == "fixed":
            amount = val.quantize(Decimal("0.01"))
        elif comp.calc_type == "percentage_of_ctc":
            amount = (val / 100 * monthly_ctc).quantize(Decimal("0.01"))
        elif comp.calc_type == "percentage_of_basic":
            amount = (val / 100 * basic).quantize(Decimal("0.01"))
        else:
            amount = Decimal("0")

        if comp.name.lower() == "basic":
            basic = amount

        if comp.component_type == "earning":
            earnings[comp.name] = amount
        else:
            deductions[comp.name] = amount

    return {"earnings": earnings, "deductions": deductions, "basic": basic}


def calculate_payroll(
    basic: Decimal,
    hra: Decimal,
    special_allowance: Decimal,
    conveyance_allowance: Decimal,
    medical_allowance: Decimal,
    other_earnings: Decimal = Decimal("0"),
    other_deductions: Decimal = Decimal("0"),
    working_days: int = 26,
    present_days: int = 26,
    lop_days: int = 0,
    state: str = "Maharashtra",
) -> dict:
    """Legacy flat-field based payroll calculation (no salary structure assigned)."""
    if working_days > 0 and lop_days > 0:
        factor = Decimal(str((working_days - lop_days) / working_days))
        basic = (basic * factor).quantize(Decimal("0.01"))
        hra = (hra * factor).quantize(Decimal("0.01"))
        special_allowance = (special_allowance * factor).quantize(Decimal("0.01"))
        conveyance_allowance = (conveyance_allowance * factor).quantize(Decimal("0.01"))
        medical_allowance = (medical_allowance * factor).quantize(Decimal("0.01"))

    gross = basic + hra + special_allowance + conveyance_allowance + medical_allowance + other_earnings

    pf_basic = min(basic, PF_WAGE_LIMIT)
    pf_employee = (pf_basic * PF_RATE).quantize(Decimal("0.01"))
    pf_employer = pf_employee

    if gross <= ESIC_WAGE_LIMIT:
        esic_employee = (gross * ESIC_EMPLOYEE_RATE).quantize(Decimal("0.01"))
        esic_employer = (gross * ESIC_EMPLOYER_RATE).quantize(Decimal("0.01"))
    else:
        esic_employee = Decimal("0")
        esic_employer = Decimal("0")

    pt = calc_professional_tax(gross, state)
    annual_gross = gross * 12
    annual_pf = pf_employee * 12
    standard_deduction = Decimal("75000")
    annual_taxable = max(annual_gross - annual_pf - standard_deduction, Decimal("0"))
    tds = calc_tds_monthly(annual_taxable)

    total_deductions = pf_employee + esic_employee + pt + tds + other_deductions
    net_salary = gross - total_deductions

    return {
        "basic": basic,
        "hra": hra,
        "special_allowance": special_allowance,
        "conveyance_allowance": conveyance_allowance,
        "medical_allowance": medical_allowance,
        "other_earnings": other_earnings,
        "gross_salary": gross,
        "pf_employee": pf_employee,
        "pf_employer": pf_employer,
        "esic_employee": esic_employee,
        "esic_employer": esic_employer,
        "professional_tax": pt,
        "tds": tds,
        "other_deductions": other_deductions,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "components_json": None,
    }


def calculate_payroll_from_structure(
    structure_components: List,
    annual_ctc: Decimal,
    other_earnings: Decimal = Decimal("0"),
    other_deductions: Decimal = Decimal("0"),
    working_days: int = 26,
    present_days: int = 26,
    lop_days: int = 0,
    state: str = "Maharashtra",
) -> dict:
    """
    Dynamic structure-based payroll calculation.
    Maps known component names to standard Payroll columns;
    anything unrecognised goes to other_earnings / other_deductions.
    Stores full component breakdown in components_json.
    """
    result = compute_components_from_structure(structure_components, annual_ctc)
    earnings = dict(result["earnings"])
    struct_deductions = dict(result["deductions"])

    # LOP adjustment on all earnings
    if working_days > 0 and lop_days > 0:
        factor = Decimal(str((working_days - lop_days) / working_days))
        earnings = {k: (v * factor).quantize(Decimal("0.01")) for k, v in earnings.items()}
        struct_deductions = {k: (v * factor).quantize(Decimal("0.01")) for k, v in struct_deductions.items()}

    # Map to standard Payroll columns
    col_values = {
        "basic": Decimal("0"),
        "hra": Decimal("0"),
        "special_allowance": Decimal("0"),
        "conveyance_allowance": Decimal("0"),
        "medical_allowance": Decimal("0"),
    }
    extra_earnings = Decimal("0")
    for name, amount in earnings.items():
        col = _COLUMN_MAP.get(name.lower())
        if col:
            col_values[col] = amount
        else:
            extra_earnings += amount

    col_values_ded = Decimal("0")
    for amount in struct_deductions.values():
        col_values_ded += amount

    total_other_earnings = extra_earnings + other_earnings
    gross = sum(col_values.values()) + total_other_earnings

    basic = col_values["basic"]
    pf_basic = min(basic, PF_WAGE_LIMIT)
    pf_employee = (pf_basic * PF_RATE).quantize(Decimal("0.01"))
    pf_employer = pf_employee

    if gross <= ESIC_WAGE_LIMIT:
        esic_employee = (gross * ESIC_EMPLOYEE_RATE).quantize(Decimal("0.01"))
        esic_employer = (gross * ESIC_EMPLOYER_RATE).quantize(Decimal("0.01"))
    else:
        esic_employee = Decimal("0")
        esic_employer = Decimal("0")

    pt = calc_professional_tax(gross, state)
    annual_gross = gross * 12
    annual_pf = pf_employee * 12
    standard_deduction = Decimal("75000")
    annual_taxable = max(annual_gross - annual_pf - standard_deduction, Decimal("0"))
    tds = calc_tds_monthly(annual_taxable)

    total_deductions = pf_employee + esic_employee + pt + tds + col_values_ded + other_deductions
    net_salary = gross - total_deductions

    # Build components_json for display
    components_json = json.dumps({
        "earnings": {k: str(v) for k, v in earnings.items()},
        "structure_deductions": {k: str(v) for k, v in struct_deductions.items()},
    })

    return {
        **col_values,
        "other_earnings": total_other_earnings,
        "gross_salary": gross,
        "pf_employee": pf_employee,
        "pf_employer": pf_employer,
        "esic_employee": esic_employee,
        "esic_employer": esic_employer,
        "professional_tax": pt,
        "tds": tds,
        "other_deductions": other_deductions,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "components_json": components_json,
    }
