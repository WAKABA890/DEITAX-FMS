import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FuelDelivery, ShiftSession, StationSettings, ThreeWayReconciliation } from '../types';
import { printSelectedDocument } from '../utils/print-document';

const money = (value: number) => `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const liters = (value: number) => `${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })} L`;

const DocumentHeader = ({ settings, title }: { settings?: StationSettings | null; title: string }) => (
  <header className="border-b border-slate-200 pb-3 text-center">
    <h1 className="text-sm font-extrabold uppercase text-slate-900">{settings?.stationName || 'DT-FMS PETROLEUM LTD'}</h1>
    {(settings?.address || settings?.phone || settings?.taxPin) && (
      <div className="mt-1 text-[9px] text-slate-600">
        <p>{[settings?.address, settings?.phone].filter(Boolean).join(' | ')}</p>
        {settings?.taxPin && <p>KRA PIN: {settings.taxPin}</p>}
      </div>
    )}
    <h2 className="mt-3 text-[11px] font-extrabold uppercase text-slate-900">{title}</h2>
  </header>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-4 border-b border-slate-200 pb-1 text-[10px] font-bold uppercase text-slate-700">{children}</h2>
);

export const FuelDeliveryDocument = ({ delivery, settings, documentNo }: { delivery: FuelDelivery; settings?: StationSettings | null; documentNo?: string }) => {
  const openingLevel = Number(delivery.openingLevel ?? 0);
  const litersReceived = Number(delivery.litersReceived ?? 0);
  const storedClosingLevel = Number(delivery.closingLevel ?? 0);
  const closingLevel = storedClosingLevel || openingLevel + litersReceived;

  return (
    <article data-printable-document data-reprint-document className="thermal-receipt document-preview-paper w-[80mm] max-w-full bg-white p-4 text-slate-900">
      <DocumentHeader settings={settings} title="Delivery Record" />
      <SectionTitle>Delivery Information</SectionTitle>
      <dl className="mt-2 space-y-1 text-[10px] text-slate-700">
        <div className="flex justify-between gap-3"><dt>Delivery Reference</dt><dd className="font-bold text-right">{documentNo || delivery.deliveryNoteNo}</dd></div>
        <div className="flex justify-between gap-3"><dt>Date / Time</dt><dd className="text-right">{new Date(delivery.timestamp).toLocaleString('en-KE')}</dd></div>
        <div className="flex justify-between gap-3"><dt>Supplier</dt><dd className="font-bold text-right">{delivery.supplierName}</dd></div>
        <div className="flex justify-between gap-3"><dt>Vehicle Registration</dt><dd className="text-right">{delivery.truckPlate || 'Not Provided'}</dd></div>
        <div className="flex justify-between gap-3"><dt>Driver</dt><dd className="text-right">{delivery.driverName || 'Not Provided'}</dd></div>
        <div className="flex justify-between gap-3"><dt>Logged By</dt><dd className="text-right">{delivery.receivedBy || 'Station Staff'}</dd></div>
      </dl>
      <SectionTitle>Delivery Details</SectionTitle>
      <div className="mt-2 grid grid-cols-[1.3fr_0.7fr] gap-y-1 text-[10px] text-slate-700">
        <span>Tank / Product</span><strong className="text-right">{delivery.tankName}</strong>
        <span>Quantity</span><strong className="text-right">{liters(litersReceived)}</strong>
        <span>Unit Price</span><strong className="text-right">{money(delivery.costPerLiter)}</strong>
        <span>Delivery Value</span><strong className="text-right">{money(delivery.totalCost)}</strong>
      </div>
      <SectionTitle>Tank Reconciliation</SectionTitle>
      <div className="mt-2 border-y border-slate-200 py-2 text-[9px] text-slate-700">
        <div className="grid grid-cols-4 gap-1 font-bold uppercase text-slate-600"><span>Tank</span><span className="text-right">Before</span><span className="text-right">Delivered</span><span className="text-right">After</span></div>
        <div className="mt-1 grid grid-cols-4 gap-1"><span>{delivery.tankName}</span><span className="text-right">{liters(openingLevel)}</span><span className="text-right">{liters(litersReceived)}</span><span className="text-right">{liters(closingLevel)}</span></div>
      </div>
      <div className="mt-4 flex justify-between border-t border-slate-300 pt-2 text-xs font-extrabold text-slate-900"><span>Total Delivery Value</span><span>{money(delivery.totalCost)}</span></div>
    </article>
  );
};

export const ShiftReconciliationDocument = ({ reconciliation, shift, settings }: { reconciliation: ThreeWayReconciliation; shift?: ShiftSession; settings?: StationSettings | null }) => (
  <article data-printable-document data-reprint-document className="thermal-receipt document-preview-paper w-[80mm] max-w-full bg-white p-4 text-slate-900">
    <DocumentHeader settings={settings} title="Shift Reconciliation Report" />
    <dl className="mt-3 space-y-1 text-[10px] text-slate-700">
      <div className="flex justify-between gap-3"><dt>Shift ID</dt><dd className="font-bold text-right">{reconciliation.shiftId}</dd></div>
      <div className="flex justify-between gap-3"><dt>Staff Member</dt><dd className="font-bold text-right">{reconciliation.staffName}</dd></div>
      <div className="flex justify-between gap-3"><dt>Expected Cash</dt><dd>{money(reconciliation.expectedCash)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Actual Cash Count</dt><dd>{money(reconciliation.totalActualCash)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Cash Variance</dt><dd>{money(reconciliation.cashVariance)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Approval Status</dt><dd className="font-bold text-right">{reconciliation.status}</dd></div>
      {shift && <div className="flex justify-between gap-3"><dt>Total Shift Sales</dt><dd>{money(Number(shift.totalFuelSales || 0) + Number(shift.totalShopSales || 0))}</dd></div>}
    </dl>
    <SectionTitle>Pump / Nozzle Reconciliation</SectionTitle>
    <div className="mt-2 space-y-2 text-[9px] text-slate-700">{(reconciliation.pumpReadings || []).map((reading) => <div key={reading.pumpId} className="border-b border-slate-100 pb-1"><strong>{reading.pumpName} / {reading.fuelName}</strong><div className="grid grid-cols-4 gap-1"><span>Open {liters(reading.openingMeter)}</span><span>Close {liters(reading.closingMeter)}</span><span>Disp. {liters(reading.meterSalesLiters)}</span><span>Var. {liters(reading.varianceLiters)}</span></div></div>)}</div>
    <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-800"><span>Total pump variance</span><span>{liters(reconciliation.totalPumpVarianceLiters)}</span></div>
    <SectionTitle>Tank Reconciliation</SectionTitle>
    <div className="mt-2 space-y-2 text-[9px] text-slate-700">{(reconciliation.tankDips || []).map((dip) => <div key={dip.tankId} className="border-b border-slate-100 pb-1"><strong>{dip.tankName} / {dip.fuelName}</strong><div className="grid grid-cols-4 gap-1"><span>Open {liters(dip.openingDip)}</span><span>Close {liters(dip.closingDip)}</span><span>Usage {liters(dip.calculatedUsage)}</span><span>Var. {liters(dip.varianceLiters)}</span></div></div>)}</div>
    <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-800"><span>Total tank variance</span><span>{liters(reconciliation.totalTankVarianceLiters)}</span></div>
    {reconciliation.managerNotes && <div className="mt-4 border-t border-slate-200 pt-2 text-[10px] text-slate-700"><strong>Manager remarks</strong><p className="mt-1">{reconciliation.managerNotes}</p></div>}
  </article>
);

export const OperationalDocumentPreview = ({ children, fileName, onClose }: { children: React.ReactNode; fileName: string; onClose: () => void }) => {
  const documentRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.documentPreviewOpen = 'true';
    return () => { delete document.documentElement.dataset.documentPreviewOpen; };
  }, []);

  const target = () => documentRef.current;
  const handlePrint = () => { try { const element = target(); if (!element) throw new Error('Document is unavailable.'); printSelectedDocument(element, { pageSize: '80mm auto' }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to print document.'); } };
  const handleDownload = async () => {
    try {
      const element = target();
      if (!element) throw new Error('Document is unavailable.');
      setIsGenerating(true); setError(null);
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const width = 80; const height = Math.max((canvas.height * width) / canvas.width, 80);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, height], compress: true });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST');
      pdf.save(`${fileName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'document'}.pdf`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to download document.'); } finally { setIsGenerating(false); }
  };

  return <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full items-start justify-end overflow-y-auto px-3 pb-5 pt-14 lg:w-[calc(80mm+1.25rem)] lg:px-5">
    <div className="pointer-events-auto w-[80mm] max-w-full">
      <div className="receipt-screen-ui mb-2 flex justify-end gap-1"><button type="button" title="Print document" onClick={handlePrint} className="rounded border border-slate-300 bg-white p-2 text-slate-700"><Printer className="h-4 w-4" /></button><button type="button" title="Download PDF" onClick={handleDownload} disabled={isGenerating} className="rounded border border-slate-300 bg-white p-2 text-slate-700"><Download className="h-4 w-4" /></button><button type="button" title="Close preview" onClick={onClose} className="rounded border border-slate-300 bg-white p-2 text-slate-700"><X className="h-4 w-4" /></button></div>
      {error && <p className="receipt-screen-ui mb-2 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      <div ref={(element) => { documentRef.current = element; }} className="shadow-xl">{children}</div>
    </div>
  </div>;
};