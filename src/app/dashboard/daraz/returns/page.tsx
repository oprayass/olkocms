"use client";
import { useState } from "react";
import { RotateCcw, CheckCircle } from "lucide-react";

const RETURN_TYPES = ["Failed Delivery", "Customer Return", "Damaged Item", "Wrong Item", "Other"];

export default function ReturnsPage() {
  const [form, setForm] = useState({ trackingNo: "", quantity: "1", returnType: "Failed Delivery", notes: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!form.trackingNo.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daraz/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNo: form.trackingNo.trim(),
          quantity: parseInt(form.quantity),
          returnType: form.returnType,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Return recorded: ${form.trackingNo.trim()}` });
        setForm({ trackingNo: "", quantity: "1", returnType: "Failed Delivery", notes: "" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to record return" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Returns Scan</h1>
          <p className="text-gray-400 text-sm">Process returned or failed delivery items</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm text-gray-400 font-medium block mb-2">Tracking Number *</label>
          <input
            type="text"
            value={form.trackingNo}
            onChange={(e) => setForm({ ...form, trackingNo: e.target.value })}
            placeholder="Scan or type tracking number..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-lg tracking-wider"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 font-medium block mb-2">Quantity</label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 font-medium block mb-2">Return Type</label>
            <select
              value={form.returnType}
              onChange={(e) => setForm({ ...form, returnType: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
            >
              {RETURN_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-400 font-medium block mb-2">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any additional notes..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !form.trackingNo.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? "Saving..." : "Record Return"}
        </button>

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
