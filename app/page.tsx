"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sun, Moon, Laptop, LogIn, LogOut, ListChecks, Menu, Plus, X, Users } from "lucide-react";
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
import SplitBillList from "../components/SplitBillList";
import SubscriptionSkeleton from "../components/SubscriptionSkeleton";
import Image from "next/image";
import { Montserrat } from "next/font/google";
const montserrat = Montserrat({ subsets: ["latin"], weight: "700" });

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
          <Laptop className="mr-2 w-4 h-4" /> 跟隨裝置
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navbar({ onLogout, token }: { onLogout: () => void; token: string | null }) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    // 僅在 client 端執行
    const isDark = document.documentElement.classList.contains('dark');
    setLogoSrc(isDark ? '/subtracker-dark.png' : '/subtracker-light.png');
  }, []);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-white dark:bg-black" style={{height: 68}}>
      <div className="max-w-xl mx-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt="SubTracker"
              className={
                `h-8 w-auto rounded-md ` +
                (logoSrc.includes('dark')
                  ? 'border border-gray-700'
                  : 'border border-gray-300')
              }
              width={32}
              height={32}
              priority
            />
          ) : (
            <div style={{ width: 32, height: 32 }} />
          )}
          <span
            className={
              `${montserrat.className} font-bold select-none`
            }
            style={{ fontSize: 20, lineHeight: '32px', height: 32, display: 'flex', alignItems: 'center' }}
          >
            SubTracker
          </span>
        </div>
        {/* 桌面版 */}
        <div className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          {token && <Button variant="outline" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />登出</Button>}
        </div>
        {/* 手機版主題選擇+登出 DropdownMenu */}
        <div className="sm:hidden flex items-center gap-2">
          <ThemeToggle />
          {token && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="更多選單">
                  <Menu className="w-6 h-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="w-5 h-5 mr-2" />登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
  const [dataLoading, setDataLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    price: "",
    currency: "TWD",
    billingDate: "",
    cycle: "monthly",
    note: "",
    isAdvance: false,
    selfRatio: "1",
    advanceRatio: "1",
    category: "subscription",
    reminderEnabled: false,
    reminderDaysBefore: "1"
  });
  const [memberTags, setMemberTags] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [perPersonAmount, setPerPersonAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(form.billingDate ? new Date(form.billingDate) : undefined);
  const [open, setOpen] = useState(false);
  const [tabMode, setTabMode] = useState<'monthly' | 'halfyear' | 'yearly'>('monthly');
  const [mainTab, setMainTab] = useState<'subscriptions' | 'splitbills'>('subscriptions');

  // 頁面載入時自動讀取 localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      fetchSubscriptions(savedToken);
    }
    setIsLoading(false);
    
    // iOS Safari viewport fix
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
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
  async function fetchSubscriptions(token: string, showLoading = true) {
    if (showLoading) setDataLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setToken(null);
          localStorage.removeItem("token");
          return;
        }
        setSubscriptions([]);
        return;
      }
      const data = await res.json();
      setSubscriptions(data);
    } finally {
      if (showLoading) setDataLoading(false);
    }
  }

  // 新增訂閱
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const now = format(new Date(), "yyyy-MM");
    try {
      const body: Record<string, unknown> = {
        ...form,
        price: form.price === "" ? 0 : parseFloat(form.price),
        selfRatio: form.selfRatio === "" ? 1 : Number(form.selfRatio),
        advanceRatio: form.advanceRatio === "" ? 1 : Number(form.advanceRatio),
        billingDate: new Date(form.billingDate),
        category: form.category,
        reminder: {
          enabled: form.reminderEnabled,
          daysBefore: Number(form.reminderDaysBefore) || 1,
        },
      };
      if (form.isAdvance && memberTags.length > 0) {
        body.perPersonAmount = parseFloat(perPersonAmount) || 0;
        body.knownMembers = memberTags;
        body.records = [{ month: now, participants: memberTags }];
        body.settlements = [];
      }
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        fetchSubscriptions(token!);
        setForm({ name: "", price: "", currency: "TWD", billingDate: "", cycle: "monthly", note: "", isAdvance: false, selfRatio: "1", advanceRatio: "1", category: "subscription", reminderEnabled: false, reminderDaysBefore: "1" });
        setMemberTags([]);
        setMemberInput("");
        setPerPersonAmount("");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[100dvh] text-muted-foreground">載入中...</div>;
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background ios-full-height">
        <Card className="w-full max-w-xs sm:w-80 shadow-md max-h-[90vh] overflow-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Image
                src="/subtracker-light.png"
                alt="SubTracker"
                className="h-8 w-auto rounded-md border border-gray-300"
                width={32}
                height={32}
                priority
              />
              <span className="font-bold select-none text-xl" style={{ lineHeight: '32px', height: 32, display: 'flex', alignItems: 'center' }}>
                SubTracker
              </span>
            </div>
          </CardHeader>
          <CardContent className="overflow-visible">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input
                name="username"
                autoComplete="username"
                placeholder="帳號"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
              <Input
                name="password"
                autoComplete="current-password"
                placeholder="密碼"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <Button type="submit" disabled={loading} className="mt-2 w-full">
                <LogIn className="w-4 h-4 mr-2" />{loading ? "登入中..." : "登入"}
              </Button>
              {error && (
                <Alert variant="destructive" className="mt-2 flex items-start gap-2">
                  <AlertCircle className="mt-0.5 w-4 h-4" />
                  <div>
                    <AlertTitle>登入失敗</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </div>
                </Alert>
              )}
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
      <div className="max-w-xl mx-auto px-4 mt-[68px] pt-4 space-y-3">
        <Tabs value={mainTab} onValueChange={v => setMainTab(v as 'subscriptions' | 'splitbills')} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="subscriptions"><ListChecks className="w-4 h-4 mr-1.5" />個人訂閱</TabsTrigger>
            <TabsTrigger value="splitbills"><Users className="w-4 h-4 mr-1.5" />代墊項目</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex justify-end">
          <Button variant="default" className="flex items-center gap-2" onClick={() => {
            if (mainTab === 'splitbills') {
              setForm(f => ({ ...f, isAdvance: true }));
            } else {
              setForm(f => ({ ...f, isAdvance: false }));
            }
            setOpen(true);
          }}><Plus className="w-4 h-4" />新增{mainTab === 'splitbills' ? '代墊' : '訂閱'}</Button>
        </div>
      </div>
      {/* Dialog 不包在主內容區 */}
        <Dialog open={open} onOpenChange={v => {
          setOpen(v);
          if (!v) {
            setForm({ name: "", price: "", currency: "TWD", billingDate: "", cycle: "monthly", note: "", isAdvance: false, selfRatio: "1", advanceRatio: "1", category: "subscription", reminderEnabled: false, reminderDaysBefore: "1" });
            setMemberTags([]);
            setMemberInput("");
            setPerPersonAmount("");
            setDate(undefined);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.isAdvance ? "新增代墊" : "新增訂閱"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-4 mt-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">訂閱名稱</label>
                  <Input placeholder="請輸入訂閱名稱" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">金額</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                    <Input placeholder="0" type="number" inputMode="decimal" pattern="[0-9]*" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/^0+(?!$)/, "") }))} required className="pl-6" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox id="advance" checked={form.isAdvance} onCheckedChange={v => {
                      setForm(f => ({ ...f, isAdvance: !!v }));
                    }} />
                    <label htmlFor="advance" className="text-sm select-none cursor-pointer">此訂閱包含代墊</label>
                  </div>
                  {form.isAdvance && (
                    <div className="mt-2 space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">每人每月金額</label>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            placeholder="0"
                            type="number"
                            inputMode="decimal"
                            value={perPersonAmount}
                            onChange={e => setPerPersonAmount(e.target.value)}
                            className="pl-5"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">分帳成員</label>
                        <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 min-h-[36px] items-center">
                          {memberTags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded">
                              {tag}
                              <button type="button" onClick={() => setMemberTags(memberTags.filter(t => t !== tag))} className="hover:text-destructive">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            placeholder={memberTags.length === 0 ? "輸入姓名後按 Enter..." : ""}
                            value={memberInput}
                            onChange={e => setMemberInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && memberInput.trim()) {
                                e.preventDefault();
                                if (!memberTags.includes(memberInput.trim())) {
                                  setMemberTags([...memberTags, memberInput.trim()]);
                                }
                                setMemberInput("");
                              }
                              if (e.key === "Backspace" && !memberInput && memberTags.length > 0) {
                                setMemberTags(memberTags.slice(0, -1));
                              }
                            }}
                            className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
                  <label className="block mb-1 text-sm font-medium">分類</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">訂閱</SelectItem>
                      <SelectItem value="investment">投資</SelectItem>
                      <SelectItem value="expense">固定支出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="reminder" checked={form.reminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, reminderEnabled: !!v }))} />
                    <label htmlFor="reminder" className="text-sm select-none cursor-pointer">到期前提醒</label>
                  </div>
                  {form.reminderEnabled && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">提前</span>
                      <Input type="number" inputMode="numeric" min={0} className="w-20"
                        value={form.reminderDaysBefore}
                        onChange={e => setForm(f => ({ ...f, reminderDaysBefore: e.target.value }))} />
                      <span className="text-sm text-muted-foreground">天</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">備註</label>
                  <Input placeholder="請輸入備註 (可選)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
                <Button type="submit" className="mt-2" disabled={loading}>
                  {loading ? "新增中..." : form.isAdvance ? "新增代墊" : "新增訂閱"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
      {/* 主內容區 */}
      <div className="max-w-xl mx-auto p-4 flex-1 flex flex-col">
        {dataLoading ? (
          <SubscriptionSkeleton />
        ) : mainTab === 'subscriptions' ? (
          subscriptions.length === 0 ? (
            <EmptyState onAdd={() => setOpen(true)} />
          ) : (
            <OverviewTabs subscriptions={subscriptions} tabMode={tabMode} setTabMode={setTabMode} token={token} onRefresh={() => fetchSubscriptions(token!)} onUnauthorized={handleLogout} />
          )
        ) : (
          <SplitBillList subscriptions={subscriptions.filter(s => s.isAdvance)} token={token!} onRefresh={() => fetchSubscriptions(token!, false)} onUnauthorized={handleLogout} />
        )}
      </div>
    </>
  );
}
