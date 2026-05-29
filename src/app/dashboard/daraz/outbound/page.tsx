"use client";
import { useState, useEffect } from "react";
import { Package, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface ScanRecord {
  trackingNo: string;
  scannedAt: string;
}

interface Stats {
  todayCount: number;
  totalCount: number;
  recentScans: { trackingNo: string; createdAt: string; scannedBy: string }[];
}

export default function OutboundPage() {
  const [trackingNo, setTrackingNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessionScans, setSessionScans] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ todayCount: 0, totalCount: 0, recentScans: [] });

  const fetchStats = async () => {
    const res = await fetch("/api/daraz/outbound");
    const data = await res.json();
    setStats(data);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleScan = async () => {
    if (!trackingNo.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daraz/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNo: trackingNo.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Scanned: ${trackingNo.trim()}` });
        setSessionScans((prev) => [
          { trackingNo: trackingNo.trim(), scannedAt: new Date().toLocaleTimeString() },
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

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Outbound Scan</h1>
          <p className="text-gray-400 text-sm">Scan before sending to Daraz warehouse</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{stats.todayCount}</p>
          <p className="text-gray-400 text-xs mt-1">Today</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{sessionScans.length}</p>
          <p className="text-gray-400 text-xs mt-1">This Session</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-300">{stats.totalCount}</p>
          <p className="text-gray-400 text-xs mt-1">All Time</p>
        </div>
      </div>

      {/* Scan Input */}
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

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Session Scans */}
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

        {/* Today's Scans from DB */}
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
                  <span className="text-gray-500 text-xs">{scan.scannedBy}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
