"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Moon, Laptop, LogIn, LogOut, ListChecks, Menu, X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Subscription } from "../components/types";
import EmptyState from "../components/EmptyState";
import OverviewTabs from "../components/OverviewTabs";

// 移除 Subscription type，改由 components/types 匯入
function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      setTheme('system');
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mq.matches);
    }
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  function setAndApplyTheme(next: 'light' | 'dark' | 'system') {
    setTheme(next);
    if (next === 'light') {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
    } else if (next === 'dark') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.removeItem('theme');
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mq.matches);
    }
  }

  if (!mounted) return null;

  const icon = theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'light' ? <Sun className="w-5 h-5" /> : <Laptop className="w-5 h-5" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="ml-2" aria-label="切換主題">
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setAndApplyTheme('light')}>
          <Sun className="mr-2 w-4 h-4" /> 亮色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAndApplyTheme('dark')}>
          <Moon className="mr-2 w-4 h-4" /> 暗色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAndApplyTheme('system')}>
          <Laptop className="mr-2 w-4 h-4" /> 跟隨系統
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navbar({ onLogout, token }: { onLogout: () => void; token: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav className="w-full border-b bg-white dark:bg-black" style={{height: 68}}>
      <div className="max-w-xl mx-auto flex items-center justify-between p-4">
        <span className="font-bold text-lg tracking-wide">SubTracker</span>
        {/* 桌面版 */}
        <div className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          {token && <Button variant="outline" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />登出</Button>}
        </div>
        {/* 手機版漢堡選單+主題 */}
        <div className="sm:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="flex items-center justify-center w-8 h-8 relative"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="menu"
          >
            <span
              className={`absolute transition-all duration-300 ${
                menuOpen
                  ? 'opacity-0 scale-75 rotate-45'
                  : 'opacity-100 scale-100 rotate-0'
              }`}
            >
              <Menu className="w-6 h-6" />
            </span>
            <span
              className={`absolute transition-all duration-300 ${
                menuOpen
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-75 -rotate-45'
              }`}
            >
              <X className="w-6 h-6" />
            </span>
          </button>
          {token && (
            <>
              <div
                className={`fixed left-0 right-0 top-[68px] z-50 bg-white dark:bg-black flex flex-col items-center shadow-lg overflow-hidden transition-all duration-500 h-full
                  ${menuOpen ? 'max-h-[calc(100vh-68px)] opacity-100 py-12' : 'max-h-0 opacity-0 py-0'}`}
              >
                <Button
                  variant="ghost"
                  className="w-40 mb-4 text-lg"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut className="w-5 h-5 mr-2" />登出
                </Button>
                {/* 之後可在這裡加更多選單項目 */}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  // form 狀態加 selfRatio, advanceRatio
  const [form, setForm] = useState({
    name: "",
    price: "",
    currency: "TWD",
    billingDate: "",
    cycle: "monthly",
    note: "",
    isAdvance: false,
    selfRatio: 1,
    advanceRatio: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(form.billingDate ? new Date(form.billingDate) : undefined);
  // 新增: Dialog 開關 state
  const [open, setOpen] = useState(false);
  // 在 Home 組件內部 state 區域加：
  const [tabMode, setTabMode] = useState<'monthly' | 'halfyear' | 'yearly'>('monthly');

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
        setForm({ name: "", price: "", currency: "TWD", billingDate: "", cycle: "monthly", note: "", isAdvance: false, selfRatio: 1, advanceRatio: 1 });
        setOpen(false); // 新增成功後關閉 Dialog
      }
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
        <Card className="w-80">
          <CardHeader>
            <CardTitle>訂閱管理登入</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input
                placeholder="帳號"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="密碼"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <Button type="submit" disabled={loading} className="mt-2 w-full">
                <LogIn className="w-4 h-4 mr-2" />{loading ? "登入中..." : "登入"}
              </Button>
              {error && <Alert variant="destructive" className="mt-2">{error}</Alert>}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Navbar onLogout={handleLogout} token={token} />
      {/* 置頂區塊 */}
      <div className="flex justify-between items-center max-w-xl mx-auto p-4">
          <h2 className="text-xl flex items-center"><ListChecks className="w-5 h-5 mr-2" />訂閱列表</h2>
          <Button variant="default" className="flex items-center gap-2" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />新增訂閱</Button>
        </div>
      {/* Dialog 不包在主內容區 */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增訂閱</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-4 mt-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">訂閱名稱</label>
                  <Input placeholder="Cursor Pro" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">金額</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                    <Input placeholder="20" type="number" inputMode="decimal" pattern="[0-9]*" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required className="pl-6" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox id="advance" checked={form.isAdvance} onCheckedChange={v => setForm(f => ({ ...f, isAdvance: !!v }))} />
                    <label htmlFor="advance" className="text-sm select-none cursor-pointer">此訂閱包含代墊</label>
                  </div>
                  {form.isAdvance && (
                    <div className="flex gap-4 mt-2">
                      <div>
                        <label className="block mb-1 text-xs font-medium">自己出的比例</label>
                        <Input
                          type="number"
                          min={1}
                          value={form.selfRatio}
                          onChange={e => setForm(f => ({ ...f, selfRatio: Math.max(1, Number(e.target.value) || 1) }))}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium">代墊的比例</label>
                        <Input
                          type="number"
                          min={1}
                          value={form.advanceRatio}
                          onChange={e => setForm(f => ({ ...f, advanceRatio: Math.max(1, Number(e.target.value) || 1) }))}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium">每一份比例金額</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                          <Input
                            type="number"
                            value={(() => {
                              const total = Number(form.price) || 0;
                              const ratio = Number(form.selfRatio) + Number(form.advanceRatio);
                              return ratio > 0 ? Math.floor(total / ratio) : "";
                            })()}
                            disabled
                            className="w-28 bg-muted pl-6"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-full">
                  <label className="block mb-1 text-sm font-medium">幣別</label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇幣別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TWD">TWD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <label className="block mb-1 text-sm font-medium">帳單起始日</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "yyyy-MM-dd") : "選擇日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={d => {
                          setDate(d!);
                          setForm(f => ({ ...f, billingDate: d ? d.toISOString().slice(0, 10) : "" }));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">週期</label>
                  <Tabs value={form.cycle} onValueChange={v => setForm(f => ({ ...f, cycle: v }))} className="w-full">
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="monthly">每月</TabsTrigger>
                      <TabsTrigger value="halfyear">每半年</TabsTrigger>
                      <TabsTrigger value="yearly">每年</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">備註</label>
                  <Input placeholder="備註 (可選)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <Button type="submit" className="mt-2" disabled={loading}>
                  {loading ? "新增中..." : "新增訂閱"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
      {/* 主內容區 */}
      <div className="max-w-xl mx-auto p-4 flex-1 flex flex-col">
          {subscriptions.length === 0 ? (
          <EmptyState onAdd={() => setOpen(true)} />
        ) : (
          <OverviewTabs subscriptions={subscriptions} tabMode={tabMode} setTabMode={setTabMode} />
        )}
      </div>
    </>
  );
}
