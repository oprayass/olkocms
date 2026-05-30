"use client";
import { useState, useEffect } from "react";
import { RefreshCw, Search, RotateCcw } from "lucide-react";
import OrderDetailPopup from "@/components/OrderDetailPopup";

interface Claim {
  id: string;
  trackingNo: string;
  darazOrderId: string | null;
  itemName: string | null;
  customerName: string | null;
  quantity: number;
  price: number | null;
  returnType: string | null;
  customerComment: string | null;
  claimStatus: string;
  storeId: string | null;
  createdAt: string;
  orderDate: string | null;
}

interface Store {
  id: string;
  storeName: string;
}

const typeColors: Record<string, string> = {
  returned: "bg-orange-900 text-orange-300",
  shipped_back: "bg-orange-900 text-orange-300",
  shipped_back_success: "bg-amber-900 text-amber-300",
  failed_delivery: "bg-red-900 text-red-300",
};

function startOf(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay(); // 0 = Sun
  const mondayOffset = day === 0 ? 6 : day - 1;
  switch (period) {
    case "today":
      return { from: today, to: new Date(today.getTime() + 86400000) };
    case "yesterday":
      return { from: new Date(today.getTime() - 86400000), to: today };
    case "this_week": {
      const f = new Date(today.getTime() - mondayOffset * 86400000);
      return { from: f, to: new Date(f.getTime() + 7 * 86400000) };
    }
    case "last_week": {
      const tEnd = new Date(today.getTime() - mondayOffset * 86400000);
      const f = new Date(tEnd.getTime() - 7 * 86400000);
      return { from: f, to: tEnd };
    }
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case "last_month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "last_year":
      return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) };
    default:
      return { from: null, to: null };
  }
}

export default function ReturnsListPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [message, setMessage] = useState("");
  const [popupOrder, setPopupOrder] = useState<{ orderId: string; storeId: string | null } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [claimsRes, storesRes] = await Promise.all([
        fetch("/api/daraz/returns"),
        fetch("/api/daraz/stores"),
      ]);
      const claimsData = await claimsRes.json();
      const storesData = await storesRes.json();
      setClaims(Array.isArray(claimsData) ? claimsData : []);
      setStores(Array.isArray(storesData) ? storesData : (storesData.stores || []));
    } catch {
      setMessage("Failed to load returns");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleFetch = async () => {
    setFetching(true);
    let grandTotal = 0;
    let done = 0;
    for (const s of stores) {
      setMessage(`Fetching ${s.storeName} (${done + 1}/${stores.length})...`);
      try {
        const res = await fetch(`/api/daraz/returns/fetch?store=${s.id}`);
        const data = await res.json();
        if (data.success) grandTotal += data.totalSaved || 0;
      } catch {}
      done++;
    }
    setMessage(`Done! Fetched/updated ${grandTotal} returns with tracking from ${stores.length} stores.`);
    await loadData();
    setFetching(false);
  };

  const storeName = (id: string | null) => {
    const s = stores.find((s) => s.id === id);
    return s ? s.storeName : "Unknown";
  };

  let filtered = claims.filter((c) => {
    const matchSearch =
      (c.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      c.trackingNo.toLowerCase().includes(search.toLowerCase()) ||
      (c.darazOrderId || "").includes(search);
    const matchStore = storeFilter === "all" || c.storeId === storeFilter;
    const matchType = typeFilter === "all" || c.returnType === typeFilter;

    let matchDate = true;
    const created = new Date(c.orderDate || c.createdAt);
    if (period === "custom") {
      if (customFrom) matchDate = matchDate && created >= new Date(customFrom);
      if (customTo) matchDate = matchDate && created < new Date(new Date(customTo).getTime() + 86400000);
    } else if (period !== "all") {
      const { from, to } = startOf(period);
      if (from && to) matchDate = created >= from && created < to;
    }
    return matchSearch && matchStore && matchType && matchDate;
  });

  // store-wise sort: group by store name, then by date desc
  filtered = filtered.sort((a, b) => {
    const sa = storeName(a.storeId);
    const sb = storeName(b.storeId);
    if (sa !== sb) return sa.localeCompare(sb);
    return new Date(b.orderDate || b.createdAt).getTime() - new Date(a.orderDate || a.createdAt).getTime();
  });

  const totalValue = filtered.reduce((sum, c) => sum + (c.price || 0), 0);
  const types = Array.from(new Set(claims.map((c) => c.returnType).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Returns List</h1>
            <p className="text-gray-400 text-sm">All returns from connected stores</p>
          </div>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
          {fetching ? "Fetching..." : "Fetch Returns"}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Returns</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Value</p>
          <p className="text-2xl font-bold text-orange-400">Rs {totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Connected Stores</p>
          <p className="text-2xl font-bold text-violet-400">{stores.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search customer, order or tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white text-sm"
          />
        </div>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm">
          <option value="all">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm">
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t!}>{t}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
          <option value="last_year">Last Year</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <span className="text-gray-400 text-sm">From</span>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm" />
          <span className="text-gray-400 text-sm">To</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading returns...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">Order ID</th>
                  <th className="text-left px-4 py-3">Tracking No</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Store</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 400).map((c) => (
                  <tr key={c.id} className="border-t border-gray-800 hover:bg-gray-850">
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.darazOrderId ? (
                        <button
                          onClick={() => setPopupOrder({ orderId: c.darazOrderId!, storeId: c.storeId })}
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {c.darazOrderId}
                        </button>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.trackingNo}</td>
                    <td className="px-4 py-3 text-white">{c.customerName || "N/A"}</td>
                    <td className="px-4 py-3 text-gray-400">{c.quantity}</td>
                    <td className="px-4 py-3 text-orange-400">Rs {(c.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${typeColors[c.returnType || ""] || "bg-gray-800 text-gray-400"}`}>
                        {c.returnType || "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{storeName(c.storeId)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.orderDate || c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 400 && (
            <p className="text-center text-gray-500 text-xs py-3">
              Showing first 400 of {filtered.length} returns
            </p>
          )}
        </div>
      )}

      {popupOrder && (
        <OrderDetailPopup
          orderId={popupOrder.orderId}
          storeId={popupOrder.storeId}
          onClose={() => setPopupOrder(null)}
        />
      )}
    </div>
  );
}