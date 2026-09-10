import type Database from 'better-sqlite3';

const requiredColumns: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'role', 'active'], fuel_products: ['id', 'name', 'code'],
  fuel_tanks: ['id', 'tank_name', 'fuel_product_id', 'fuel_name'], pumps: ['id', 'pump_number', 'pump_name', 'status'],
  pump_nozzles: ['id', 'physical_pump_id', 'nozzle_number', 'fuel_product_id', 'tank_id'], shifts: ['id', 'staff_id', 'start_time', 'end_time'],
  transactions: ['id', 'shift_id', 'product_id', 'nozzle_id'], cash_flow_records: ['id', 'date', 'type', 'category', 'amount', 'reference_no'],
  customers: ['id', 'tax_id'], suppliers: ['id', 'supplier_name', 'tax_id'],
};

export function validateDatabaseSchema(sqlite: Database.Database) {
  const failures: string[] = [];
  console.log('[DB] Schema validation started');
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const actual = new Set((sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name));
    if (!actual.size) { failures.push(`Table ${table} is missing`); continue; }
    for (const column of columns) if (!actual.has(column)) failures.push(`Table ${table} is missing column ${column}`);
  }
  if (sqlite.pragma('integrity_check', { simple: true }) !== 'ok') failures.push('integrity_check failed');
  if ((sqlite.pragma('foreign_key_check') as unknown[]).length) failures.push('foreign_key_check found violations');
  if (sqlite.prepare(`SELECT physical_pump_id FROM pump_nozzles WHERE physical_pump_id IS NOT NULL AND physical_pump_id <> '' GROUP BY physical_pump_id, nozzle_number HAVING COUNT(*) > 1`).all().length) failures.push('pump_nozzles has duplicate physical pump/nozzle numbers');
  sqlite.prepare('SELECT reference_no FROM cash_flow_records LIMIT 1').all();
  if (failures.length) throw new Error(`Database schema validation failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  console.log('[DB] Schema validation passed');
}
