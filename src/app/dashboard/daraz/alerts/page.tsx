"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";

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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unresolved");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    const res = await fetch("/api/daraz/alerts");
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

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

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            <p className="text-gray-400 text-sm">Missing items and unresolved issues</p>
          </div>
        </div>
        <button onClick={fetchAlerts} className="text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2">
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
              <span className="ml-1.5 text-gray-500">
                ({alerts.filter((a) => a.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No {filter} alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div key={alert.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{alert.productName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${ALERT_COLORS[alert.status] || ALERT_COLORS.unresolved}`}>
                      {alert.status}
                    </span>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{alert.alertType}</span>
                  </div>
                  <p className="text-gray-500 text-xs">Order: {alert.darazOrderId}</p>
                  {alert.notes && <p className="text-gray-400 text-xs mt-1">{alert.notes}</p>}
                  <p className="text-gray-600 text-xs">{new Date(alert.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {alert.status !== "investigating" && (
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
          ))}
        </div>
      )}
    </div>
  );
}
