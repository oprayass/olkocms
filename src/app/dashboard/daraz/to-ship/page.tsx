"use client";
import { useState, useEffect } from "react";
import { Truck, RefreshCw, Package } from "lucide-react";
import { resolveStoreName } from "@/lib/storeMap";
import OrderDetailPopup from "@/components/OrderDetailPopup";

interface ToShipOrder {
  orderId: string;
  customerName: string;
  itemsCount: number;
  price: number;
  status: string;
  storeId: string | null;
  orderDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ready_to_ship: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  packed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export default function ToShipPage() {
  const [orders, setOrders] = useState<ToShipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [popupOrder, setPopupOrder] = useState<{ orderId: string; storeId: string | null } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/daraz/to-ship");
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const storeIds = Array.from(new Set(orders.map((o) => o.storeId).filter(Boolean))) as string[];
  const filtered = storeFilter === "all" ? orders : orders.filter((o) => o.storeId === storeFilter);

  return (
    <div className="p-6 space-y-6">
      {popupOrder && (
        <OrderDetailPopup
          orderId={popupOrder.orderId}
          storeId={popupOrder.storeId}
          onClose={() => setPopupOrder(null)}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              All To Ship
              {orders.length > 0 && (
                <span className="ml-2 text-sm bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                  {orders.length} orders
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">सबै stores का Daraz पठाउन बाँकी orders (live)</p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Fetching..." : "Refresh"}
        </button>
      </div>

      {/* Store filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStoreFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${storeFilter === "all" ? "bg-orange-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
        >
          All Stores ({orders.length})
        </button>
        {storeIds.map((id) => {
          const count = orders.filter((o) => o.storeId === id).length;
          return (
            <button
              key={id}
              onClick={() => setStoreFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${storeFilter === id ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"}`}
            >
              {resolveStoreName(id)} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading from Daraz... (केही सेकेन्ड लाग्छ)</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Package className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">कुनै order पठाउन बाँकी छैन</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 text-gray-400 text-xs">
              <tr>
                <th className="text-left px-4 py-3">Order ID</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-center px-4 py-3">Qty</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Store</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.orderId} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3"><button onClick={() => setPopupOrder({ orderId: o.orderId, storeId: o.storeId })} className="text-blue-400 font-mono text-xs hover:underline">{o.orderId}</button></td>
                  <td className="px-4 py-3 text-gray-300">{o.customerName}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{o.itemsCount}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">Rs {o.price.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[o.status] ?? "bg-gray-700 text-gray-300 border-gray-600"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{resolveStoreName(o.storeId)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "—"}
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