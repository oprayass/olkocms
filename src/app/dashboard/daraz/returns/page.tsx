"use client";
import { useState, useEffect } from "react";
import { RotateCcw, CheckCircle, AlertTriangle, Clock, AlertOctagon } from "lucide-react";
import { validateTracking } from "@/lib/trackingValidator";
import Link from "next/link";

interface DupInfo {
  trackingNo: string;
  scannedAt: string;
  scannedBy: string;
}

interface RecentScan {
  trackingNo: string;
  createdAt: string;
  scannedBy: string;
  wrongStore: boolean;
  itemName: string | null;
}

interface Stats {
  todayCount: number;
  totalCount: number;
  wrongStoreCount: number;
  recentScans: RecentScan[];
}

export default function ReturnsScanPage() {
  const [trackingNo, setTrackingNo] = useState("");
  const [invalidWarn, setInvalidWarn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [stats, setStats] = useState<Stats>({ todayCount: 0, totalCount: 0, wrongStoreCount: 0, recentScans: [] });
  const [dup, setDup] = useState<{ info: DupInfo; pendingTracking: string } | null>(null);

  const fetchStats = async () => {
    const res = await fetch("/api/daraz/inbound");
    const data = await res.json();
    setStats(data);
  };

  useEffect(() => { fetchStats(); }, []);

  const doScan = async (tracking: string, force: boolean) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daraz/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNo: tracking, force }),
      });
      const data = await res.json();

      if (data.duplicate) {
        setDup({ info: data.existing, pendingTracking: tracking });
        setLoading(false);
        return;
      }

      if (data.success) {
        if (data.wrongStore) {
          setMessage({
            type: "warning",
            text: `⚠ WRONG STORE / गलत स्टोर! "${tracking}" हाम्रो कुनै store मा भेटिएन। अर्कै store को सामान हुनसक्छ।`,
          });
        } else {
          setMessage({
            type: "success",
            text: `Inbound recorded: ${tracking}${data.matchedStore ? ` (${data.matchedStore})` : ""}${data.matchedItem ? ` — ${data.matchedItem}` : ""}`,
          });
        }
        setTrackingNo("");
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Scan failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setLoading(false);
  };

  const handleScan = () => {
    if (!trackingNo.trim() || loading) return;
    const v = validateTracking(trackingNo);
    if (!v.valid) {
      setInvalidWarn(v.reason || "Invalid format");
      setMessage(null);
      return;
    }
    setInvalidWarn(null);
    doScan(v.cleaned, false);
  };
  const forceAdd = () => {
    if (!trackingNo.trim() || loading) return;
    setInvalidWarn(null);
    doScan(trackingNo.trim().toUpperCase(), false);
  };

  const replaceOld = () => {
    if (!dup) return;
    const t = dup.pendingTracking;
    setDup(null);
    doScan(t, true);
  };

  const discardNew = () => {
    setDup(null);
    setTrackingNo("");
    setMessage({ type: "error", text: "New scan discarded / नयाँ scan रद्द गरियो" });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Returns Scan (Inbound)</h1>
          <p className="text-gray-400 text-sm">Scan items coming back from Daraz warehouse</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link href="/dashboard/daraz/scans?type=inbound&view=today" className="bg-gray-900 border border-amber-500/20 rounded-xl p-4 text-center hover:border-amber-500/50 transition-colors">
          <p className="text-3xl font-bold text-amber-400">{stats.todayCount}</p>
          <p className="text-gray-400 text-xs mt-1">Today</p>
        </Link>
        <Link href="/dashboard/daraz/scans?type=inbound&view=all" className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-gray-600 transition-colors">
          <p className="text-3xl font-bold text-white">{stats.totalCount}</p>
          <p className="text-gray-400 text-xs mt-1">All Time</p>
        </Link>
        <Link href="/dashboard/daraz/scans?type=inbound&view=wrongStore" className="bg-gray-900 border border-red-500/20 rounded-xl p-4 text-center hover:border-red-500/50 transition-colors">
          <p className="text-3xl font-bold text-red-400">{stats.wrongStoreCount}</p>
          <p className="text-gray-400 text-xs mt-1">Wrong Store</p>
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <label className="text-sm text-gray-400 font-medium block">Tracking Number</label>
        <input
          type="text"
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="Scan or type tracking number..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-lg tracking-wider"
          autoFocus
        />
        <button
          onClick={handleScan}
          disabled={loading || !trackingNo.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? "Scanning..." : "Confirm Inbound Scan"}
        </button>

        {invalidWarn && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-red-400 font-medium">Invalid tracking format</p>
                <p className="text-gray-400 text-xs mt-1">{invalidWarn}</p>
                <p className="text-gray-500 text-xs mt-1">Standard: DEXNP025527286, UPANP000318133, or PND-NP-000717568</p>
              </div>
            </div>
            <button
              onClick={forceAdd}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              Force Add (verify first)
            </button>
          </div>
        )}

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : message.type === "warning" ? "bg-red-500/10 text-red-400 border border-red-500/30"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {message.type === "warning" ? <AlertOctagon className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}
      </div>

      {/* Today's inbound scans */}
      {stats.recentScans.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-gray-400 font-medium">Today&apos;s Inbound Scans</span>
          </div>
          <div className="space-y-2">
            {stats.recentScans.map((scan, i) => (
              <div key={i} className={`flex items-center justify-between py-2 px-2 rounded border-b border-gray-800 last:border-0 ${scan.wrongStore ? "bg-red-500/5" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {scan.wrongStore && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <div className="min-w-0">
                    <span className="text-white font-mono text-xs">{scan.trackingNo}</span>
                    {scan.wrongStore && <span className="text-red-400 text-xs ml-2">WRONG STORE</span>}
                    {scan.itemName && <div className="text-gray-500 text-xs truncate">{scan.itemName}</div>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-gray-400 text-xs">{scan.scannedBy}</div>
                  <div className="text-gray-600 text-xs">{new Date(scan.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate popup */}
      {dup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-amber-500/40 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <h3 className="text-white font-semibold">Already Scanned / पहिले नै scan भएको</h3>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-300 font-mono">{dup.info.trackingNo}</p>
              <p className="text-gray-400 text-xs">
                Scanned at / scan भएको: <span className="text-white">{new Date(dup.info.scannedAt).toLocaleString()}</span>
              </p>
              <p className="text-gray-400 text-xs">
                By / द्वारा: <span className="text-white">{dup.info.scannedBy}</span>
              </p>
            </div>
            <p className="text-gray-400 text-sm">
              This item is already inbound. What do you want to do?<br />
              <span className="text-gray-500">यो सामान पहिले नै inbound भइसकेको छ। के गर्ने?</span>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={replaceOld} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm">
                Delete old entry &amp; keep new / पुरानो हटाएर नयाँ राख्ने
              </button>
              <button onClick={discardNew} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-lg text-sm">
                Discard new scan / नयाँ scan रद्द गर्ने
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}