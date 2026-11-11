import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, money } from '../api.js';

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: '#5b5bf0',
  headerFontWeight: 600,
  fontFamily: 'inherit',
  borderRadius: 8,
  wrapperBorderRadius: 12,
});

const STATUS_COLOR = {
  Paid: '#0f9f6e',
  'Payout in progress': '#0369a1',
  Sent: '#0369a1',
  'Needs review': '#b86a00',
  Rejected: '#d92d4b',
  'Payout failed': '#d92d4b',
};

const REIMBURSEMENT_STATUS = {
  needs_review: 'Needs review',
  processing: 'Payout in progress',
  paid: 'Paid',
  rejected: 'Rejected',
  failed: 'Payout failed',
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replaceAll('_', ' ') : '');

/** One row per money movement: reimbursements go out (negative), dues come in (positive). */
function toRows(reimbursements, invoices) {
  return [
    ...reimbursements.map((r) => ({
      date: r.created_at.slice(0, 10),
      type: 'Reimbursement',
      member: r.member_name,
      description: r.vendor || 'Receipt',
      category: titleCase(r.category),
      amount: r.amount == null ? null : -r.amount,
      status: REIMBURSEMENT_STATUS[r.status] || titleCase(r.status),
      aiReview: titleCase(r.ai_decision),
      paypalRef: r.payout_batch_id || '',
    })),
    ...invoices.map((i) => ({
      date: i.created_at.slice(0, 10),
      type: 'Dues invoice',
      member: i.member_name,
      description: i.description,
      category: 'Dues',
      amount: i.amount,
      status: titleCase(i.status),
      aiReview: '',
      paypalRef: i.paypal_id,
    })),
  ];
}

export default function Ledger({ overview }) {
  const currency = overview.club.currency;
  const gridRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/reimbursements'), api.get('/invoices')])
      .then(([r, i]) => setRows(toRows(r, i)))
      .catch((e) => setError(e.message));
  }, [overview]);

  const columnDefs = useMemo(
    () => [
      { field: 'date', headerName: 'Date', sort: 'desc', width: 120 },
      { field: 'type', headerName: 'Type', width: 150 },
      { field: 'member', headerName: 'Member', width: 150 },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 160 },
      { field: 'category', headerName: 'Category', width: 120 },
      {
        field: 'amount',
        headerName: 'Amount',
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        width: 130,
        valueFormatter: (p) => (p.value == null ? '' : money(p.value, currency)),
        cellStyle: (p) => ({ color: p.value < 0 ? '#d92d4b' : '#0f9f6e', fontWeight: 600 }),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 160,
        cellStyle: (p) => ({ color: STATUS_COLOR[p.value] || 'inherit', fontWeight: 600 }),
      },
      { field: 'aiReview', headerName: 'AI review', width: 110 },
      { field: 'paypalRef', headerName: 'PayPal reference', width: 210 },
    ],
    [currency],
  );

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const settled = (rows || []).filter((r) => r.status === 'Paid' && r.amount != null);
  const moneyIn = settled.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const moneyOut = settled.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  return (
    <>
      <h1>Ledger</h1>
      {error && <div className="banner error">{error}</div>}
      <div className="ledger-bar">
        <input
          className="grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member, vendor, PayPal reference…"
          aria-label="Search the ledger"
        />
        <span className="muted small">
          Settled: {money(moneyIn, currency)} in · {money(moneyOut, currency)} out
        </span>
        <button
          className="btn ghost"
          onClick={() => gridRef.current?.api.exportDataAsCsv({ fileName: 'clubpay-ledger.csv' })}
          disabled={!rows?.length}
        >
          Export CSV
        </button>
      </div>
      <div className="ledger-grid">
        <AgGridReact
          ref={gridRef}
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={search}
          pagination
          paginationPageSize={20}
          overlayNoRowsTemplate="No transactions yet. Submit a receipt or send dues invoices to fill the ledger."
        />
      </div>
    </>
  );
}
