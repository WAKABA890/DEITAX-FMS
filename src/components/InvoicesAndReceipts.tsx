import React, { useEffect, useState } from 'react';
import {
  Receipt,
  FileText,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  QrCode,
  User,
  ShieldCheck,
  Building2,
  Calendar,
  X,
  CreditCard,
  Hash,
  ArrowRightLeft,
  Users,
  DollarSign,
  Plus,
  History,
  Clock,
  Truck,
  Scale,
} from 'lucide-react';
import {
  Transaction,
  CreditNote,
  StationSettings,
  User as UserType,
  CustomerAccount,
  FuelDelivery,
  ThreeWayReconciliation,
  ShiftSession,
} from '../types';
import { PaginationControls, usePagination } from './PaginationControls';
import { printSelectedDocument } from '../utils/print-document';
import { usePermissions } from '../hooks/usePermissions';
import toast from 'react-hot-toast';
import { AppDialog } from './AppDialog';
import { FuelDeliveryDocument, OperationalDocumentPreview, ShiftReconciliationDocument } from './OperationalDocumentPreview';

interface InvoicesAndReceiptsProps {
  transactions?: Transaction[];
  creditNotes?: CreditNote[];
  customers?: CustomerAccount[];
  deliveries?: FuelDelivery[];
  reconciliations?: ThreeWayReconciliation[];
  shifts?: ShiftSession[];
  stationSettings?: StationSettings;
  settings?: StationSettings;
  currentUser?: UserType;
  onIssueCreditNote?: (data: any) => Promise<CreditNote>;
  onCreateCreditNote?: (data: any) => Promise<CreditNote>;
  onOpenReceipt?: (tx: Transaction) => void;
  onSaveCustomer?: (data: any) => Promise<any>;
  onDeleteCustomer?: (customerId: string) => Promise<any>;
  onRecordDebtRepayment?: (data: any) => Promise<any>;
  requestedReconciliationReprint?: ThreeWayReconciliation | null;
  onRequestedReconciliationHandled?: () => void;
}

