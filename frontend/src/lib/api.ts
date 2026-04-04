import axios from 'axios'
import type {
  Employee, AttendanceRecord, AttendanceSummary,
  LeaveRequest, PayrollRecord, Department, Holiday,
  Reimbursement, Notification, SalaryStructure, SalaryComponent, SalaryPreview,
} from '@/types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const stored = localStorage.getItem('user')
      const slug = stored ? JSON.parse(stored)?.tenant_slug : null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = slug ? `/${slug}/login` : '/'
    }
    return Promise.reject(err)
  },
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string, tenantSlug: string) =>
    api.post('/auth/login', { username, password, tenant_slug: tenantSlug }).then((r) => r.data),
  registerTenant: (data: { company_name: string; admin_username: string; admin_email: string; password: string }) =>
    api.post('/auth/register-tenant', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
}

export const tenantApi = {
  getBySlug: (slug: string) => api.get(`/auth/tenant/${slug}`).then((r) => r.data) as Promise<{ id: number; name: string; slug: string }>,
}

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeeApi = {
  list: (params?: { is_active?: boolean; department_id?: number; search?: string }) =>
    api.get<Employee[]>('/employees/', { params }).then((r) => r.data),
  get: (id: number) => api.get<Employee>(`/employees/${id}`).then((r) => r.data),
  create: (data: Partial<Employee> & { pan?: string; aadhaar?: string; bank_account?: string }) =>
    api.post<Employee>('/employees/', data).then((r) => r.data),
  update: (id: number, data: Partial<Employee> & { pan?: string; aadhaar?: string; bank_account?: string }) =>
    api.put<Employee>(`/employees/${id}`, data).then((r) => r.data),
  deactivate: (id: number) => api.delete(`/employees/${id}`).then((r) => r.data),
  uploadDocument: (id: number, file: File, documentType: string) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/employees/${id}/documents?document_type=${documentType}`, form).then((r) => r.data)
  },
  departments: () => api.get<Department[]>('/employees/departments/list').then((r) => r.data),
}

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  list: (params?: { employee_id?: number; month?: number; year?: number }) =>
    api.get<AttendanceRecord[]>('/attendance/', { params }).then((r) => r.data),
  mark: (data: { employee_id: number; date: string; status: string; check_in?: string; check_out?: string; remarks?: string }) =>
    api.post<AttendanceRecord>('/attendance/', data).then((r) => r.data),
  bulkMark: (data: { date: string; records: { employee_id: number; status: string; check_in?: string; check_out?: string; remarks?: string }[] }) =>
    api.post<AttendanceRecord[]>('/attendance/bulk', data).then((r) => r.data),
  summary: (employeeId: number, month: number, year: number) =>
    api.get<AttendanceSummary>(`/attendance/summary/${employeeId}`, { params: { month, year } }).then((r) => r.data),
  holidays: (year: number) =>
    api.get<Holiday[]>('/attendance/holidays/', { params: { year } }).then((r) => r.data),
}

// ── Leaves ────────────────────────────────────────────────────────────────────
export const leaveApi = {
  list: (params?: { employee_id?: number; status?: string; month?: number; year?: number }) =>
    api.get<LeaveRequest[]>('/leaves/', { params }).then((r) => r.data),
  apply: (data: { leave_type: string; start_date: string; end_date: string; reason?: string }) =>
    api.post<LeaveRequest>('/leaves/', data).then((r) => r.data),
  adminApply: (employeeId: number, data: { leave_type: string; start_date: string; end_date: string; reason?: string }) =>
    api.post<LeaveRequest>(`/leaves/admin/apply?employee_id=${employeeId}`, data).then((r) => r.data),
  approve: (leaveId: number, status: 'approved' | 'rejected', rejectionReason?: string) =>
    api.put<LeaveRequest>(`/leaves/${leaveId}/approve`, { status, rejection_reason: rejectionReason }).then((r) => r.data),
  cancel: (leaveId: number) => api.put(`/leaves/${leaveId}/cancel`).then((r) => r.data),
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export const payrollApi = {
  list: (params?: { employee_id?: number; month?: number; year?: number; status?: string }) =>
    api.get<PayrollRecord[]>('/payroll/', { params }).then((r) => r.data),
  generate: (data: { employee_id: number; month: number; year: number; present_days?: number; lop_days?: number; other_earnings?: number; other_deductions?: number }) =>
    api.post<PayrollRecord>('/payroll/generate', data).then((r) => r.data),
  bulkGenerate: (data: { month: number; year: number; department_id?: number }) =>
    api.post('/payroll/bulk-generate', data).then((r) => r.data),
  finalize: (id: number) => api.put(`/payroll/${id}/finalize`).then((r) => r.data),
  downloadPayslip: (id: number) =>
    api.get(`/payroll/${id}/payslip`, { responseType: 'blob' }).then((r) => r.data),
}

// ── Salary Structures ─────────────────────────────────────────────────────────
export const salaryStructureApi = {
  list: () => api.get<SalaryStructure[]>('/salary-structures/').then((r) => r.data),
  get: (id: number) => api.get<SalaryStructure>(`/salary-structures/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post<SalaryStructure>('/salary-structures/', data).then((r) => r.data),
  update: (id: number, data: { name?: string; description?: string; is_active?: boolean }) =>
    api.put<SalaryStructure>(`/salary-structures/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/salary-structures/${id}`).then((r) => r.data),

  addComponent: (structureId: number, data: Partial<SalaryComponent>) =>
    api.post<SalaryComponent>(`/salary-structures/${structureId}/components`, data).then((r) => r.data),
  updateComponent: (structureId: number, componentId: number, data: Partial<SalaryComponent>) =>
    api.put<SalaryComponent>(`/salary-structures/${structureId}/components/${componentId}`, data).then((r) => r.data),
  deleteComponent: (structureId: number, componentId: number) =>
    api.delete(`/salary-structures/${structureId}/components/${componentId}`).then((r) => r.data),

  preview: (structureId: number, annualCtc: number) =>
    api.post<SalaryPreview>(`/salary-structures/${structureId}/preview`, { annual_ctc: annualCtc }).then((r) => r.data),
  assign: (employeeId: number, structureId: number, annualCtc: number) =>
    api.post('/salary-structures/assign', { employee_id: employeeId, structure_id: structureId, annual_ctc: annualCtc }).then((r) => r.data),
  removeAssignment: (employeeId: number) =>
    api.delete(`/salary-structures/assign/${employeeId}`).then((r) => r.data),
}

