"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Store, Plus, CheckCircle, AlertTriangle, Trash2, Edit2, RefreshCw } from "lucide-react";

interface DarazStore {
  id: string;
  storeName: string;
  sellerId: string | null;
  accessToken: string | null;
  tokenExpiry: string | null;
  isActive: boolean;
  status: string;
  createdAt: string;
}

export default function DarazStoresPage() {
  const [stores, setStores] = useState<DarazStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  const fetchStores = async () => {
    setLoading(true);
    const res = await fetch("/api/daraz/stores");
    const data = await res.json();
    setStores(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchStores(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this store?")) return;
    await fetch("/api/daraz/stores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchStores();
  };

  const handleRename = async (id: string) => {
    await fetch("/api/daraz/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, storeName: editName }),
    });
    setEditId(null);
    fetchStores();
  };

  const isExpired = (expiry: string | null) => {
    if (!expiry) return true;
    return new Date(expiry) < new Date();
  };

  const daysLeft = (expiry: string | null) => {
    if (!expiry) return 0;
    const diff = new Date(expiry).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Daraz Stores</h1>
            <p className="text-gray-400 text-sm">Connect and manage your Daraz seller accounts</p>
          </div>
        </div>
        <button onClick={fetchStores} className="text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Store connected successfully!
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error === "token_failed" ? "Authorization failed. Please try again." : "Something went wrong. Please try again."}
        </div>
      )}

      <a href="/api/daraz/auth"
        className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors">
        <Plus className="w-5 h-5" />
        Connect New Daraz Store
      </a>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading stores...</div>
      ) : stores.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Store className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No stores connected yet</p>
          <p className="text-gray-600 text-xs mt-1">Click the button above to connect your first Daraz store</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div key={store.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${store.isActive && !isExpired(store.tokenExpiry) ? "bg-emerald-400" : "bg-red-400"}`} />
                  {editId === store.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                      <button onClick={() => handleRename(store.id)} className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">Save</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{store.storeName}</p>
                      <p className="text-gray-500 text-xs">Seller ID: {store.sellerId || "unknown"}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {store.tokenExpiry && (
                    <div className="text-right">
                      {isExpired(store.tokenExpiry) ? (
                        <span className="text-xs text-red-400">Token expired</span>
                      ) : (
                        <span className="text-xs text-gray-500">{daysLeft(store.tokenExpiry)}d left</span>
                      )}
                    </div>
                  )}
                  {isExpired(store.tokenExpiry) && (
                    <a href="/api/daraz/auth" className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded hover:bg-orange-500/20 transition-colors">
                      Reconnect
                    </a>
                  )}
                  <button onClick={() => { setEditId(store.id); setEditName(store.storeName); }}
                    className="text-gray-500 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(store.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
