export interface AuthUser {
  access_token: string
  token_type: string
  role: 'admin' | 'manager' | 'employee'
  username: string
  tenant_id: number
  tenant_slug: string
  employee_id: number | null
}

export interface Department {
  id: number
  name: string
  description?: string
}

export interface CompanyProfile {
  id: number
  name: string
  legal_name?: string
  slug: string
  gstin?: string
  pan?: string
  tan?: string
  cin?: string
  pf_registration_no?: string
  esi_registration_no?: string
  professional_tax_no?: string
  phone?: string
  email?: string
  website?: string
  registered_address?: string
  corporate_address?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
  authorized_signatory?: string
  signatory_designation?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HRPolicy {
  id: number
  tenant_id: number
  casual_leave_days: number
  sick_leave_days: number
  earned_leave_days: number
  comp_off_enabled: boolean
  maternity_leave_days: number
  paternity_leave_days: number
  leave_accrual_mode: 'monthly' | 'yearly'
  carry_forward_max_days: number
  leave_encashment_enabled: boolean
  half_day_leave_allowed: boolean
  sandwich_leave_enabled: boolean
  weekend_days: string
  weekly_working_days: number
  holiday_calendar_name?: string
  payroll_cutoff_day: number
  payroll_payout_day: number
  lop_enabled: boolean
  late_grace_minutes: number
  half_day_threshold_minutes: number
  probation_months: number
  notice_period_days: number
  onboarding_checklist?: string
  exit_notice_recovery_enabled: boolean
  leave_encashment_on_exit: boolean
  fnf_settlement_days: number
  created_at: string
  updated_at: string
}

export interface Position {
  id: number
  code: string
  title: string
  department_id?: number
  department?: Department
  employment_type?: string
  location?: string
  openings?: number
  status?: 'open' | 'closed' | 'on_hold'
  description?: string
  filled_count: number
  hiring_count: number
  active_employee_count: number
  open_vacancies: number
  linked_hires: Array<{
    id: number
    emp_code: string
    first_name: string
    last_name: string
    email: string
    date_of_joining: string
    designation?: string
    lifecycle_stage: 'hiring' | 'onboarding' | 'active' | 'exit_initiated' | 'exited'
    offer_status: 'draft' | 'released' | 'accepted' | 'declined'
    is_active: boolean
  }>
  created_at: string
}

export interface Requisition {
  id: number
  code: string
  position_id: number
  position?: Position
  title: string
  openings: number
  status: 'open' | 'on_hold' | 'closed' | 'filled'
  reason?: string
  target_hire_date?: string
  recruiter_name?: string
  hiring_manager_name?: string
  description?: string
  candidate_count: number
  offer_count: number
  onboarding_count: number
  joined_count: number
  open_slots: number
  created_at: string
}

export interface Candidate {
  id: number
  requisition_id?: number
  position_id?: number
  requisition?: Requisition
  position?: Position
  first_name: string
  last_name: string
  email: string
  phone?: string
  source?: string
  stage: 'applied' | 'screening' | 'interview' | 'offer_released' | 'offer_accepted' | 'offer_declined' | 'onboarding' | 'onboarding_cancelled' | 'joined' | 'rejected'
  current_ctc?: number
  expected_ctc?: number
  notice_period_days?: number
  proposed_joining_date?: string
  designation?: string
  notes?: string
  active_offer_status?: string
  onboarding_status?: string
  created_at: string
}

export interface HiringOffer {
  id: number
  candidate_id: number
  candidate?: Candidate
  annual_ctc?: number
  structure_id?: number
  joining_date?: string
  reporting_manager?: string
  work_location?: string
  probation_months?: number
  additional_terms?: string
  status: 'draft' | 'released' | 'accepted' | 'declined'
  issue_date?: string
  released_on?: string
  accepted_on?: string
  declined_on?: string
  document_file_name?: string
  created_at: string
}

export interface OnboardingRecord {
  id: number
  tenant_id: number
  candidate_id: number
  offer_id: number
  candidate?: Candidate
  offer?: HiringOffer
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  checklist_json?: string
  started_on?: string
  completed_on?: string
  employee_id?: number
  created_at: string
}

export interface Employee {
  id: number
  emp_code: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  gender?: string
  date_of_birth?: string
  date_of_joining: string
  department_id?: number
  department?: Department
  position_id?: number
  position?: Position
  requisition_id?: number
  requisition?: Requisition
  candidate_id?: number
  candidate?: Candidate
  offer_id?: number
  offer?: HiringOffer
  onboarding_id?: number
  designation?: string
  employment_type?: string
  lifecycle_stage?: 'hiring' | 'onboarding' | 'active' | 'exit_initiated' | 'exited'
  offer_status?: 'draft' | 'released' | 'accepted' | 'declined'
  offer_released_on?: string
  offer_accepted_on?: string
  onboarding_started_on?: string
  onboarding_completed_on?: string
  exit_initiated_on?: string
  exit_date?: string
  exit_reason?: string
  uan?: string
  ifsc_code?: string
  bank_name?: string
  basic_salary?: number
  hra?: number
  special_allowance?: number
  conveyance_allowance?: number
  medical_allowance?: number
  is_active: boolean
  address?: string
  city?: string
  state?: string
  pincode?: string
  cl_balance: number
  sl_balance: number
  el_balance: number
  structure_id?: number
  annual_ctc?: number
  salary_structure_name?: string
  salary_breakup?: {
    earnings: Record<string, number>
    employer_contributions: Record<string, number>
    employee_deductions: Record<string, number>
    gross_salary: number
    annual_ctc: number
    monthly_ctc: number
  }
  created_at: string
  pan?: string
  aadhaar?: string
  bank_account?: string
}

export interface EmployeeDocument {
  id: number
  employee_id: number
  document_type?: string
  file_name?: string
  uploaded_at: string
}

export interface OfferLetterResponse {
  employee_id: number
  document: EmployeeDocument
  offer_status: 'draft' | 'released' | 'accepted' | 'declined'
  offer_released_on?: string
}

export interface AttendanceRecord {
  id: number
  employee_id: number
  date: string
  check_in?: string
  check_out?: string
  status: 'present' | 'absent' | 'half_day' | 'holiday' | 'weekend' | 'lop'
  working_hours?: number
  remarks?: string
  employee?: Employee
}

export interface AttendanceSummary {
  employee_id: number
  month: number
  year: number
  total_days: number
  records_marked: number
  present: number
  absent: number
  half_day: number
  holiday: number
  weekend: number
  lop: number
}

export interface LeaveRequest {
  id: number
  employee_id: number
  leave_type: 'CL' | 'SL' | 'EL' | 'LOP'
  start_date: string
  end_date: string
  days: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  applied_on: string
  approved_on?: string
  rejection_reason?: string
  employee?: Employee
}

export interface PayrollRecord {
  id: number
  employee_id: number
  month: number
  year: number
  basic: number
  hra: number
  special_allowance: number
  conveyance_allowance: number
  medical_allowance: number
  other_earnings: number
  gross_salary: number
  pf_employee: number
  pf_employer: number
  esic_employee: number
  esic_employer: number
  professional_tax: number
  tds: number
  other_deductions: number
  total_deductions: number
  net_salary: number
  working_days: number
  present_days: number
  lop_days: number
  status: 'draft' | 'finalized'
  generated_on: string
  paid_on?: string
  employee?: Employee
}

export interface Holiday {
  id: number
  name: string
  date: string
  holiday_type: string
}

export interface Reimbursement {
  id: number
  employee_id: number
  category: string
  amount: number
  date: string
  description?: string
  status: 'pending' | 'approved' | 'rejected'
  applied_on: string
  reviewed_on?: string
  reviewer_comments?: string
  employee?: Employee
}

export interface SalaryComponent {
  id: number
  name: string
  component_type: 'earning' | 'benefit' | 'deduction'
  calc_type: 'fixed' | 'percentage_of_basic' | 'percentage_of_ctc' | 'percentage_of_annual_ctc' | 'remainder' | 'ctc_deduction'
  value: number
  min_value?: number | null
  max_value?: number | null
  is_taxable: boolean
  sort_order: number
  is_active: boolean
}

export interface SalaryStructure {
  id: number
  name: string
  description?: string
  is_active: boolean
  salary_mode: 'basic_driven' | 'ctc_driven'
  mode_config?: string | null
  components: SalaryComponent[]
  created_at: string
}

export interface SalaryPreview {
  annual_ctc: number
  monthly_ctc: number
  gross_ctc: number
  monthly_gross_ctc: number
  salary_mode: 'basic_driven' | 'ctc_driven'
  earnings: Record<string, number>
  employer_contributions: Record<string, number>
  employee_deductions: Record<string, number>
  fixed_pay: number
}

export interface SalaryConfig {
  basic_pct: number
  hra_pct: number
  pf_rate: number
  pf_capped: boolean
  pf_cap: number
  gratuity_rate: number
  insurance_monthly: number
}

export interface Notification {
  id: number
  title: string
  message?: string
  notif_type: string
  is_read: boolean
  created_at: string
}
