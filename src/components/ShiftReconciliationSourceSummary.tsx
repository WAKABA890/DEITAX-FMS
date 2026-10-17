import React from 'react';
import type { ShiftSession, ThreeWayReconciliation } from '../types';

type Value = number | null | undefined | 'N/A';
type Row = { label: string; user: Value; reference: Value; variance?: Value; money?: boolean };

const formatValue = (value: Value, money = false): string => {
  if (value === 'N/A') return value;
  if (value == null || !Number.isFinite(value)) return 'Not recorded';
  return `${money ? 'KES ' : ''}${value.toLocaleString('en-KE', { minimumFractionDigits: money ? 2 : 3, maximumFractionDigits: money ? 2 : 3 })}${money ? '' : ' L'}`;
};
const hasVariance = (value: Value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) >= 0.0005;
const formatVariance = (row: Row) => {
  if (typeof row.variance !== 'number' || !Number.isFinite(row.variance)) return formatValue(row.variance, row.money);
  if (!hasVariance(row.variance)) return 'No variance';
  return `${row.variance > 0 ? '+' : '-'}${formatValue(Math.abs(row.variance), row.money)}`;
};

export const ShiftReconciliationSourceSummary = ({ reconciliation: rec, shift }: { reconciliation: ThreeWayReconciliation; shift?: ShiftSession }) => {
  const openingPumps = new Map((shift?.openingPumpReadings || []).map((reading) => [reading.pumpId, reading]));
  const openingTanks = new Map((shift?.openingTankDips || []).map((dip) => [dip.tankId, dip]));
  const pumps = rec.pumpReadings?.length ? rec.pumpReadings : shift?.closingPumpReadings || [];
  const tanks = rec.tankDips?.length ? rec.tankDips : shift?.closingTankDips || [];
  const cashRows: Row[] = [
    { label: 'Opening cash', user: shift?.openingCash, reference: 'N/A', variance: 'N/A', money: true },
    { label: 'Closing cash count', user: shift?.actualCashCount ?? rec.totalActualCash, reference: rec.expectedCash, variance: rec.cashVariance, money: true },
  ];
  const pumpRows = pumps.flatMap((reading, index): Row[] => {
    const opening = openingPumps.get(reading.pumpId);
    const label = `${reading.pumpName || `Pump ${index + 1}`} / ${reading.fuelName || 'Fuel'}`;
    return [
      { label: `${label} opening meter`, user: opening?.reportedOpeningMeter ?? opening?.openingMeter ?? reading.openingMeter, reference: opening?.authoritativeOpeningMeter, variance: opening?.variance },
      { label: `${label} closing meter`, user: reading.closingMeter, reference: 'N/A', variance: 'N/A' },
      { label: `${label} dispensed`, user: reading.meterSalesLiters, reference: reading.posSalesLiters, variance: reading.varianceLiters },
    ];
  });
  const tankRows = tanks.flatMap((dip, index): Row[] => {
    const opening = openingTanks.get(dip.tankId);
    const label = `${dip.tankName || `Tank ${index + 1}`} / ${dip.fuelName || 'Fuel'}`;
    return [
      { label: `${label} opening stock`, user: opening?.reportedOpeningDip ?? opening?.openingDip ?? dip.openingDip, reference: opening?.authoritativeQuantity, variance: opening?.variance },
      { label: `${label} tank movement`, user: dip.calculatedUsage, reference: dip.actualSales, variance: dip.varianceLiters },
      { label: `${label} closing stock`, user: dip.closingDip, reference: 'N/A', variance: 'N/A' },
    ];
  });
  const renderTable = (title: string, rows: Row[], explanation: string) => <section className="space-y-2">
    <h5 className="font-bold uppercase text-slate-200">{title}</h5>
    <p className="text-xs leading-relaxed text-slate-400">{explanation}</p>
    {rows.length === 0 ? <p className="text-xs text-slate-500">No readings were recorded.</p> : <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-sm leading-relaxed text-slate-300">
        <colgroup><col className="w-[40%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[20%]" /></colgroup>
        <thead className="border-y border-slate-700 text-[10px] uppercase text-slate-500"><tr>
          <th scope="col" className="py-1 pr-1 text-left font-bold">Measure</th>
          <th scope="col" className="px-1 py-1 text-right font-bold">User</th>
          <th scope="col" className="px-1 py-1 text-right font-bold">FMS reference</th>
          <th scope="col" className="py-1 pl-1 text-right font-bold">Variance</th>
        </tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-slate-800 align-top">
          <td className="break-words py-1 pr-1 font-medium">{row.label}</td>
          <td className="break-words px-1 py-1 text-right tabular-nums">{formatValue(row.user, row.money)}</td>
          <td className="break-words px-1 py-1 text-right tabular-nums">{formatValue(row.reference, row.money)}</td>
          <td className={`break-words py-1 pl-1 text-right tabular-nums ${hasVariance(row.variance) ? 'font-bold text-rose-400' : 'text-slate-400'}`}>{formatVariance(row)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
  return <div className="space-y-4">
    {renderTable('Cash reconciliation', cashRows, 'Closing cash compares the counted amount with the expected FMS cash total.')}
    {renderTable('Pump / nozzle source values', pumpRows, 'Opening readings compare the user entry with the saved FMS meter. Dispensed volume compares meter sales with POS sales.')}
    {renderTable('Tank source values', tankRows, 'Opening stock compares the user dip with the saved FMS stock. Tank movement compares dip usage with recorded sales.')}
    <p className="text-xs leading-relaxed text-slate-400">“Not recorded” means a value is missing and is not treated as zero. “N/A” means there is no separate comparison for that measure.</p>
  </div>;
};
