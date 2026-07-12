"use client";
import { useState, useEffect } from "react";
import {
  Printer, Truck, RefreshCw, Package, AlertTriangle, Loader2, CheckCircle2, Circle,
} from "lucide-react";
import { resolveStoreName } from "@/lib/storeMap";
import OrderDetailPopup from "@/components/OrderDetailPopup";

interface Row {
  orderItemId: string;
  darazOrderId: string;
  itemName: string;
  sku: string;
  status: string;
  price: number;
  storeId: string | null;
  trackingNo: string;
  printCount: number;
  printedAt: string | null;
  customerName: string;
  customerPhone: string;
  orderDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  packed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  ready_to_ship: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const PAPERS = [
  { id: "a5", label: "A5 (1 per sheet)" },
  { id: "a4", label: "A4 (1 per sheet)" },
  { id: "a4x2", label: "A4 landscape (2 per sheet)" },
  { id: "thermal", label: "Thermal 100x150 (label only)" },
];

type Tab = "pending" | "packed" | "notprinted" | "printed" | "all";
const MAX_BATCH = 6; // Vercel 10s ceiling: each order costs 2 Daraz calls

export default function OrderProcessingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [storeFilter, setStoreFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [paper, setPaper] = useState("a5");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ orderId: string; storeId: string | null } | null>(null);

