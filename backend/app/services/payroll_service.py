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
    "basic salary": "basic",
    "basic pay": "basic",
    "hra": "hra",
    "house rent allowance (hra)": "hra",
    "house rent allowance": "hra",
    "special allowance": "special_allowance",
    "special_allowance": "special_allowance",
    "conveyance": "conveyance_allowance",
    "conveyance allowance": "conveyance_allowance",
    "conveyance_allowance": "conveyance_allowance",
    "medical": "medical_allowance",
    "medical allowance": "medical_allowance",
    "medical_allowance": "medical_allowance",
}

_EMPLOYER_CONTRIBUTION_KEYWORDS = (
    "employer pf",
    "gratuity",
    "insurance",
    "employer esic",
    "esic employer",
    "edli",
)

_EMPLOYEE_DEDUCTION_KEYWORDS = (
    "employee pf",
    "pf employee",
    "employee esic",
    "esic employee",
    "professional tax",
    "pt",
    "tds",
    "income tax",
)


def split_structural_deductions(deductions: dict) -> tuple[dict, dict]:
    employer_contributions: dict = {}
    employee_deductions: dict = {}

    for name, amount in deductions.items():
        key = name.lower()
        if any(token in key for token in _EMPLOYER_CONTRIBUTION_KEYWORDS):
            employer_contributions[name] = amount
        else:
            employee_deductions[name] = amount

    return employer_contributions, employee_deductions


def is_employer_contribution_name(name: str) -> bool:
    key = name.lower()
    return any(token in key for token in _EMPLOYER_CONTRIBUTION_KEYWORDS)


def compute_basic_driven(config: dict, annual_ctc: Decimal) -> dict:
    """
    Basic-Driven mode:
      CTC → Basic (% of CTC) → HRA/PF/Gratuity (% of Basic) → Special Allowance (remainder)
    All employer contributions (PF, Gratuity, Insurance) are CTC-inclusive.
    Special Allowance = CTC - Basic - HRA - Employer PF - Gratuity - Insurance
    """
    monthly_ctc     = (annual_ctc / 12).quantize(Decimal("0.01"))
    basic_pct       = Decimal(str(config.get("basic_pct",        40)))
    hra_pct         = Decimal(str(config.get("hra_pct",          40)))
    pf_rate         = Decimal(str(config.get("pf_rate",          12)))
    pf_cap          = Decimal(str(config.get("pf_cap",         1800)))
    gratuity_rate   = Decimal(str(config.get("gratuity_rate",  4.81)))
    insurance       = Decimal(str(config.get("insurance_monthly", 0))).quantize(Decimal("0.01"))

    basic           = (basic_pct / 100 * monthly_ctc).quantize(Decimal("0.01"))
    hra             = (hra_pct   / 100 * basic).quantize(Decimal("0.01"))
    pf_employer     = (pf_rate   / 100 * basic).quantize(Decimal("0.01"))
    if pf_cap > 0:
        pf_employer = min(pf_employer, pf_cap.quantize(Decimal("0.01")))
    gratuity        = (gratuity_rate / 100 * basic).quantize(Decimal("0.01"))

    special         = (monthly_ctc - basic - hra - pf_employer - gratuity - insurance).quantize(Decimal("0.01"))
    special         = max(special, Decimal("0"))

    earnings: dict = {"Basic": basic, "HRA": hra}
    if special > 0:
        earnings["Special Allowance"] = special

    employer_contributions: dict = {}
    if pf_employer > 0:
        employer_contributions["Employer PF"] = pf_employer
    if gratuity > 0:
        employer_contributions["Gratuity"] = gratuity
    if insurance > 0:
        employer_contributions["Insurance"] = insurance

    return {
        "earnings": earnings,
        "employer_contributions": employer_contributions,
        "deductions": {},     # no employee-side structure deductions in basic_driven
        "basic": basic,
    }


