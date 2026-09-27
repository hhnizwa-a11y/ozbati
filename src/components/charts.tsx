import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatDateAr, formatDateShort, weekdayAr } from '../lib/dates';
import type { CategoryTotal } from '../lib/metrics';
import { formatOMR, formatShort } from '../lib/money';
import type { Transaction, Category } from '../lib/types';
import { Money } from './ui';

const GOLD = '#D6AC59';
const EMERALD = '#10B981';
const NAVY_SOFT = '#5A7899';

function Tip({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div dir="rtl" className="rounded-xl bg-surface border border-line shadow-pop px-3 py-2 text-xs min-w-[150px]">
      <div className="font-medium text-ink mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">{r.color && <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />}{r.label}</span>
          <span className="num text-ink font-medium" dir="ltr">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** الرسم الأول: توزيع المصاريف (دونات) مع قائمة تفصيلية قابلة للنقر */
export function CategoryDonut({ data, total, selected, onSelect, height = 240 }: { data: CategoryTotal[]; total: number; selected: string | null; onSelect: (id: string | null) => void; height?: number }) {
  const rows = data.filter((d) => d.total > 0);
  const sel = rows.find((r) => r.id === selected);
  return (
    <div className="grid sm:grid-cols-[minmax(0,240px)_1fr] gap-4 items-center">
      <div className="relative" dir="ltr" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="total" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={rows.length > 1 ? 1.2 : 0} stroke="rgb(var(--surface))" strokeWidth={2}
              onClick={(_, i) => onSelect(rows[i].id === selected ? null : rows[i].id)} isAnimationActive animationDuration={600}>
              {rows.map((r) => <Cell key={r.id} fill={r.color} opacity={selected && selected !== r.id ? 0.28 : 1} style={{ cursor: 'pointer' }} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
              <Tip title={(payload[0].payload as CategoryTotal).name} rows={[
                { label: 'المبلغ', value: formatOMR((payload[0].payload as CategoryTotal).total) },
                { label: 'النسبة', value: `${(payload[0].payload as CategoryTotal).share}%` },
                { label: 'العمليات', value: String((payload[0].payload as CategoryTotal).count) },
              ]} />) : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center" dir="rtl">
          <span className="text-[11px] text-muted">{sel ? sel.name : 'الإجمالي'}</span>
          <Money value={sel ? sel.total : total} className="text-lg font-semibold" />
          {sel && <span className="text-[11px] text-muted num">{sel.share}%</span>}
        </div>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.id}>
            <button onClick={() => onSelect(r.id === selected ? null : r.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${selected === r.id ? 'bg-sunk' : 'hover:bg-sunk/70'} ${selected && selected !== r.id ? 'opacity-55' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="truncate text-start flex-1">{r.name}</span>
              <span className="text-[11px] text-muted num w-11 text-left">{r.share}%</span>
              <Money value={r.total} unit={false} className="text-xs font-medium w-20 text-left" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** الرسم الثاني: المصاريف اليومية */
export function DailyChart({ data, avg, height = 240, onPick }: { data: { date: string; total: number; count: number }[]; avg: number | null; height?: number; onPick?: (date: string) => void }) {
  const max = data.reduce((m, d) => Math.max(m, d.total), 0);
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: 8, bottom: 0 }} onClick={(e: any) => { const d = e?.activePayload?.[0]?.payload?.date ?? (typeof e?.activeLabel === 'string' ? e.activeLabel : null); if (d && onPick) onPick(d); }}>
          <defs>
            <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity={0.28} />
              <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tickLine={false} axisLine={false} minTickGap={18} reversed />
          <YAxis tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={40} orientation="right" domain={[0, 'auto']} />
          {avg !== null && <ReferenceLine y={avg} stroke={GOLD} strokeDasharray="4 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: 'المتوسط', position: 'insideTopLeft', fill: GOLD, fontSize: 10 }} />}
          <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.[0] ? (
            <Tip title={`${weekdayAr(payload[0].payload.date)} ${formatDateAr(payload[0].payload.date)}`} rows={[
              { label: 'المصروف', value: formatOMR(payload[0].payload.total) },
              { label: 'العمليات', value: String(payload[0].payload.count) },
            ]} />) : null} />
          <Area type="monotone" dataKey="total" stroke={EMERALD} strokeWidth={2} fill="url(#dailyFill)"
            dot={(p: any) => p.payload.total > 0 && p.payload.total === max ? <circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill={GOLD} stroke="rgb(var(--surface))" strokeWidth={2} /> : <g key={p.key} />}
            activeDot={{ r: 5, fill: EMERALD, stroke: 'rgb(var(--surface))', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** الرسم الثالث: مقارنة الأشهر */
export function MonthlyBars({ data, currentId, height = 240, onPick }: { data: { periodId: string; label: string; name: string; total: number; count: number }[]; currentId?: string | null; height?: number; onPick?: (id: string) => void }) {
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} reversed />
          <YAxis tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={44} orientation="right" />
          <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={({ active, payload }) => active && payload?.[0] ? (
            <Tip title={payload[0].payload.name} rows={[{ label: 'الإجمالي', value: formatOMR(payload[0].payload.total) }, { label: 'العمليات', value: String(payload[0].payload.count) }]} />) : null} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48} onClick={(d: any) => onPick?.(d.periodId)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            {data.map((d) => <Cell key={d.periodId} fill={d.periodId === currentId ? EMERALD : NAVY_SOFT} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** الرسم الرابع: الميزانية مقابل المصروف لكل تصنيف */
export function BudgetVsSpent({ data, height }: { data: CategoryTotal[]; height?: number }) {
  const rows = data.filter((d) => d.budget !== null || d.total > 0).map((d) => ({
    name: d.name, spent: d.total, budget: d.budget ?? 0, remaining: d.budget !== null ? Math.max(0, d.budget - d.total) : 0, over: d.budget !== null && d.total > d.budget, hasBudget: d.budget !== null,
  }));
  const h = height ?? Math.max(200, rows.length * 44 + 40);
  return (
    <div dir="ltr" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="30%">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} reversed />
          <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} orientation="right" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={({ active, payload }) => active && payload?.[0] ? (
            <Tip title={payload[0].payload.name} rows={[
              { label: 'المصروف', value: formatOMR(payload[0].payload.spent), color: payload[0].payload.over ? '#EF4444' : EMERALD },
              { label: 'الميزانية', value: payload[0].payload.hasBudget ? formatOMR(payload[0].payload.budget) : 'غير محددة', color: GOLD },
              ...(payload[0].payload.hasBudget ? [{ label: payload[0].payload.over ? 'التجاوز' : 'المتبقي', value: formatOMR(Math.abs(payload[0].payload.budget - payload[0].payload.spent)) }] : []),
            ]} />) : null} />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted">{v}</span>} />
          <Bar name="الميزانية" dataKey="budget" fill={GOLD} radius={[4, 0, 0, 4]} maxBarSize={12} />
          <Bar name="المصروف" dataKey="spent" radius={[4, 0, 0, 4]} maxBarSize={12}>
            {rows.map((r) => <Cell key={r.name} fill={r.over ? '#EF4444' : EMERALD} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** الرسم الخامس: أعلى 10 عمليات */
export function TopTransactions({ txs, categories, onPick }: { txs: Transaction[]; categories: Category[]; onPick?: (t: Transaction) => void }) {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const rows = txs.map((t) => ({ id: t.id, name: t.description, amount: t.amount, date: t.date, color: cat.get(t.categoryId)?.color ?? '#94A3B8', catName: cat.get(t.categoryId)?.name ?? 'أخرى', tx: t }));
  return (
    <div dir="ltr" style={{ height: Math.max(180, rows.length * 34 + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} reversed />
          <YAxis type="category" dataKey="id" width={120} tickLine={false} axisLine={false} orientation="right" tick={{ fontSize: 11 }}
            tickFormatter={(id) => { const r = rows.find((x) => x.id === id); return r ? (r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name) : ''; }} />
          <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={({ active, payload }) => active && payload?.[0] ? (
            <Tip title={payload[0].payload.name} rows={[{ label: 'المبلغ', value: formatOMR(payload[0].payload.amount) }, { label: 'التاريخ', value: formatDateAr(payload[0].payload.date) }, { label: 'التصنيف', value: payload[0].payload.catName, color: payload[0].payload.color }]} />) : null} />
          <Bar dataKey="amount" radius={[4, 0, 0, 4]} maxBarSize={18} onClick={(d: any) => onPick?.(d.tx)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            {rows.map((r) => <Cell key={r.id} fill={r.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** الرسم السادس: المصاريف المتكررة (الفواتير والاشتراكات) */
export function RecurringChart({ data, height = 240 }: { data: { label: string; bills: number; subscriptions: number }[]; height?: number }) {
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="30%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} reversed />
          <YAxis tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} width={44} orientation="right" />
          <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={({ active, payload, label }) => active && payload?.length ? (
            <Tip title={String(label)} rows={payload.map((p: any) => ({ label: p.name, value: formatOMR(p.value), color: p.color }))} />) : null} />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted">{v}</span>} />
          <Bar name="فواتير المنزل" dataKey="bills" fill="#3B6EA8" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar name="الاشتراكات الرقمية" dataKey="subscriptions" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** مقارنة شهرين حسب التصنيف */
export function TwoMonthCompare({ rows, aLabel, bLabel }: { rows: { name: string; a: number; b: number }[]; aLabel: string; bLabel: string }) {
  return (
    <div dir="ltr" style={{ height: Math.max(220, rows.length * 44 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="30%">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatShort(v)} tickLine={false} axisLine={false} reversed />
          <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} orientation="right" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'rgb(var(--sunk))' }} content={({ active, payload }) => active && payload?.length ? (
            <Tip title={payload[0].payload.name} rows={[{ label: aLabel, value: formatOMR(payload[0].payload.a), color: NAVY_SOFT }, { label: bLabel, value: formatOMR(payload[0].payload.b), color: EMERALD }, { label: 'الفرق', value: formatOMR(payload[0].payload.b - payload[0].payload.a) }]} />) : null} />
          <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted">{v}</span>} />
          <Bar name={aLabel} dataKey="a" fill={NAVY_SOFT} radius={[4, 0, 0, 4]} maxBarSize={12} />
          <Bar name={bLabel} dataKey="b" fill={EMERALD} radius={[4, 0, 0, 4]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function useSelected() {
  return useState<string | null>(null);
}