  const load = async () => {
    const res = await fetch("/api/daraz/ship-queue", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data.rows) ? data.rows : []);
  };

  // Refresh = live sync, not a DB re-read. Item rows are otherwise only created
  // by the nightly cron, so today's orders would be invisible here.
  const refresh = async () => {
    setLoading(true);
    setNote(null);
    try {
      setSyncMsg("Pulling new orders from Daraz...");
      await fetch("/api/daraz/orders/fetch", { cache: "no-store" });

      // Each pass creates missing item rows AND re-checks the stalest ones
      // against Daraz, so cancelled orders stop haunting the queue.
      let left = -1;
      const MAX_PASSES = 10;
      let pass = 0;
      for (; pass < MAX_PASSES; pass++) {
        setSyncMsg(
          left < 0
            ? "Syncing order items..."
            : `Syncing order items... ${left} orders left`
        );
        const res = await fetch("/api/daraz/ship-queue?sync=1", { cache: "no-store" });
        const data = await res.json();
        setRows(Array.isArray(data.rows) ? data.rows : []);
        if (data?.sync?.error) {
          setNote(`Sync warning: ${data.sync.error}`);
          break;
        }
        left = data?.sync?.remaining ?? 0;
        if (left === 0) break;
      }
      if (pass >= MAX_PASSES && left > 0) {
        setNote(`Sync stopped after ${MAX_PASSES} passes with ${left} orders left. Press Refresh again to continue.`);
      }
      await load();
      setSyncMsg(null);
    } catch (e) {
      setSyncMsg(null);
      setNote(`Refresh failed: ${String(e).substring(0, 120)}`);
    }
    setSelected([]);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    const saved = window.localStorage?.getItem("olko_paper");
    if (saved) setPaper(saved);
  }, []);

  const pickPaper = (p: string) => {
    setPaper(p);
    try {
      window.localStorage?.setItem("olko_paper", p);
    } catch {
      /* ignore */
    }
  };

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    packed: rows.filter((r) => r.status === "packed").length,
    notprinted: rows.filter((r) => r.status === "ready_to_ship" && r.printCount === 0).length,
    printed: rows.filter((r) => r.printCount > 0).length,
  };

  const byTab = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "pending") return r.status === "pending";
    if (tab === "packed") return r.status === "packed";
    if (tab === "notprinted") return r.status === "ready_to_ship" && r.printCount === 0;
    if (tab === "printed") return r.printCount > 0;
    return true;
  });
  const filtered = storeFilter === "all" ? byTab : byTab.filter((r) => r.storeId === storeFilter);
  const storeIds = Array.from(new Set(rows.map((r) => r.storeId).filter(Boolean))) as string[];

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const printable = selected.filter(
    (id) => rows.find((r) => r.orderItemId === id)?.status === "ready_to_ship"
  );

  const openPrint = async (ids: string[]) => {
    if (ids.length === 0) return;
    window.open(
      `/api/daraz/shipping-label?mode=print&ids=${ids.slice(0, MAX_BATCH).join(",")}&paper=${paper}&auto=1`,
      "_blank"
    );
    // the print route increments printCount server-side; reflect it here
    setTimeout(load, 2500);
  };

  const ship = async (r: Row) => {
    const ok = window.confirm(
      `Pack + Ready-to-Ship on Daraz?\n\n` +
        `Customer : ${r.customerName}\n` +
        `Order    : ${r.darazOrderId}\n` +
        `Item     : ${r.itemName}\n` +
        `Store    : ${resolveStoreName(r.storeId)}\n\n` +
        `This writes to the live Daraz order and cannot be undone here.`
    );
    if (!ok) return;
    setBusy(r.orderItemId);
    setNote(null);
    try {
      const res = await fetch(
        `/api/daraz/ship?mode=fulfil&orderItemId=${r.orderItemId}&confirm=SHIP`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.ok) {
        setNote(`Shipped ${r.darazOrderId} - ${data.trackingNumber || "-"} (${data.shipmentProvider || "-"})`);
        await openPrint([r.orderItemId]);
        await load();
      } else {
        setNote(`FAILED at ${data.failedAt || "?"}: ${data.error || "see console"}`);
      }
    } catch (e) {
      setNote(`Request failed: ${String(e).substring(0, 120)}`);
    }
    setBusy(null);
  };

  const TABS: [Tab, string][] = [
    ["pending", `To Ship (${counts.pending})`],
    ["packed", `Packed (${counts.packed})`],
    ["notprinted", `Not Printed (${counts.notprinted})`],
    ["printed", `Printed (${counts.printed})`],
    ["all", `All (${rows.length})`],
  ];

  return (
    <div className="p-6 space-y-6">
      {popup && (
        <OrderDetailPopup
          orderId={popup.orderId}
          storeId={popup.storeId}
          onClose={() => setPopup(null)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Order Processing</h1>
            <p className="text-gray-400 text-sm">
              Pack, Ready-to-Ship and print labels for all stores
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {(syncMsg || note) && (
        <div className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300">
          {syncMsg ? (
            <Loader2 className="w-4 h-4 text-orange-400 mt-0.5 shrink-0 animate-spin" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          )}
          <span>{syncMsg || note}</span>
        </div>
      )}

      {/* Stage tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setSelected([]);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? "bg-orange-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Store filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStoreFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            storeFilter === "all"
              ? "bg-gray-700 text-white"
              : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
          }`}
        >
          All Stores
        </button>
        {storeIds.map((id) => (
          <button
            key={id}
            onClick={() => setStoreFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              storeFilter === id
                ? "bg-gray-700 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {resolveStoreName(id)}
          </button>
        ))}
      </div>

      {/* Print bar */}
      <div className="flex items-center gap-3 flex-wrap bg-gray-900 border border-gray-800 rounded-xl p-3">
        <span className="text-xs text-gray-400">Paper</span>
        <select
          value={paper}
          onChange={(e) => pickPaper(e.target.value)}
          className="bg-gray-950 border border-gray-800 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-500"
        >
          {PAPERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => openPrint(printable)}
          disabled={printable.length === 0}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print selected ({printable.length})
        </button>
        {printable.length > MAX_BATCH && (
          <span className="text-xs text-amber-400">
            Only the first {MAX_BATCH} will print (10s limit)
          </span>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          Print dialog: Scale = <b className="text-gray-300">100%</b>, never &quot;Fit to page&quot;
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nothing here.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={filtered.length > 0 && filtered.every((r) => selected.includes(r.orderItemId))}
                    onChange={(e) => setSelected(e.target.checked ? filtered.map((r) => r.orderItemId) : [])}
                  />
                </th>
                <th className="px-4 py-3 w-12 text-center">Print</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.orderItemId} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-orange-500"
                      checked={selected.includes(r.orderItemId)}
                      onChange={() => toggle(r.orderItemId)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {r.printCount > 0 ? (
                      <div
                        className="flex items-center justify-center gap-1"
                        title={`Printed ${r.printCount}x${r.printedAt ? " - last " + new Date(r.printedAt).toLocaleString() : ""}`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {r.printCount > 1 && (
                          <span className="text-[10px] font-bold text-emerald-400">x{r.printCount}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center" title="Not printed yet">
                        <Circle className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPopup({ orderId: r.darazOrderId, storeId: r.storeId })}
                      className="text-blue-400 font-mono text-xs hover:underline"
                    >
                      {r.darazOrderId}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate" title={r.itemName}>
                    {r.itemName}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {r.customerName}
                    {r.customerPhone && <span className="block text-xs text-gray-500">{r.customerPhone}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        STATUS_COLORS[r.status] ?? "bg-gray-700 text-gray-300 border-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{resolveStoreName(r.storeId)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.trackingNo || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "ready_to_ship" ? (
                      <button
                        onClick={() => openPrint([r.orderItemId])}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-white ${
                          r.printCount > 0
                            ? "bg-gray-700 hover:bg-gray-600"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {r.printCount > 0 ? "Reprint" : "Print"}
                      </button>
                    ) : (
                      <button
                        onClick={() => ship(r)}
                        disabled={busy === r.orderItemId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        {busy === r.orderItemId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                        {r.status === "packed" ? "Resume RTS" : "Ship"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
