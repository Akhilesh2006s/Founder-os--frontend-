"use client";

import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CreditCard,
  Flame,
  Target,
  Users,
  Wallet,
  AlertTriangle
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { formatInr } from "@/lib/format-inr";
import { useIsDarkTheme } from "@/features/theme/use-is-dark-theme";

type Kpis = {
  totalRevenue: number;
  monthlyRevenue: number;
  burnRate: number;
  runwayRemainingMonths: number;
  totalExpenses: number;
  pendingPayments: number;
  leads: number;
  convertedClients: number;
  activeEmployees: number;
  pendingTasks: number;
  overdueTasks: number;
};

type Charts = {
  monthlyExpenses: { month: string; total: number }[];
  monthlyLeads: { month: string; count: number }[];
  taskStatusBreakdown: { status: string; count: number }[];
};

const PIE_COLORS_DARK = ["#e8cf6a", "#c9a227", "#a68b2e", "#6b5f32", "#8b4513", "#f4e4a6"];

const PIE_COLORS_LIGHT = ["#c9a56c", "#8f6641", "#5c3d27", "#a67c52", "#6b4423", "#d4b896"];

function useKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Kpis }>("/dashboard/kpis");
      return data.data;
    }
  });
}

function useCharts() {
  return useQuery({
    queryKey: ["dashboard", "charts"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Charts }>("/dashboard/charts");
      return data.data;
    }
  });
}

export default function DashboardPage() {
  const kpiQuery = useKpis();
  const chartsQuery = useCharts();
  const isDark = useIsDarkTheme();

  const chartTooltipStyle = {
    background: isDark ? "#0a0a0b" : "#fffcf7",
    border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid rgba(92,61,39,0.22)",
    color: isDark ? "#f5f2ea" : "#362a21"
  } as const;

  const gridStroke = isDark ? "rgba(201,162,39,0.12)" : "rgba(92,61,39,0.14)";
  const axisStroke = isDark ? "#9d968a" : "#7a6656";

  const k = kpiQuery.data;

  const pieColors = isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT;
  const cards: Array<{ title: string; value: string; icon: LucideIcon; hint?: string }> = [
    {
      title: "Monthly revenue",
      value: formatInr(k?.monthlyRevenue ?? 0),
      icon: Wallet,
      hint: "Paid invoice flows this month"
    },
    {
      title: "Burn (this month)",
      value: formatInr(k?.burnRate ?? 0),
      icon: Flame,
      hint: "Expense outflows"
    },
    {
      title: "Pending payments",
      value: formatInr(k?.pendingPayments ?? 0),
      icon: CreditCard,
      hint: "Payroll & AR watchlist"
    },
    {
      title: "Runway (rough)",
      value: `${k?.runwayRemainingMonths ?? 0} mo`,
      icon: BarChart3,
      hint: "Revenue ÷ burn heuristic"
    },
    { title: "Open leads", value: `${k?.leads ?? 0}`, icon: Target, hint: "Active pipeline count" },
    { title: "Clients", value: `${k?.convertedClients ?? 0}`, icon: Building2, hint: "CRM clients" },
    { title: "Team", value: `${k?.activeEmployees ?? 0}`, icon: Users, hint: "Employees on file" },
    { title: "Pending tasks", value: `${k?.pendingTasks ?? 0}`, icon: BarChart3 },
    { title: "Overdue tasks", value: `${k?.overdueTasks ?? 0}`, icon: AlertTriangle }
  ];

  const comboBars = chartsQuery.data
    ? chartsQuery.data.monthlyExpenses.map((row, i) => ({
        month: row.month,
        expenses: row.total,
        leads: chartsQuery.data!.monthlyLeads[i]?.count ?? 0
      }))
    : [];

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1 border-b border-gold/20 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-gold-bright">Executive Control Center</h1>
        <p className="text-sm text-muted">Dashboard KPIs plus chart data from Mongo aggregates.</p>
      </header>
      {kpiQuery.isLoading && <p className="text-sm text-muted">Loading metrics…</p>}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-gold/20 bg-surface-card p-4 shadow-[0_0_0_1px_rgba(92,61,39,0.08)] dark:shadow-[0_0_0_1px_rgba(201,162,39,0.06)]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{card.title}</p>
                <Icon className="h-4 w-4 text-gold/70" />
              </div>
              <p className="text-2xl font-semibold mt-4 text-gold-bright">{card.value}</p>
              {card.hint && <p className="text-[11px] text-muted/80 mt-1">{card.hint}</p>}
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gold/20 bg-surface-card p-4 h-[320px]">
          <p className="text-sm text-muted mb-2">Expense vs lead volume</p>
          {chartsQuery.isLoading ? (
            <p className="text-xs text-muted">Loading charts…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comboBars}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" stroke={axisStroke} fontSize={11} />
                <YAxis stroke={axisStroke} fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                <Bar dataKey="expenses" name="Expenses (₹)" fill="#c9a227" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" name="Leads" fill="#e8cf6a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gold/20 bg-surface-card p-4 h-[320px]">
          <p className="text-sm text-muted mb-2">Tasks by status</p>
          {chartsQuery.isLoading ? (
            <p className="text-xs text-muted">Loading charts…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartsQuery.data?.taskStatusBreakdown ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label>
                  {(chartsQuery.data?.taskStatusBreakdown ?? []).map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </main>
  );
}