export const InvoicesAndReceipts: React.FC<InvoicesAndReceiptsProps> = ({
  transactions = [],
  creditNotes = [],
  customers = [],
  deliveries = [],
  reconciliations = [],
  shifts = [],
  stationSettings,
  settings,
  currentUser,
  onIssueCreditNote,
  onCreateCreditNote,
  onOpenReceipt,
  onSaveCustomer,
  onDeleteCustomer,
  onRecordDebtRepayment,
  requestedReconciliationReprint,
  onRequestedReconciliationHandled,
}) => {
  // ✅ Granular permissions + composite canManageUsers fallback
  const {
    canCreateCreditNote,
    canManageCreditCustomers,
    canRecordCreditPayment,
    canViewInvoices,
    canManageUsers, // 👈 composite fallback
    hasPermission,
  } = usePermissions(currentUser ?? null);

  // 🔍 Debug (remove in production)
  console.log('📋 InvoicesAndReceipts permissions:', {
    canCreateCreditNote,
    canManageCreditCustomers,
    canRecordCreditPayment,
    canManageUsers,
  });

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeCreditNotes = Array.isArray(creditNotes) ? creditNotes : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const safeReconciliations = Array.isArray(reconciliations) ? reconciliations : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];

  const activeSettings = stationSettings || settings;
  const issueCreditNoteHandler = onIssueCreditNote || onCreateCreditNote;

  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'customers' | 'credit-notes' | 'document-history' | 'delivery-records' | 'reconciliation-documents'>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<{ type: string; title: string; docNo: string; timestamp: string; customer?: string; details: any } | null>(null);
  const [creditNoteDocumentLock, setCreditNoteDocumentLock] = useState<{ type: 'receipt' | 'invoice'; docNo: string } | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestedReconciliationReprint) return;
    setActiveSubTab('reconciliation-documents');
    setSelectedDoc({
      type: 'Shift Reconciliation',
      title: 'Shift Reconciliation Report',
      docNo: requestedReconciliationReprint.id.toUpperCase(),
      timestamp: requestedReconciliationReprint.timestamp,
      customer: `Staff: ${requestedReconciliationReprint.staffName}`,
      details: requestedReconciliationReprint,
    });
    onRequestedReconciliationHandled?.();
  }, [requestedReconciliationReprint, onRequestedReconciliationHandled]);

  // Credit Note Modal State
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [cnCustomerName, setCnCustomerName] = useState('');
  const [cnCustomerPin, setCnCustomerPin] = useState('');
  const [cnVehiclePlate, setCnVehiclePlate] = useState('');
  const [cnDocumentType, setCnDocumentType] = useState<'receipt' | 'invoice'>('receipt');
  const [cnOriginalInvoiceNo, setCnOriginalInvoiceNo] = useState('');
  const [cnOriginalReceiptNo, setCnOriginalReceiptNo] = useState('');
  const [cnReason, setCnReason] = useState('01');
  const [cnNarration, setCnNarration] = useState('');
  const [cnCreditType, setCnCreditType] = useState<'full' | 'partial'>('partial');
  const [cnItemName, setCnItemName] = useState('');
  const [cnQty, setCnQty] = useState(1);
  const [cnUnitPrice, setCnUnitPrice] = useState(100);
  const [cnSelectedItems, setCnSelectedItems] = useState<Record<string, {
    itemId: string;
    originalItemId?: string;
    name: string;
    type: 'Fuel' | 'Shop';
    selected: boolean;
    qty: number;
    originalQty: number;
    remainingQty: number;
    unitPrice: number;
    taxCode: string;
    taxRate: number;
    taxAmount: number;
    taxableAmount: number;
    totalPrice: number;
    totalAmount: number;
  }>>({});
  const [cnSourceTransactionId, setCnSourceTransactionId] = useState<string | null>(null);
  const [isSubmittingCN, setIsSubmittingCN] = useState(false);

  const resolveTransactionDocumentKind = (tx?: Pick<Transaction, 'documentType' | 'taxInvoiceNo' | 'receiptNo'> | null) => {
    if (!tx) return 'Receipt';
    if (tx.documentType === 'Invoice') return 'Invoice';
    if (tx.documentType === 'Receipt') return 'Receipt';
    if (tx.taxInvoiceNo) return 'Invoice';
    if (tx.receiptNo) return 'Receipt';
    return 'Receipt';
  };

  const creditReasonOptions = {
    '01': 'Missing Quantity',
    '02': 'Missing Item',
    '03': 'Damaged Goods',
    '04': 'Wasted/Expired',
    '05': 'Raw Material Shortage',
    '06': 'Refund',
    '07': 'Wrong Customer PIN',
    '08': 'Wrong Customer Name',
    '09': 'Wrong Amount/Price',
    '10': 'Wrong Quantity',
    '11': 'Wrong Item(s)',
    '12': 'Wrong Tax Type',
    '13': 'Other Reason',
  } as const;

  const normalizeDocumentNumber = (value: string | undefined, prefix: 'Rcpt' | 'Inv' | 'Cn') => {
    const raw = String(value ?? '').trim();
    const currentYear = new Date().getFullYear();

    if (!raw) return `${prefix}-${currentYear}-0000`;

    const yearMatch = raw.match(/-(\d{4})-/);
    const sequenceMatch = raw.match(/-(\d+)$/);

    const year = yearMatch ? yearMatch[1] : currentYear;
    const sequenceNumber = sequenceMatch ? Number(sequenceMatch[1]) : 0;

    return `${prefix}-${year}-${String(sequenceNumber).padStart(4, '0')}`;
  };

  const handleSelectedDocumentPrint = () => {
    const target = document.querySelector('[data-reprint-document]') as HTMLElement | null;
    try {
      if (!target) throw new Error('Selected document is unavailable for printing.');
      printSelectedDocument(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown print error';
      setPrintError(message);
    }
  };

  const getDocumentCreditSummary = (docType: 'receipt' | 'invoice', docNo: string) => {
    const resolvedTx = safeTransactions.find((tx) => {
      if (!docNo) return false;
      if (docType === 'receipt') {
        return !!tx.receiptNo && normalizeDocumentNumber(tx.receiptNo, 'Rcpt') === normalizeDocumentNumber(docNo, 'Rcpt');
      }
      return !!tx.taxInvoiceNo && normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv') === normalizeDocumentNumber(docNo, 'Inv');
    });

    if (!resolvedTx) {
      return { originalTotal: 0, alreadyCredited: 0, remainingCredit: 0, matchedTransaction: null };
    }

    const alreadyCredited = safeCreditNotes.reduce((sum, cn) => {
      if (cn.status === 'Voided') return sum;
      const sameTransaction = cn.originalTransactionId === resolvedTx.id;
      const sameInvoice = !!resolvedTx.taxInvoiceNo && !!cn.originalInvoiceNo && normalizeDocumentNumber(cn.originalInvoiceNo, 'Inv') === normalizeDocumentNumber(resolvedTx.taxInvoiceNo, 'Inv');
      const sameReceipt = !!resolvedTx.receiptNo && !!cn.originalReceiptNo && normalizeDocumentNumber(cn.originalReceiptNo, 'Rcpt') === normalizeDocumentNumber(resolvedTx.receiptNo, 'Rcpt');
      return (sameTransaction || sameInvoice || sameReceipt) ? sum + Number(cn.totalAmount ?? 0) : sum;
    }, 0);

    const originalTotal = Number(resolvedTx.totalAmount ?? 0);
    const remainingCredit = Math.max(originalTotal - alreadyCredited, 0);

    return { originalTotal, alreadyCredited, remainingCredit, matchedTransaction: resolvedTx };
  };

  const creditNoteMatchesTransaction = (cn: CreditNote, tx: Transaction) => {
    if (cn.status === 'Voided') return false;
    if (cn.originalTransactionId === tx.id) return true;
    const sameInvoice = !!tx.taxInvoiceNo && !!cn.originalInvoiceNo &&
      normalizeDocumentNumber(cn.originalInvoiceNo, 'Inv') === normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv');
    const sameReceipt = !!tx.receiptNo && !!cn.originalReceiptNo &&
      normalizeDocumentNumber(cn.originalReceiptNo, 'Rcpt') === normalizeDocumentNumber(tx.receiptNo, 'Rcpt');
    return sameInvoice || sameReceipt;
  };

  const getPreviouslyCreditedQty = (tx: Transaction, originalItem: Transaction['items'][number]) =>
    safeCreditNotes
      .filter((cn) => creditNoteMatchesTransaction(cn, tx))
      .flatMap((cn) => cn.items || [])
      .filter((creditedItem) =>
        (!!originalItem.itemId && creditedItem.originalItemId === originalItem.itemId) ||
        String(creditedItem.name || '').trim().toLowerCase() === String(originalItem.name || '').trim().toLowerCase()
      )
      .reduce((sum, creditedItem) => sum + Number(creditedItem.quantity ?? creditedItem.qty ?? 0), 0);

  const clearCreditSource = (documentType: 'receipt' | 'invoice', documentNo = '') => {
    setCnSourceTransactionId(null);
    setCnSelectedItems({});
    setCnCustomerName('');
    setCnCustomerPin('');
    setCnVehiclePlate('');
    setCnItemName('');
    setCnQty(1);
    setCnUnitPrice(100);
    setCnDocumentType(documentType);
    setCnOriginalReceiptNo(documentType === 'receipt' ? documentNo : '');
    setCnOriginalInvoiceNo(documentType === 'invoice' ? documentNo : '');
  };

  const loadCreditSource = (tx: Transaction) => {
    const documentType = resolveTransactionDocumentKind(tx) === 'Invoice' ? 'invoice' : 'receipt';
    const documentNo = documentType === 'invoice' ? tx.taxInvoiceNo || '' : tx.receiptNo || '';
    const taxRateMap = { A: 0, B: 0.16, C: 0, D: 0, E: 0.08 } as const;
    const selection = (tx.items || []).reduce((rows, item, index) => {
      const itemId = item.itemId || `${item.name}-${index}`;
      const originalQty = Number(item.qty || 0);
      const remainingQty = Math.max(0, originalQty - getPreviouslyCreditedQty(tx, item));
      const taxCode = String(item.taxCode || 'A').toUpperCase();
      const taxRate = taxRateMap[taxCode as keyof typeof taxRateMap] ?? 0;
      const totalPrice = remainingQty * Number(item.unitPrice || 0);
      const taxAmount = taxRate === 0 ? 0 : (totalPrice * taxRate) / (1 + taxRate);
      rows[itemId] = {
        itemId,
        originalItemId: item.itemId || itemId,
        name: item.name,
        type: item.type || 'Fuel',
        selected: remainingQty > 0,
        qty: remainingQty,
        originalQty,
        remainingQty,
        unitPrice: Number(item.unitPrice || 0),
        taxCode,
        taxRate,
        taxAmount,
        taxableAmount: totalPrice - taxAmount,
        totalPrice,
        totalAmount: totalPrice,
      };
      return rows;
    }, {} as typeof cnSelectedItems);

    setCnSourceTransactionId(tx.id);
    setCnDocumentType(documentType);
    setCnOriginalReceiptNo(documentType === 'receipt' ? documentNo : '');
    setCnOriginalInvoiceNo(documentType === 'invoice' ? documentNo : '');
    setCnCustomerName(tx.customerName || '');
    setCnCustomerPin(tx.customerPin || '');
    setCnVehiclePlate(tx.vehiclePlate || '');
    setCnSelectedItems(selection);
    setCnItemName(tx.items?.[0]?.name || '');
    setCnQty(Number(tx.items?.[0]?.qty || 1));
    setCnUnitPrice(Number(tx.items?.[0]?.unitPrice || 0));
  };

  const getSelectedCreditItems = () => {
    return Object.values(cnSelectedItems)
      .filter((item) => item.selected)
      .map((item) => {
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const totalPrice = qty * unitPrice;
        const taxRate = Number(item.taxRate || 0);
        const taxAmount = Number(item.taxAmount || (taxRate === 0 ? 0 : (totalPrice * taxRate) / (1 + taxRate)));
        const taxableAmount = Number(item.taxableAmount || (totalPrice - taxAmount));
        return {
          itemId: item.itemId,
          originalItemId: item.originalItemId || item.itemId,
          name: item.name,
          type: item.type,
          qty,
          quantity: qty,
          unitPrice,
          totalPrice,
          totalAmount: Number(item.totalAmount || totalPrice),
          taxAmount,
          taxableAmount,
          taxRate,
          taxCode: String(item.taxCode || 'A').toUpperCase(),
        };
      });
  };

  const getTaxDetailsForLine = (unitPrice: number, qty: number, taxCode: string) => {
    const normalizedTaxCode = String(taxCode || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
    const taxRateMap = { A: 0, B: 0.16, C: 0, D: 0, E: 0.08 } as const;
    const totalPrice = Number(unitPrice || 0) * Number(qty || 0);
    const taxRate = taxRateMap[normalizedTaxCode] ?? 0;
    const taxAmount = taxRate === 0 ? 0 : (totalPrice * taxRate) / (1 + taxRate);
    const taxableAmount = totalPrice - taxAmount;

    return {
      totalPrice,
      taxRate,
      taxAmount,
      taxableAmount,
      taxCode: normalizedTaxCode,
    };
  };

  const currentCNDocumentNo = cnDocumentType === 'receipt' ? (cnOriginalReceiptNo || '') : (cnOriginalInvoiceNo || '');
  const currentCreditSummary = getDocumentCreditSummary(cnDocumentType, currentCNDocumentNo);
  const selectedCreditRows = Object.values(cnSelectedItems);
  const selectedCreditAmount = selectedCreditRows
    .filter((item) => item.selected)
    .reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);
  const maxAllowedQtyByDocument = (() => {
    const sourceTx = safeTransactions.find((tx) => {
      if (!currentCNDocumentNo) return false;
      if (cnDocumentType === 'receipt') {
        return !!tx.receiptNo && normalizeDocumentNumber(tx.receiptNo, 'Rcpt') === normalizeDocumentNumber(currentCNDocumentNo, 'Rcpt');
      }
      return !!tx.taxInvoiceNo && normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv') === normalizeDocumentNumber(currentCNDocumentNo, 'Inv');
    });

    if (!sourceTx) return 0;
    const sourceItems = Array.isArray(sourceTx.items) ? sourceTx.items : [];
    const matchedItem = sourceItems.find((item) => String(item.name || '').trim().toLowerCase() === String(cnItemName || '').trim().toLowerCase()) || sourceItems[0] || null;
    return matchedItem ? Number(matchedItem.qty || 0) : Math.max(0, Math.floor((sourceTx.totalAmount || 0) / Math.max(cnUnitPrice || 1, 1)));
  })();
  const proposedCreditValue = cnCreditType === 'full'
    ? Number(currentCreditSummary.matchedTransaction?.totalAmount ?? 0)
    : selectedCreditRows.some((item) => item.selected)
      ? selectedCreditAmount
      : Number((cnQty || 0) * (cnUnitPrice || 0));
  const maxAllowedQty = Math.max(0, maxAllowedQtyByDocument);
  const isOverQtyLimit = selectedCreditRows.some((item) => item.selected && (item.qty <= 0 || item.qty > item.remainingQty + 0.0001)) || cnQty > maxAllowedQty + 0.0001;
  const isOverAmountLimit = proposedCreditValue > currentCreditSummary.remainingCredit + 0.0001;

  const getTransactionDocumentNumber = (tx?: Pick<Transaction, 'documentType' | 'taxInvoiceNo' | 'receiptNo'> | null) => {
    if (!tx) return 'Inv000';
    return resolveTransactionDocumentKind(tx) === 'Invoice' ? (tx.taxInvoiceNo || 'Inv000') : (tx.receiptNo || 'Rcpt000');
  };

  const getCreditNoteReference = (cn: CreditNote) => {
    const originalDocumentNo = cn.originalDocumentNo?.trim();
    const invoiceNo = cn.originalInvoiceNo?.trim();
    const receiptNo = cn.originalReceiptNo?.trim();
    const txMatch = cn.originalTransactionId ? safeTransactions.find((tx) => tx.id === cn.originalTransactionId) : undefined;

    if (originalDocumentNo && /^(Rcpt|Rec|Inv)/i.test(originalDocumentNo)) {
      return { label: 'Original Document No', value: originalDocumentNo };
    }

    if (cn.originalDocumentType === 'invoice' && txMatch?.taxInvoiceNo) {
      return { label: 'Original Document No', value: txMatch.taxInvoiceNo };
    }

    if (cn.originalDocumentType === 'receipt' && txMatch?.receiptNo) {
      return { label: 'Original Document No', value: txMatch.receiptNo };
    }

    if (receiptNo && /^(Rcpt|Rec)/i.test(receiptNo)) {
      return { label: 'Original Document No', value: receiptNo };
    }

    if (invoiceNo && /^Inv/i.test(invoiceNo)) {
      return { label: 'Original Document No', value: invoiceNo };
    }

    if (receiptNo) return { label: 'Original Document No', value: receiptNo };
    if (invoiceNo) return { label: 'Original Document No', value: invoiceNo };
    return { label: 'Original Document No', value: 'Original document unavailable' };
  };

  const resolveCreditNoteOriginalReference = (cn: CreditNote) => {
    const txMatch = cn.originalTransactionId ? safeTransactions.find((tx) => tx.id === cn.originalTransactionId) : undefined;
    const saved = (cn.originalDocumentNo || '').trim();
    const savedInvoice = (cn.originalInvoiceNo || '').trim();
    const savedReceipt = (cn.originalReceiptNo || '').trim();

    if (saved && /^(Rcpt|Rec|Inv)/i.test(saved)) {
      return {
        originalDocumentType: /^(Inv)/i.test(saved) ? 'invoice' : 'receipt',
        originalDocumentNo: saved,
      };
    }

    if (cn.originalDocumentType === 'invoice') {
      const invoiceRef = savedInvoice || txMatch?.taxInvoiceNo || '';
      if (invoiceRef) {
        return {
          originalDocumentType: 'invoice',
          originalDocumentNo: invoiceRef,
        };
      }
    }

    if (cn.originalDocumentType === 'receipt') {
      const receiptRef = savedReceipt || txMatch?.receiptNo || '';
      if (receiptRef) {
        return {
          originalDocumentType: 'receipt',
          originalDocumentNo: receiptRef,
        };
      }
    }

    if (savedInvoice && /^Inv/i.test(savedInvoice)) {
      return {
        originalDocumentType: 'invoice',
        originalDocumentNo: savedInvoice,
      };
    }

    if (savedReceipt && /^(Rcpt|Rec)/i.test(savedReceipt)) {
      return {
        originalDocumentType: 'receipt',
        originalDocumentNo: savedReceipt,
      };
    }

    if (txMatch?.taxInvoiceNo) {
      return {
        originalDocumentType: 'invoice',
        originalDocumentNo: txMatch.taxInvoiceNo,
      };
    }

    if (txMatch?.receiptNo) {
      return {
        originalDocumentType: 'receipt',
        originalDocumentNo: txMatch.receiptNo,
      };
    }

    return {
      originalDocumentType: undefined,
      originalDocumentNo: 'Original document unavailable',
    };
  };

  // --- CREDIT NOTE HANDLERS ---
  const openCreditNoteModalForTransaction = (tx?: Transaction | null) => {
    if (!canCreateCreditNote) {
      toast.error('You do not have permission to issue credit notes.');
      return;
    }
    setSelectedDoc(null);
    setCreditNoteDocumentLock(null);
    if (tx) loadCreditSource(tx);
    else clearCreditSource('receipt');
    setCnReason('01');
    setCnNarration('');
    setCnCreditType('partial');
    setShowCreditNoteModal(true);
  };

  const openCreditNoteReprint = (cn: CreditNote) => {
    if (!onOpenReceipt) return;

    const resolvedReference = resolveCreditNoteOriginalReference(cn);
    const resolvedOriginalDocumentType = resolvedReference.originalDocumentType;
    const resolvedOriginalDocumentNo = resolvedReference.originalDocumentNo;

    const preservedItems = (cn.items || []).map((item: any) => {
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      const itemTotal = Number(item.totalAmount ?? item.totalPrice ?? (qty * unitPrice));
      const taxAmount = Number(item.taxAmount ?? 0);
      const taxCode = String(item.taxCode || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
      const taxRate = Number(item.taxRate ?? { A: 0, B: 0.16, C: 0, D: 0, E: 0.08 }[taxCode] ?? 0);
      const taxableAmount = Number(item.taxableAmount ?? Math.max(0, itemTotal - taxAmount));

      return {
        itemId: item.itemId || `${cn.id}-${item.name}`,
        name: item.name,
        type: item.type || 'Fuel',
        qty,
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
        totalAmount: itemTotal,
        taxableAmount,
        taxAmount,
        taxRate,
        taxCode,
      };
    });

    const preservedSubtotal = Number(cn.subtotal || preservedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));
    const preservedTaxAmount = Number(cn.taxAmount || preservedItems.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0));
    const preservedTotalAmount = Number(cn.totalAmount || preservedSubtotal + preservedTaxAmount);

    const txLike: any = {
      id: cn.id,
      receiptNo: cn.creditNoteNo,
      taxInvoiceNo: cn.creditNoteNo,
      originalDocumentType: resolvedOriginalDocumentType,
      originalDocumentNo: resolvedOriginalDocumentNo,
      originalInvoiceNo: resolvedOriginalDocumentType === 'invoice' ? (cn.originalInvoiceNo || resolvedOriginalDocumentNo || '') : '',
      originalReceiptNo: resolvedOriginalDocumentType === 'receipt' ? (cn.originalReceiptNo || resolvedOriginalDocumentNo || '') : '',
      documentType: 'Credit Note',
      timestamp: cn.timestamp,
      shiftId: 'credit-note',
      staffId: cn.issuedBy || 'credit-note-user',
      staffName: cn.issuedBy || 'Manager',
      type: 'Combined',
      items: preservedItems,
      subtotal: preservedSubtotal,
      taxAmount: preservedTaxAmount,
      totalAmount: preservedTotalAmount,
      paymentMethod: 'Cash',
      customerName: cn.customerName,
      customerPin: cn.customerPin,
      vehiclePlate: cn.vehiclePlate,
      status: 'Completed',
    };

    onOpenReceipt(txLike as Transaction);
  };

  // --- CUSTOMER ACCOUNT HANDLERS (with composite fallback) ---
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerAccount | null>(null);
  const [custName, setCustName] = useState('');
  const [custPin, setCustPin] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState(100000);
  const [custVehicles, setCustVehicles] = useState('');
  const [custStatus, setCustStatus] = useState<'Active' | 'Suspended' | 'Blocked'>('Active');
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const [customerFormError, setCustomerFormError] = useState('');
  const [customerToDelete, setCustomerToDelete] = useState<CustomerAccount | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  const openEditCustomer = (cust: CustomerAccount) => {
    if (!canManageCreditCustomers && !canManageUsers) {
      toast.error('You do not have permission to edit customer accounts.');
      return;
    }
    setEditingCustomer(cust);
    setCustName(cust.name);
    setCustPin(cust.kraPin ?? '');
    setCustPhone(cust.phone);
    setCustEmail(cust.email || '');
    setCustAddress(cust.address || '');
    setCustCreditLimit(cust.creditLimit);
    setCustVehicles((cust.vehicles || []).join(', '));
    setCustStatus(cust.status);
    setCustomerFormError('');
    setShowCustomerModal(true);
  };

  const openNewCustomer = () => {
    if (!canManageCreditCustomers && !canManageUsers) {
      toast.error('You do not have permission to register new customers.');
      return;
    }
    setEditingCustomer(null);
    setCustName('');
    setCustPin('');
    setCustPhone('');
    setCustEmail('');
    setCustAddress('');
    setCustCreditLimit(100000);
    setCustVehicles('');
    setCustStatus('Active');
    setCustomerFormError('');
    setShowCustomerModal(true);
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCreditCustomers && !canManageUsers) {
      toast.error('You do not have permission to manage customer accounts.');
      return;
    }
    if (!custName.trim() || !custPin.trim() || !custPhone.trim() || !onSaveCustomer) {
      const message = 'Enter the customer name, KRA PIN, and phone number before saving.';
      setCustomerFormError(message);
      toast.error(message);
      return;
    }
    const normalizedName = custName.trim().toLocaleLowerCase();
    const duplicateName = safeCustomers.some((customer) => customer.id !== editingCustomer?.id && customer.name.trim().toLocaleLowerCase() === normalizedName);
    if (duplicateName) {
      const message = 'A customer account with this name already exists.';
      setCustomerFormError(message);
      toast.error(message);
      return;
    }
    const duplicatePin = safeCustomers.some((customer) => customer.id !== editingCustomer?.id && customer.kraPin?.trim().toUpperCase() === custPin.trim().toUpperCase());
    if (duplicatePin) {
      const message = 'This KRA PIN is already registered to another customer account.';
      setCustomerFormError(message);
      toast.error(message);
      return;
    }
    setCustomerFormError('');
    setIsSubmittingCust(true);
    try {
      const vArray = custVehicles
        .split(',')
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean);

      await onSaveCustomer({
        id: editingCustomer?.id,
        name: custName,
        kraPin: custPin,
        phone: custPhone,
        email: custEmail,
        address: custAddress,
        creditLimit: custCreditLimit,
        vehicles: vArray,
        status: custStatus,
      });
      toast.success('Customer account saved successfully.');
      setShowCustomerModal(false);
    } catch (err: any) {
      console.error(err);
      const rawMessage = err?.message || 'Customer account could not be saved.';
      const message = /KRA PIN|UNIQUE constraint|unique constraint/i.test(rawMessage)
        ? 'This KRA PIN is already registered to another customer account.'
        : rawMessage;
      setCustomerFormError(message);
      toast.error(message);
    } finally {
      setIsSubmittingCust(false);
    }
  };

  const deleteCustomer = async () => {
    if (!customerToDelete || !onDeleteCustomer) return;
    setDeletingCustomer(true);
    try { await onDeleteCustomer(customerToDelete.id); toast.success('Customer deleted successfully.'); setCustomerToDelete(null); }
    catch (error: any) { toast.error(error?.message || 'Customer could not be deleted.'); setCustomerToDelete(null); }
    finally { setDeletingCustomer(false); }
  };

  // --- REPAYMENT HANDLERS (with composite fallback) ---
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [selectedRepayCust, setSelectedRepayCust] = useState<CustomerAccount | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayMethod, setRepayMethod] = useState<'Bank Transfer' | 'M-Pesa' | 'Cash' | 'Cheque'>('Bank Transfer');
  const [repayRef, setRepayRef] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [isSubmittingRepay, setIsSubmittingRepay] = useState(false);

  const handleRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRecordCreditPayment && !canManageUsers) {
      toast.error('You do not have permission to record repayments.');
      return;
    }
    if (!selectedRepayCust || !repayAmount || repayAmount <= 0 || !onRecordDebtRepayment) {
      toast.error('Missing customer, amount, or repayment function.');
      return;
    }
    setIsSubmittingRepay(true);
    try {
      await onRecordDebtRepayment({
        customerId: selectedRepayCust.id,
        amount: repayAmount,
        paymentMethod: repayMethod,
        referenceNo: repayRef || `PAY-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: repayNotes,
      });
      toast.success(`Repayment of KES ${repayAmount.toLocaleString()} recorded.`);
      setShowRepaymentModal(false);
      setRepayAmount(0);
      setRepayRef('');
      setRepayNotes('');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to record repayment.');
    } finally {
      setIsSubmittingRepay(false);
    }
  };

  // --- CREDIT NOTE SUBMIT (granular only) ---
  const handleCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateCreditNote) {
      toast.error('You do not have permission to issue credit notes.');
      return;
    }
    if (!cnSourceTransactionId || !issueCreditNoteHandler) {
      toast.error('Select an existing receipt or invoice before issuing a credit note.');
      return;
    }
    setIsSubmittingCN(true);
    try {
      const originalInvoiceNo = cnDocumentType === 'invoice'
        ? (cnOriginalInvoiceNo || 'Inv000')
        : (cnOriginalInvoiceNo || '');
      const originalReceiptNo = cnDocumentType === 'receipt'
        ? (cnOriginalReceiptNo || 'Rcpt000')
        : (cnOriginalReceiptNo || '');

      const sourceTx = safeTransactions.find((tx) => {
        const exactDocumentNo = cnDocumentType === 'receipt' ? cnOriginalReceiptNo : cnOriginalInvoiceNo;
        if (!exactDocumentNo) return false;

        if (cnDocumentType === 'receipt') {
          return !!tx.receiptNo && normalizeDocumentNumber(tx.receiptNo, 'Rcpt') === normalizeDocumentNumber(exactDocumentNo, 'Rcpt');
        }

        return !!tx.taxInvoiceNo && normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv') === normalizeDocumentNumber(exactDocumentNo, 'Inv');
      });
      const sourceDocumentNo = cnDocumentType === 'receipt'
        ? (sourceTx?.receiptNo || cnOriginalReceiptNo || '')
        : (sourceTx?.taxInvoiceNo || cnOriginalInvoiceNo || '');

      if (!sourceTx || !sourceDocumentNo) {
        throw new Error(`No original ${cnDocumentType} was selected for this credit note.`);
      }

      const sourceItems = Array.isArray(sourceTx.items) ? sourceTx.items : [];
      const selectedEntries = getSelectedCreditItems();
      if (selectedEntries.length === 0) {
        throw new Error('Select at least one item with a positive quantity to credit.');
      }
      const preparedItems = selectedEntries;

      const preparedEntries = preparedItems.map((entry) => {
        const matchingOriginalItem = sourceItems.find((src) => {
          const sameId = entry.originalItemId && entry.originalItemId.trim() && src.itemId && src.itemId === entry.originalItemId;
          const sameName = !sameId && String(src.name || '').trim().toLowerCase() === String(entry.name || '').trim().toLowerCase();
          return sameId || sameName;
        }) || sourceItems.find((src) => String(src.name || '').trim().toLowerCase() === String(entry.name || '').trim().toLowerCase()) || sourceItems[0] || null;

        const qty = Number(entry.qty || 0);
        const unitPrice = Number(entry.unitPrice || matchingOriginalItem?.unitPrice || 0);
        const taxCode = String((entry.taxCode || matchingOriginalItem?.taxCode || 'A')).toUpperCase();
        const lineTax = getTaxDetailsForLine(unitPrice, qty, taxCode);

        return {
          itemId: entry.itemId || matchingOriginalItem?.itemId || `cn-item-${Date.now()}`,
          originalItemId: matchingOriginalItem?.itemId || entry.originalItemId || entry.itemId,
          name: entry.name || matchingOriginalItem?.name || 'Selected Item',
          type: matchingOriginalItem?.type || entry.type || 'Shop',
          qty,
          quantity: qty,
          unitPrice,
          totalPrice: lineTax.totalPrice,
          totalAmount: lineTax.totalPrice,
          taxableAmount: lineTax.taxableAmount,
          taxAmount: lineTax.taxAmount,
          taxRate: lineTax.taxRate,
          taxCode,
        };
      });

      const proposedCreditAmount = preparedEntries.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
      const { alreadyCredited, remainingCredit } = getDocumentCreditSummary(cnDocumentType, sourceDocumentNo);

      for (const item of preparedEntries) {
        const originalMatch = sourceItems.find((src) => {
          const sameId = item.originalItemId && src.itemId && src.itemId === item.originalItemId;
          const sameName = !sameId && String(src.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
          return sameId || sameName;
        }) || sourceItems[0] || null;
        const originalQty = Number(originalMatch?.qty || 0);
        const previouslyCreditedQty = originalMatch ? getPreviouslyCreditedQty(sourceTx, originalMatch) : 0;
        const remainingQty = Math.max(0, originalQty - previouslyCreditedQty);

        if (Number(item.qty || 0) <= 0) {
          throw new Error(`Credit quantity for ${item.name} must be greater than zero.`);
        }

        if (!originalMatch || Number(item.qty || 0) > remainingQty + 0.0001) {
          throw new Error(`Credit quantity for ${item.name} exceeds its remaining balance. Original: ${originalQty}, already credited: ${previouslyCreditedQty}, requested: ${Number(item.qty || 0)}, remaining: ${remainingQty}.`);
        }
      }

      if (proposedCreditAmount > remainingCredit + 0.0001) {
        throw new Error(`This ${cnDocumentType} already has KES ${alreadyCredited.toFixed(2)} in credit notes. Remaining creditable amount is KES ${remainingCredit.toFixed(2)}.`);
      }

      const createdNote = await issueCreditNoteHandler({
        documentType: cnDocumentType,
        originalTransactionId: sourceTx.id,
        originalDocumentType: cnDocumentType,
        originalDocumentNo: sourceDocumentNo,
        originalInvoiceNo: cnDocumentType === 'invoice' ? sourceDocumentNo : '',
        originalReceiptNo: cnDocumentType === 'receipt' ? sourceDocumentNo : '',
        customerName: cnCustomerName,
        customerPin: cnCustomerPin,
        vehiclePlate: cnVehiclePlate,
        items: preparedEntries,
        reason: creditReasonOptions[cnReason as keyof typeof creditReasonOptions] || cnReason,
        reasonCode: cnReason,
        narration: cnNarration,
        creditType: cnCreditType,
        issuedBy: currentUser?.name || 'Manager',
        userId: currentUser?.id,
        userRole: currentUser?.role,
      });

      const previewSourceTx = safeTransactions.find((tx) => {
        if (cnDocumentType === 'receipt') {
          return !!tx.receiptNo && normalizeDocumentNumber(tx.receiptNo, 'Rcpt') === normalizeDocumentNumber(cnOriginalReceiptNo || '', 'Rcpt');
        }
        return !!tx.taxInvoiceNo && normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv') === normalizeDocumentNumber(cnOriginalInvoiceNo || '', 'Inv');
      });

      const selectedOriginalInvoiceNo = cnDocumentType === 'invoice' ? (cnOriginalInvoiceNo || createdNote?.originalInvoiceNo || 'Inv000') : (createdNote?.originalInvoiceNo || cnOriginalInvoiceNo || '');
      const selectedOriginalReceiptNo = cnDocumentType === 'receipt' ? (cnOriginalReceiptNo || createdNote?.originalReceiptNo || 'Rcpt000') : (createdNote?.originalReceiptNo || cnOriginalReceiptNo || '');
      const preferredTaxCode = String(
        previewSourceTx?.items?.[0]?.taxCode || 'A'
      ).toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';

      const previewItems = (createdNote?.items || preparedEntries).map((item: any) => {
        const previewItemsList = Array.isArray(previewSourceTx?.items) ? previewSourceTx.items : [];
        const sourceItem = previewItemsList.find((src) => src.itemId === item.itemId) ||
          previewItemsList.find((src) => String(src.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase()) || null;
        const taxCode = String((item.taxCode || sourceItem?.taxCode || preferredTaxCode || 'A')).toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
        const qty = Number(item.qty ?? item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? sourceItem?.unitPrice ?? 0);
        const lineTaxDetails = getTaxDetailsForLine(unitPrice, qty, taxCode);

        return {
          itemId: item.itemId || `${createdNote?.id || 'cn'}-${Math.random().toString(36).slice(2)}`,
          name: item.name || 'Selected Item',
          type: item.type || sourceItem?.type || 'Fuel',
          qty,
          quantity: qty,
          unitPrice,
          totalPrice: lineTaxDetails.totalPrice,
          totalAmount: lineTaxDetails.totalPrice,
          taxableAmount: lineTaxDetails.taxableAmount,
          taxAmount: lineTaxDetails.taxAmount,
          taxRate: lineTaxDetails.taxRate,
          taxCode,
        };
      });

      const previewSubtotal = previewItems.reduce((sum, item) => sum + Number(item.taxableAmount || (Number(item.totalPrice || 0) - Number(item.taxAmount || 0))), 0);
      const previewTaxAmount = previewItems.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);
      const previewTotalAmount = previewItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

      const previewTx: Transaction = {
        id: createdNote?.id || `cn-preview-${Date.now()}`,
        receiptNo: createdNote?.creditNoteNo || 'Cn000',
        taxInvoiceNo: createdNote?.creditNoteNo || 'Cn000',
        originalDocumentNo: createdNote?.originalDocumentNo || selectedOriginalInvoiceNo || selectedOriginalReceiptNo || '',
        originalInvoiceNo: selectedOriginalInvoiceNo,
        originalReceiptNo: selectedOriginalReceiptNo,
        documentType: 'Credit Note',
        timestamp: createdNote?.timestamp || new Date().toISOString(),
        shiftId: 'credit-note',
        staffId: currentUser?.id || 'credit-note-user',
        staffName: createdNote?.issuedBy || currentUser?.name || 'Manager',
        type: 'Combined',
        items: previewItems,
        subtotal: Number(createdNote?.subtotal || previewSubtotal),
        taxAmount: Number(createdNote?.taxAmount || previewTaxAmount),
        totalAmount: Number(createdNote?.totalAmount || previewTotalAmount),
        paymentMethod: 'Cash',
        customerName: createdNote?.customerName || cnCustomerName,
        customerPin: createdNote?.customerPin || cnCustomerPin,
        vehiclePlate: createdNote?.vehiclePlate || cnVehiclePlate,
        status: 'Completed',
      };

      setShowCreditNoteModal(false);
      onOpenReceipt?.(previewTx);
      toast.success('Credit note issued successfully.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to issue credit note.');
    } finally {
      setIsSubmittingCN(false);
    }
  };

  // --- DOCUMENT HISTORY & PAGINATION (unchanged) ---
  const documentArchive: Array<{
    id: string;
    type: 'Tax Invoice' | 'Receipt' | 'Credit Note' | 'Fuel Delivery' | 'Shift Reconciliation';
    docNo: string;
    timestamp: string;
    customer: string;
    amount: number;
    details: any;
  }> = [
    ...safeTransactions.map((t) => {
      const kind = resolveTransactionDocumentKind(t);
      return {
        id: `${t.id}-${kind === 'Invoice' ? 'inv' : 'rcpt'}`,
        type: kind === 'Invoice' ? ('Tax Invoice' as const) : ('Receipt' as const),
        docNo: kind === 'Invoice' ? (t.taxInvoiceNo || t.receiptNo || '') : (t.receiptNo || t.taxInvoiceNo || ''),
        timestamp: t.timestamp,
        customer: t.customerName || 'Walk-in Customer',
        amount: t.totalAmount,
        details: t,
      };
    }),
    ...safeCreditNotes.map((cn) => ({
      id: cn.id,
      type: 'Credit Note' as const,
      docNo: cn.creditNoteNo,
      timestamp: cn.timestamp,
      customer: cn.customerName,
      amount: cn.totalAmount,
      details: cn,
    })),
    ...safeDeliveries.map((del) => ({
      id: del.id,
      type: 'Fuel Delivery' as const,
      docNo: del.deliveryNoteNo,
      timestamp: del.timestamp,
      customer: `Supplier: ${del.supplierName}`,
      amount: del.totalCost,
      details: del,
    })),
    ...safeReconciliations.map((rec) => ({
      id: rec.id,
      type: 'Shift Reconciliation' as const,
      docNo: rec.id.toUpperCase(),
      timestamp: rec.timestamp,
      customer: `Staff: ${rec.staffName}`,
      amount: (() => {
        const shift = safeShifts.find((item) => item.id === rec.shiftId);
        return Number(shift?.totalFuelSales ?? 0) + Number(shift?.totalShopSales ?? 0);
      })(),
      details: rec,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredTx = safeTransactions.filter((t) => {
    const q = searchTerm.toLowerCase();
    const taxInvoiceNo = String(t?.taxInvoiceNo ?? '').toLowerCase();
    const receiptNo = String(t?.receiptNo ?? '').toLowerCase();
    const customerName = String(t?.customerName ?? '').toLowerCase();
    const customerPin = String(t?.customerPin ?? '').toLowerCase();
    const vehiclePlate = String(t?.vehiclePlate ?? '').toLowerCase();

    return (
      taxInvoiceNo.includes(q) ||
      receiptNo.includes(q) ||
      customerName.includes(q) ||
      customerPin.includes(q) ||
      vehiclePlate.includes(q)
    );
  });

  const filteredCustomers = safeCustomers.filter((c) => {
    const q = searchTerm.toLowerCase();
    const name = String(c?.name ?? '').toLowerCase();
    const kraPin = String(c?.kraPin ?? '').toLowerCase();
    const phone = String(c?.phone ?? '');
    const vehicles = Array.isArray(c?.vehicles) ? c.vehicles : [];

    return (
      name.includes(q) ||
      kraPin.includes(q) ||
      phone.includes(searchTerm) ||
      vehicles.some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  });

  const filteredArchive = documentArchive.filter((doc) => {
    if (activeSubTab === 'delivery-records' && doc.type !== 'Fuel Delivery') return false;
    if (activeSubTab === 'reconciliation-documents' && doc.type !== 'Shift Reconciliation') return false;
    const q = searchTerm.toLowerCase();
    const docNo = String(doc?.docNo ?? '').toLowerCase();
    const type = String(doc?.type ?? '').toLowerCase();
    const customer = String(doc?.customer ?? '').toLowerCase();

    return docNo.includes(q) || type.includes(q) || customer.includes(q);
  });

  const filteredCreditNotes = safeCreditNotes.filter((creditNote) => {
    const q = searchTerm.toLowerCase();
    return [
      creditNote.creditNoteNo,
      creditNote.customerName,
      creditNote.customerPin,
      creditNote.originalInvoiceNo,
      creditNote.originalReceiptNo,
      creditNote.reason,
    ].some((value) => String(value ?? '').toLowerCase().includes(q));
  }).sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime());

  const invoicePagination = usePagination(filteredTx, `invoices:${searchTerm.trim().toLowerCase()}`);
  const customerPagination = usePagination(filteredCustomers, `customers:${searchTerm.trim().toLowerCase()}`);
  const creditNotePagination = usePagination(filteredCreditNotes, `credit-notes:${searchTerm.trim().toLowerCase()}`);
  const archivePagination = usePagination(filteredArchive, `${activeSubTab}:${searchTerm.trim().toLowerCase()}`);

  // --- RENDER ---
  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            eTIMS Invoices, Corporate Debt & Document Archive
          </h2>
          <p className="text-xs text-slate-400">
            Issue KRA eTIMS tax invoices, manage corporate customer credit limits, log repayments, and reprint all official documents.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'invoices'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Tax Invoices & Receipts
          </button>
          <button
            onClick={() => setActiveSubTab('customers')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'customers'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Corporate Accounts & Debt
          </button>
          <button
            onClick={() => setActiveSubTab('credit-notes')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'credit-notes'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Credit Notes ({creditNotes.length})
          </button>
          <button
            onClick={() => setActiveSubTab('document-history')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'document-history'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Reprint & History
          </button>
          <button
            onClick={() => setActiveSubTab('delivery-records')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'delivery-records'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Delivery Records
          </button>
          <button
            onClick={() => setActiveSubTab('reconciliation-documents')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'reconciliation-documents'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Shift Reconciliation Reports
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by Invoice No, Customer Name, KRA PIN, Vehicle Plate, Document No..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-mono"
        />
      </div>

      {/* TAB 1: TAX INVOICES & RECEIPTS */}
      {activeSubTab === 'invoices' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-3 border-b border-slate-800">
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              eTIMS Tax Invoices & POS Receipts ({filteredTx.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                KRA Standard 16% VAT Tax Compliant
              </span>
              <button
                type="button"
                onClick={() => setActiveSubTab('credit-notes')}
                className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px]"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                View Credit Notes ({creditNotes.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Invoice / Receipt No</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Customer & PIN</th>
                  <th className="p-3.5">Vehicle</th>
                  <th className="p-3.5">Payment</th>
                  <th className="p-3.5">Total (KES)</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                {filteredTx.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                      No invoices or receipts found.
                    </td>
                  </tr>
                ) : (
                  invoicePagination.pageItems.map((tx) => {
                    const docKind = resolveTransactionDocumentKind(tx);
                    const docNumber = docKind === 'Invoice' ? (tx.taxInvoiceNo || 'Inv000') : (tx.receiptNo || 'Rcpt000');
                    const docNumberTone = docKind === 'Invoice' ? 'text-emerald-400' : 'text-blue-400';

                    return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className={`font-bold ${docNumberTone}`}>{docNumber}</div>
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleString('en-KE')}
                      </td>
                      <td className="p-3.5 font-sans">
                        <div className="font-bold text-slate-200">{tx.customerName || 'Walk-in Customer'}</div>
                        {tx.customerPin && <div className="text-[10px] text-emerald-400 font-mono">PIN: {tx.customerPin}</div>}
                      </td>
                      <td className="p-3.5 text-slate-300 font-bold">{tx.vehiclePlate || '—'}</td>
                      <td className="p-3.5 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.paymentMethod === 'Credit'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : tx.paymentMethod === 'M-Pesa'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {tx.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-100 text-sm">
                        KES {(tx.totalAmount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-sans">
                        <div className="flex justify-end gap-2 ml-auto">
                          {canCreateCreditNote && (
                            <button
                              onClick={() => openCreditNoteModalForTransaction(tx)}
                              className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px]"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Credit Note
                            </button>
                          )}
                          <button
                            onClick={() => onOpenReceipt && onOpenReceipt(tx)}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-bold rounded-lg transition-all flex items-center gap-1 text-[11px]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reprint {tx.documentType === 'Invoice' ? 'Invoice' : 'Receipt'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={invoicePagination.currentPage}
            totalPages={invoicePagination.totalPages}
            itemCount={filteredTx.length}
            onPageChange={invoicePagination.setCurrentPage}
          />
        </div>
      )}

      {/* TAB 2: CORPORATE CUSTOMER ACCOUNTS & DEBT LIMITS */}
      {activeSubTab === 'customers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Corporate Fleet Accounts & Credit Debt Limits
              </h3>
              <p className="text-xs text-slate-400">
                Set approved credit limits for fleet customers. Sales automatically check outstanding debt before authorizing credit fueling.
              </p>
            </div>

            {/* ✅ Register New Customer – uses granular OR canManageUsers */}
            {(canManageCreditCustomers || canManageUsers) && (
              <button
                onClick={openNewCustomer}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                Register New Customer
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-500 italic bg-slate-950 rounded-2xl border border-slate-800">
                No corporate customer accounts found.
              </div>
            ) : (
              customerPagination.pageItems.map((cust) => {
                const usedPct = Math.min(100, Math.round((cust.currentBalance / cust.creditLimit) * 100));
                const remainingCredit = Math.max(0, cust.creditLimit - cust.currentBalance);

                return (
                  <div
                    key={cust.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-100 text-base">{cust.name}</h4>
                          <span className="text-[11px] text-emerald-400 font-mono font-bold">
                            KRA PIN: {cust.kraPin}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            cust.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : cust.status === 'Suspended'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="text-xs text-slate-400 space-y-1 font-sans">
                        <div>Phone: {cust.phone}</div>
                        {cust.email && <div>Email: {cust.email}</div>}
                      </div>

                      {/* Fleet Vehicles */}
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                          Authorized Fleet Vehicles ({cust.vehicles?.length || 0})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(cust.vehicles || []).map((v, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300 font-bold"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Debt & Credit Limit Progress */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Credit Limit:</span>
                          <span className="font-bold text-slate-200">
                            KES {cust.creditLimit.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Outstanding Debt:</span>
                          <span className="font-bold text-rose-400">
                            KES {cust.currentBalance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-400 border-t border-slate-800/80 pt-1.5 font-bold">
                          <span>Available Credit:</span>
                          <span>KES {remainingCredit.toLocaleString()}</span>
                        </div>

                        {/* Limit Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                usedPct > 85 ? 'bg-rose-500' : usedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Limit Used: {usedPct}%</span>
                            <span>{cust.currentBalance > cust.creditLimit ? 'OVER LIMIT!' : 'OK'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-slate-800 text-xs">
                      {/* ✅ Record Repayment – uses granular OR canManageUsers */}
                      {(canRecordCreditPayment || canManageUsers) && (
                        <button
                          onClick={() => {
                            setSelectedRepayCust(cust);
                            setRepayAmount(cust.currentBalance);
                            setShowRepaymentModal(true);
                          }}
                          className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Record Repayment
                        </button>
                      )}

                      {/* ✅ Edit Limit / Info – uses granular OR canManageUsers */}
                      {(canManageCreditCustomers || canManageUsers) && (
                        <button
                          onClick={() => openEditCustomer(cust)}
                          className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors"
                        >
                          Edit Limit / Info
                        </button>
                      )}
                      {hasPermission('DELETE_CUSTOMER') && <button onClick={() => setCustomerToDelete(cust)} className="py-2 px-2 text-rose-300 hover:text-rose-200 font-bold">Delete</button>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <PaginationControls
            currentPage={customerPagination.currentPage}
            totalPages={customerPagination.totalPages}
            itemCount={filteredCustomers.length}
            onPageChange={customerPagination.setCurrentPage}
          />
        </div>
      )}

      {/* TAB 3: CREDIT NOTES */}
      {activeSubTab === 'credit-notes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                eTIMS Official Credit Notes & Invoice Reversals ({creditNotes.length})
              </h3>
              <p className="text-xs text-slate-400">
                Official KRA tax adjustments issued to corporate customers for price corrections or returns.
              </p>
            </div>

            {canCreateCreditNote && (
              <button
                onClick={() => {
                  setCnCustomerName('');
                  setCnCustomerPin('');
                  setCnVehiclePlate('');
                  setCnOriginalInvoiceNo('');
                  setCnOriginalReceiptNo('');
                  setCnItemName('');
                  setCnQty(1);
                  setCnUnitPrice(100);
                  setCnReason('01');
                  setCnNarration('');
                  setCnCreditType('partial');
                  setShowCreditNoteModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Issue New Credit Note
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Credit Note No</th>
                  <th className="p-3.5">Original Document No</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer & PIN</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5">Credit Amount</th>
                  <th className="p-3.5">Issued By</th>
                  <th className="p-3.5 text-right">Print / Reprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                {filteredCreditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                      No credit notes issued.
                    </td>
                  </tr>
                ) : (
                  creditNotePagination.pageItems.map((cn) => {
                    const reference = getCreditNoteReference(cn);

                    return (
                      <tr key={cn.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-rose-400">{cn.creditNoteNo}</td>
                        <td className="p-3.5 text-slate-300 font-semibold">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{reference.label}</div>
                          <div className="font-bold text-slate-100">{reference.value}</div>
                        </td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {new Date(cn.timestamp).toLocaleString('en-KE')}
                        </td>
                        <td className="p-3.5 font-sans">
                          <div className="font-bold text-slate-200">{cn.customerName}</div>
                          {cn.customerPin && <div className="text-[10px] text-emerald-400">PIN: {cn.customerPin}</div>}
                        </td>
                        <td className="p-3.5 font-sans text-slate-300">{cn.reason}</td>
                        <td className="p-3.5 font-bold text-rose-400 text-sm">
                          KES {(cn.totalAmount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 font-sans text-slate-400">
                          {cn.issuedByName || cn.issuedBy || 'System'}
                        </td>
                        <td className="p-3.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => openCreditNoteReprint(cn)}
                            className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold rounded-lg transition-all flex items-center gap-1 ml-auto text-[11px]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print / Reprint
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={creditNotePagination.currentPage}
            totalPages={creditNotePagination.totalPages}
            itemCount={filteredCreditNotes.length}
            onPageChange={creditNotePagination.setCurrentPage}
          />
        </div>
      )}

      {/* TAB 4: DOCUMENT HISTORY & REPRINTING */}
      {(activeSubTab === 'document-history' || activeSubTab === 'delivery-records' || activeSubTab === 'reconciliation-documents') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                {activeSubTab === 'delivery-records' ? 'Fuel Delivery Records' : activeSubTab === 'reconciliation-documents' ? 'Shift Reconciliation Reports' : 'Complete Document History & Instant Reprint Archive'}
              </h3>
              <p className="text-xs text-slate-400">
                {activeSubTab === 'delivery-records' ? 'Saved fuel delivery records.' : activeSubTab === 'reconciliation-documents' ? 'Saved shift reconciliation reports.' : 'Permanent log of all generated Tax Invoices, Receipts, Credit Notes, Tanker Deliveries, and Shift Reconciliations.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Document Type</th>
                  <th className="p-3.5">Document Reference No</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Customer / Entity</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5 text-right">Reprint Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                {filteredArchive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                      No document history records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  archivePagination.pageItems.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-sans">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            doc.type === 'Tax Invoice'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : doc.type === 'Credit Note'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : doc.type === 'Fuel Delivery'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : doc.type === 'Shift Reconciliation'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {doc.type}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-100">{doc.docNo}</td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {new Date(doc.timestamp).toLocaleString('en-KE')}
                      </td>
                      <td className="p-3.5 font-sans text-slate-300 font-semibold">{doc.customer}</td>
                      <td className="p-3.5 font-bold text-slate-100 text-sm">
                        KES {(doc.amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-sans">
                        <button
                          onClick={() => {
                            if (doc.type === 'Tax Invoice' || doc.type === 'Receipt' || doc.type === 'Credit Note') {
                              onOpenReceipt && onOpenReceipt(doc.details);
                            } else {
                              setSelectedDoc({
                                type: doc.type,
                                title: doc.type,
                                docNo: doc.docNo,
                                timestamp: doc.timestamp,
                                customer: doc.customer,
                                details: doc.details,
                              });
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold rounded-lg transition-all flex items-center gap-1 ml-auto text-[11px]"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          Reprint {doc.type}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={archivePagination.currentPage}
            totalPages={archivePagination.totalPages}
            itemCount={filteredArchive.length}
            onPageChange={archivePagination.setCurrentPage}
          />
        </div>
      )}

      <AppDialog open={Boolean(customerToDelete)} kind="delete" title="Delete customer" message={`Delete ${customerToDelete?.name || 'this customer'}? Customers with invoices, credit history, or outstanding balances are protected.`} busy={deletingCustomer} onClose={() => setCustomerToDelete(null)} onConfirm={deleteCustomer} />

      {/* CUSTOMER ACCOUNT CREATION / EDIT MODAL */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                {editingCustomer ? 'Edit Corporate Account & Credit Limit' : 'Register New Corporate Customer'}
              </h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} className="space-y-4 text-xs">
              {customerFormError && (
                <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300">
                  {customerFormError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Company / Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => { setCustName(e.target.value); setCustomerFormError(''); }}
                    aria-invalid={/name/i.test(customerFormError)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-semibold focus:outline-none ${/name/i.test(customerFormError) ? 'border-rose-500' : 'border-slate-800'}`}
                    placeholder="e.g. Kenya Bus Service Ltd"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">KRA PIN Number *</label>
                  <input
                    type="text"
                    required
                    value={custPin}
                    onChange={(e) => { setCustPin(e.target.value.toUpperCase()); setCustomerFormError(''); }}
                    aria-invalid={/KRA PIN/i.test(customerFormError)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none ${/KRA PIN/i.test(customerFormError) ? 'border-rose-500' : 'border-slate-800'}`}
                    placeholder="e.g. P051234567A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                    placeholder="0722000000"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                    placeholder="accounts@company.co.ke"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Approved Credit Limit (KES) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-sm font-bold text-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Account Status</label>
                  <select
                    value={custStatus}
                    onChange={(e) => setCustStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none"
                  >
                    <option value="Active">Active (Credit Allowed)</option>
                    <option value="Suspended">Suspended (Temporary Hold)</option>
                    <option value="Blocked">Blocked (Overdue Debt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Fleet Vehicle Plates (Comma Separated)</label>
                <input
                  type="text"
                  value={custVehicles}
                  onChange={(e) => setCustVehicles(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none"
                  placeholder="KBB 101A, KCC 202B, KBZ 303C"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmittingCust ? 'Saving...' : 'Save Customer Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPAYMENT MODAL */}
      {showRepaymentModal && selectedRepayCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Record Debt Repayment — {selectedRepayCust.name}
              </h3>
              <button onClick={() => setShowRepaymentModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>KRA PIN:</span>
                <span className="text-emerald-400 font-bold">{selectedRepayCust.kraPin}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Current Debt Balance:</span>
                <span className="text-rose-400 font-bold">
                  KES {selectedRepayCust.currentBalance.toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRepaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Repayment Amount (KES) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={repayAmount || ''}
                  onChange={(e) => setRepayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={repayMethod}
                    onChange={(e) => setRepayMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="M-Pesa">M-Pesa Paybill</option>
                    <option value="Cash">Cash Handover</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Bank / M-Pesa Ref</label>
                  <input
                    type="text"
                    value={repayRef}
                    onChange={(e) => setRepayRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                    placeholder="e.g. MP89102X"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  placeholder="Partial / Full account settlement"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepaymentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepay}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmittingRepay ? 'Processing...' : 'Confirm Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE CREDIT NOTE MODAL */}
      {showCreditNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                Issue eTIMS Official Credit Note
              </h3>
              <button onClick={() => setShowCreditNoteModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreditNoteSubmit} className="space-y-4 text-xs overflow-y-auto max-h-[calc(90vh-110px)] pr-1 mt-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-rose-200">
                <div className="font-bold text-rose-300 uppercase tracking-wide mb-2">Credit Note / Return</div>
                <div className="text-[11px] text-rose-200/80">For returns, refunds and invoice corrections that reduce the original amount.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Document Type</label>
                  <select
                    value={cnDocumentType}
                    onChange={(e) => {
                      clearCreditSource(e.target.value as 'receipt' | 'invoice');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="receipt">Receipt</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    {cnDocumentType === 'receipt' ? 'Receipt Number' : 'Invoice Number'}
                  </label>
                  <input
                    type="text"
                    value={cnDocumentType === 'receipt' ? cnOriginalReceiptNo : cnOriginalInvoiceNo}
                    onChange={(e) => {
                      const documentNo = e.target.value;
                      const sourceTx = safeTransactions.find((tx) => cnDocumentType === 'receipt'
                        ? !!tx.receiptNo && normalizeDocumentNumber(tx.receiptNo, 'Rcpt') === normalizeDocumentNumber(documentNo, 'Rcpt')
                        : !!tx.taxInvoiceNo && normalizeDocumentNumber(tx.taxInvoiceNo, 'Inv') === normalizeDocumentNumber(documentNo, 'Inv'));
                      if (sourceTx) loadCreditSource(sourceTx);
                      else clearCreditSource(cnDocumentType, documentNo);
                    }}
                    list={`credit-source-${cnDocumentType}`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none"
                    placeholder={cnDocumentType === 'receipt' ? 'Rcpt000' : 'Inv000'}
                  />
                  <datalist id={`credit-source-${cnDocumentType}`}>
                    {safeTransactions
                      .filter((tx) => cnDocumentType === 'receipt' ? !!tx.receiptNo : !!tx.taxInvoiceNo)
                      .map((tx) => {
                        const documentNo = cnDocumentType === 'receipt' ? tx.receiptNo : tx.taxInvoiceNo;
                        return <option key={tx.id} value={documentNo} label={tx.customerName || 'Walk-in Customer'} />;
                      })}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={cnCustomerName}
                    onChange={(e) => setCnCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none"
                    placeholder="e.g. Kenya Bus Service"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Customer KRA PIN</label>
                  <input
                    type="text"
                    value={cnCustomerPin}
                    onChange={(e) => setCnCustomerPin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none"
                    placeholder="P051234567A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Credit Reason *</label>
                  <select
                    value={cnReason}
                    onChange={(e) => setCnReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    {Object.entries(creditReasonOptions).map(([code, label]) => (
                      <option key={code} value={code}>{code} - {label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Credit Note Type</label>
                  <select
                    value={cnCreditType}
                    onChange={(e) => setCnCreditType(e.target.value as 'full' | 'partial')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="full">Full Credit Note (Full Return)</option>
                    <option value="partial">Partial Credit Note (Partial Return)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Vehicle Plate</label>
                  <input
                    type="text"
                    value={cnVehiclePlate}
                    onChange={(e) => setCnVehiclePlate(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                    placeholder="KBB 101A"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Credit Note Narration</label>
                  <input
                    type="text"
                    value={cnNarration}
                    onChange={(e) => setCnNarration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                    placeholder="Explain why the credit note is being issued"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-200 uppercase tracking-wide">Step 3: Select Items to Credit</div>
                  <div className="text-[10px] text-slate-400">
                    {selectedCreditRows.filter((item) => item.selected).length} selected
                  </div>
                </div>

                {selectedCreditRows.length > 0 ? (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <div className="min-w-[680px]">
                        <div className="grid grid-cols-[32px,1.4fr,70px,80px,90px,90px,100px] gap-2 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-800 pb-2">
                          <span>Sel</span>
                          <span>Item</span>
                          <span>Orig Qty</span>
                          <span>Available</span>
                          <span>Qty to Credit</span>
                          <span>Unit Price</span>
                          <span>Amount</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto pr-1 mt-2 space-y-2">
                          {selectedCreditRows.map((item) => (
                            <div key={item.itemId} className="grid grid-cols-[32px,1.4fr,70px,80px,90px,90px,100px] gap-2 items-center text-[11px] min-w-[680px]">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => {
                                  setCnSelectedItems((prev) => ({
                                    ...prev,
                                    [item.itemId]: {
                                      ...item,
                                      selected: !item.selected,
                                      qty: item.selected ? item.qty : item.remainingQty,
                                      totalPrice: Number(item.unitPrice || 0) * Number(item.selected ? item.qty : item.remainingQty),
                                      totalAmount: Number(item.unitPrice || 0) * Number(item.selected ? item.qty : item.remainingQty),
                                      taxAmount: Number(item.taxRate || 0) === 0 ? 0 : ((Number(item.unitPrice || 0) * Number(item.selected ? item.qty : item.remainingQty) * Number(item.taxRate || 0)) / (1 + Number(item.taxRate || 0))),
                                      taxableAmount: (Number(item.unitPrice || 0) * Number(item.selected ? item.qty : item.remainingQty)) - (Number(item.taxRate || 0) === 0 ? 0 : ((Number(item.unitPrice || 0) * Number(item.selected ? item.qty : item.remainingQty) * Number(item.taxRate || 0)) / (1 + Number(item.taxRate || 0)))),
                                    },
                                  }));
                                }}
                                className="h-4 w-4 accent-emerald-500"
                              />
                              <div>
                                <div className="font-semibold text-slate-100">{item.name}</div>
                                <div className="text-[9px] text-slate-400 uppercase">{item.type}</div>
                              </div>
                              <div className="font-mono text-slate-300">{item.originalQty}</div>
                              <div className="font-mono text-emerald-400">{item.remainingQty}</div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                max={item.remainingQty}
                                value={item.qty}
                                onChange={(e) => {
                                  const nextQty = Math.min(Math.max(0, Number(e.target.value || 0)), item.remainingQty);
                                  const nextTotalPrice = Number(item.unitPrice || 0) * nextQty;
                                  const taxRate = Number(item.taxRate || 0);
                                  const nextTaxAmount = taxRate === 0 ? 0 : (nextTotalPrice * taxRate) / (1 + taxRate);
                                  setCnSelectedItems((prev) => ({
                                    ...prev,
                                    [item.itemId]: {
                                      ...item,
                                      qty: nextQty,
                                      selected: nextQty > 0,
                                      totalPrice: nextTotalPrice,
                                      totalAmount: nextTotalPrice,
                                      taxAmount: nextTaxAmount,
                                      taxableAmount: nextTotalPrice - nextTaxAmount,
                                    },
                                  }));
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 font-mono text-white focus:outline-none"
                              />
                              <div className="font-mono text-emerald-400 font-bold">KES {Number(item.unitPrice || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
                              <div className="font-mono text-slate-100 font-bold">KES {(Number(item.qty || 0) * Number(item.unitPrice || 0)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    Select an existing receipt or invoice number to load its creditable items.
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>Original Document Total</span>
                    <span className="font-bold text-slate-100">
                      KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(currentCreditSummary.originalTotal || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>Already Credited</span>
                    <span className="font-bold text-amber-300">
                      KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(currentCreditSummary.alreadyCredited)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>Remaining Credit</span>
                    <span className="font-bold text-emerald-400">
                      KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(currentCreditSummary.remainingCredit)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                    <div>Original Amount</div>
                    <div>Credit Amount</div>
                    <div>Net Balance</div>
                    <div className="font-bold text-slate-100">KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format((cnQty * cnUnitPrice) || 0)}</div>
                    <div className={`font-bold ${isOverAmountLimit ? 'text-rose-400' : 'text-rose-400'}`}>
                      KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(proposedCreditValue || 0)}
                    </div>
                    <div className="font-bold text-emerald-400">
                      KES {new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(Math.max(currentCreditSummary.remainingCredit - proposedCreditValue, 0))}
                    </div>
                  </div>
                  {(isOverQtyLimit || isOverAmountLimit) && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                      {isOverQtyLimit ? `Quantity exceeds the original document limit (${maxAllowedQty}).` : `Amount exceeds the remaining creditable amount (KES ${currentCreditSummary.remainingCredit.toFixed(2)} remaining).`}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreditNoteModal(false);
                    setCreditNoteDocumentLock(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCN || !cnSourceTransactionId || selectedCreditRows.filter((item) => item.selected).length === 0 || isOverQtyLimit || isOverAmountLimit}
                  onClick={() => setCreditNoteDocumentLock(null)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmittingCN ? 'Issuing...' : (isOverQtyLimit || isOverAmountLimit) ? 'Over Credit Limit' : 'Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT REPRINT PREVIEW MODAL */}
      {selectedDoc && !['Fuel Delivery', 'Shift Reconciliation'].includes(selectedDoc.type) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0">
          <div className="relative flex h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-none border border-slate-700 bg-slate-800 shadow-2xl">
            <div className="w-[320px] bg-slate-800 p-4 text-slate-100 border-r border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="text-2xl font-bold tracking-tight">Print</div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600"
                  aria-label="Close print preview"
                >
                  ×
                </button>
              </div>

              <div className="mb-6 text-sm text-slate-300">
                <div className="font-medium">Total: 1 page</div>
              </div>

              <div className="mb-5 border-b border-slate-700 pb-4">
                <div className="mb-3 text-sm font-semibold text-slate-300">Printer</div>
                <button
                  type="button"
                  onClick={handleSelectedDocumentPrint}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-600"
                >
                  Save as PDF
                </button>
              </div>

              <div className="mb-5 border-b border-slate-700 pb-4">
                <div className="mb-3 text-sm font-semibold text-slate-300">Layout</div>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-3 text-slate-200">
                    <input type="radio" name="print-layout" defaultChecked className="h-4 w-4 accent-sky-500" />
                    <span>Portrait</span>
                  </label>
                  <label className="flex items-center gap-3 text-slate-200">
                    <input type="radio" name="print-layout" className="h-4 w-4 accent-sky-500" />
                    <span>Landscape</span>
                  </label>
                </div>
              </div>

              <div className="mb-5 border-b border-slate-700 pb-4">
                <div className="mb-3 text-sm font-semibold text-slate-300">Pages</div>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-3 text-slate-200">
                    <input type="radio" name="print-pages" defaultChecked className="h-4 w-4 accent-sky-500" />
                    <span>All</span>
                  </label>
                  <label className="flex items-center gap-3 text-slate-200">
                    <input type="radio" name="print-pages" className="h-4 w-4 accent-sky-500" />
                    <span>Odd pages only</span>
                  </label>
                  <label className="flex items-center gap-3 text-slate-200">
                    <input type="radio" name="print-pages" className="h-4 w-4 accent-sky-500" />
                    <span>Even pages only</span>
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      defaultValue="e.g. 1-5, 8, 11-13"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-300 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>More settings</span>
                  <span>⌄</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSelectedDocumentPrint}
                  className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="flex-1 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="flex flex-1 items-start justify-center overflow-y-auto bg-[#f1f1f1] p-5">
              <div data-reprint-document className="w-full max-w-[520px] bg-white p-5 text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
                {printError && (
                  <div className="no-print mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
                    Unable to print: {printError}
                  </div>
                )}
                <div className="border-b border-slate-200 pb-3 text-center">
                  <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                    {activeSettings?.stationName || 'DT-FMS PETROLEUM LTD'}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-600">
                    {activeSettings?.address || 'Westlands Highway Station #04'} | TEL: {activeSettings?.phone || '+254 (0) 700 123 456'}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    KRA eTIMS PIN: {activeSettings?.taxPin || 'P051892301A'}
                  </p>
                  <div className="mt-2 inline-block rounded bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase text-white">
                    Official {selectedDoc.title} Reprint
                  </div>
                </div>

                <div className="mt-3 space-y-1 border-b border-slate-200 pb-3 text-[11px]">
                  <div className="flex justify-between">
                    <span>Document No:</span>
                    <span className="font-bold">{selectedDoc.docNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date / Time:</span>
                    <span>{new Date(selectedDoc.timestamp).toLocaleString('en-KE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer / Entity:</span>
                    <span className="font-bold">{selectedDoc.customer}</span>
                  </div>
                </div>

                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-[11px]">
                  <div className="mb-2 border-b border-slate-200 pb-1 font-bold text-slate-700">Credit Note Details</div>

                  {(() => {
                    const cn = selectedDoc.details as any;
                    const items = Array.isArray(cn?.items) ? cn.items : [];
                    const subtotal = Number(cn?.subtotal || items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0));
                    const taxAmount = Number(cn?.taxAmount || items.reduce((sum: number, item: any) => sum + Number(item.taxAmount || 0), 0));
                    const totalAmount = Number(cn?.totalAmount || subtotal + taxAmount);
                    const docTypeHeading = selectedDoc.type === 'Credit Note' ? 'CREDIT NOTE' : selectedDoc.title?.toUpperCase() || 'DOCUMENT';

                    return (
                      <div className="thermal-receipt w-full max-w-[520px] bg-white text-slate-900">
                        <div className="border-b border-slate-200 pb-2 text-center">
                          <div className="text-[12px] font-extrabold uppercase tracking-wide text-slate-900">{docTypeHeading}</div>
                          <div className="mt-1 text-[10px] text-slate-600">
                            {(activeSettings?.stationName || 'DT-FMS PETROLEUM LTD').toUpperCase()}
                          </div>
                          <div className="text-[9px] text-slate-600">
                            {(activeSettings?.address || 'Westlands Highway Station #04')}
                          </div>
                          <div className="text-[9px] text-slate-600">
                            PIN: {(activeSettings?.taxPin || 'P051892301A')}
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 text-[10px] text-slate-700">
                          <div className="flex justify-between">
                            <span>Document No:</span>
                            <span className="font-bold">{selectedDoc.docNo}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Original Document No:</span>
                            <span className="font-bold">{getCreditNoteReference(cn as CreditNote).value}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Date / Time:</span>
                            <span>{new Date(selectedDoc.timestamp).toLocaleString('en-KE')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customer:</span>
                            <span className="font-bold">{cn?.customerName || selectedDoc.customer || 'Walk-in Customer'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Reason:</span>
                            <span>{cn?.reason || 'Adjustment'}</span>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-b border-slate-200 py-2">
                          <div className="grid grid-cols-[1.5fr_0.5fr_0.8fr_0.9fr] gap-1 text-[9px] font-bold uppercase text-slate-700">
                            <div>Item</div>
                            <div className="text-right">Qty</div>
                            <div className="text-right">Price</div>
                            <div className="text-right">Total</div>
                          </div>

                          {items.map((item: any, index: number) => (
                            <div key={`${item.name || 'item'}-${index}`} className="mt-1 grid grid-cols-[1.5fr_0.5fr_0.8fr_0.9fr] gap-1 text-[9px] text-slate-800">
                              <div className="pr-1">{String(item.name || 'ITEM').toUpperCase()}</div>
                              <div className="text-right">{Number(item.qty || 0).toFixed(1)}</div>
                              <div className="text-right">{Number(item.unitPrice || 0).toFixed(2)}</div>
                              <div className="text-right">{Number(item.totalPrice || 0).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-1 text-[10px] text-slate-700">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>KES {subtotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>VAT</span>
                            <span>KES {taxAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="border-t border-slate-200 mt-1 pt-1 flex justify-between font-bold text-slate-900">
                            <span>TOTAL</span>
                            <span>KES {totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-200 pt-2 text-center text-[9px] text-slate-600">
                          <p>*** eTIMS VERIFIED OFFICIAL DOCUMENT RECORD ***</p>
                          <p className="italic">
                            {activeSettings?.invoiceTerms || 'Thank you for choosing DT-FMS Stations'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
                  <p>*** eTIMS VERIFIED OFFICIAL DOCUMENT RECORD ***</p>
                  <p className="italic">
                    {activeSettings?.invoiceTerms || 'Thank you for choosing DT-FMS Stations'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDoc?.type === 'Fuel Delivery' && (
        <OperationalDocumentPreview fileName={selectedDoc.docNo} onClose={() => setSelectedDoc(null)}>
          <FuelDeliveryDocument delivery={selectedDoc.details as FuelDelivery} settings={activeSettings} documentNo={selectedDoc.docNo} />
        </OperationalDocumentPreview>
      )}

      {selectedDoc?.type === 'Shift Reconciliation' && (
        <OperationalDocumentPreview fileName={selectedDoc.docNo} onClose={() => setSelectedDoc(null)}>
          <ShiftReconciliationDocument reconciliation={selectedDoc.details as ThreeWayReconciliation} shift={safeShifts.find((item) => item.id === (selectedDoc.details as ThreeWayReconciliation).shiftId)} settings={activeSettings} />
        </OperationalDocumentPreview>
      )}
    </div>
  );
};
