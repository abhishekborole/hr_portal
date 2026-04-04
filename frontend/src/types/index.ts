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
  designation?: string
  employment_type?: string
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
  created_at: string
  pan?: string
  aadhaar?: string
  bank_account?: string
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
  type: string
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
  component_type: 'earning' | 'deduction'
  calc_type: 'fixed' | 'percentage_of_basic' | 'percentage_of_ctc'
  value: number
  is_taxable: boolean
  sort_order: number
  is_active: boolean
}

export interface SalaryStructure {
  id: number
  name: string
  description?: string
  is_active: boolean
  components: SalaryComponent[]
  created_at: string
}

export interface SalaryPreview {
  annual_ctc: number
  monthly_ctc: number
  earnings: Record<string, number>
  deductions: Record<string, number>
  gross_monthly: number
  total_deductions: number
  estimated_net: number
}

export interface Notification {
  id: number
  title: string
  message?: string
  notif_type: string
  is_read: boolean
  created_at: string
}
