"use client";
import { useState, useEffect } from "react";
import { X, Package, Truck, Loader2 } from "lucide-react";

interface OrderItem {
  name: string;
  sku: string;
  variation: string;
  quantity: number;
  paidPrice: number;
  trackingCode: string;
  shipmentProvider: string;
  status: string;
  reason: string;
  productImage: string;
}

interface Props {
  orderId: string | null;
  storeId?: string | null;
  onClose: () => void;
}

export default function OrderDetailPopup({ orderId, storeId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    setItems([]);
    const url = `/api/daraz/order-detail?orderId=${orderId}${storeId ? `&store=${storeId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setItems(data.items || []);
          setStoreName(data.store || "");
        } else {
          setError(data.error || "No details found");
        }
      })
      .catch(() => setError("Failed to load details"))
      .finally(() => setLoading(false));
  }, [orderId, storeId]);

  if (!orderId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-white font-semibold">Order #{orderId}</h3>
              {storeName && <p className="text-gray-500 text-xs">{storeName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-10">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading from Daraz...
            </div>
          )}

          {error && !loading && (
            <div className="text-center text-gray-400 py-10">{error}</div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-4">
              {items.map((it, i) => (
                <div key={i} className="bg-gray-850 border border-gray-800 rounded-lg p-4">
                  <div className="flex gap-4">
                    {it.productImage ? (
                      <img src={it.productImage} alt="" className="w-16 h-16 rounded object-cover border border-gray-700" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-gray-800 flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{it.name}</p>
                      {it.variation && <p className="text-gray-400 text-xs mt-0.5">{it.variation}</p>}
                      {it.sku && <p className="text-gray-500 text-xs mt-0.5">SKU: {it.sku}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-emerald-400 text-sm font-medium">Rs {it.paidPrice.toLocaleString()}</span>
                        {it.status && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{it.status}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(it.trackingCode || it.shipmentProvider) && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800 text-xs">
                      <Truck className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300 font-mono">{it.trackingCode || "-"}</span>
                      {it.shipmentProvider && <span className="text-gray-500">({it.shipmentProvider})</span>}
                    </div>
                  )}

                  {it.reason && (
                    <div className="mt-2 text-xs">
                      <span className="text-gray-500">Reason: </span>
                      <span className="text-orange-300">{it.reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center text-gray-400 py-10">No items found for this order.</div>
          )}
        </div>
      </div>
    </div>
  );
}