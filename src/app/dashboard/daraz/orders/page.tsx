"use client";
import { useState, useEffect } from "react";
import { RefreshCw, Search, Package } from "lucide-react";

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

export default function DarazOrdersPage() {
  const [orders, setOrders] = useState<DarazOrder[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    loadData();
  }, []);

  const handleFetch = async () => {
    setFetching(true);
    setMessage("Fetching latest orders from Daraz...");
    try {
      const res = await fetch("/api/daraz/orders/fetch");
      const data = await res.json();
      if (data.success) {
        setMessage(`Fetched ${data.totalFetched} orders from ${data.stores} stores!`);
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

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.darazOrderId.includes(search);
    const matchStore = storeFilter === "all" || o.storeId === storeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStore && matchStatus;
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
        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm"
        >
          <option value="all">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.storeName}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm"
        >
          <option value="all">All Status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

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
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((o) => (
                  <tr key={o.id} className="border-t border-gray-800 hover:bg-gray-850">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{o.darazOrderId}</td>
                    <td className="px-4 py-3 text-white">{o.customerName}</td>
                    <td className="px-4 py-3 text-gray-400">{o.quantity}</td>
                    <td className="px-4 py-3 text-emerald-400">Rs {o.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[o.status] || "bg-gray-800 text-gray-400"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{storeName(o.storeId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <p className="text-center text-gray-500 text-xs py-3">
              Showing first 200 of {filtered.length} orders
            </p>
          )}
        </div>
      )}
    </div>
  );
}
