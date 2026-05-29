"use client";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, AlertTriangle, RefreshCw } from "lucide-react";

type Tab = "overview" | "weekly" | "monthly" | "yearly" | "fiscal" | "store" | "pnl" | "loss";

interface FinancialData {
  summary: { totalRevenue: number; totalCost: number; totalProfit: number; totalOrders: number };
  monthly: { month: string; revenue: number; cost: number; profit: number; orders: number }[];
  weekly: { week: string; revenue: number; cost: number; profit: number; orders: number }[];
  yearly: { year: string; revenue: number; cost: number; profit: number; orders: number }[];
  fiscal: { fy: string; revenue: number; cost: number; profit: number; orders: number }[];
  storeWise: { store: string; revenue: number; cost: number; profit: number; orders: number }[];
  lossProducts: { product: string; revenue: number; cost: number; profit: number; orders: number }[];
  allProducts: { product: string; revenue: number; cost: number; profit: number; orders: number }[];
}

const fmt = (n: number) => `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (profit: number, revenue: number) => revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} /></div>;
}

function SalesTable({ data, labelKey }: { data: Record<string, number | string>[]; labelKey: string }) {
  const maxRev = Math.max(...data.map((d) => d.revenue as number));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs">
            <th className="text-left py-3 px-2">{labelKey}</th>
            <th className="text-right py-3 px-2">Orders</th>
            <th className="text-right py-3 px-2">Revenue</th>
            <th className="text-right py-3 px-2">Cost</th>
            <th className="text-right py-3 px-2">Profit</th>
            <th className="text-right py-3 px-2">Margin</th>
            <th className="py-3 px-2 w-32">Bar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
              <td className="py-3 px-2 text-white font-medium">{row[labelKey] as string}</td>
              <td className="py-3 px-2 text-right text-gray-400">{row.orders as number}</td>
              <td className="py-3 px-2 text-right text-white">{fmt(row.revenue as number)}</td>
              <td className="py-3 px-2 text-right text-red-400">{fmt(row.cost as number)}</td>
              <td className={`py-3 px-2 text-right font-medium ${(row.profit as number) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmt(row.profit as number)}
              </td>
              <td className={`py-3 px-2 text-right text-xs ${(row.profit as number) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pct(row.profit as number, row.revenue as number)}%
              </td>
              <td className="py-3 px-2">
                <Bar value={row.revenue as number} max={maxRev} color="bg-violet-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancialReportsPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/reports/financial");
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
    { key: "fiscal", label: "Fiscal Year" },
    { key: "store", label: "Store-wise" },
    { key: "pnl", label: "P&L" },
    { key: "loss", label: "Loss Products" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
          <p className="text-gray-400 text-sm mt-1">Revenue, cost, profit analysis</p>
        </div>
        <button onClick={fetchData} className="text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? "bg-violet-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading financial data...</div>
      ) : !data ? (
        <div className="text-red-400 text-sm">Failed to load data</div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Revenue", value: fmt(data.summary.totalRevenue), icon: DollarSign, color: "text-violet-400", border: "border-violet-500/20" },
                  { label: "Total Cost", value: fmt(data.summary.totalCost), icon: TrendingDown, color: "text-red-400", border: "border-red-500/20" },
                  { label: "Net Profit", value: fmt(data.summary.totalProfit), icon: TrendingUp, color: data.summary.totalProfit >= 0 ? "text-emerald-400" : "text-red-400", border: data.summary.totalProfit >= 0 ? "border-emerald-500/20" : "border-red-500/20" },
                  { label: "Total Orders", value: data.summary.totalOrders.toString(), icon: ShoppingBag, color: "text-blue-400", border: "border-blue-500/20" },
                ].map((card) => (
                  <div key={card.label} className={`bg-gray-900 border ${card.border} rounded-xl p-4`}>
                    <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    <p className="text-gray-500 text-xs mt-1">{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Overall Profit Margin</p>
                <p className={`text-3xl font-bold ${data.summary.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pct(data.summary.totalProfit, data.summary.totalRevenue)}%
                </p>
                <div className="mt-3 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${data.summary.totalProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(Math.abs(parseFloat(pct(data.summary.totalProfit, data.summary.totalRevenue))), 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* WEEKLY */}
          {tab === "weekly" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-4">Weekly Sales (Last 8 Weeks)</h2>
              {data.weekly.length === 0 ? <p className="text-gray-500 text-sm">No data</p> : <SalesTable data={data.weekly} labelKey="week" />}
            </div>
          )}

          {/* MONTHLY */}
          {tab === "monthly" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-4">Monthly Sales (Last 12 Months)</h2>
              {data.monthly.length === 0 ? <p className="text-gray-500 text-sm">No data</p> : <SalesTable data={data.monthly} labelKey="month" />}
            </div>
          )}

          {/* YEARLY */}
          {tab === "yearly" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-4">Yearly Sales</h2>
              {data.yearly.length === 0 ? <p className="text-gray-500 text-sm">No data</p> : <SalesTable data={data.yearly} labelKey="year" />}
            </div>
          )}

          {/* FISCAL YEAR */}
          {tab === "fiscal" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-1">Fiscal Year Sales</h2>
              <p className="text-gray-500 text-xs mb-4">Nepal fiscal year: July 16 - July 15</p>
              {data.fiscal.length === 0 ? <p className="text-gray-500 text-sm">No data</p> : <SalesTable data={data.fiscal} labelKey="fy" />}
            </div>
          )}

          {/* STORE-WISE */}
          {tab === "store" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-4">Store-wise Sales</h2>
              {data.storeWise.length === 0 ? <p className="text-gray-500 text-sm">No data</p> : <SalesTable data={data.storeWise} labelKey="store" />}
            </div>
          )}

          {/* P&L */}
          {tab === "pnl" && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-white font-semibold mb-6">Profit & Loss Statement</h2>
                <div className="space-y-4">
                  {[
                    { label: "Gross Revenue", value: data.summary.totalRevenue, color: "text-white", bold: true },
                    { label: "Cost of Goods Sold (COGS)", value: -data.summary.totalCost, color: "text-red-400", bold: false },
                    { label: "Gross Profit", value: data.summary.totalRevenue - data.summary.totalCost, color: data.summary.totalRevenue - data.summary.totalCost >= 0 ? "text-emerald-400" : "text-red-400", bold: true },
                    { label: "Net Profit (after shipping)", value: data.summary.totalProfit, color: data.summary.totalProfit >= 0 ? "text-emerald-400" : "text-red-400", bold: true },
                  ].map((row, i) => (
                    <div key={i} className={`flex justify-between items-center py-3 border-b border-gray-800 last:border-0 ${row.bold ? "font-semibold" : ""}`}>
                      <span className="text-gray-400 text-sm">{row.label}</span>
                      <span className={`${row.color} text-sm`}>{fmt(Math.abs(row.value))}{row.value < 0 && row.label !== "Net Profit (after shipping)" ? " (expense)" : ""}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">Profit Margin</span>
                    <span className={`text-2xl font-bold ${data.summary.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pct(data.summary.totalProfit, data.summary.totalRevenue)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOSS PRODUCTS */}
          {tab === "loss" && (
            <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="text-white font-semibold">Loss Making Products</h2>
                <span className="ml-auto text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">{data.lossProducts.length} products</span>
              </div>
              {data.lossProducts.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No loss making products!</p>
                </div>
              ) : (
                <SalesTable data={data.lossProducts} labelKey="product" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
