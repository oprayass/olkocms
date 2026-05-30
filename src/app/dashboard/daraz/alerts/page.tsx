"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, CheckCircle, Play, X, Package, User, Store, Hash, TrendingUp } from "lucide-react";

interface OrderDetails {
  darazOrderId: string;
  product: string | null;
  customerName: string | null;
  price: number | null;
  quantity: number | null;
  status: string | null;
  trackingNo: string | null;
  storeId: string | null;
  storeName: string;
  orderDate: string | null;
}

interface Alert {
  id: string;
  darazOrderId: string;
  productName: string;
  alertType: string;
  status: string;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  orderDetails: OrderDetails | null;
}

const STATUS_COLORS: Record<string, string> = {
  unresolved: "bg-red-500/10 text-red-400 border-red-500/20",
  investigating: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  lost: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  outbound_not_delivered: { label: "Outbound → Not Delivered", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  return_not_received: { label: "Return → Not Received", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  wrong_store: { label: "Wrong Store / गलत स्टोर", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "lost", label: "🔴 Lost (2m+)" },
  { key: "all", label: "All Time" },
];

function getDateRange(filter: string): { from: Date | null; to: Date | null; lostOnly: boolean } {
  const now = new Date();
  if (filter === "lost") return { from: null, to: null, lostOnly: true };
  if (filter === "all") return { from: null, to: null, lostOnly: false };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  if (filter === "today") return { from: start, to: end, lostOnly: false };
  if (filter === "yesterday") {
    const f = new Date(start); f.setDate(f.getDate() - 1);
    const t = new Date(end); t.setDate(t.getDate() - 1);
    return { from: f, to: t, lostOnly: false };
  }
  if (filter === "this_week") {
    const f = new Date(start); f.setDate(f.getDate() - now.getDay());
    return { from: f, to: end, lostOnly: false };
  }
  if (filter === "last_week") {
    const f = new Date(start); f.setDate(f.getDate() - now.getDay() - 7);
    const t = new Date(start); t.setDate(t.getDate() - now.getDay() - 1); t.setHours(23,59,59,999);
    return { from: f, to: t, lostOnly: false };
  }
  if (filter === "this_month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end, lostOnly: false };
  }
  if (filter === "last_month") {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: f, to: t, lostOnly: false };
  }
  return { from: null, to: null, lostOnly: false };
}

function DetailPopup({ alert, onClose, onUpdateStatus, updating }: {
  alert: Alert;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  updating: string | null;
}) {
  const o = alert.orderDetails;
  const typeInfo = ALERT_TYPE_LABELS[alert.alertType];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[alert.status] ?? STATUS_COLORS.unresolved}`}>
                {alert.status}
              </span>
              {typeInfo && (
                <span className={`text-xs px-2 py-0.5 rounded border ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
              )}
            </div>
            <h2 className="text-white font-semibold text-base mt-1">
              {o?.product ?? alert.productName ?? "Unknown Item"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-3 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Details */}
        <div className="p-5 space-y-3">
          {o ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Hash className="w-3 h-3" /> Order ID</div>
                  <div className="text-white text-xs font-mono">{o.darazOrderId}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Store className="w-3 h-3" /> Store</div>
                  <div className="text-white text-xs font-medium">{o.storeName}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs"><User className="w-3 h-3" /> Customer</div>
                  <div className="text-white text-xs">{o.customerName ?? "—"}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs"><TrendingUp className="w-3 h-3" /> Status</div>
                  <div className="text-amber-400 text-xs font-medium">{o.status ?? "—"}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Package className="w-3 h-3" /> Price × Qty</div>
                  <div className="text-white text-xs">Rs. {o.price ?? "—"} × {o.quantity ?? 1}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">🚚 Tracking</div>
                  <div className="text-white text-xs font-mono">{o.trackingNo ?? "none"}</div>
                </div>
              </div>
              {o.orderDate && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <span className="text-gray-400 text-xs">Order Date: </span>
                  <span className="text-white text-xs">{new Date(o.orderDate).toLocaleDateString()}</span>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Order ID: <span className="text-white font-mono">{alert.darazOrderId}</span></p>
              <p className="text-gray-500 text-xs mt-1">OlkoCMS मा order record छैन</p>
            </div>
          )}

          {/* Notes */}
          {alert.notes && (
            <div className="bg-gray-800/50 rounded-xl p-3">
              <p className="text-gray-400 text-xs leading-relaxed">{alert.notes}</p>
            </div>
          )}

          <p className="text-gray-600 text-xs">{new Date(alert.createdAt).toLocaleString()}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-5 pt-0">
          {alert.status !== "investigating" && alert.status !== "resolved" && (
            <button
              onClick={() => onUpdateStatus(alert.id, "investigating")}
              disabled={updating === alert.id}
              className="flex-1 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-40"
            >
              Investigate
            </button>
          )}
          {alert.status !== "resolved" && (
            <button
              onClick={() => { onUpdateStatus(alert.id, "resolved"); onClose(); }}
              disabled={updating === alert.id}
              className="flex-1 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
            >
              Resolve ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("unresolved");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ created: number; skipped: number } | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    const res = await fetch("/api/daraz/alerts");
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const runReconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      let totalCreated = 0;
      let totalSkipped = 0;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch("/api/daraz/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (data.error) break;
        totalCreated += data.created ?? 0;
        totalSkipped += data.skipped ?? 0;
        hasMore = data.nextOffset !== null && data.nextOffset !== undefined;
        offset = data.nextOffset ?? 0;
      }
      setReconcileResult({ created: totalCreated, skipped: totalSkipped });
      await fetchAlerts();
    } catch {
      setReconcileResult({ created: -1, skipped: -1 });
    }
    setReconciling(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/daraz/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchAlerts();
    setUpdating(null);
  };

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const applyDateFilter = (a: Alert) => {
    const { from, to, lostOnly } = getDateRange(dateFilter);
    if (lostOnly) return a.status === "lost" || new Date(a.createdAt) < twoMonthsAgo;
    if (!from) return true;
    const d = new Date(a.createdAt);
    return d >= from && d <= to!;
  };

  const filtered = alerts
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => typeFilter === "all" || a.alertType === typeFilter)
    .filter(applyDateFilter);

  const activeCount = (s: string) => alerts.filter((a) => a.status === s).length;
  const unresolvedCount = activeCount("unresolved") + activeCount("lost");

  return (
    <div className="p-6 space-y-6">
      {selectedAlert && (
        <DetailPopup
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onUpdateStatus={updateStatus}
          updating={updating}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              Alerts
              {unresolvedCount > 0 && (
                <span className="ml-2 text-sm bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                  {unresolvedCount} unresolved
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">Missing items and unresolved issues</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runReconcile}
            disabled={reconciling}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            {reconciling ? "Running..." : "Run Reconciliation"}
          </button>
          <button onClick={fetchAlerts} className="text-gray-400 hover:text-white transition-colors p-2">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {reconcileResult && (
        <div className={`rounded-xl border p-4 text-sm ${reconcileResult.created === -1 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
          {reconcileResult.created === -1
            ? "❌ Reconciliation failed"
            : `✅ Reconciliation complete — ${reconcileResult.created} new alerts created, ${reconcileResult.skipped} skipped`}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(ALERT_TYPE_LABELS).map(([type, { label, color }]) => {
          const count = alerts.filter((a) => a.alertType === type && a.status !== "resolved").length;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
              className={`rounded-xl border p-3 text-left transition-all ${typeFilter === type ? color : "bg-gray-900 border-gray-800"}`}
            >
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </button>
          );
        })}
      </div>

      {/* Date filter */}
      <div className="flex gap-2 flex-wrap">
        {DATE_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setDateFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateFilter === f.key ? "bg-blue-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["unresolved", "investigating", "lost", "resolved", "all"].map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === f ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}>
            {f}
            {f !== "all" && <span className="ml-1.5 text-gray-500">({activeCount(f)})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No alerts for this filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => {
            const typeInfo = ALERT_TYPE_LABELS[alert.alertType];
            const isLost = alert.status === "lost" || new Date(alert.createdAt) < twoMonthsAgo;
            const o = alert.orderDetails;
            return (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`bg-gray-900 border rounded-xl p-4 cursor-pointer hover:border-gray-600 transition-all ${isLost ? "border-gray-700" : "border-gray-800"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLost && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-600">🔴 LOST</span>}
                        <span className="text-white font-medium text-sm truncate">
                          {o?.product ?? alert.productName ?? "Unknown Item"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${STATUS_COLORS[alert.status] ?? STATUS_COLORS.unresolved}`}>
                          {alert.status}
                        </span>
                        {typeInfo && (
                          <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span>Order: {alert.darazOrderId}</span>
                        {o?.storeName && <span className="text-blue-400">🏪 {o.storeName}</span>}
                        {o?.customerName && <span>👤 {o.customerName}</span>}
                        {o?.price && <span>Rs. {o.price}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {alert.status !== "investigating" && alert.status !== "resolved" && (
                      <button
                        onClick={() => updateStatus(alert.id, "investigating")}
                        disabled={updating === alert.id}
                        className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                      >
                        Investigate
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        onClick={() => updateStatus(alert.id, "resolved")}
                        disabled={updating === alert.id}
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}