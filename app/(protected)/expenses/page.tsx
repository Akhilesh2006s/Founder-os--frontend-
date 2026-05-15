"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api-client";
import { toastApiError } from "@/components/ui/toast-handler";
import { appToast } from "@/lib/app-toast";
import { formatInr } from "@/lib/format-inr";

type Expense = {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date?: string;
  vendorName?: string;
  paymentStatus: string;
  approvalStatus: string;
  isRecurring?: boolean;
};

const CATEGORIES = [
  "Office Rent",
  "Internet",
  "Electricity",
  "Salaries",
  "Cloud Hosting",
  "Marketing",
  "Travel",
  "Software Tools",
  "Miscellaneous"
] as const;

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Miscellaneous");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const expensesQuery = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: { items: Expense[] } }>(
        "/expenses?limit=100&sortOrder=desc"
      );
      return data.data.items;
    }
  });

  const analyticsQuery = useQuery({
    queryKey: ["expenses", "analytics"],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        success: boolean;
        data: {
          monthlyBurn: number;
          lastMonthBurn: number;
          byCategory: Array<{ category: string; total: number }>;
          recurringLiability: number;
          recurringCount: number;
        };
      }>("/expenses/analytics/summary");
      return data.data;
    }
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses", "analytics"] })
    ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/expenses", {
        title,
        category,
        amount: Number(amount),
        date: new Date(date).toISOString(),
        vendorName: vendor || undefined,
        isRecurring
      });
    },
    onSuccess: () => {
      void invalidate();
      setTitle("");
      setAmount("");
      setVendor("");
      setIsRecurring(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Partial<Expense> }) => {
      await apiClient.patch(`/expenses/${payload.id}`, payload.body);
    },
    onSuccess: () => {
      void invalidate();
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      setDeleteExpenseId(null);
      void invalidate();
      appToast.success("Expense deleted successfully");
    },
    onError: (err) => toastApiError(err, "Could not delete expense")
  });

  const approvalMutation = useMutation({
    mutationFn: async (payload: { id: string; approvalStatus: string }) => {
      await apiClient.patch(`/expenses/${payload.id}/approval`, {
        approvalStatus: payload.approvalStatus
      });
    },
    onSuccess: () => void invalidate()
  });

  const paymentMutation = useMutation({
    mutationFn: async (payload: { id: string; paymentStatus: string }) => {
      await apiClient.patch(`/expenses/${payload.id}/payment`, {
        paymentStatus: payload.paymentStatus
      });
    },
    onSuccess: () => void invalidate()
  });

  return (
    <PageShell title="Expense Management" description="CRUD, approvals, payment tracking, burn and category analytics.">
      {analyticsQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs uppercase text-muted">This month burn</p>
            <p className="text-2xl font-semibold mt-1">{formatInr(analyticsQuery.data.monthlyBurn)}</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs uppercase text-muted">Last month</p>
            <p className="text-2xl font-semibold mt-1">{formatInr(analyticsQuery.data.lastMonthBurn)}</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4">
            <p className="text-xs uppercase text-muted">Recurring liability</p>
            <p className="text-2xl font-semibold mt-1">{formatInr(analyticsQuery.data.recurringLiability)}</p>
            <p className="text-[11px] text-muted mt-1">{analyticsQuery.data.recurringCount} open recurring</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-surface-card p-4 md:col-span-1">
            <p className="text-xs uppercase text-muted mb-2">By category</p>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {analyticsQuery.data.byCategory
                .filter((c) => c.total > 0)
                .map((c) => (
                  <div key={c.category} className="flex justify-between text-xs text-muted">
                    <span className="truncate mr-2">{c.category}</span>
                    <span>{formatInr(c.total)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gold/20 bg-surface-card p-4 space-y-3">
        <p className="text-sm font-medium text-ink-secondary">{editingId ? "Edit expense" : "New expense"}</p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            type="number"
            placeholder="Amount (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            className="rounded-lg bg-surface-lift px-3 py-2 text-sm"
            placeholder="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-muted px-2">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Recurring
          </label>
        </div>
        <div className="flex gap-2">
          {editingId ? (
            <>
              <button
                className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm"
                disabled={!title || !amount || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editingId,
                    body: {
                      title,
                      category,
                      amount: Number(amount),
                      date: new Date(date).toISOString(),
                      vendorName: vendor,
                      isRecurring
                    }
                  })
                }
              >
                Save
              </button>
              <button
                className="rounded-lg border border-gold/40 px-4 py-2 text-sm"
                onClick={() => {
                  setEditingId(null);
                  setTitle("");
                  setAmount("");
                  setVendor("");
                  setIsRecurring(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="rounded-lg bg-gold-cta font-semibold shadow-gold hover:brightness-110 px-4 py-2 text-sm"
              disabled={!title || !amount || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving..." : "Create expense"}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gold/20 bg-surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-muted">
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Approval</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expensesQuery.data?.map((exp) => (
              <tr key={exp._id} className="border-b border-gold/20 hover:bg-surface">
                <td className="p-3 font-medium">{exp.title}</td>
                <td className="p-3 text-muted">{exp.category}</td>
                <td className="p-3">{formatInr(exp.amount)}</td>
                <td className="p-3">
                  <select
                    className="rounded bg-surface-lift px-2 py-1 text-xs"
                    value={exp.approvalStatus}
                    onChange={(e) =>
                      approvalMutation.mutate({ id: exp._id, approvalStatus: e.target.value })
                    }
                  >
                    {["Draft", "Pending", "Approved", "Rejected"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <select
                    className="rounded bg-surface-lift px-2 py-1 text-xs"
                    value={exp.paymentStatus}
                    onChange={(e) =>
                      paymentMutation.mutate({ id: exp._id, paymentStatus: e.target.value })
                    }
                  >
                    {["Pending", "Paid"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 space-x-2">
                  <button
                    className="text-xs text-gold-bright"
                    type="button"
                    onClick={() => {
                      setEditingId(exp._id);
                      setTitle(exp.title);
                      setCategory(exp.category as (typeof CATEGORIES)[number]);
                      setAmount(String(exp.amount));
                      setVendor(exp.vendorName ?? "");
                      setIsRecurring(Boolean(exp.isRecurring));
                      setDate(exp.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeleteExpenseId(exp._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!expensesQuery.data?.length && (
          <p className="p-6 text-sm text-muted text-center">No expenses yet.</p>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(deleteExpenseId)}
        title="Delete Expense?"
        message="This action cannot be undone."
        destructive
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleteExpenseId(null)}
        onConfirm={() => deleteExpenseId && deleteMutation.mutate(deleteExpenseId)}
      />
    </PageShell>
  );
}