// ── Profile (employee self-service) ──────────────────────────────────────────
export const profileApi = {
  get: () => api.get<Employee>('/employees/me').then((r) => r.data),
  update: (data: { phone?: string; address?: string; city?: string; state?: string; pincode?: string; ifsc_code?: string; bank_name?: string; bank_account?: string }) =>
    api.put<Employee>('/employees/me', data).then((r) => r.data),
}

// ── Reimbursements ────────────────────────────────────────────────────────────
export const reimbursementApi = {
  list: (params?: { status?: string; employee_id?: number }) =>
    api.get<Reimbursement[]>('/reimbursements/', { params }).then((r) => r.data),
  create: (data: { category: string; amount: number; date: string; description?: string }) =>
    api.post<Reimbursement>('/reimbursements/', data).then((r) => r.data),
  review: (id: number, status: 'approved' | 'rejected', reviewer_comments?: string) =>
    api.put<Reimbursement>(`/reimbursements/${id}/review`, { status, reviewer_comments }).then((r) => r.data),
  cancel: (id: number) => api.delete(`/reimbursements/${id}`).then((r) => r.data),
  categories: () => api.get<string[]>('/reimbursements/categories').then((r) => r.data),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get<Notification[]>('/notifications/').then((r) => r.data),
  markRead: (id: number) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/mark-all-read').then((r) => r.data),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportApi = {
  payrollSummary: (month: number, year: number, departmentId?: number) =>
    api.get('/reports/payroll-summary', { params: { month, year, department_id: departmentId } }).then((r) => r.data),
  payrollCsv: (month: number, year: number, departmentId?: number) =>
    api.get('/reports/payroll-summary', { params: { month, year, department_id: departmentId, format: 'csv' }, responseType: 'blob' }).then((r) => r.data),
  attendanceSummary: (month: number, year: number, departmentId?: number) =>
    api.get('/reports/attendance-summary', { params: { month, year, department_id: departmentId } }).then((r) => r.data),
  attendanceCsv: (month: number, year: number, departmentId?: number) =>
    api.get('/reports/attendance-summary', { params: { month, year, department_id: departmentId, format: 'csv' }, responseType: 'blob' }).then((r) => r.data),
  leaveSummary: (year: number, departmentId?: number) =>
    api.get('/reports/leave-summary', { params: { year, department_id: departmentId } }).then((r) => r.data),
  leaveCsv: (year: number, departmentId?: number) =>
    api.get('/reports/leave-summary', { params: { year, department_id: departmentId, format: 'csv' }, responseType: 'blob' }).then((r) => r.data),
}
