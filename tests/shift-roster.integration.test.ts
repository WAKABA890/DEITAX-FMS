import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const port = 3117;
const databasePath = path.join(process.cwd(), 'data', `shift-roster-integration-${randomUUID()}.db`);
const baseUrl = `http://localhost:${port}/api`;
const dueShiftStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const dueShiftEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();

if (existsSync(databasePath)) rmSync(databasePath);

let server: ReturnType<typeof spawn>;
let serverOutput = '';
const startServer = () => {
  serverOutput = '';
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      VITE_HMR_PORT: '24717',
      FMS_DB_PATH: databasePath,
      DISABLE_HMR: 'true',
    },
    stdio: 'pipe',
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
};
startServer();

const waitForServer = async () => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Integration server did not start. ${serverOutput}`);
};

const request = async (endpoint: string, options: RequestInit = {}, cookie?: string) => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });
  return { response, body: await response.json().catch(() => null) };
};

const login = async (userId: string, pin: string) => {
  const { response, body } = await request('/auth/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ userId, pin }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'Expected authentication cookie.');
  return { user: body.user, cookie: cookie!.split(';')[0] };
};

try {
  await waitForServer();

  const bootstrap = await request('/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Roster Admin', email: 'admin@example.test', phone: '0700000000', pin: '1234' }),
  });
  assert.equal(bootstrap.response.status, 200);
  let admin = await login(bootstrap.body.id, '1234');

  const rolesDatabase = new Database(databasePath);
  rolesDatabase.prepare(`INSERT INTO custom_roles (name, description, active, created_by, created_at, updated_at)
    VALUES ('Roster Attendant', 'Integration-test operational role', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
    .run(admin.user.id);
  rolesDatabase.close();

  const newUser = await request('/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Roster User', email: 'user@example.test', phone: '0700000001', pin: '4321', role: 'Roster Attendant' }),
  }, admin.cookie);
  assert.equal(newUser.response.status, 200);
  let normalUser = await login(newUser.body.id, '4321');

  const inventoryDatabase = new Database(databasePath);
  inventoryDatabase.exec(`
    INSERT INTO fuel_products (id, code, name, price_per_liter, cost_per_liter, tax_rate, tax_code, unit, color)
    VALUES ('fuel-1', 'PET-01', 'Petrol', 170, 150, 0.16, 'B', 'L', '#10b981');
    INSERT INTO fuel_tanks (id, tank_name, fuel_product_id, fuel_name, capacity_liters, current_level_liters, reorder_level_liters, last_dip_reading)
    VALUES ('tank-1', 'Tank 1', 'fuel-1', 'Petrol', 10000, 5000, 1000, 5000);
    INSERT INTO pump_nozzles (id, pump_number, pump_name, tank_id, fuel_product_id, fuel_name, opening_meter_reading, current_meter_reading, status)
    VALUES ('nozzle-1', 1, 'Pump 1 / Nozzle 1', 'tank-1', 'fuel-1', 'Petrol', 1000, 1000, 'Active');
    INSERT INTO shop_items (id, code, name, category, unit_price, cost_price, stock_qty, reorder_level, require_shift_count)
    VALUES ('shop-1', 'WATER-01', 'Water', 'Drinks', 50, 30, 20, 5, 0);
  `);
  inventoryDatabase.close();
  server.kill('SIGTERM');
  await new Promise<void>((resolve) => server.once('exit', () => resolve()));
  startServer();
  await waitForServer();
  admin = await login(admin.user.id, '1234');
  normalUser = await login(normalUser.user.id, '4321');

  const unauthenticatedClockIn = await request('/shifts/clock-in', {
    method: 'POST',
    body: JSON.stringify({ userId: admin.user.id, pin: '1234', shiftType: 'Morning', openingCash: 0 }),
  });
  assert.equal(unauthenticatedClockIn.response.status, 401);

  const createPlan = await request('/shift-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Morning Roster',
      shiftType: 'Morning',
      scheduledStart: dueShiftStart,
      scheduledEnd: dueShiftEnd,
      userIds: [admin.user.id],
    }),
  }, admin.cookie);
  assert.equal(createPlan.response.status, 201);
  const planId = createPlan.body.id;
  assert.equal(createPlan.body.assignments.length, 1);
  assert.equal(createPlan.body.assignments[0].status, 'Due');

  const orphanedPlan = await request('/shift-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Legacy Orphaned Attendance',
      shiftType: 'Night',
      scheduledStart: '2020-01-01T22:00:00.000Z',
      scheduledEnd: '2020-01-02T06:00:00.000Z',
      userIds: [admin.user.id],
    }),
  }, admin.cookie);
  assert.equal(orphanedPlan.response.status, 201);
  const orphanedAssignmentId = orphanedPlan.body.assignments[0].id;
  const orphanedAttendanceDatabase = new Database(databasePath);
  orphanedAttendanceDatabase.prepare('UPDATE shift_assignments SET clock_in_time = ? WHERE id = ?')
    .run('2020-01-01T22:00:00.000Z', orphanedAssignmentId);
  orphanedAttendanceDatabase.close();
  const lifecycleRoster = await request('/shift-plans', {}, admin.cookie);
  assert.equal(lifecycleRoster.response.status, 200);
  const orphanedAssignment = lifecycleRoster.body.find((plan: any) => plan.id === orphanedPlan.body.id).assignments[0];
  assert.equal(orphanedAssignment.status, 'Stale', 'An orphaned legacy clock-in timestamp must not count as attendance.');

  const recurrenceStart = new Date();
  const recurrenceEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const recurringRoster = await request('/shift-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Recurring Coverage Roster',
      shiftType: 'Morning',
      scheduleMode: 'recurring',
      recurrenceStartDate: recurrenceStart.toISOString().slice(0, 10),
      recurrenceEndDate: recurrenceEnd.toISOString().slice(0, 10),
      recurrenceWeekdays: [0, 1, 2, 3, 4, 5, 6],
      dailyStartTime: '06:00',
      dailyEndTime: '14:00',
      userIds: [admin.user.id],
    }),
  }, admin.cookie);
  assert.equal(recurringRoster.response.status, 201);
  assert.ok(recurringRoster.body.recurrenceId, 'Expected generated roster occurrence to link to a recurrence master.');
  const recurringId = recurringRoster.body.recurrenceId;
  const recurringPlans = (await request('/shift-plans', {}, admin.cookie)).body.filter((plan: any) => plan.recurrenceId === recurringId);
  assert.equal(recurringPlans.length, 3, 'Expected one persisted occurrence per day in the recurrence period.');
  assert.equal(new Set(recurringPlans.map((plan: any) => plan.scheduledStart)).size, 3, 'Recurring occurrences must have unique scheduled starts.');
  const refreshedRecurringPlans = (await request('/shift-plans', {}, admin.cookie)).body.filter((plan: any) => plan.recurrenceId === recurringId);
  assert.equal(refreshedRecurringPlans.length, 3, 'Reading roster data must not generate duplicate occurrences.');
  const statusSchedules = await request('/schedules', {}, admin.cookie);
  const statusCounts = statusSchedules.body.reduce((counts: Record<string, number>, schedule: any) => {
    counts[schedule.status] = (counts[schedule.status] || 0) + 1;
    return counts;
  }, {});
  assert.equal(Object.values(statusCounts).reduce((sum: number, count: any) => sum + Number(count), 0), statusSchedules.body.length);

  const normalCreateAttempt = await request('/shift-plans', {
    method: 'POST',
    body: JSON.stringify({ name: 'Blocked', shiftType: 'Night', scheduledStart: '2026-08-22T22:00:00.000Z', scheduledEnd: '2026-08-23T06:00:00.000Z', userIds: [] }),
  }, normalUser.cookie);
  assert.equal(normalCreateAttempt.response.status, 403);

  const delegatedPlan = await request('/shift-plans', {
    method: 'POST',
    body: JSON.stringify({ name: 'Delegated Shift', shiftType: 'Afternoon', scheduledStart: '2026-08-21T14:00:00.000Z', scheduledEnd: '2026-08-21T22:00:00.000Z', userIds: [] }),
  }, admin.cookie);
  assert.equal(delegatedPlan.response.status, 201);

  const delegatedStockAttempt = await request('/stock/adjustments', {
    method: 'POST',
    body: JSON.stringify({ type: 'Shop', itemId: 'shop-1', newQty: 10, reason: 'Unauthorized test' }),
  }, normalUser.cookie);
  assert.equal(delegatedStockAttempt.response.status, 403);

  const retiredScheduleAttempt = await request('/schedules', { method: 'POST', body: JSON.stringify({}) }, admin.cookie);
  assert.equal(retiredScheduleAttempt.response.status, 410);

  const addUser = await request(`/shift-plans/${planId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ userId: normalUser.user.id }),
  }, admin.cookie);
  assert.equal(addUser.response.status, 201);
  assert.equal(addUser.body.assignments.length, 2);

  const duplicateUser = await request(`/shift-plans/${planId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ userId: normalUser.user.id }),
  }, admin.cookie);
  assert.equal(duplicateUser.response.status, 409);

  // The schedules screen is a roster projection. It must expose the owning
  // roster ID so its delete action can use the supported assignment endpoint.
  const projectedSchedules = await request('/schedules', {}, admin.cookie);
  assert.equal(projectedSchedules.response.status, 200);
  const normalUserSchedule = projectedSchedules.body.find((schedule: any) => schedule.staffId === normalUser.user.id);
  assert.equal(normalUserSchedule.shiftPlanId, planId);
  assert.ok(normalUserSchedule.assignmentId);
  const removeProjectedSchedule = await request(`/shift-plans/${normalUserSchedule.shiftPlanId}/assignments/${normalUserSchedule.staffId}`, { method: 'DELETE' }, admin.cookie);
  assert.equal(removeProjectedSchedule.response.status, 200);
  assert.equal(removeProjectedSchedule.body.assignments.find((assignment: any) => assignment.userId === normalUser.user.id).status, 'Cancelled');

  const unauthorizedPlanRead = await request('/shift-plans');
  assert.equal(unauthorizedPlanRead.response.status, 401);

  const unassignedClockIn = await request('/shifts/clock-in', {
    method: 'POST',
    body: JSON.stringify({ userId: normalUser.user.id, pin: '4321', shiftType: 'Morning', openingCash: 0, shiftPlanId: 'missing-plan' }),
  }, normalUser.cookie);
  assert.equal(unassignedClockIn.response.status, 403);

  const impersonatedClockIn = await request('/shifts/clock-in', {
    method: 'POST',
    body: JSON.stringify({ userId: admin.user.id, pin: '1234', shiftType: 'Morning', openingCash: 0, shiftPlanId: planId }),
  }, normalUser.cookie);
  assert.equal(impersonatedClockIn.response.status, 403);

  const clockIn = await request('/shifts/clock-in', {
    method: 'POST',
    body: JSON.stringify({
      userId: admin.user.id,
      pin: '1234',
      shiftType: 'Morning',
      openingCash: 0,
      openingPumpReadings: [{ pumpId: 'nozzle-1', pumpName: 'Pump 1 / Nozzle 1', fuelName: 'Petrol', openingMeter: 900 }],
      openingTankDips: [{ tankId: 'tank-1', tankName: 'Tank 1', fuelName: 'Petrol', openingDip: 4900 }],
      shiftPlanId: planId,
    }),
  }, admin.cookie);
  assert.equal(clockIn.response.status, 200);
  const sessionId = clockIn.body.id;

  const observationDatabase = new Database(databasePath, { readonly: true });
  assert.equal((observationDatabase.prepare('SELECT current_level_liters FROM fuel_tanks WHERE id = ?').get('tank-1') as { current_level_liters: number }).current_level_liters, 5000);
  assert.equal((observationDatabase.prepare('SELECT current_meter_reading FROM pump_nozzles WHERE id = ?').get('nozzle-1') as { current_meter_reading: number }).current_meter_reading, 1000);
  assert.equal((observationDatabase.prepare('SELECT COUNT(*) AS count FROM reading_variances WHERE shift_id = ?').get(sessionId) as { count: number }).count, 2);
  observationDatabase.close();

  const directDipObservation = await request('/tanks/dip', {
    method: 'POST',
    body: JSON.stringify({ tankId: 'tank-1', dipReadingLiters: 4800 }),
  }, admin.cookie);
  assert.equal(directDipObservation.response.status, 200);
  assert.equal(directDipObservation.body.currentLevelLiters, 5000);
  const directDipDatabase = new Database(databasePath, { readonly: true });
  assert.equal((directDipDatabase.prepare('SELECT current_level_liters FROM fuel_tanks WHERE id = ?').get('tank-1') as { current_level_liters: number }).current_level_liters, 5000);
  assert.equal((directDipDatabase.prepare('SELECT COUNT(*) AS count FROM reading_variances WHERE shift_id = ?').get(sessionId) as { count: number }).count, 3);
  directDipDatabase.close();

  const variances = await request('/reading-variances', {}, admin.cookie);
  assert.equal(variances.response.status, 200);
  const tankVariance = variances.body.records.find((variance: any) => variance.reading_type === 'Tank Dip');
  assert.ok(tankVariance);
  const normalResolveAttempt = await request(`/reading-variances/${tankVariance.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolutionNotes: 'Not permitted' }) }, normalUser.cookie);
  assert.equal(normalResolveAttempt.response.status, 403);
  const adminResolve = await request(`/reading-variances/${tankVariance.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolutionNotes: 'Investigated without stock change.' }) }, admin.cookie);
  assert.equal(adminResolve.response.status, 200);
  const resolvedObservationDatabase = new Database(databasePath, { readonly: true });
  assert.equal((resolvedObservationDatabase.prepare('SELECT current_level_liters FROM fuel_tanks WHERE id = ?').get('tank-1') as { current_level_liters: number }).current_level_liters, 5000);
  resolvedObservationDatabase.close();

  const fuelSale = await request('/sales', {
    method: 'POST',
    body: JSON.stringify({
      shiftId: sessionId,
      staffId: normalUser.user.id,
      staffName: normalUser.user.name,
      type: 'Fuel',
      paymentMethod: 'Cash',
      items: [{ itemId: 'fuel-1', pumpId: 'nozzle-1', nozzleId: 'nozzle-1', name: 'Petrol', type: 'Fuel', qty: 1, unitPrice: 170 }],
    }),
  }, admin.cookie);
  assert.equal(fuelSale.response.status, 200);

  const shopSale = await request('/sales', {
    method: 'POST',
    body: JSON.stringify({
      shiftId: sessionId,
      staffId: normalUser.user.id,
      staffName: normalUser.user.name,
      type: 'Shop',
      paymentMethod: 'Cash',
      items: [{ itemId: 'shop-1', name: 'Water', type: 'Shop', qty: 1, unitPrice: 50 }],
    }),
  }, admin.cookie);
  assert.equal(shopSale.response.status, 200);

  const removeParticipatingUser = await request(`/shift-plans/${planId}/assignments/${admin.user.id}`, { method: 'DELETE' }, admin.cookie);
  assert.equal(removeParticipatingUser.response.status, 200);
  const preservedAssignment = removeParticipatingUser.body.assignments.find((assignment: any) => assignment.userId === admin.user.id);
  assert.equal(preservedAssignment.status, 'Cancelled');
  assert.equal(preservedAssignment.clockInShiftId, sessionId);

  const clockOut = await request('/reconciliations', {
    method: 'POST',
    body: JSON.stringify({
      shiftId: sessionId,
      staffId: admin.user.id,
      staffName: admin.user.name,
      cashCount: {},
      pumpReadings: [],
      tankDips: [],
    }),
  }, admin.cookie);
  assert.equal(clockOut.response.status, 200);

  const roster = await request('/shift-plans', {}, admin.cookie);
  assert.equal(roster.response.status, 200);
  const completedAssignment = roster.body.find((plan: any) => plan.id === planId).assignments.find((assignment: any) => assignment.userId === admin.user.id);
  assert.ok(completedAssignment.clockOutTime, 'Expected clock-out time on retained assignment.');

  const auditApi = await request('/audit-logs?pageSize=100', {}, admin.cookie);
  assert.equal(auditApi.response.status, 200);
  assert.equal(auditApi.body.pageSize, 100);
  assert.ok(Array.isArray(auditApi.body.records));
  for (const action of ['SHIFT_CREATED', 'SHIFT_USER_ASSIGNED', 'SHIFT_USER_REMOVED', 'SHIFT_CLOCK_IN', 'SHIFT_CLOCK_OUT']) {
    assert.ok(auditApi.body.records.some((log: any) => log.action === action), `Missing ${action} from audit API.`);
  }

  const auditMutation = await request('/audit-logs/anything', { method: 'DELETE' }, admin.cookie);
  assert.equal(auditMutation.response.status, 404);

  const sqlite = new Database(databasePath, { readonly: true });
  for (const action of ['SHIFT_CREATED', 'SHIFT_USER_ASSIGNED', 'SHIFT_USER_REMOVED', 'SHIFT_CLOCK_IN', 'SHIFT_CLOCK_OUT']) {
    const expectedCount = action === 'SHIFT_CREATED' ? 4 : action === 'SHIFT_USER_REMOVED' ? 2 : 1;
    assert.equal((sqlite.prepare('SELECT COUNT(*) AS count FROM audit_logs WHERE action = ?').get(action) as { count: number }).count, expectedCount);
  }
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS count FROM shift_assignments WHERE shift_plan_id = ? AND user_id = ?').get(planId, normalUser.user.id) as { count: number }).count, 1);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS count FROM transactions WHERE shift_id = ?').get(sessionId) as { count: number }).count, 2);
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS count FROM nozzle_reading_history WHERE shift_id = ? AND reading_type = ?').get(sessionId, 'Opening') as { count: number }).count, 0);
  assert.equal((sqlite.prepare('SELECT attendant_id FROM transactions WHERE id = ?').get(fuelSale.body.id) as { attendant_id: string }).attendant_id, admin.user.id);
  sqlite.close();

  console.log('Shift roster integration checks passed.');
} finally {
  if (!server.killed) {
    server.kill('SIGTERM');
    await new Promise<void>((resolve) => server.once('exit', () => resolve()));
  }
  for (const pathToRemove of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    try {
      if (existsSync(pathToRemove)) rmSync(pathToRemove, { force: true });
    } catch {
      // Windows can retain a closed SQLite handle briefly; this test database is isolated.
    }
  }
}
