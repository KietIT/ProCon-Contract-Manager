'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  FileText, CheckCircle, Package, Truck, Warehouse, AlertTriangle,
  Clock, ChevronRight, ChevronDown, Factory, Ship, ArrowRight,
  DollarSign, TrendingUp, ArrowUpDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PR_STATUSES = [
  { label: 'PR Issued',               count: 24, pct: 39, color: '#25d1f4', text: 'text-accent-cyan',  bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  { label: 'RFQ In Progress',         count: 18, pct: 29, color: '#fbbf24', text: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  { label: 'Tenders Under Evaluation',count: 11, pct: 18, color: '#a78bfa', text: 'text-violet-400',  bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { label: 'PO Awarded',              count:  9, pct: 14, color: '#4ade80', text: 'text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-500/20' },
];

const FUNNEL = [
  { stage: 'Purchase Request', count: 62, color: '#25d1f4' },
  { stage: 'Request for Quotation', count: 45, color: '#fbbf24' },
  { stage: 'Evaluation',            count: 28, color: '#a78bfa' },
  { stage: 'PO Awarded',            count: 18, color: '#4ade80' },
];

const DELIVERY_STAGES = [
  { label: 'In Production',           count: 12, Icon: Factory,    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { label: 'FAT',                     count:  7, Icon: CheckCircle,color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { label: 'Ready to Ship',           count:  5, Icon: Package,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { label: 'In Transit',              count:  4, Icon: Truck,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { label: 'Arrived at Port',         count:  3, Icon: Ship,       color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { label: 'Delivered to Warehouse',  count:  8, Icon: Warehouse,  color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20' },
];

interface StageDetailRow {
  contract: string;
  supplier: string;
  department: string;
  description: string;
}

const STAGE_DETAILS: Record<string, StageDetailRow[]> = {
  'In Production': [
    { contract: 'CON-2026-001', supplier: 'Gulf Engineering Group',  department: 'Mechanical',      description: 'Turbo Compressor Unit A — rotor assembly' },
    { contract: 'CON-2026-002', supplier: 'Al-Faris Fabrication',    department: 'Mechanical',      description: 'Heat Exchanger Bundle #3 — tube sheet welding' },
    { contract: 'CON-2026-003', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Control Valve Set (18 pcs) — body casting' },
    { contract: 'CON-2026-004', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Gas Turbine Generator Set — stator winding' },
    { contract: 'CON-2026-005', supplier: 'Schneider Electric',      department: 'Electrical',      description: 'MV Switchgear Panel (6.6kV) — busbar fabrication' },
    { contract: 'CON-2026-006', supplier: 'Gulf Engineering Group',  department: 'Piping',          description: 'High-pressure manifold headers — forging' },
    { contract: 'CON-2026-007', supplier: 'Al-Faris Fabrication',    department: 'Civil',           description: 'Structural steel modules — cutting & prep' },
    { contract: 'CON-2026-008', supplier: 'Yokogawa Electric',       department: 'Instrumentation', description: 'DCS Cabinets & Marshalling — panel assembly' },
    { contract: 'CON-2026-009', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Centrifugal pump skid — impeller machining' },
    { contract: 'CON-2026-010', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Pressure transmitters (24 pcs) — calibration' },
    { contract: 'CON-2026-011', supplier: 'Schneider Electric',      department: 'Electrical',      description: 'UPS System 200kVA — battery rack assembly' },
    { contract: 'CON-2026-012', supplier: 'Gulf Engineering Group',  department: 'Mechanical',      description: 'Air-cooled condenser fans — blade balancing' },
  ],
  'FAT': [
    { contract: 'CON-2026-013', supplier: 'Siemens Energy',          department: 'Electrical',      description: 'Power transformer 33/11kV — dielectric test' },
    { contract: 'CON-2026-014', supplier: 'ABB Ltd',                 department: 'Electrical',      description: 'Variable frequency drive 500HP — load test' },
    { contract: 'CON-2026-015', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Safety instrumented system — SIL verification' },
    { contract: 'CON-2026-016', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Reciprocating compressor — performance test' },
    { contract: 'CON-2026-017', supplier: 'Yokogawa Electric',       department: 'Instrumentation', description: 'Analyzer shelter — loop check & FAT' },
    { contract: 'CON-2026-018', supplier: 'Gulf Engineering Group',  department: 'Mechanical',      description: 'Fin-fan cooler assembly — vibration test' },
    { contract: 'CON-2026-019', supplier: 'Schneider Electric',      department: 'Electrical',      description: 'LV Distribution board — type test' },
  ],
  'Ready to Ship': [
    { contract: 'CON-2026-020', supplier: 'ABB Ltd',                 department: 'Electrical',      description: 'MCC Panel Section A — packing complete' },
    { contract: 'CON-2026-021', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Flow meters (12 pcs) — export crating' },
    { contract: 'CON-2026-022', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Lube oil console — preservation & crating' },
    { contract: 'CON-2026-023', supplier: 'Yokogawa Electric',       department: 'Instrumentation', description: 'RTDs & Thermocouples (bulk) — boxed' },
    { contract: 'CON-2026-024', supplier: 'Siemens Energy',          department: 'Electrical',      description: 'Cable tray & accessories — palletized' },
  ],
  'In Transit': [
    { contract: 'CON-2026-025', supplier: 'Gulf Engineering Group',  department: 'Mechanical',      description: 'Pressure vessel (V-101) — sea freight ETA 10d' },
    { contract: 'CON-2026-026', supplier: 'Al-Faris Fabrication',    department: 'Piping',          description: 'Pre-fab spool pieces (Lot 3) — on vessel' },
    { contract: 'CON-2026-027', supplier: 'Schneider Electric',      department: 'Electrical',      description: 'HV Cable drums 18/30kV — in transit' },
    { contract: 'CON-2026-028', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Spare parts kit — air freight' },
  ],
  'Arrived at Port': [
    { contract: 'CON-2026-029', supplier: 'Siemens Energy',          department: 'Electrical',      description: 'Generator step-up transformer — customs clearance' },
    { contract: 'CON-2026-030', supplier: 'Al-Faris Fabrication',    department: 'Civil',           description: 'Structural columns (Lot 1) — awaiting transport' },
    { contract: 'CON-2026-031', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Junction boxes (bulk) — port storage' },
  ],
  'Delivered to Warehouse': [
    { contract: 'CON-2026-032', supplier: 'Yokogawa Electric',       department: 'Instrumentation', description: 'Field instruments batch 1 — received & inspected' },
    { contract: 'CON-2026-033', supplier: 'Schneider Electric',      department: 'Electrical',      description: 'Lighting fixtures (200 pcs) — in warehouse' },
    { contract: 'CON-2026-034', supplier: 'ABB Ltd',                 department: 'Electrical',      description: 'Motor starters (36 pcs) — QC passed' },
    { contract: 'CON-2026-035', supplier: 'Gulf Engineering Group',  department: 'Piping',          description: 'Gasket & bolt sets — inventory logged' },
    { contract: 'CON-2026-036', supplier: 'Baker Hughes',            department: 'Mechanical',      description: 'Pump mechanical seals — stored' },
    { contract: 'CON-2026-037', supplier: 'Emerson Process',         department: 'Instrumentation', description: 'Control cables (Lot 2) — on racks' },
    { contract: 'CON-2026-038', supplier: 'Al-Faris Fabrication',    department: 'Civil',           description: 'Anchor bolts & embed plates — verified' },
    { contract: 'CON-2026-039', supplier: 'Siemens Energy',          department: 'Electrical',      description: 'Bus duct sections — warehouse bay 3' },
  ],
};

const DELIVERY_PROGRESS = [
  { month: 'Oct', Baseline: 6,  Expected: 5,  Actual: 4 },
  { month: 'Nov', Baseline: 12, Expected: 9,  Actual: 7 },
  { month: 'Dec', Baseline: 18, Expected: 14, Actual: 11 },
  { month: 'Jan', Baseline: 24, Expected: 19, Actual: 16 },
  { month: 'Feb', Baseline: 30, Expected: 26, Actual: 22 },
  { month: 'Mar', Baseline: 35, Expected: 32, Actual: 27 },
];

const CRITICAL_ITEMS = [
  { name: 'Turbo Compressor Unit A',    supplier: 'Gulf Engineering Group', delay: 12, risk: 'red' },
  { name: 'Heat Exchanger Bundle #3',   supplier: 'Al-Faris Fabrication',   delay:  7, risk: 'amber' },
  { name: 'Control Valve Set (18 pcs)', supplier: 'Emerson Process',        delay:  3, risk: 'amber' },
];

const BUDGET_CHART = [
  { category: 'Civil',            budget: 12,  commitment: 10.5, actual: 8.2 },
  { category: 'Mechanical',       budget: 18,  commitment: 16.8, actual: 14.1 },
  { category: 'Electrical',       budget:  8,  commitment:  7.2, actual: 5.8 },
  { category: 'Instrumentation',  budget:  6,  commitment:  5.9, actual: 4.3 },
  { category: 'Piping',           budget: 11,  commitment: 10.1, actual: 8.7 },
];

const CAPEX_OPEX = [
  { name: 'CAPEX', value: 38.4, color: '#25d1f4' },
  { name: 'OPEX',  value: 16.6, color: '#a78bfa' },
];

const SUPPLIER_ROWS = [
  { supplier: 'Gulf Engineering Group', contracts: 4, value: 14.2, onTime: 75 },
  { supplier: 'Al-Faris Fabrication',   contracts: 3, value:  9.8, onTime: 67 },
  { supplier: 'Emerson Process',        contracts: 2, value:  6.1, onTime: 90 },
  { supplier: 'Baker Hughes',           contracts: 2, value: 11.4, onTime: 85 },
  { supplier: 'Schneider Electric',     contracts: 1, value:  4.5, onTime: 100 },
];

const DEPT_STYLES: Record<string, string> = {
  Mechanical:      'bg-blue-500/10 text-blue-400',
  Electrical:      'bg-amber-500/10 text-amber-400',
  Instrumentation: 'bg-violet-500/10 text-violet-400',
  Piping:          'bg-cyan-500/10 text-cyan-400',
  Civil:           'bg-green-500/10 text-green-400',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-extrabold text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/3 border border-white/10 p-5 ${className}`}>
      {children}
    </div>
  );
}

function RiskDot({ risk }: { risk: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      risk === 'red' ? 'bg-red-400' : risk === 'amber' ? 'bg-amber-400' : 'bg-green-400'
    }`} />
  );
}

function ExpandablePanel({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (contentRef.current) setHeight(contentRef.current.scrollHeight);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: height }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0d1525',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
  },
};

// ─── Paginated Stage Table ────────────────────────────────────────────────────

type SortKey = 'contract' | 'supplier' | 'department' | 'description';
type SortDir = 'asc' | 'desc';

const StageRow = memo(function StageRow({
  row,
  globalIdx,
}: {
  row: StageDetailRow;
  globalIdx: number;
}) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors group">
      <td className="py-2.5 px-5 text-gray-600 tabular-nums">{globalIdx}</td>
      <td className="py-2.5 px-3 font-medium text-accent-cyan whitespace-nowrap">{row.contract}</td>
      <td className="py-2.5 px-3 text-gray-300">{row.supplier}</td>
      <td className="py-2.5 px-3">
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${DEPT_STYLES[row.department] ?? 'bg-gray-500/10 text-gray-400'}`}>
          {row.department}
        </span>
      </td>
      <td className="py-2.5 px-3 text-gray-400 max-w-xs truncate">{row.description}</td>
    </tr>
  );
});

function PaginatedStageTable({
  stage,
  rows,
  onCollapse,
}: {
  stage: string;
  rows: StageDetailRow[];
  onCollapse: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const prevStage = useRef(stage);

  // Reset sort when stage changes
  useEffect(() => {
    if (prevStage.current !== stage) {
      setSortKey(null);
      prevStage.current = stage;
    }
  }, [stage]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const SortTh = ({ field, children }: { field: SortKey; children: React.ReactNode }) => (
    <th
      className="text-left py-2.5 px-3 font-semibold text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none bg-sidebar-bg"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-2.5 h-2.5 ${sortKey === field ? 'text-accent-cyan' : 'text-gray-600'}`} />
      </span>
    </th>
  );

  return (
    <div className="mt-3 rounded-2xl bg-white/3 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">{stage}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
            {rows.length} contracts
          </span>
        </div>
        <button
          onClick={onCollapse}
          className="text-[10px] text-gray-500 hover:text-white transition-colors"
        >
          Collapse
        </button>
      </div>

      {/* Scrollable Table — max 5 rows visible */}
      <div className="max-h-[250px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-white/5">
              <th className="text-left py-2.5 px-5 font-semibold text-gray-500 w-10 bg-sidebar-bg">#</th>
              <SortTh field="contract">Contract</SortTh>
              <SortTh field="supplier">Supplier</SortTh>
              <SortTh field="department">Department</SortTh>
              <SortTh field="description">Description</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <StageRow
                key={row.contract}
                row={row}
                globalIdx={idx + 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const [costTab, setCostTab] = useState<'supplier' | 'contract' | 'portfolio'>('supplier');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const totalContracts = 10;
  const completionRate = 62;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-10">

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-accent-cyan font-bold uppercase tracking-widest mb-1">Procurement Command Center</p>
        <h1 className="text-2xl font-black text-white">Procurement Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">North Refinery TAR 2026 · Real-time sourcing, delivery & cost tracking</p>
      </div>

      {/* ── KPI Row (Total Contracts + Completion Rate only) ──────────── */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Contracts</span>
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-accent-cyan" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalContracts}</div>
          <div className="text-xs text-gray-500 mt-1">Across all packages</div>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completion Rate</span>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{completionRate}%</div>
          <div className="text-xs text-gray-500 mt-1">Milestones done</div>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — Pre-Contract (Sourcing Phase)
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-5 w-1 rounded-full bg-accent-cyan" />
          <SectionHeader title="Pre-Contract · Sourcing Phase" subtitle="Purchase request pipeline and procurement funnel status" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* PR Status Distribution */}
          <Card className="lg:col-span-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">PR Status Distribution</p>
            <div className="space-y-3">
              {PR_STATUSES.map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300">{s.label}</span>
                    <span className={`text-xs font-bold ${s.text}`}>{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Donut */}
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={PR_STATUSES} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="count">
                    {PR_STATUSES.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {PR_STATUSES.map(s => (
                  <div key={s.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-gray-500">{s.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Cycle Time + Funnel */}
          <div className="lg:col-span-2 space-y-5">

            {/* Avg Cycle Time */}
            <Card>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Avg Cycle Time · PR &rarr; PO</p>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-4xl font-black text-accent-cyan">34</div>
                  <div className="text-xs text-gray-500 mt-1">Days avg</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {[
                    { label: 'PR → RFQ', days: 8, target: 7, color: 'text-amber-400' },
                    { label: 'RFQ → Eval', days: 14, target: 14, color: 'text-green-400' },
                    { label: 'Eval → PO', days: 12, target: 10, color: 'text-red-400' },
                  ].map(step => (
                    <div key={step.label} className="rounded-xl bg-white/5 border border-white/8 p-3 text-center">
                      <div className={`text-xl font-black ${step.color}`}>{step.days}d</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{step.label}</div>
                      <div className="text-[10px] text-gray-600">target {step.target}d</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Procurement Funnel */}
            <Card>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Procurement Funnel</p>
              <div className="space-y-2.5">
                {FUNNEL.map((f, i) => {
                  const pct = Math.round((f.count / FUNNEL[0].count) * 100);
                  const dropOff = i > 0 ? FUNNEL[i - 1].count - f.count : 0;
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-gray-400 text-right flex-shrink-0">{f.stage}</div>
                      <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full rounded-lg flex items-center px-3 transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: f.color + '33', border: `1px solid ${f.color}40` }}
                        >
                          <span className="text-xs font-bold" style={{ color: f.color }}>{f.count}</span>
                        </div>
                      </div>
                      <div className="w-14 text-right flex-shrink-0">
                        {dropOff > 0 ? (
                          <span className="text-[10px] text-red-400">&minus;{dropOff}</span>
                        ) : (
                          <span className="text-[10px] text-gray-600">start</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-600">
                {FUNNEL.map((f, i) => (
                  <span key={f.stage} className="flex items-center gap-1.5">
                    <span style={{ color: f.color }}>{f.stage}</span>
                    {i < FUNNEL.length - 1 && <ArrowRight className="w-3 h-3" />}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — Post-Contract (Delivery Progress)
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-5 w-1 rounded-full bg-violet-400" />
          <SectionHeader title="Post-Contract · Accelerated Progress & Delivery" subtitle="Click any stage card to view contract details" />
        </div>

        {/* Delivery Stage Cards — clickable with expandable detail tables */}
        <div className="space-y-0 mb-5">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {DELIVERY_STAGES.map(({ label, count, Icon, color, bg, border }) => {
              const isActive = expandedStage === label;
              return (
                <button
                  key={label}
                  onClick={() => setExpandedStage(isActive ? null : label)}
                  className={`rounded-2xl border p-5 text-center cursor-pointer transition-all duration-200 ${
                    isActive
                      ? `${border} bg-white/8 ring-1 ring-white/20 scale-[1.02]`
                      : `border-white/10 bg-white/3 hover:bg-white/5`
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl ${bg} ${border} border flex items-center justify-center mx-auto mb-2`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className={`text-2xl font-black ${color}`}>{count}</div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-tight">{label}</div>
                  <div className={`mt-2 transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`}>
                    <ChevronDown className={`w-3.5 h-3.5 mx-auto ${isActive ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expandable detail panel with paginated table */}
          <ExpandablePanel isOpen={expandedStage !== null}>
            {expandedStage && (
              <PaginatedStageTable
                stage={expandedStage}
                rows={STAGE_DETAILS[expandedStage] ?? []}
                onCollapse={() => setExpandedStage(null)}
              />
            )}
          </ExpandablePanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Delivery Progress Chart */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivery Progress · Expected vs Actual</p>
              <span className="text-xs text-gray-600">Cumulative items</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={DELIVERY_PROGRESS}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                <Line type="monotone" dataKey="Baseline" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Baseline" />
                <Line type="monotone" dataKey="Expected" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Expected" />
                <Line type="monotone" dataKey="Actual" stroke="#25d1f4" strokeWidth={2.5} dot={{ r: 3, fill: '#25d1f4' }} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* On-time + Critical Items */}
          <div className="space-y-4">
            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center border-green-500/20">
                <div className="text-xl font-black text-green-400">82%</div>
                <div className="text-[10px] text-gray-500 mt-1">On-Time</div>
              </Card>
              <Card className="text-center border-amber-500/20">
                <div className="text-xl font-black text-amber-400">7</div>
                <div className="text-[10px] text-gray-500 mt-1">Delayed</div>
              </Card>
              <Card className="text-center border-red-500/20">
                <div className="text-xl font-black text-red-400">3</div>
                <div className="text-[10px] text-gray-500 mt-1">Critical</div>
              </Card>
            </div>

            {/* Critical Items */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Critical Items</p>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <div className="space-y-3">
                {CRITICAL_ITEMS.map(item => (
                  <div key={item.name} className="flex items-start gap-2.5 group cursor-pointer">
                    <RiskDot risk={item.risk} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-accent-cyan transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-600 truncate">{item.supplier}</p>
                    </div>
                    <span className={`text-[10px] font-bold flex-shrink-0 flex items-center gap-0.5 ${item.risk === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                      <Clock className="w-2.5 h-2.5" /> +{item.delay}d
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — Cost Management
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-5 w-1 rounded-full bg-green-400" />
          <SectionHeader title="Cost Management · Fees & Budget Control" subtitle="CAPEX / OPEX tracking — Budget vs Commitment vs Actual" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* CAPEX / OPEX Split */}
          <Card>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">CAPEX / OPEX Split</p>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={CAPEX_OPEX} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={4} dataKey="value">
                  {CAPEX_OPEX.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`$${v}M`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {CAPEX_OPEX.map(e => (
                <div key={e.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="text-xs text-gray-400">{e.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">${e.value}M</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-gray-600">Total</span>
                <span className="text-xs font-black text-white">$55.0M</span>
              </div>
            </div>
          </Card>

          {/* Budget vs Commitment vs Actual */}
          <Card className="lg:col-span-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Budget vs Commitment vs Actual ($M)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={BUDGET_CHART} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`$${v}M`]} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                <Bar dataKey="budget"     name="Budget"     fill="rgba(255,255,255,0.12)" radius={[4,4,0,0]} />
                <Bar dataKey="commitment" name="Commitment" fill="#fbbf24"                radius={[4,4,0,0]} />
                <Bar dataKey="actual"     name="Actual"     fill="#25d1f4"                radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Analysis Tabs */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Analysis</p>
            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              {(['supplier', 'contract', 'portfolio'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCostTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                    costTab === tab
                      ? 'bg-accent-cyan text-trust-blue'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {costTab === 'supplier' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left pb-2 font-semibold text-gray-500 pr-4">Supplier</th>
                    <th className="text-center pb-2 font-semibold text-gray-500 px-3">Contracts</th>
                    <th className="text-right  pb-2 font-semibold text-gray-500 px-3">Value ($M)</th>
                    <th className="text-right  pb-2 font-semibold text-gray-500 pl-3">On-Time %</th>
                    <th className="pb-2 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {SUPPLIER_ROWS.map(row => (
                    <tr key={row.supplier} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                      <td className="py-2.5 pr-4 font-medium text-white group-hover:text-accent-cyan transition-colors">{row.supplier}</td>
                      <td className="py-2.5 px-3 text-center text-gray-400">{row.contracts}</td>
                      <td className="py-2.5 px-3 text-right text-gray-300">{row.value}</td>
                      <td className="py-2.5 pl-3 text-right">
                        <span className={`font-bold ${row.onTime >= 90 ? 'text-green-400' : row.onTime >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                          {row.onTime}%
                        </span>
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.onTime >= 90 ? 'bg-green-400' : row.onTime >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${row.onTime}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {costTab === 'contract' && (
            <div className="space-y-2">
              {[
                { num: 'CON-2026-001', name: 'Mechanical Scope A', budget: 18, actual: 14.1, pct: 78, risk: 'green' },
                { num: 'CON-2026-002', name: 'Civil & Structural',  budget: 12, actual: 10.8, pct: 90, risk: 'amber' },
                { num: 'CON-2026-003', name: 'Electrical Package',  budget:  8, actual:  7.6, pct: 95, risk: 'red' },
                { num: 'CON-2026-004', name: 'Instrumentation',     budget:  6, actual:  4.3, pct: 72, risk: 'green' },
              ].map(c => (
                <div key={c.num} className="flex items-center gap-4 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors group cursor-pointer">
                  <RiskDot risk={c.risk} />
                  <div className="w-28 flex-shrink-0">
                    <p className="text-xs font-bold text-white group-hover:text-accent-cyan">{c.num}</p>
                    <p className="text-[10px] text-gray-500">{c.name}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Actual ${c.actual}M</span>
                      <span>Budget ${c.budget}M</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${c.risk === 'red' ? 'bg-red-400' : c.risk === 'amber' ? 'bg-amber-400' : 'bg-accent-cyan'}`}
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-black flex-shrink-0 ${c.risk === 'red' ? 'text-red-400' : c.risk === 'amber' ? 'text-amber-400' : 'text-green-400'}`}>
                    {c.pct}%
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-accent-cyan flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {costTab === 'portfolio' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Budget',    value: '$55.0M', color: 'text-white',       icon: DollarSign  },
                { label: 'Committed',       value: '$50.5M', color: 'text-amber-400',   icon: TrendingUp  },
                { label: 'Actual Spend',    value: '$41.1M', color: 'text-accent-cyan', icon: TrendingUp  },
                { label: 'Remaining',       value: '$13.9M', color: 'text-green-400',   icon: DollarSign  },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl bg-white/5 border border-white/8 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
                </div>
              ))}
              <div className="col-span-2 lg:col-span-4">
                <div className="h-3 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                  <div className="h-full bg-red-400/80 rounded-l-full" style={{ width: '10%' }} title="Over budget" />
                  <div className="h-full bg-amber-400/80" style={{ width: '17%' }} title="Committed not spent" />
                  <div className="h-full bg-accent-cyan" style={{ width: '48%' }} title="Actual spend" />
                  <div className="h-full bg-white/10 rounded-r-full flex-1" title="Remaining" />
                </div>
                <div className="flex gap-4 mt-2">
                  {[
                    { color: 'bg-accent-cyan', label: 'Actual (75%)' },
                    { color: 'bg-amber-400/80', label: 'Committed (17%)' },
                    { color: 'bg-white/10',    label: 'Remaining (25%)' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-sm ${l.color}`} />
                      <span className="text-[10px] text-gray-500">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
