"use client";
import { useState } from "react";
import { Lock, CheckCircle, AlertOctagon } from "lucide-react";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (!current || !next || !confirm) {
      setMsg({ type: "error", text: "All fields required" });
      return;
    }
    if (next !== confirm) {
      setMsg({ type: "error", text: "New password and confirm do not match" });
      return;
    }
    if (next.length < 6) {
      setMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ type: "success", text: "Password successfully changed!" });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setMsg({ type: "error", text: data.error || "Failed" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Lock className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Change Password</h1>
          <p className="text-gray-400 text-sm">आफ्नो password सुरक्षित राख्नुहोस्</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-gray-400 text-xs block mb-1">Current Password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-gray-400 text-xs block mb-1">New Password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-gray-400 text-xs block mb-1">Confirm New Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
        </div>

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {msg.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertOctagon className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        <button onClick={submit} disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {loading ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}