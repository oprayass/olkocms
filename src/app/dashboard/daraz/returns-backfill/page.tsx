"use client";

import { useState } from "react";

const STATUSES = ["returned", "shipped_back", "shipped_back_success", "failed_delivery"];

type LogEntry = { store: string; status: string; returns?: number; error?: string; time: string };

export default function ReturnsBackfillPage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totalSaved, setTotalSaved] = useState(0);
  const [skipItems, setSkipItems] = useState(false);

  async function startBackfill() {
    setRunning(true);
    setLogs([]);
    setTotalSaved(0);
    setProgress({ done: 0, total: 0 });

    // 1) Stores list
    let stores: { id: string; storeName: string }[] = [];
    try {
      const res = await fetch("/api/daraz/debug-stores");
      const data = await res.json();
      stores = data.stores || [];
    } catch (e) {
      setLogs((l) => [...l, { store: "ALL", status: "-", error: "Failed to load stores", time: new Date().toLocaleTimeString() }]);
      setRunning(false);
      return;
    }

    const total = stores.length * STATUSES.length;
    setProgress({ done: 0, total });

    let saved = 0;
    let done = 0;

    // 2) Sequential: store x status (one at a time to avoid timeout)
    for (const store of stores) {
      for (const status of STATUSES) {
        const skip = skipItems ? "&skipItems=1" : "";
        const url = `/api/daraz/returns/fetch?store=${store.id}&status=${status}${skip}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          const r = data?.results?.[0];
          const returns = r?.returns ?? 0;
          saved += returns;
          setLogs((l) => [
            ...l,
            { store: store.storeName, status, returns, error: data?.error || r?.error, time: new Date().toLocaleTimeString() },
          ]);
        } catch (e) {
          setLogs((l) => [
            ...l,
            { store: store.storeName, status, error: String(e).substring(0, 80), time: new Date().toLocaleTimeString() },
          ]);
        }
        done++;
        setProgress({ done, total });
        setTotalSaved(saved);
        // छोटो pause — rate limit नछुने
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setRunning(false);
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Returns Backfill</h1>
      <p className="text-sm text-muted-foreground mb-4">
        सबै stores × सबै return statuses एक-एक गरेर fetch गर्छ (timeout बच्न sequential)। एकपटकको काम हो।
      </p>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={startBackfill}
          disabled={running}
          className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {running ? "Running..." : "Start Backfill"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={skipItems} onChange={(e) => setSkipItems(e.target.checked)} disabled={running} />
          Skip item details (छिटो, tracking बिना)
        </label>
      </div>

      {progress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{progress.done} / {progress.total} calls</span>
            <span>Total saved: {totalSaved}</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="border rounded-md max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Store</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Returns</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 text-muted-foreground">{log.time}</td>
                <td className="p-2">{log.store}</td>
                <td className="p-2">{log.status}</td>
                <td className="p-2 text-right">
                  {log.error ? (
                    <span className="text-red-500" title={log.error}>error</span>
                  ) : (
                    log.returns
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}