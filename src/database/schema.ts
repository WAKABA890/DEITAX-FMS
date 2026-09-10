import { sqliteTable, text, real, integer, blob, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ===========================
// USERS & AUTHENTICATION
// ===========================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  username: text('username'),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  role: text('role').notNull(),
  pin: text('pin').notNull(),
  employeeId: text('employee_id'),
  department: text('department'),
  jobTitle: text('job_title'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  currentShiftId: text('current_shift_id'),
  assignedPumps: text('assigned_pumps'),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  lastLogin: text('last_login'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const userPermissions = sqliteTable('user_permissions', {
  userId: text('user_id').notNull().references(() => users.id),
  permission: text('permission').notNull(),
  grantedBy: text('granted_by').notNull().references(() => users.id),
  grantedAt: text('granted_at').notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.userId, table.permission] }),
}));

export const userPermissionOverrides = sqliteTable('user_permission_overrides', {
  userId: text('user_id').notNull().references(() => users.id),
  permission: text('permission').notNull(),
  granted: integer('granted', { mode: 'boolean' }).notNull(),
  updatedBy: text('updated_by').notNull().references(() => users.id),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.userId, table.permission] }),
}));

// ===========================
// FUEL PRODUCTS & INVENTORY
// ===========================
export const fuelProducts = sqliteTable('fuel_products', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  pricePerLiter: real('price_per_liter').notNull(),
  costPerLiter: real('cost_per_liter').notNull(),
  taxRate: real('tax_rate').notNull(),
  taxCode: text('tax_code').notNull().default('B'),
  unit: text('unit').notNull().default('L'),
  color: text('color').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const fuelTanks = sqliteTable('fuel_tanks', {
  id: text('id').primaryKey(),
  tankName: text('tank_name').notNull(),
  fuelProductId: text('fuel_product_id').notNull().references(() => fuelProducts.id),
  fuelName: text('fuel_name').notNull(),
  capacityLiters: real('capacity_liters').notNull(),
  currentLevelLiters: real('current_level_liters').notNull(),
  reorderLevelLiters: real('reorder_level_liters').notNull(),
  lastDipReading: real('last_dip_reading').notNull(),
  lastDipTime: text('last_dip_time'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const pumps = sqliteTable('pumps', {
  id: text('id').primaryKey(),
  pumpNumber: integer('pump_number').notNull().unique(),
  pumpName: text('pump_name').notNull(),
  status: text('status').notNull().default('Active'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const pumpNozzles = sqliteTable('pump_nozzles', {
  id: text('id').primaryKey(),
  physicalPumpId: text('physical_pump_id').references(() => pumps.id),
  nozzleNumber: integer('nozzle_number').notNull().default(1),
  nozzleName: text('nozzle_name'),
  pumpNumber: integer('pump_number').notNull(),
  pumpName: text('pump_name').notNull(),
  tankId: text('tank_id').notNull().references(() => fuelTanks.id),
  fuelProductId: text('fuel_product_id').notNull().references(() => fuelProducts.id),
  fuelName: text('fuel_name').notNull(),
  openingMeterReading: real('opening_meter_reading').notNull(),
  currentMeterReading: real('current_meter_reading').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const nozzleReadingHistory = sqliteTable('nozzle_reading_history', {
  id: text('id').primaryKey(),
  nozzleId: text('nozzle_id').notNull().references(() => pumpNozzles.id),
  pumpId: text('pump_id').references(() => pumps.id),
  tankId: text('tank_id').notNull().references(() => fuelTanks.id),
  fuelProductId: text('fuel_product_id').notNull().references(() => fuelProducts.id),
  shiftId: text('shift_id').references(() => shifts.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  previousReading: real('previous_reading').notNull(),
  quantityDispensed: real('quantity_dispensed').notNull().default(0),
  currentReading: real('current_reading').notNull(),
  readingType: text('reading_type').notNull(),
  recordedBy: text('recorded_by').references(() => users.id),
  timestamp: text('timestamp').notNull(),
});

// ===========================
// SHOP INVENTORY
// ===========================
export const shopItems = sqliteTable('shop_items', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unitPrice: real('unit_price').notNull(),
  price: real('price'),
  costPrice: real('cost_price').notNull(),
  stockQty: integer('stock_qty').notNull(),
  reorderLevel: integer('reorder_level').notNull(),
  requireShiftCount: integer('require_shift_count', { mode: 'boolean' }).notNull(),
  taxCode: text('tax_code'),
  taxType: text('tax_type').default('A'),
  country: text('country').default('KE'),
  currency: text('currency').default('KES'),
  productType: integer('product_type').default(1),
  unit: text('unit').default('Pieces'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// SHIFT MANAGEMENT
// ===========================
export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => users.id),
  staffName: text('staff_name').notNull(),
  staffRole: text('staff_role').notNull(),
  shiftType: text('shift_type').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').notNull(),
  openingCash: real('opening_cash').notNull(),
  closingCash: real('closing_cash'),
  openingPumpReadingsJson: text('opening_pump_readings_json'),
  openingTankDipsJson: text('opening_tank_dips_json'),
  closingPumpReadingsJson: text('closing_pump_readings_json'),
  closingTankDipsJson: text('closing_tank_dips_json'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const shiftSchedules = sqliteTable('shift_schedules', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => users.id),
  staffName: text('staff_name').notNull(),
  role: text('role').notNull(),
  shiftType: text('shift_type').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const shiftPlans = sqliteTable('shift_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shiftType: text('shift_type').notNull(),
  scheduledStart: text('scheduled_start').notNull(),
  scheduledEnd: text('scheduled_end').notNull(),
  status: text('status').notNull().default('Scheduled'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  recurrenceId: text('recurrence_id'),
});

export const shiftRecurrences = sqliteTable('shift_recurrences', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shiftType: text('shift_type').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  weekdaysJson: text('weekdays_json').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const shiftAssignments = sqliteTable('shift_assignments', {
  id: text('id').primaryKey(),
  shiftPlanId: text('shift_plan_id').notNull().references(() => shiftPlans.id),
  userId: text('user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('Assigned'),
  assignedAt: text('assigned_at').notNull(),
  assignedBy: text('assigned_by').notNull().references(() => users.id),
  removedAt: text('removed_at'),
  removedBy: text('removed_by').references(() => users.id),
  clockInShiftId: text('clock_in_shift_id').references(() => shifts.id),
  clockInTime: text('clock_in_time'),
  clockOutTime: text('clock_out_time'),
});

export const readingVariances = sqliteTable('reading_variances', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => shifts.id),
  readingType: text('reading_type').notNull(),
  tankId: text('tank_id').notNull().references(() => fuelTanks.id),
  nozzleId: text('nozzle_id').references(() => pumpNozzles.id),
  reportedValue: real('reported_value').notNull(),
  authoritativeValue: real('authoritative_value').notNull(),
  variance: real('variance').notNull(),
  status: text('status').notNull().default('Review Required'),
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  recordedAt: text('recorded_at').notNull(),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: text('reviewed_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolvedAt: text('resolved_at'),
  resolutionNotes: text('resolution_notes'),
});

// ===========================
// SALES & TRANSACTIONS
// ===========================
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  pumpId: text('pump_id'),
  nozzleId: text('nozzle_id').references(() => pumpNozzles.id),
  itemsJson: text('items_json'),
  productId: text('product_id').references(() => fuelProducts.id),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  subtotal: real('subtotal').notNull(),
  tax: real('tax').notNull(),
  totalAmount: real('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  attendantId: text('attendant_id').references(() => users.id),
  attendantName: text('attendant_name'),
  meterReadingBefore: real('meter_reading_before'),
  meterReadingAfter: real('meter_reading_after'),
  receiptNumber: text('receipt_number').unique(),
  invoiceNumber: text('invoice_number').unique(),
  documentType: text('document_type').notNull().default('Receipt'),
  customerName: text('customer_name'),
  customerPin: text('customer_pin'),
  vehiclePlate: text('vehicle_plate'),
  status: text('status').notNull().default('Completed'),
  shiftId: text('shift_id').references(() => shifts.id),
  customerId: text('customer_id').references(() => customers.id),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documentCounters = sqliteTable('document_counters', {
  documentType: text('document_type').primaryKey(),
  lastNumber: integer('last_number').notNull().default(0),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// CUSTOMERS & CREDIT
// ===========================
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  businessName: text('business_name').notNull(),
  contactPerson: text('contact_person').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  address: text('address'),
  accountType: text('account_type').notNull(),
  creditLimit: real('credit_limit').notNull(),
  currentDebt: real('current_debt').notNull().default(0),
  status: text('status').notNull().default('Active'),
  taxId: text('tax_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const creditNotes = sqliteTable('credit_notes', {
  id: text('id').primaryKey(),
  creditNoteNo: text('credit_note_no'),
  customerId: text('customer_id').references(() => customers.id),
  customerName: text('customer_name'),
  customerPin: text('customer_pin'),
  vehiclePlate: text('vehicle_plate'),
  amount: real('amount'),
  subtotal: real('subtotal'),
  taxAmount: real('tax_amount'),
  totalAmount: real('total_amount'),
  reason: text('reason'),
  narration: text('narration'),
  status: text('status').notNull(),
  itemsJson: text('items_json'),
  originalTransactionId: text('original_transaction_id'),
  originalDocumentType: text('original_document_type'),
  originalDocumentNo: text('original_document_no'),
  originalInvoiceNo: text('original_invoice_no'),
  originalReceiptNo: text('original_receipt_no'),
  issuedBy: text('issued_by').references(() => users.id),
  issuedByName: text('issued_by_name'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedByName: text('approved_by_name'),
  appliedToTransactionId: text('applied_to_transaction_id'),
  timestamp: text('timestamp'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// SUPPLIERS & PAYMENTS
// ===========================
export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  supplierName: text('supplier_name').notNull(),
  contactPerson: text('contact_person').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  address: text('address'),
  paymentTerms: text('payment_terms'),
  accountBalance: real('account_balance').notNull().default(0),
  status: text('status').notNull().default('Active'),
  taxId: text('tax_id'),
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const supplierPayments = sqliteTable('supplier_payments', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  referenceNumber: text('reference_number'),
  date: text('date').notNull(),
  approvedBy: text('approved_by').references(() => users.id),
  approvedByName: text('approved_by_name'),
  notes: text('notes'),
  status: text('status').notNull().default('Completed'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// FUEL DELIVERIES & STOCK
// ===========================
export const fuelDeliveries = sqliteTable('fuel_deliveries', {
  id: text('id').primaryKey(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  supplierName: text('supplier_name').notNull(),
  tankId: text('tank_id').notNull().references(() => fuelTanks.id),
  fuelProductId: text('fuel_product_id').notNull().references(() => fuelProducts.id),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalCost: real('total_cost').notNull(),
  openingLevel: real('opening_level'),
  closingLevel: real('closing_level'),
  deliveryDate: text('delivery_date').notNull(),
  deliveryTime: text('delivery_time'),
  invoiceNumber: text('invoice_number'),
  driverName: text('driver_name'),
  driverPhone: text('driver_phone'),
  vehicleReg: text('vehicle_reg'),
  receivedBy: text('received_by').references(() => users.id),
  receivedByName: text('received_by_name'),
  status: text('status').notNull().default('Pending'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const stockAdjustments = sqliteTable('stock_adjustments', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  referenceId: text('reference_id').notNull(),
  referenceName: text('reference_name').notNull(),
  previousQuantity: real('previous_quantity').notNull(),
  adjustmentQuantity: real('adjustment_quantity').notNull(),
  newQuantity: real('new_quantity').notNull(),
  reason: text('reason').notNull(),
  movementType: text('movement_type'),
  source: text('source').default('Manual Adjustment'),
  referenceNumber: text('reference_number'),
  originalDocumentNumber: text('original_document_number'),
  productCode: text('product_code'),
  performedBy: text('performed_by'),
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  recordedByName: text('recorded_by_name').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// FINANCIAL RECORDS
// ===========================
export const cashFlowRecords = sqliteTable('cash_flow_records', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  accountingMethod: text('accounting_method').notNull(),
  referenceNo: text('reference_no'), // ✅ ADDED
  relatedTransactionId: text('related_transaction_id'),
  relatedDeliveryId: text('related_delivery_id'),
  relatedPaymentId: text('related_payment_id'),
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  recordedByName: text('recorded_by_name').notNull(),
  approvedBy: text('approved_by').references(() => users.id),
  approvedByName: text('approved_by_name'),
  notes: text('notes'),
  status: text('status').notNull().default('Recorded'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// RECONCILIATION
// ===========================
export const reconciliations = sqliteTable('reconciliations', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  shiftId: text('shift_id').references(() => shifts.id),
  staffId: text('staff_id').notNull().references(() => users.id),
  staffName: text('staff_name').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  tankDipBefore: real('tank_dip_before'),
  tankDipAfter: real('tank_dip_after'),
  tankExpectedLiters: real('tank_expected_liters'),
  tankActualLiters: real('tank_actual_liters'),
  tankVariance: real('tank_variance'),
  pumpMeterBefore: real('pump_meter_before'),
  pumpMeterAfter: real('pump_meter_after'),
  pumpExpectedLiters: real('pump_expected_liters'),
  pumpActualLiters: real('pump_actual_liters'),
  pumpVariance: real('pump_variance'),
  cashExpected: real('cash_expected'),
  cashActual: real('cash_actual'),
  cashVariance: real('cash_variance'),
  varianceNotes: text('variance_notes'),
  status: text('status').notNull().default('Pending'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedByName: text('approved_by_name'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// APPROVALS & WORKFLOW
// ===========================
export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  referenceId: text('reference_id').notNull(),
  description: text('description').notNull(),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  requestedByName: text('requested_by_name').notNull(),
  requestedAt: text('requested_at').default(sql`CURRENT_TIMESTAMP`),
  details: blob('details'),
  status: text('status').notNull().default('Pending'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedByName: text('approved_by_name'),
  approvedAt: text('approved_at'),
  approvalNotes: text('approval_notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// STATION SETTINGS
// ===========================
export const stationSettings = sqliteTable('station_settings', {
  id: text('id').primaryKey().default('station-1'),
  stationName: text('station_name').notNull(),
  tagline: text('tagline'),
  taxPin: text('tax_pin').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  invoiceTerms: text('invoice_terms'),
  paybillNumber: text('paybill_number'),
  paybillAccountNumber: text('paybill_account_number'),
  tillNumber: text('till_number'),
  showPaybillOnInvoice: integer('show_paybill_on_invoice', { mode: 'boolean' }).notNull().default(true),
  showTillOnInvoice: integer('show_till_on_invoice', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ===========================
// AUDIT & LOGGING
// ===========================
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  userId: text('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(),
  details: text('details').notNull(),
  ipAddress: text('ip_address').notNull(),
  severity: text('severity').notNull().default('Info'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// =========================================================
// NEW TABLE: MANAGER APPROVALS (added to persist approvals)
// =========================================================
export const managerApprovals = sqliteTable('manager_approvals', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  shiftId: text('shift_id').references(() => shifts.id),
  type: text('type').notNull(),
  requestedBy: text('requested_by').notNull(),
  reason: text('reason').notNull(),
  amountOrQty: text('amount_or_qty').notNull(),
  status: text('status').notNull().default('Pending'),
  managerId: text('manager_id').references(() => users.id),
  managerNotes: text('manager_notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
