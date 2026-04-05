# 🤖 AGENT.md — Complete HRMS Portal (India)

## 📌 Purpose

Design and implement a **full-featured HRMS (Human Resource Management System)** with a strong focus on:

* Dynamic salary structure & payroll
* Employee lifecycle management
* Attendance & leave
* Compliance (India)
* Performance & analytics

The system must be scalable, modular, and production-ready.

---

# 🧠 Core Principles

1. **Dynamic Configuration**

   * All rules (salary, leave, tax, policies) must be configurable

2. **One-Time Computation (Where Applicable)**

   * Salary structure computed during onboarding
   * Reused during payroll

3. **Separation of Concerns**

   * CTC ≠ Salary
   * Fixed Pay drives payslip

4. **Auditability**

   * Every change must be tracked (who, when, what)

---

# 🧩 MODULES OVERVIEW

---

## 👤 1. Employee Management

### Features:

* Employee onboarding (manual + bulk upload)
* Employee profile:

  * Personal details
  * Job details
  * Salary structure
  * Documents (PAN, Aadhaar, bank)
* Employee lifecycle:

  * Hire → Probation → Confirmed → Exit
* Role-based access control (RBAC)

---

## 💰 2. Salary Structure & Payroll Engine

### 🔹 Salary Modes

* `basic_driven`
* `ctc_driven`

### 🔹 Dynamic Calculation Rules

* Basic (% of CTC)
* HRA (% of Basic)
* PF (%, capped, or fixed)
* Gratuity (%)
* Insurance (optional)

### 🔹 Fixed Pay

Fixed Pay = Basic + HRA + Special Allowance

👉 Only Fixed Pay used in payslip

---

### 🔹 Onboarding Logic

* Calculate salary structure ONCE
* Store monthly values
* Do NOT recompute every month

---

### 🔹 Payroll Processing

* Use stored salary
* Apply:

  * LOP
  * Bonuses
  * Reimbursements
* Deduct:

  * TDS
  * PT
  * Employee PF

---

### 🔹 Payslip

* Earnings (Fixed Pay + variables)
* Deductions
* Net Salary
* Employer contributions shown separately

---

## 🕒 3. Attendance Management

### Features:

* Daily attendance tracking
* Multiple modes:

  * Manual
  * Biometric integration
  * Geo-tagging (mobile)
* Shift management:

  * Fixed shift
  * Rotational shift
* Late mark / early exit rules
* Overtime calculation

---

## 🌴 4. Leave Management

### Features:

* Leave types:

  * Casual Leave (CL)
  * Sick Leave (SL)
  * Earned Leave (EL)
* Leave policies:

  * Accrual rules
  * Carry forward
  * Encashment
* Approval workflows:

  * Manager → HR
* Leave balance tracking

---

## 📊 5. Performance Management

### Features:

* Goal setting (OKRs/KPIs)
* Review cycles:

  * Quarterly / Annual
* 360° feedback
* Rating system
* Promotion & increment linkage

---

## 💸 6. Expense & Reimbursement

### Features:

* Claim submission:

  * Travel
  * Food
  * Internet
* Approval workflows
* Integration with payroll
* Tax-exempt reimbursements

---

## 📑 7. Compliance & Statutory (India)

### Features:

* Provident Fund (PF)
* Employee State Insurance (ESIC)
* Professional Tax (state-wise)
* Income Tax (TDS)

### Tax Regimes:

* Old Regime
* New Regime

### Reports:

* Form 16
* PF reports
* TDS filings

---

## 📈 8. Reports & Analytics

### Dashboards:

* Headcount
* Payroll cost
* Attrition rate
* Leave trends

### Reports:

* Salary register
* Attendance report
* Tax summary

---

## 🔐 9. Security & Access Control

### Features:

* Role-based access:

  * Admin
  * HR
  * Manager
  * Employee
* Data privacy controls
* Audit logs

---

## 🔔 10. Notifications & Workflow Engine

### Features:

* Email / SMS / In-app notifications
* Approval workflows:

  * Leave
  * Expense
  * Salary changes

---

## 📂 11. Document Management

### Features:

* Upload & store documents
* Offer letters
* Payslips
* Tax proofs

---

# 🧱 DATA MODEL (HIGH LEVEL)

## Employee Table

* id
* name
* department
* role
* joining_date
* status

## Salary Structure Table

* employee_id
* salary_mode
* config_snapshot (JSON)
* basic_monthly
* hra_monthly
* special_allowance_monthly
* fixed_pay_monthly
* employer_pf_monthly
* total_ctc

## Payroll Table

* employee_id
* month
* fixed_salary
* variable_components
* deductions
* net_salary

## Attendance Table

* employee_id
* date
* check_in
* check_out
* status

## Leave Table

* employee_id
* leave_type
* balance
* applied_dates

---

# 🎯 UI/UX GUIDELINES

* Keep UI clean and simple
* Avoid unnecessary dropdown complexity
* Remove:

  * "Divide by 1"
  * "Divide by 12"

### Must Show:

* Fixed Pay clearly
* CTC breakdown separately
* Monthly in-hand salary

---

# 🚫 STRICT RULES

* ❌ No hardcoded salary values
* ❌ No monthly recalculation of structure
* ❌ Employer PF not part of payslip earnings
* ❌ Avoid complex UI inputs

---

# 🚀 SYSTEM ARCHITECTURE (SUGGESTED)

### Backend:

* FastAPI / Node.js
* PostgreSQL

### Frontend:

* React (with dynamic forms)

### Integrations:

* Biometric devices
* Email/SMS gateways

---

# 🧩 FUTURE ENHANCEMENTS

* AI-based attrition prediction
* Salary benchmarking
* Automated tax optimization
* Chatbot for employee queries

---

# ✅ FINAL GOAL

Build a complete HRMS system that is:

✔ Dynamic
✔ Scalable
✔ Enterprise-ready
✔ India-compliant
✔ Easy to use

👉 Comparable to systems like SAP, Darwinbox, Zoho People

---