def compute_salary_from_config(config: dict, salary_mode: str, annual_ctc: Decimal) -> dict:
    """
    Config-driven salary computation.

    basic_driven:
        Basic   = CTC × basic_pct
        HRA     = Basic × hra_pct
        Special = CTC − Basic − HRA          (Employer PF/Gratuity added ON TOP of CTC)
        Total employer cost = CTC + Employer PF + Gratuity + Insurance

    ctc_driven:
        Basic   = CTC × basic_pct
        HRA     = Basic × hra_pct
        Special = CTC − Basic − HRA − Employer PF − Gratuity − Insurance   (all within CTC)
        Total employer cost = CTC
    """
    monthly_ctc   = (annual_ctc / 12).quantize(Decimal("0.01"))
    basic_pct     = Decimal(str(config.get("basic_pct",     40)))
    hra_pct       = Decimal(str(config.get("hra_pct",       50)))
    pf_rate       = Decimal(str(config.get("pf_rate",       12)))
    pf_capped     = bool(config.get("pf_capped",            True))
    pf_cap        = Decimal(str(config.get("pf_cap",      1800)))
    gratuity_rate = Decimal(str(config.get("gratuity_rate", 4.81)))
    insurance     = Decimal(str(config.get("insurance_monthly", 0))).quantize(Decimal("0.01"))

    basic    = (basic_pct / 100 * monthly_ctc).quantize(Decimal("0.01"))
    hra      = (hra_pct   / 100 * basic).quantize(Decimal("0.01"))
    pf_emp   = (pf_rate   / 100 * basic).quantize(Decimal("0.01"))
    if pf_capped:
        pf_emp = min(pf_emp, pf_cap.quantize(Decimal("0.01")))
    gratuity = (gratuity_rate / 100 * basic).quantize(Decimal("0.01"))

    if salary_mode == "ctc_driven":
        special    = (monthly_ctc - basic - hra - pf_emp - gratuity - insurance).quantize(Decimal("0.01"))
        special    = max(special, Decimal("0"))
        total_cost = monthly_ctc
    else:   # basic_driven default
        special    = (monthly_ctc - basic - hra).quantize(Decimal("0.01"))
        special    = max(special, Decimal("0"))
        total_cost = (monthly_ctc + pf_emp + gratuity + insurance).quantize(Decimal("0.01"))

    fixed_pay = (basic + hra + special).quantize(Decimal("0.01"))

    return {
        "monthly_ctc":        monthly_ctc,
        "basic":              basic,
        "hra":                hra,
        "special_allowance":  special,
        "fixed_pay":          fixed_pay,
        "employer_pf":        pf_emp,
        "gratuity":           gratuity,
        "insurance":          insurance,
        "total_employer_cost": total_cost,
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


def compute_components_from_structure(components: List, annual_ctc: Decimal, salary_mode: str = "basic_driven") -> dict:
    """
    Evaluate salary components from a structure definition.

    salary_mode controls how the 'remainder' component (Special Allowance) is computed:
      basic_driven: remainder = monthly_ctc - earnings_so_far
                    Employer contributions are costs ON TOP of CTC.
      ctc_driven:   remainder = monthly_ctc - earnings_so_far - employer_contributions_so_far
                    Employer contributions are included WITHIN CTC.
    Employee deductions do not reduce CTC or gross salary; they affect net pay later.
    """
    active = sorted([c for c in components if c.is_active], key=lambda c: c.sort_order)
    monthly_ctc = (annual_ctc / 12).quantize(Decimal("0.01"))

    # ── Pass 1: resolve basic first (needed as base for percentage_of_basic) ──
    basic = Decimal("0")
    for comp in active:
        if comp.component_type != "earning" or "basic" not in comp.name.lower():
            continue
        val = Decimal(str(comp.value))
        if comp.calc_type == "fixed":
            basic = val.quantize(Decimal("0.01"))
        elif comp.calc_type in ("percentage_of_ctc", "percentage_of_annual_ctc"):
            basic = (val / 100 * monthly_ctc).quantize(Decimal("0.01"))
        if comp.max_value is not None:
            basic = min(basic, Decimal(str(comp.max_value)).quantize(Decimal("0.01")))
        if comp.min_value is not None:
            basic = max(basic, Decimal(str(comp.min_value)).quantize(Decimal("0.01")))
        break

    # ── Pass 2: compute fixed / percentage components first ────────────────────
    resolved_amounts: dict = {}
    remainder_components = []

    for comp in active:
        if comp.calc_type == "remainder":
            remainder_components.append(comp)
            continue

        val = Decimal(str(comp.value))

        if comp.calc_type == "fixed":
            amount = val.quantize(Decimal("0.01"))
        elif comp.calc_type in ("percentage_of_ctc", "percentage_of_annual_ctc", "ctc_deduction"):
            amount = (val / 100 * monthly_ctc).quantize(Decimal("0.01"))
        elif comp.calc_type == "percentage_of_basic":
            amount = (val / 100 * basic).quantize(Decimal("0.01"))
        else:
            amount = Decimal("0")

        if comp.calc_type != "fixed":
            if comp.max_value is not None:
                amount = min(amount, Decimal(str(comp.max_value)).quantize(Decimal("0.01")))
            if comp.min_value is not None:
                amount = max(amount, Decimal(str(comp.min_value)).quantize(Decimal("0.01")))

        resolved_amounts[comp.id] = amount

    # ── Pass 3: compute remainder components after all other values are known ──
    for comp in remainder_components:
        earnings_total = sum(
            amount for c in active
            if c.component_type == "earning" and c.id in resolved_amounts
            for amount in [resolved_amounts[c.id]]
        )
        benefits_total = sum(
            amount for c in active
            if (c.component_type == "benefit" or (c.component_type == "deduction" and is_employer_contribution_name(c.name))) and c.id in resolved_amounts
            for amount in [resolved_amounts[c.id]]
        )

        if salary_mode == "ctc_driven":
            # CTC-driven: remainder sits inside CTC after earnings and employer contributions.
            amount = (monthly_ctc - earnings_total - benefits_total).quantize(Decimal("0.01"))
        else:
            # Basic-driven: remainder completes fixed pay; employer costs sit on top.
            amount = (monthly_ctc - earnings_total).quantize(Decimal("0.01"))
        amount = max(amount, Decimal("0"))

        if comp.max_value is not None:
            amount = min(amount, Decimal(str(comp.max_value)).quantize(Decimal("0.01")))
        if comp.min_value is not None:
            amount = max(amount, Decimal(str(comp.min_value)).quantize(Decimal("0.01")))

        resolved_amounts[comp.id] = amount

    earnings: dict = {}
    benefits: dict = {}
    deductions: dict = {}
    for comp in active:
        amount = resolved_amounts.get(comp.id, Decimal("0"))
        if comp.component_type == "earning":
            earnings[comp.name] = amount
        elif comp.component_type == "benefit" or (comp.component_type == "deduction" and is_employer_contribution_name(comp.name)):
            benefits[comp.name] = amount
        else:
            deductions[comp.name] = amount

    return {"earnings": earnings, "benefits": benefits, "deductions": deductions, "basic": basic}


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
    salary_mode: str = "basic_driven",
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
    result = compute_components_from_structure(structure_components, annual_ctc, salary_mode)
    earnings = dict(result["earnings"])
    employer_contributions = dict(result.get("benefits", {}))
    employee_structure_deductions = dict(result.get("deductions", {}))

    # LOP adjustment on all earnings
    if working_days > 0 and lop_days > 0:
        factor = Decimal(str((working_days - lop_days) / working_days))
        earnings = {k: (v * factor).quantize(Decimal("0.01")) for k, v in earnings.items()}
        employer_contributions = {k: (v * factor).quantize(Decimal("0.01")) for k, v in employer_contributions.items()}
        employee_structure_deductions = {k: (v * factor).quantize(Decimal("0.01")) for k, v in employee_structure_deductions.items()}

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

    total_other_earnings = extra_earnings + other_earnings
    gross = sum(col_values.values()) + total_other_earnings

    basic = col_values["basic"]
    pf_basic = min(basic, PF_WAGE_LIMIT)

    struct_pf_employee = next((v for k, v in employee_structure_deductions.items() if "pf" in k.lower()), None)
    pf_employee = struct_pf_employee if struct_pf_employee is not None else (pf_basic * PF_RATE).quantize(Decimal("0.01"))

    struct_pf_employer = next((v for k, v in employer_contributions.items() if "pf" in k.lower()), None)
    pf_employer = struct_pf_employer if struct_pf_employer is not None else pf_employee

    if gross <= ESIC_WAGE_LIMIT:
        struct_esic_employee = next((v for k, v in employee_structure_deductions.items() if "esic" in k.lower()), None)
        esic_employee = struct_esic_employee if struct_esic_employee is not None else (gross * ESIC_EMPLOYEE_RATE).quantize(Decimal("0.01"))
        struct_esic_employer = next((v for k, v in employer_contributions.items() if "esic" in k.lower()), None)
        esic_employer = struct_esic_employer if struct_esic_employer is not None else (gross * ESIC_EMPLOYER_RATE).quantize(Decimal("0.01"))
    else:
        esic_employee = Decimal("0")
        esic_employer = Decimal("0")

    struct_pt = next((v for k, v in employee_structure_deductions.items() if "professional tax" in k.lower() or k.lower() == "pt"), None)
    pt = struct_pt if struct_pt is not None else calc_professional_tax(gross, state)
    annual_gross = gross * 12
    annual_pf = pf_employee * 12
    standard_deduction = Decimal("75000")
    annual_taxable = max(annual_gross - annual_pf - standard_deduction, Decimal("0"))
    struct_tds = next((v for k, v in employee_structure_deductions.items() if "tds" in k.lower() or "income tax" in k.lower()), None)
    tds = struct_tds if struct_tds is not None else calc_tds_monthly(annual_taxable)

    known_employee_struct_deductions = pf_employee + esic_employee + pt + tds
    remaining_employee_struct_deductions = max(sum(employee_structure_deductions.values()) - known_employee_struct_deductions, Decimal("0"))

    total_deductions = pf_employee + esic_employee + pt + tds + remaining_employee_struct_deductions + other_deductions
    net_salary = gross - total_deductions

    # Build components_json for display
    components_json = json.dumps({
        "earnings": {k: str(v) for k, v in earnings.items()},
        "employer_contributions": {k: str(v) for k, v in employer_contributions.items()},
        "employee_deductions": {k: str(v) for k, v in employee_structure_deductions.items()},
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
