import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import {
  User,
  FuelProduct,
  FuelTank,
  FuelPump,
  PumpNozzle,
  ShopItem,
  ShiftSession,
  Transaction,
  ThreeWayReconciliation,
  FuelDelivery,
  ManagerApproval,
  AuditLog,
  ShiftSchedule,
  ShiftPlan,
  StationSettings as StationSettingsType,
  CreditNote,
  CustomerAccount,
  CashFlowRecord,
  SupplierAccount,
  SupplierPayment,
  StockAdjustment,
  Permission,
} from './types';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';
import { PointOfSale } from './components/PointOfSale';
import { ShiftManagement } from './components/ShiftManagement';
import { PumpsAndTanks } from './components/PumpsAndTanks';
import { ReconciliationLedger } from './components/ReconciliationLedger';
import { CashFlowLedger } from './components/CashFlowLedger';
import { ManagerApprovals } from './components/ManagerApprovals';
import { ShopInventory } from './components/ShopInventory';
import { InvoicesAndReceipts } from './components/InvoicesAndReceipts';
import { SuppliersManagement } from './components/SuppliersManagement';
import { StockManagement } from './components/StockManagement';
import { StationSettings } from './components/StationSettings';
import { AuditTrail } from './components/AuditTrail';
import { Reports } from './components/Reports';
import { ReceiptModal } from './components/ReceiptModal';
import { UserManagement } from './components/UserManagement';
import { Fuel, AlertTriangle, LogOut, Moon, Sun } from 'lucide-react';
import { canAccessModule } from './types';
import type { DashboardSalesSummary } from './utils/sales-summary';
import { usePermissions } from './hooks/usePermissions';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFmsTheme } from './hooks/useFmsTheme';
import { AppDialog } from './components/AppDialog';

