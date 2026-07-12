"use client";
import { useState, useEffect } from "react";
import { Printer, Truck, RefreshCw, Package, AlertTriangle, Loader2 } from "lucide-react";
import { resolveStoreName } from "@/lib/storeMap";

interface QueueRow {
  orderItemId: string;
  darazOrderId: string;
  itemName: string;
  sku: string;
  status: string;
  price: number;
  storeId: string | null;
  trackingNo: string;
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

// Vercel Hobby kills the request at 10s and each order costs 2 Daraz calls.
const MAX_BATCH = 6;

export default function ShippingPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "ready_to_ship" | "all">("pending");
  const [storeFilter, setStoreFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [paper, setPaper] = useState("a5");
  const [shipping, setShipping] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/daraz/ship-queue", { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setRows([]);
    }
    setSelected([]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
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

  const byTab = rows.filter((r) => (tab === "all" ? true : r.status === tab));
  const filtered = storeFilter === "all" ? byTab : byTab.filter((r) => r.storeId === storeFilter);
  const storeIds = Array.from(new Set(rows.map((r) => r.storeId).filter(Boolean))) as string[];

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    ready_to_ship: rows.filter((r) => r.status === "ready_to_ship").length,
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const printableSelected = selected.filter(
    (id) => rows.find((r) => r.orderItemId === id)?.status === "ready_to_ship"
  );

  const printSelected = () => {
    if (printableSelected.length === 0) return;
    const ids = printableSelected.slice(0, MAX_BATCH).join(",");
    window.open(
      `/api/daraz/shipping-label?mode=print&ids=${ids}&paper=${paper}&auto=1`,
      "_blank"
    );
  };

  const printOne = (id: string) => {
    window.open(
      `/api/daraz/shipping-label?mode=print&ids=${id}&paper=${paper}&auto=1`,
      "_blank"
    );
  };

  // Writes to a live customer order on Daraz. Cannot be undone from here.
  const shipOne = async (r: QueueRow) => {
    const ok = window.confirm(
      `Pack + Ready-to-Ship this order on Daraz?\n\n` +
        `Customer : ${r.customerName}\n` +
        `Order    : ${r.darazOrderId}\n` +
        `Item     : ${r.itemName}\n` +
        `Store    : ${resolveStoreName(r.storeId)}\n\n` +
        `This writes to the live Daraz order and cannot be undone here.`
    );
    if (!ok) return;

    setShipping(r.orderItemId);
    setNote(null);
    try {
      const res = await fetch(
        `/api/daraz/ship?mode=fulfil&orderItemId=${r.orderItemId}&confirm=SHIP`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.ok) {
        setNote(
          `Shipped ${r.darazOrderId} - tracking ${data.trackingNumber || "-"} (${data.shipmentProvider || "-"}). Printing...`
        );
        window.open(
          `/api/daraz/shipping-label?mode=print&ids=${r.orderItemId}&paper=${paper}&auto=1`,
          "_blank"
        );
        await fetchRows();
      } else {
        setNote(
          `FAILED at ${data.failedAt || "?"}: ${data.error || data.steps?.slice(-1)?.[0]?.msg || "unknown"}`
        );
      }
    } catch (e) {
      setNote(`Request failed: ${String(e).substring(0, 120)}`);
    }
    setShipping(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Printer className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Shipping &amp; Labels</h1>
            <p className="text-gray-400 text-sm">
              Pack + Ready-to-Ship on Daraz, then print the label and invoice
            </p>
          </div>
        </div>
        <button
          onClick={fetchRows}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {note && (
        <div className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <span>{note}</span>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["pending", `To Ship (${counts.pending})`],
            ["ready_to_ship", `Ready to Print (${counts.ready_to_ship})`],
            ["all", `All (${rows.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id as any);
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
          onClick={printSelected}
          disabled={printableSelected.length === 0}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print selected ({printableSelected.length})
        </button>

        {printableSelected.length > MAX_BATCH && (
          <span className="text-xs text-amber-400">
            Only the first {MAX_BATCH} will print - batch is capped (10s limit)
          </span>
        )}
        {selected.length > printableSelected.length && (
          <span className="text-xs text-gray-500">
            {selected.length - printableSelected.length} selected are not ready_to_ship yet
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
                    onChange={(e) =>
                      setSelected(e.target.checked ? filtered.map((r) => r.orderItemId) : [])
                    }
                  />
                </th>
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
                <tr
                  key={r.orderItemId}
                  className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-orange-500"
                      checked={selected.includes(r.orderItemId)}
                      onChange={() => toggle(r.orderItemId)}
                    />
                  </td>
                  <td className="px-4 py-3 text-blue-400 font-mono text-xs">{r.darazOrderId}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate" title={r.itemName}>
                    {r.itemName}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {r.customerName}
                    {r.customerPhone && (
                      <span className="block text-xs text-gray-500">{r.customerPhone}</span>
                    )}
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
                        onClick={() => printOne(r.orderItemId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </button>
                    ) : (
                      <button
                        onClick={() => shipOne(r)}
                        disabled={shipping === r.orderItemId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        {shipping === r.orderItemId ? (
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
