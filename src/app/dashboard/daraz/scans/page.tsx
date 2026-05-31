"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Trash2, RotateCcw, AlertTriangle, Clock } from "lucide-react";
import { resolveStoreName } from "@/lib/storeMap";

interface Scan {
  id: string;
  trackingNo: string | null;
  darazOrderId: string | null;
  itemName: string | null;
  price: number | null;
  scanType: string;
  storeId: string | null;
  scannedBy: string | null;
  wrongStore: boolean;
  createdAt: string;
  deleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
}

const VIEW_LABELS: Record<string, string> = {
  today: "Today's Scans",
  all: "All Time Scans",
  wrongStore: "Wrong Store Scans",
  deleted: "Deleted Scans",
};

function ScansContent() {
  const params = useSearchParams();
  const router = useRouter();
  const scanType = params.get("type") || "inbound";
  const view = params.get("view") || "all";

  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  const fetchScans = async () => {
    setLoading(true);
    try {
      const url = view === "deleted"
        ? `/api/daraz/scan-manage?view=deleted${scanType ? `&scanType=${scanType}` : ""}`
        : `/api/daraz/scan-manage?scanType=${scanType}&view=${view}`;
      const res = await fetch(url);
      const data = await res.json();
      setScans(Array.isArray(data.scans) ? data.scans : []);
    } catch {
      setScans([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(d => setRole((d?.user as any)?.role || ""));
  }, []);

  useEffect(() => { fetchScans(); }, [scanType, view]);

  const isAdmin = role === "ADMIN";

  const deleteScan = async (id: string) => {
    if (!confirm("यो scan delete गर्ने? (Deleted folder मा जान्छ, 30 days भित्र undo गर्न सकिन्छ)")) return;
    setBusy(id);
    const res = await fetch("/api/daraz/scan-manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Delete failed");
    }
    await fetchScans();
    setBusy(null);
  };

  const undoScan = async (id: string) => {
    setBusy(id);
    await fetch("/api/daraz/scan-manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchScans();
    setBusy(null);
  };

  const setView = (v: string) => {
    router.push(`/dashboard/daraz/scans?type=${scanType}&view=${v}`);
  };

  const setType = (t: string) => {
    router.push(`/dashboard/daraz/scans?type=${t}&view=${view}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white capitalize">
            {scanType} — {VIEW_LABELS[view] || view}
            <span className="ml-2 text-sm bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{scans.length}</span>
          </h1>
          <p className="text-gray-400 text-sm">Scan records — delete, undo, र manage गर्नुहोस्</p>
        </div>
      </div>

      {/* Type toggle */}
      <div className="flex gap-2 flex-wrap">
        {["inbound", "outbound"].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${scanType === t ? "bg-amber-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* View filter */}
      <div className="flex gap-2 flex-wrap">
        {["today", "all", "wrongStore", "deleted"].map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === v ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}>
            {VIEW_LABELS[v] || v}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : scans.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Package className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">कुनै scan छैन</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scans.map((s) => (
            <div key={s.id} className={`bg-gray-900 border rounded-xl p-4 ${s.wrongStore ? "border-red-500/30" : "border-gray-800"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.wrongStore && <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">WRONG STORE</span>}
                    <span className="text-white font-mono text-sm">{s.trackingNo || "(no tracking)"}</span>
                    {s.itemName && <span className="text-gray-400 text-xs truncate">{s.itemName}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {s.darazOrderId && <span>Order: {s.darazOrderId}</span>}
                    {s.storeId && <span className="text-blue-400">{resolveStoreName(s.storeId)}</span>}
                    {s.price && <span>Rs. {s.price}</span>}
                    <span>by {s.scannedBy || "unknown"}</span>
                    <span>{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                  {s.deleted && (
                    <p className="text-red-400 text-xs">🗑️ Deleted by {s.deletedBy} on {s.deletedAt ? new Date(s.deletedAt).toLocaleString() : ""}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {view === "deleted" ? (
                    isAdmin && (
                      <button onClick={() => undoScan(s.id)} disabled={busy === s.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 disabled:opacity-40">
                        <RotateCcw className="w-3 h-3" /> Undo
                      </button>
                    )
                  ) : (
                    isAdmin && (
                      <button onClick={() => deleteScan(s.id)} disabled={busy === s.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs hover:bg-red-500/20 disabled:opacity-40">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="text-gray-600 text-xs">Delete/Undo permission सिर्फ admin सँग छ।</p>
      )}
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ScansContent />
    </Suspense>
  );
}