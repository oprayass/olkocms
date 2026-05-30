"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, CheckCircle, Play } from "lucide-react";

interface Alert {
  id: string;
  darazOrderId: string;
  productName: string;
  alertType: string;
  status: string;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const ALERT_COLORS: Record<string, string> = {
  unresolved: "bg-red-500/10 text-red-400 border-red-500/20",
  investigating: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  outbound_not_in_daraz: { label: "Outbound → No Claim", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  daraz_return_not_scanned: { label: "Return → Not Scanned", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  wrong_store: { label: "Wrong Store / गलत स्टोर", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unresolved");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ created: number; skipped: number } | null>(null);

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
      const res = await fetch("/api/daraz/reconcile", { method: "POST" });
      const data = await res.json();
      setReconcileResult(data);
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

  const filtered = alerts
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) => typeFilter === "all" || a.alertType === typeFilter);

  const unresolvedCount = alerts.filter((a) => a.status === "unresolved").length;

  return (
    <div className="p-6 space-y-6">
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

      {/* Reconcile result */}
      {reconcileResult && (
        <div className={`rounded-xl border p-4 text-sm ${reconcileResult.created === -1 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
          {reconcileResult.created === -1
            ? "❌ Reconciliation failed — check console"
            : `✅ Reconciliation complete — ${reconcileResult.created} new alerts created, ${reconcileResult.skipped} skipped (already existed or matched)`}
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["unresolved", "investigating", "resolved", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {f}
            {f !== "all" && (
              <span className="ml-1.5 text-gray-500">({alerts.filter((a) => a.status === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No {filter} alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const typeInfo = ALERT_TYPE_LABELS[alert.alertType];
            return (
              <div key={alert.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{alert.productName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${ALERT_COLORS[alert.status] ?? ALERT_COLORS.unresolved}`}>
                        {alert.status}
                      </span>
                      {typeInfo && (
                        <span className={`text-xs px-2 py-0.5 rounded border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs">Order: {alert.darazOrderId}</p>
                    {alert.notes && <p className="text-gray-400 text-xs mt-1 leading-relaxed">{alert.notes}</p>}
                    <p className="text-gray-600 text-xs">{new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
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