export default function App() {
  const { colorMode, setColorMode } = useFmsTheme();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showSignup, setShowSignup] = useState(false);
  const [passwordResetCurrentPin, setPasswordResetCurrentPin] = useState('');
  const [passwordResetNewPin, setPasswordResetNewPin] = useState('');
  const [passwordResetConfirmPin, setPasswordResetConfirmPin] = useState('');
  const [passwordResetError, setPasswordResetError] = useState('');
  const [passwordResetSaving, setPasswordResetSaving] = useState(false);

  // App Data State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authRestoring, setAuthRestoring] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const result = await api.getCurrentUser();

        if (result.authenticated && result.user) {
          setCurrentUser(result.user);
        }
      } catch (error) {
        console.warn('Could not restore login session:', error);
        // A transient server restart must not overwrite an in-memory session
        // with an empty user. The login screen is shown only after restoration.
      } finally {
        setAuthRestoring(false);
      }
    };

    restoreSession();
  }, []);

  const [products, setProducts] = useState<FuelProduct[]>([]);
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [pumps, setPumps] = useState<PumpNozzle[]>([]);
  const [pumpUnits, setPumpUnits] = useState<FuelPump[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shifts, setShifts] = useState<ShiftSession[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reconciliations, setReconciliations] = useState<ThreeWayReconciliation[]>([]);
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([]);
  const [approvals, setApprovals] = useState<ManagerApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<StationSettingsType | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierAccount[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSalesSummary | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Modals
  const [activeReceiptTx, setActiveReceiptTx] = useState<Transaction | null>(null);
  const [ledgerShiftId, setLedgerShiftId] = useState<string | null>(null);
  const [dipTankModal, setDipTankModal] = useState<FuelTank | null>(null);
  const [dipReadingInput, setDipReadingInput] = useState<number>(0);

  const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

  // ✅ usePermissions called inside the component
  const { hasPermission, canManageUsers, canManageSettings, canViewAudit, canManageStock, canManagePumps, canManageShop } = usePermissions(currentUser);

  // ✅ canAccessTab defined inside the component
  const canAccessTab = (tabId: string) => {
    if (!currentUser) return false;

    const tabViewPermissions: Record<string, Permission> = {
      users: 'VIEW_USERS',
      settings: 'VIEW_SETTINGS',
      audit: 'VIEW_AUDIT_TRAIL',
      stock: 'VIEW_STOCK',
      pumps: 'VIEW_PUMPS',
      shop: 'VIEW_SHOP',
      reports: 'VIEW_REPORTS',
      cashflow: 'VIEW_CASH_FLOW',
      suppliers: 'VIEW_SUPPLIERS',
      reconciliation: 'VIEW_THREE_WAY_LEDGER',
      approvals: 'VIEW_APPROVALS',
      invoices: 'VIEW_INVOICES',
      shifts: 'VIEW_SHIFT_USERS',
    };

    const required = tabViewPermissions[tabId];
    if (!required) return true; // dashboard, pos are always open
    return hasPermission(required);
  };

  // Load Initial Data from API
  const refreshData = async () => {
    if (!currentUser) {
      try {
        const bootstrap = await api.getBootstrapStatus();
        setUsers(bootstrap.hasUsers ? [{} as User] : []);
      } finally {
        setDataLoaded(true);
      }
      return;
    }
    try {
      const [
        uList,
        pList,
        tList,
        pmpList,
        pumpUnitList,
        sList,
        shftList,
        schList,
        shiftPlanList,
        txList,
        recList,
        delList,
        apprList,
        logList,
        stgData,
        cnList,
        cList,
        cfList,
        supList,
        adjList,
        summary,
      ] = await Promise.all([
        api.getUsers(),
        api.getProducts(),
        api.getTanks(),
        api.getPumps(),
        api.getPumpUnits(),
        api.getShopItems(),
        api.getShifts(),
        api.getSchedules(),
        api.getShiftPlans(),
        api.getSales(),
        api.getReconciliations(),
        api.getDeliveries(),
        api.getApprovals(),
        api.getAuditLogs(),
        api.getSettings(),
        api.getCreditNotes(),
        api.getCustomers(),
        api.getCashFlow(),
        api.getSuppliers(),
        api.getStockAdjustments(),
        api.getDashboardSummary(),
      ]);

      const nextUsers = asArray(uList);
      setUsers(nextUsers);
      const refreshedCurrentUser = nextUsers.find((user) => user.id === currentUser.id);
      if (refreshedCurrentUser) {
        setCurrentUser((previous) => {
          if (!previous) return previous;
          const unchanged = previous.role === refreshedCurrentUser.role
            && previous.active === refreshedCurrentUser.active
            && (previous.permissions || []).join('|') === (refreshedCurrentUser.permissions || []).join('|');
          return unchanged ? previous : { ...previous, ...refreshedCurrentUser };
        });
      }
      setProducts(asArray(pList));
      setTanks(asArray(tList));
      setPumps(asArray(pmpList));
      setPumpUnits(asArray(pumpUnitList));
      setShopItems(asArray(sList));
      setShifts(asArray(shftList));
      setSchedules(asArray(schList));
      setShiftPlans(asArray(shiftPlanList));
      setTransactions(asArray(txList));
      setReconciliations(asArray(recList));
      setDeliveries(asArray(delList));
      setApprovals(asArray(apprList));
      setAuditLogs(asArray(logList));
      setSettings(stgData ?? null);
      setCreditNotes(asArray(cnList));
      setCustomers(asArray(cList));
      setCashFlow(asArray(cfList));
      setSuppliers(asArray(supList));
      setStockAdjustments(asArray(adjList));
      setDashboardSummary(summary);
      setDataLoaded(true);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setDataLoaded(true);
    }
  };

  useEffect(() => {
    if (!authRestoring) refreshData();
  }, [currentUser, authRestoring]);

  useEffect(() => {
    if (currentUser && !canAccessTab(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUser]);

  // ============================================================
  // ALL ACTION HANDLERS – kept exactly as you had them
  // ============================================================
  const handleProcessSale = async (saleData: any) => {
    const newTx = await api.processSale(saleData);
    await refreshData();
    return newTx;
  };

  const handleClockInSubmit = async (
    userId: string,
    pin: string,
    shiftType: string,
    openingCash: number,
    openingPumpReadings?: any[],
    openingTankDips?: any[],
    shiftPlanId?: string
  ) => {
    const shift = await api.clockIn(userId, pin, shiftType, openingCash, openingPumpReadings, openingTankDips, shiftPlanId);
    await refreshData();
    return shift;
  };

  const handleSubmitReconciliation = async (data: any) => {
    const res = await api.submitReconciliation({
      ...data,
      actorUserId: currentUser?.id,
      actorRole: currentUser?.role,
    });
    await refreshData();
    return res;
  };

  const handleRecordDip = async (tankId: string, dipLiters: number) => {
    const tank = await api.recordDip(
      tankId,
      dipLiters,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return tank;
  };

  const handleAddDelivery = async (deliveryData: any) => {
    const res = await api.addDelivery(deliveryData);
    await refreshData();
    return res;
  };

  const handleUpdatePrice = async (productId: string, newPrice: number, taxCode?: string, productName?: string) => {
    const prod = await api.updateProductPrice(
      productId,
      newPrice,
      taxCode,
      productName,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return prod;
  };

  const handleDeleteProduct = async (productId: string) => {
    const res = await api.deleteFuelProduct(
      productId,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleAdjustShopStock = async (
    itemId: string,
    newQty: number,
    reason: string
  ) => {
    const item = await api.adjustShopStock(
      itemId,
      newQty,
      reason,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return item;
  };

  const handleRegisterShopItem = async (itemData: any) => {
    const newItem = await api.registerShopItem(
      itemData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return newItem;
  };

  const handleUpdateShopItem = async (itemId: string, itemData: any) => {
    const updatedItem = await api.updateShopItem(
      itemId,
      itemData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return updatedItem;
  };

  const handleDeleteShopItem = async (itemId: string) => {
    const res = await api.deleteShopItem(
      itemId,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleUploadBulkShopExcel = async (items: any[]) => {
    const res = await api.uploadShopItemsBulk(
      items,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleAssignSchedule = async (scheduleData: any) => {
    const res = await api.assignSchedule(scheduleData);
    await refreshData();
    return res;
  };

  const handleDeleteSchedule = async (shiftPlanId: string, userId: string) => {
    const res = await api.removeShiftPlanUser(shiftPlanId, userId);
    await refreshData();
    return res;
  };

  const handleCreateShiftPlan = async (data: any) => {
    const plan = await api.createShiftPlan(data);
    await refreshData();
    return plan;
  };

  const handleAssignShiftPlanUser = async (shiftPlanId: string, userId: string) => {
    const plan = await api.assignShiftPlanUser(shiftPlanId, userId);
    await refreshData();
    return plan;
  };

  const handleRemoveShiftPlanUser = async (shiftPlanId: string, userId: string) => {
    const plan = await api.removeShiftPlanUser(shiftPlanId, userId);
    await refreshData();
    return plan;
  };

  const handleSaveSettings = async (newSettings: Partial<StationSettingsType>) => {
    const updated = await api.updateSettings(
      newSettings,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    setSettings(updated);
    await refreshData();
    return updated;
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const result = await api.deleteCustomer(customerId);
    await refreshData();
    return result;
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    const result = await api.deleteSupplier(supplierId);
    await refreshData();
    return result;
  };

  const handleCreateCreditNote = async (payload: any) => {
    const cn = await api.issueCreditNote({
      ...payload,
      userId: currentUser?.id,
      userRole: currentUser?.role,
    });
    await refreshData();
    return cn;
  };

  const handleSaveCustomer = async (custData: any) => {
    const res = await api.saveCustomer(
      custData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRecordDebtRepayment = async (payload: any) => {
    const res = await api.recordDebtRepayment(
      payload,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRecordCashFlow = async (payload: any) => {
    const res = await api.recordCashFlow(
      payload,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleSaveSupplier = async (supplierData: any) => {
    const res = await api.saveSupplier(
      supplierData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRecordSupplierPayment = async (payload: any) => {
    const res = await api.recordSupplierPayment(
      payload,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRecordStockAdjustment = async (payload: any) => {
    const res = await api.recordStockAdjustment(
      payload,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRegisterTank = async (tankData: any) => {
    const res = await api.registerTank(
      tankData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleDeleteTank = async (tankId: string) => {
    const res = await api.deleteTank(
      tankId,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleRegisterPump = async (pumpData: any) => {
    const res = await api.registerPump(
      pumpData,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleDeletePump = async (pumpId: string) => {
    const res = await api.deletePump(
      pumpId,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleDeletePumpUnit = async (pumpUnitId: string) => {
    const res = await api.deletePumpUnit(
      pumpUnitId,
      currentUser?.id,
      currentUser?.name,
      currentUser?.role
    );
    await refreshData();
    return res;
  };

  const handleResolveApproval = async (
    approvalId: string,
    action: 'Approved' | 'Rejected',
    managerId: string,
    managerName: string,
    managerPin: string,
    notes: string
  ) => {
    const res = await api.resolveApproval(
      approvalId,
      action,
      managerId,
      managerName,
      managerPin,
      notes
    );
    await refreshData();
    return res;
  };

  const handleCreateUser = async (payload: any) => {
    if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('CREATE_USER'))) {
      throw new Error('Permission required: CREATE_USER.');
    }
    if (payload.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      throw new Error('Only the Super Admin can assign the Super Admin role.');
    }

    const created = await api.createUser(payload, currentUser.id, currentUser.role);
    await refreshData();
    return created;
  };

  const handleUpdateUser = async (userId: string, payload: any) => {
    const target = users.find((u) => u.id === userId);
    if (!currentUser) throw new Error('Not authenticated.');
    if (!(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('MANAGE_USERS'))) {
      throw new Error('Permission required: MANAGE_USERS.');
    }
    if (target?.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      throw new Error('Admins cannot modify Super Admin accounts.');
    }
    if (payload.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      throw new Error('Only Super Admin can assign Super Admin role.');
    }

    const updated = await api.updateUser(userId, payload, currentUser.id, currentUser.role);
    await refreshData();
    return updated;
  };

  const handleResetPassword = async (userId: string, newPin: string) => {
    if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('RESET_USER_PASSWORD'))) {
      throw new Error('Permission required: RESET_USER_PASSWORD.');
    }
    const updated = await api.resetUserPin(userId, newPin, currentUser.id, currentUser.role);
    await refreshData();
    return updated;
  };

  const handleToggleUserStatus = async (userId: string, nextStatus: 'Active' | 'Inactive' | 'Suspended') => {
    if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('MANAGE_USERS'))) {
      throw new Error('Permission required: MANAGE_USERS.');
    }
    const target = users.find((u) => u.id === userId);
    if (target?.role === 'Super Admin' && currentUser.role !== 'Super Admin') {
      throw new Error('Admins cannot change Super Admin account status.');
    }
    if (userId === currentUser.id) {
      throw new Error('You cannot deactivate your own account.');
    }

    const updated = await api.toggleUserStatus(userId, nextStatus, currentUser.id, currentUser.role);
    await refreshData();
    return updated;
  };

  const handleDeleteUser = async (userId: string) => {
    if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('MANAGE_USERS'))) {
      throw new Error('Permission required: MANAGE_USERS.');
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false };
    if (target.role === 'Super Admin') throw new Error('Super Admin accounts cannot be deleted.');
    if (userId === currentUser.id) throw new Error('You cannot delete your own account.');

    const res = await api.deleteUser(userId, currentUser.id, currentUser.role);
    await refreshData();
    return res;
  };

  const handleUpdateUserPermissions = async (userId: string, permissions: Permission[]) => {
    if (!currentUser || !(currentUser.role === 'Super Admin' || currentUser.permissions?.includes('MANAGE_USERS'))) {
      throw new Error('Unauthorized permission change.');
    }
    const result = await api.updateUserPermissions(userId, permissions);
    await refreshData();
    return result;
  };

  // --- Logout flow ---
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Preserve theme and bootstrap user-presence state. Clearing `users` here
      // incorrectly makes an existing installation look like first-run setup.
      // `currentUser` is the authenticated identity and permission source.
      setCurrentUser(null);
      setActiveTab('dashboard');
      setShowLogoutConfirm(false);
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleLoginSuccess = (user: User) => {
    // The authentication response carries this flag; set it before any data
    // refresh so a newly issued PIN is gated without a visible app flash.
    setCurrentUser({ ...user, mustChangePassword: Boolean(user.mustChangePassword) });
    setShowSignup(false);
    // Background data can wait until after React has rendered the security gate.
    queueMicrotask(() => { void refreshData(); });
  };

  const handleSignupClick = () => {
    setShowSignup(true);
  };

  const handleSignupSuccess = async () => {
    // Initial setup only creates the Super Admin account. Authentication must
    // happen explicitly from the login screen with the credentials just chosen.
    setCurrentUser(null);
    setShowSignup(false);
    await refreshData();
  };

  const handleBackToLogin = () => {
    setShowSignup(false);
  };

  const todaySalesTotal = dashboardSummary?.today.totalSales ?? 0;
  const activeShiftsCount = dashboardSummary?.activeStaff.count ?? 0;
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'Pending').length;

  const forceSignupForFirstUser = users.length === 0 && dataLoaded;

  if (authRestoring || !dataLoaded) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.16),_transparent_24%),linear-gradient(180deg,_#040a12_0%,_#0a1220_40%,_#0f172a_100%)] text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3 rounded-2xl border border-blue-500/20 bg-slate-900/70 px-6 py-5 shadow-[0_16px_40px_rgba(59,130,246,0.18)] backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-200">Loading system data...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (showSignup || forceSignupForFirstUser) {
      return <Signup onSignupSuccess={handleSignupSuccess} onBackToLogin={handleBackToLogin} isFirstUser={forceSignupForFirstUser} />;
    }
    return <Login users={users} onLoginSuccess={handleLoginSuccess} onSignupClick={handleSignupClick} canSignUp={forceSignupForFirstUser} />;
  }

  // This gate is deliberately before all navigation and application content.
  // A newly issued administrator PIN cannot be used to access the system.
  if (currentUser.mustChangePassword) {
    const submitForcedPasswordReset = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!/^\d{4,6}$/.test(passwordResetNewPin)) return setPasswordResetError('New PIN must be 4–6 digits.');
      if (passwordResetNewPin !== passwordResetConfirmPin) return setPasswordResetError('New PIN entries do not match.');
      setPasswordResetSaving(true);
      setPasswordResetError('');
      try {
        await api.changePin(passwordResetCurrentPin, passwordResetNewPin);
        setCurrentUser({ ...currentUser, mustChangePassword: false });
      } catch (error: any) {
        setPasswordResetError(error?.message || 'Unable to change PIN.');
      } finally {
        setPasswordResetSaving(false);
      }
    };
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <form onSubmit={submitForcedPasswordReset} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-xl font-bold">Change your issued PIN</h1>
        <p className="text-sm text-slate-400">For security, create a personal PIN before continuing to DT-FMS.</p>
        {passwordResetError && <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{passwordResetError}</p>}
        {[['Issued PIN', passwordResetCurrentPin, setPasswordResetCurrentPin], ['New PIN', passwordResetNewPin, setPasswordResetNewPin], ['Confirm new PIN', passwordResetConfirmPin, setPasswordResetConfirmPin]].map(([label, value, setValue]) => <label key={label as string} className="block text-xs text-slate-300">{label as string}<input required type="password" inputMode="numeric" maxLength={6} value={value as string} onChange={(e) => (setValue as any)(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-base" /></label>)}
        <button disabled={passwordResetSaving} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold disabled:opacity-60">{passwordResetSaving ? 'Saving…' : 'Set new PIN'}</button>
      </form>
    </div>;
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.16),_transparent_24%),linear-gradient(180deg,_#040a12_0%,_#0a1220_40%,_#0f172a_100%)] text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3 rounded-2xl border border-blue-500/20 bg-slate-900/70 px-6 py-5 shadow-[0_16px_40px_rgba(59,130,246,0.18)] backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-200">Loading Deities Technologies System...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="fms-app-shell min-h-screen font-sans flex">
        {/* LEFT SIDEBAR NAVIGATION */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          activeShiftsCount={activeShiftsCount}
          pendingApprovalsCount={pendingApprovalsCount}
          todaySalesTotal={todaySalesTotal}
        />

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all">
          {/* Top Sticky Header */}
          <header className="fms-surface sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-md sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <h1 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  {settings.stationName}
                </h1>
                <p className="text-[10px] text-slate-400 font-mono">
                  eTIMS PIN: {settings.taxPin}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] text-slate-400">TODAY SALES:</span>
                <span className="text-emerald-400 font-bold">
                  KES {todaySalesTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1" aria-label="Appearance controls">
                <button type="button" onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')} className="rounded-lg p-1 text-slate-300 hover:bg-slate-800" title="Switch light/dark appearance">
                  {colorMode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-800 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Dynamic Workspace View */}
          <main className="p-4 sm:p-6 w-full space-y-5">
            {activeTab === 'dashboard' && (
              <Dashboard
                tanks={tanks}
                pumps={pumps}
                shifts={shifts}
                transactions={transactions}
                products={products}
                currentUser={currentUser}
                summary={dashboardSummary}
                onOpenDipModal={(tank) => {
                  setDipTankModal(tank);
                  setDipReadingInput(tank.currentLevelLiters);
                }}
                onNavigateTab={setActiveTab}
                onOpenReceipt={setActiveReceiptTx}
              />
            )}

            {activeTab === 'pos' && (
              <PointOfSale
                products={products}
                pumps={pumps}
                shopItems={shopItems}
                shifts={shifts}
                customers={customers}
                currentUser={currentUser}
                stationSettings={settings}
                onProcessSale={handleProcessSale}
                onOpenClockInModal={() => setActiveTab('shifts')}
                onOpenReceipt={setActiveReceiptTx}
                onSaveCustomer={handleSaveCustomer}
              />
            )}

            {activeTab === 'shifts' && (
              <ShiftManagement
                shifts={shifts}
                schedules={schedules}
                shiftPlans={shiftPlans}
                users={users}
                pumps={pumps}
                tanks={tanks}
                reconciliations={reconciliations}
                currentUser={currentUser}
                onClockInSubmit={handleClockInSubmit}
                onSubmitReconciliation={handleSubmitReconciliation}
                onAssignSchedule={handleAssignSchedule}
                onDeleteSchedule={handleDeleteSchedule}
                onCreateShiftPlan={handleCreateShiftPlan}
                onAssignShiftPlanUser={handleAssignShiftPlanUser}
                onRemoveShiftPlanUser={handleRemoveShiftPlanUser}
                onViewShiftReport={canAccessTab('reconciliation') ? (shiftId) => {
                  setLedgerShiftId(shiftId);
                  setActiveTab('reconciliation');
                } : undefined}
              />
            )}

            {activeTab === 'pumps' && (
              <PumpsAndTanks
                tanks={tanks}
                pumps={pumps}
                pumpUnits={pumpUnits}
                products={products}
                deliveries={deliveries}
                suppliers={suppliers}
                shifts={shifts}
                currentUser={currentUser}
                stationSettings={settings}
                onRecordDip={handleRecordDip}
                onAddDelivery={handleAddDelivery}
                onUpdatePrice={handleUpdatePrice}
                onDeleteProduct={handleDeleteProduct}
                onRegisterTank={handleRegisterTank}
                onDeleteTank={handleDeleteTank}
                onRegisterPump={handleRegisterPump}
                onDeletePump={handleDeletePump}
                onDeletePumpUnit={handleDeletePumpUnit}
              />
            )}

            {activeTab === 'reconciliation' && (
              <ReconciliationLedger reconciliations={reconciliations} shifts={shifts} selectedShiftId={ledgerShiftId} onClearSelectedShift={() => setLedgerShiftId(null)} />
            )}

            {activeTab === 'cashflow' && (
              <CashFlowLedger
                cashFlow={cashFlow}
                transactions={transactions}
                creditNotes={creditNotes}
                currentUser={currentUser}
                onRecordCashFlow={handleRecordCashFlow}
              />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersManagement
                suppliers={suppliers}
                deliveries={deliveries}
                currentUser={currentUser}
                stationSettings={settings}
                onSaveSupplier={handleSaveSupplier}
                onRecordPayment={handleRecordSupplierPayment}
                onDeleteSupplier={handleDeleteSupplier}
              />
            )}

            {activeTab === 'stock' && canAccessTab('stock') && (
              <StockManagement
                tanks={tanks}
                shopItems={shopItems}
                products={products}
                adjustments={stockAdjustments}
                currentUser={currentUser}
                onRecordStockAdjustment={handleRecordStockAdjustment}
                onSaveShopItem={handleRegisterShopItem}
                onUpdateShopItem={handleUpdateShopItem}
                onDeleteShopItem={handleDeleteShopItem}
              />
            )}

            {activeTab === 'invoices' && (
              <InvoicesAndReceipts
                transactions={transactions}
                creditNotes={creditNotes}
                customers={customers}
                deliveries={deliveries}
                settings={settings}
                currentUser={currentUser}
                onCreateCreditNote={handleCreateCreditNote}
                onOpenReceipt={setActiveReceiptTx}
                onSaveCustomer={handleSaveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onRecordDebtRepayment={handleRecordDebtRepayment}
              />
            )}

            {activeTab === 'shop' && (
              <ShopInventory
                shopItems={shopItems}
                currentUser={currentUser}
                onAdjustStock={handleAdjustShopStock}
                onRegisterItem={handleRegisterShopItem}
                onUpdateItem={handleUpdateShopItem}
                onDeleteItem={handleDeleteShopItem}
                onUploadBulkExcel={handleUploadBulkShopExcel}
              />
            )}

            {activeTab === 'approvals' && (
              <ManagerApprovals
                approvals={approvals}
                currentUser={currentUser}
                onResolveApproval={handleResolveApproval}
              />
            )}

            {activeTab === 'settings' && canAccessTab('settings') && (
              <StationSettings
                settings={settings}
                currentUser={currentUser}
                onSaveSettings={handleSaveSettings}
              />
            )}

            {activeTab === 'audit' && canAccessTab('audit') && <AuditTrail logs={auditLogs} />}

            {activeTab === 'users' && canAccessTab('users') && (
              <UserManagement
                users={users}
                shifts={shifts}
                currentUser={currentUser}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
                onResetPassword={handleResetPassword}
                onToggleUserStatus={handleToggleUserStatus}
                onDeleteUser={handleDeleteUser}
                onUpdatePermissions={handleUpdateUserPermissions}
              />
            )}

            {activeTab === 'reports' && canAccessTab('reports') && (
              <Reports
                transactions={transactions}
                shifts={shifts}
                tanks={tanks}
                pumps={pumps}
                deliveries={deliveries}
                cashFlow={cashFlow}
                auditLogs={auditLogs}
                creditNotes={creditNotes}
                settings={settings || undefined}
                currentUser={currentUser || undefined}
              />
            )}
          </main>
        </div>

        {/* Global Receipt Modal */}
        {activeReceiptTx && (
          <ReceiptModal
            transaction={activeReceiptTx}
            settings={settings}
            onClose={() => setActiveReceiptTx(null)}
          />
        )}

        {/* Quick Dashboard Dip Modal */}
        {dipTankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-slate-100">
              <h3 className="font-bold text-base text-slate-100">
                Record Dip Reading — {dipTankModal.tankName}
              </h3>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Physical Liters Dip Level
                </label>
                <input
                  type="number"
                  value={dipReadingInput}
                  onChange={(e) => setDipReadingInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDipTankModal(null)}
                  className="w-1/2 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleRecordDip(dipTankModal.id, dipReadingInput);
                    setDipTankModal(null);
                  }}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                >
                  Save Dip
                </button>
              </div>
            </div>
          </div>
        )}

        <AppDialog
          open={showLogoutConfirm}
          kind="warning"
          title="Logout of DT-FMS"
          message={`Are you sure you want to logout${currentUser?.name ? `, ${currentUser.name}` : ''}?`}
          confirmLabel="Logout"
          onClose={cancelLogout}
          onConfirm={confirmLogout}
        />
      </div>
    </ErrorBoundary>
  );
}
