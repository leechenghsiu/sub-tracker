"use client";
import { useState, useEffect } from "react";

type Subscription = {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingDate: string;
  cycle: string;
  note?: string;
  createdAt: string;
  deletedAt: string | null;
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    price: "",
    currency: "",
    billingDate: "",
    cycle: "",
    note: ""
  });
  const [isLoading, setIsLoading] = useState(true);

  // 頁面載入時自動讀取 localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      fetchSubscriptions(savedToken);
    }
    setIsLoading(false);
  }, []);

  // 登入
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem("token", data.token); // 儲存 token
        fetchSubscriptions(data.token);
      } else {
        setError(data.error || "登入失敗");
      }
    } finally {
      setLoading(false);
    }
  }

  // 登出
  function handleLogout() {
    setToken(null);
    localStorage.removeItem("token");
  }

  // 取得訂閱資料
  async function fetchSubscriptions(token: string) {
    const res = await fetch("/api/subscription", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      // 讀取錯誤訊息
      let errorMsg = "取得訂閱失敗";
      try {
        const err = await res.json();
        errorMsg = err.error || errorMsg;
      } catch {}
      setSubscriptions([]);
      alert(errorMsg);
      return;
    }
    const data = await res.json();
    setSubscriptions(data);
  }

  // 新增訂閱
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          billingDate: new Date(form.billingDate)
        })
      });
      if (res.ok) {
        fetchSubscriptions(token!);
        setForm({ name: "", price: "", currency: "", billingDate: "", cycle: "", note: "" });
      }
    } finally {
      setLoading(false);
    }
  }

  // 刪除訂閱
  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await fetch("/api/subscription", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      fetchSubscriptions(token!);
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return <div />;
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl mb-4">訂閱管理登入</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-2 w-64">
          <input
            className="border p-2 rounded"
            placeholder="帳號"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="border p-2 rounded"
            placeholder="密碼"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="bg-blue-600 text-white p-2 rounded mt-2" disabled={loading}>
            {loading ? "登入中..." : "登入"}
          </button>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl mb-4">訂閱管理</h1>
      <button onClick={handleLogout} className="text-blue-500 mb-4">登出</button>
      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-6">
        <input className="border p-2 rounded" placeholder="名稱" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        <input className="border p-2 rounded" placeholder="金額" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
        <input className="border p-2 rounded" placeholder="幣別 (如 TWD, USD)" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} required />
        <input className="border p-2 rounded" placeholder="帳單日" type="date" value={form.billingDate} onChange={e => setForm(f => ({ ...f, billingDate: e.target.value }))} required />
        <input className="border p-2 rounded" placeholder="週期 (如 monthly, yearly)" value={form.cycle} onChange={e => setForm(f => ({ ...f, cycle: e.target.value }))} required />
        <input className="border p-2 rounded" placeholder="備註 (可選)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        <button className="bg-green-600 text-white p-2 rounded mt-2" disabled={loading}>
          {loading ? "新增中..." : "新增訂閱"}
        </button>
      </form>
      <h2 className="text-xl mb-2">訂閱列表</h2>
      <ul className="space-y-2">
        {subscriptions.map(sub => (
          <li key={sub._id} className="border p-2 rounded flex justify-between items-center">
            <div>
              <div className="font-bold">{sub.name}</div>
              <div>{sub.price} {sub.currency} / {sub.cycle}</div>
              <div>帳單日: {new Date(sub.billingDate).toLocaleDateString()}</div>
              {sub.note && <div className="text-sm text-gray-500">{sub.note}</div>}
            </div>
            <button className="text-red-500" onClick={() => handleDelete(sub._id)} disabled={loading}>刪除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
