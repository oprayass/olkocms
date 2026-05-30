"use client";
import { useState, useEffect } from "react";
import { RefreshCw, Search, Package } from "lucide-react";
import OrderDetailPopup from "@/components/OrderDetailPopup";

interface DarazOrder {
  id: string;
  darazOrderId: string;
  customerName: string;
  product: string;
  quantity: number;
  price: number;
  status: string;
  storeId: string | null;
  createdAt: string;
  orderDate: string | null;
}

interface Store {
  id: string;
  storeName: string;
}

const statusColors: Record<string, string> = {
  delivered: "bg-emerald-900 text-emerald-300",
  canceled: "bg-red-900 text-red-300",
  shipped: "bg-blue-900 text-blue-300",
  pending: "bg-amber-900 text-amber-300",
  returned: "bg-orange-900 text-orange-300",
  ready_to_ship: "bg-violet-900 text-violet-300",
  shipped_back: "bg-orange-900 text-orange-300",
  shipped_back_success: "bg-orange-900 text-orange-300",
  failed_delivery: "bg-red-900 text-red-300",
  unpaid: "bg-gray-800 text-gray-400",
};

function startOf(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
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

export default function DarazOrdersPage() {
  const [orders, setOrders] = useState<DarazOrder[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [storeSort, setStoreSort] = useState(false);
  const [message, setMessage] = useState("");
  const [popupOrder, setPopupOrder] = useState<{ orderId: string; storeId: string | null } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, storesRes] = await Promise.all([
        fetch("/api/daraz/orders"),
        fetch("/api/daraz/stores"),
      ]);
      const ordersData = await ordersRes.json();
      const storesData = await storesRes.json();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setStores(Array.isArray(storesData) ? storesData : (storesData.stores || []));
    } catch {
      setMessage("Failed to load orders");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleFetch = async () => {
    setFetching(true);
    setMessage("Fetching latest orders from Daraz...");
    try {
      const res = await fetch("/api/daraz/orders/fetch");
      const data = await res.json();
      if (data.success) {
        setMessage(`Fetched ${data.totalFetched} new orders from ${data.stores} stores!`);
        await loadData();
      } else {
        setMessage("Fetch failed: " + (data.error || "unknown"));
      }
    } catch {
      setMessage("Fetch failed");
    }
    setFetching(false);
  };

  const storeName = (id: string | null) => {
    const s = stores.find((s) => s.id === id);
    return s ? s.storeName : "Unknown";
  };

  let filtered = orders.filter((o) => {
    const matchSearch =
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.darazOrderId.includes(search);
    const matchStore = storeFilter === "all" || o.storeId === storeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;

    let matchDate = true;
    const created = new Date(o.orderDate || o.createdAt);
    if (period === "custom") {
      if (customFrom) matchDate = matchDate && created >= new Date(customFrom);
      if (customTo) matchDate = matchDate && created < new Date(new Date(customTo).getTime() + 86400000);
    } else if (period !== "all") {
      const { from, to } = startOf(period);
      if (from && to) matchDate = created >= from && created < to;
    }
    return matchSearch && matchStore && matchStatus && matchDate;
  });

  filtered = filtered.sort((a, b) => {
    if (storeSort) {
      const sa = storeName(a.storeId);
      const sb = storeName(b.storeId);
      if (sa !== sb) return sa.localeCompare(sb);
    }
    return new Date(b.orderDate || b.createdAt).getTime() - new Date(a.orderDate || a.createdAt).getTime();
  });

  const totalRevenue = filtered
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.price, 0);

  const statuses = Array.from(new Set(orders.map((o) => o.status)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Daraz Orders</h1>
            <p className="text-gray-400 text-sm">All orders from connected stores</p>
          </div>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
          {fetching ? "Fetching..." : "Fetch Latest Orders"}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300">
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Delivered Revenue</p>
          <p className="text-2xl font-bold text-emerald-400">Rs {totalRevenue.toLocaleString()}</p>
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
            placeholder="Search customer or order ID..."
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm">
          <option value="all">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <button
          onClick={() => setStoreSort(!storeSort)}
          className={`px-4 py-2 rounded-lg text-sm border ${storeSort ? "bg-violet-700 border-violet-600 text-white" : "bg-gray-900 border-gray-800 text-gray-400"}`}
        >
          {storeSort ? "Store-wise ✓" : "Store-wise sort"}
        </button>
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
        <p className="text-gray-400">Loading orders...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">Order ID</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Store</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((o) => (
                  <tr key={o.id} className="border-t border-gray-800 hover:bg-gray-850">
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        onClick={() => setPopupOrder({ orderId: o.darazOrderId, storeId: o.storeId })}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {o.darazOrderId}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white">{o.customerName}</td>
                    <td className="px-4 py-3 text-gray-400">{o.quantity}</td>
                    <td className="px-4 py-3 text-emerald-400">Rs {o.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[o.status] || "bg-gray-800 text-gray-400"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{storeName(o.storeId)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.orderDate || o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 300 && (
            <p className="text-center text-gray-500 text-xs py-3">
              Showing first 300 of {filtered.length} orders
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