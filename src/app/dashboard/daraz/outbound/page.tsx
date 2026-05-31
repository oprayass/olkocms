"use client";
import { useState, useEffect } from "react";
import { Package, CheckCircle, Clock, TrendingUp, AlertTriangle, AlertOctagon } from "lucide-react";
import { validateTracking } from "@/lib/trackingValidator";
import Link from "next/link";

interface ScanRecord {
  trackingNo: string;
  scannedAt: string;
}

interface Stats {
  todayCount: number;
  totalCount: number;
  recentScans: { trackingNo: string; createdAt: string; scannedBy: string }[];
}

interface DupInfo {
  trackingNo: string;
  scannedAt: string;
  scannedBy: string;
}

export default function OutboundPage() {
  const [trackingNo, setTrackingNo] = useState("");
  const [invalidWarn, setInvalidWarn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessionScans, setSessionScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ todayCount: 0, totalCount: 0, recentScans: [] });
  const [dup, setDup] = useState<{ info: DupInfo; pendingTracking: string } | null>(null);

  const fetchStats = async () => {
    const res = await fetch("/api/daraz/outbound");
    const data = await res.json();
    setStats(data);
  };

  useEffect(() => { fetchStats(); }, []);

  const doScan = async (tracking: string, force: boolean) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daraz/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNo: tracking, force }),
      });
      const data = await res.json();

      if (data.duplicate) {
        // पहिले scan भएको — popup देखाउने
        setDup({ info: data.existing, pendingTracking: tracking });
        setLoading(false);
        return;
      }

      if (data.success) {
        setMessage({ type: "success", text: `Scanned: ${tracking}` });
        setSessionScans((prev) => [
          { trackingNo: tracking, scannedAt: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);
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

  // popup: पुरानो delete गरेर नयाँ राख्ने
  const replaceOld = () => {
    if (!dup) return;
    const t = dup.pendingTracking;
    setDup(null);
    doScan(t, true);
  };

  // popup: नयाँ discard (केही नगर्ने)
  const discardNew = () => {
    setDup(null);
    setTrackingNo("");
    setMessage({ type: "error", text: "New scan discarded / नयाँ scan रद्द गरियो" });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Outbound Scan</h1>
          <p className="text-gray-400 text-sm">Scan before sending to Daraz warehouse</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link href="/dashboard/daraz/scans?type=outbound&view=today" className="bg-gray-900 border border-orange-500/20 rounded-xl p-4 text-center hover:border-orange-500/50 transition-colors">
          <p className="text-3xl font-bold text-orange-400">{stats.todayCount}</p>
          <p className="text-gray-400 text-xs mt-1">Today</p>
        </Link>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{sessionScans.length}</p>
          <p className="text-gray-400 text-xs mt-1">This Session</p>
        </div>
        <Link href="/dashboard/daraz/scans?type=outbound&view=all" className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-gray-600 transition-colors">
          <p className="text-3xl font-bold text-gray-300">{stats.totalCount}</p>
          <p className="text-gray-400 text-xs mt-1">All Time</p>
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <label className="text-sm text-gray-400 font-medium">Tracking Number</label>
        <input
          type="text"
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="Scan or type tracking number..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-lg tracking-wider"
          autoFocus
        />
        <button
          onClick={handleScan}
          disabled={loading || !trackingNo.trim()}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? "Scanning..." : "Confirm Scan"}
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
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sessionScans.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400 font-medium">This Session</span>
            </div>
            <div className="space-y-2">
              {sessionScans.map((scan, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-white font-mono text-xs">{scan.trackingNo}</span>
                  <span className="text-gray-500 text-xs">{scan.scannedAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.recentScans.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-400 font-medium">Today&apos;s Scans</span>
            </div>
            <div className="space-y-2">
              {stats.recentScans.map((scan, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-white font-mono text-xs">{scan.trackingNo}</span>
                  <div className="text-right">
                    <div className="text-gray-400 text-xs">{scan.scannedBy}</div>
                    <div className="text-gray-600 text-xs">{new Date(scan.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
              This order is already outbound. What do you want to do?<br />
              <span className="text-gray-500">यो order पहिले नै outbound भइसकेको छ। के गर्ने?</span>
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={replaceOld}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                Delete old entry &amp; keep new / पुरानो हटाएर नयाँ राख्ने
              </button>
              <button
                onClick={discardNew}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-lg text-sm"
              >
                Discard new scan / नयाँ scan रद्द गर्ने
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}