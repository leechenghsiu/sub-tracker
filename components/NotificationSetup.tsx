import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Bell, BellOff, BellRing, Loader2, Send, FlaskConical, RefreshCw } from "lucide-react";

interface Props {
  token: string;
  onUnauthorized: () => void;
}

type Status =
  | "loading"
  | "unsupported"
  | "ios-needs-install"
  | "subscribable"
  | "subscribed"
  | "denied";

// 將 base64url 的 VAPID public key 轉為 Uint8Array（pushManager.subscribe 需要）。
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 為可能永遠 pending 的 Promise 加逾時保護，避免 UI 無限轉圈。
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// 取得一個「已 active」的 service worker registration。
// 不依賴會在 SW 未 active 時永遠 pending 的 navigator.serviceWorker.ready，
// 改為主動取得 / 註冊，並監聽狀態變化等它 active。
async function ensureReady(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  const r = reg;
  if (r.active) return r;
  return withTimeout(
    new Promise<ServiceWorkerRegistration>(resolve => {
      const done = () => {
        if (r.active) resolve(r);
      };
      done();
      const w = r.installing || r.waiting;
      w?.addEventListener("statechange", done);
      navigator.serviceWorker.addEventListener("controllerchange", done);
    }),
    timeoutMs,
  );
}

// 產生一行人類可讀的 SW 診斷字串，方便回報問題。
async function swDiag(): Promise<string> {
  try {
    const ctrl = navigator.serviceWorker.controller ? "有" : "無";
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return `SW 未註冊 · controller:${ctrl}`;
    const state = reg.active
      ? "active"
      : reg.waiting
        ? "waiting"
        : reg.installing
          ? "installing"
          : "無 worker";
    return `SW:${state} · controller:${ctrl}`;
  } catch {
    return "SW 診斷失敗";
  }
}

async function fetchStatus(url: string): Promise<string> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return String(res.status);
  } catch {
    return "err";
  }
}

// 深度診斷：抓 /sw.js（含 Content-Type）與其 import 的檔案狀態，
// 並實際跑一次 register() 把確切錯誤印出來——這是判斷「為何 SW 註冊不起來」的關鍵。
async function deepDiag(): Promise<string> {
  const lines: string[] = [await swDiag()];
  try {
    const res = await fetch("/sw.js", { cache: "no-store" });
    lines.push(`/sw.js → ${res.status} (${res.headers.get("content-type") || "無 CT"})`);
    if (res.ok) {
      const text = await res.text();
      const worker = text.match(/importScripts\("([^"]+)"\)/);
      const workbox = text.match(/define\(\["\.\/([^"]+)"/);
      if (worker) lines.push(`/${worker[1]} → ${await fetchStatus("/" + worker[1])}`);
      if (workbox) lines.push(`/${workbox[1]}.js → ${await fetchStatus("/" + workbox[1] + ".js")}`);
    }
  } catch {
    lines.push("/sw.js → fetch 失敗");
  }
  // 實際嘗試註冊，回報成功 scope 或確切錯誤（name: message）。
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    lines.push(`register OK · scope:${reg.scope.replace(location.origin, "")}`);
  } catch (e) {
    lines.push(`register 失敗 · ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
  }
  return lines.join("\n");
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari 專屬旗標
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function NotificationSetup({ token, onUnauthorized }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);

  async function refreshDiag() {
    if ("serviceWorker" in navigator) setDiag(await swDiag());
  }

  async function checkFiles() {
    setBusy(true);
    setMsg(null);
    try {
      setDiag(await deepDiag());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // iOS 只在「主畫面 PWA」才開放 Push API，一般 Safari 沒有 PushManager。
      // 必須先判斷 iOS 未安裝，否則會誤落到「不支援」而非「請先加入主畫面」。
      if (isIOS() && !isStandalone()) {
        if (!cancelled) setStatus("ios-needs-install");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (!cancelled) setDiag(await swDiag());
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      // 用 ensureReady 主動確保 SW 就緒；逾時就先讓卡片顯示為 subscribable。
      try {
        const reg = await ensureReady(4000);
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "subscribed" : "subscribable");
      } catch {
        if (!cancelled) setStatus("subscribable");
      }
      if (!cancelled) setDiag(await swDiag());
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "subscribable");
        setMsg(perm === "denied" ? "已封鎖通知權限" : "尚未允許通知權限");
        return;
      }
      const keyRes = await fetch("/api/push/vapid", { headers: { Authorization: `Bearer ${token}` } });
      if (keyRes.status === 401) return onUnauthorized();
      if (!keyRes.ok) throw new Error("VAPID");
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("VAPID");

      const reg = await ensureReady(10000);
      const sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }),
        15000,
      );

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error("subscribe");
      setStatus("subscribed");
      setMsg("已開啟通知");
    } catch (err) {
      const detail = err instanceof Error && err.message === "timeout"
        ? "Service Worker 未就緒（逾時），請按下方「重新註冊 SW」再試"
        : err instanceof Error && err.message === "VAPID"
          ? "伺服器尚未設定 VAPID 金鑰（環境變數）"
          : "開啟通知失敗，請稍後再試";
      setMsg(detail);
    } finally {
      setBusy(false);
      refreshDiag();
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await ensureReady(8000);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("subscribable");
      setMsg("已關閉通知");
    } catch {
      setMsg("關閉通知失敗");
    } finally {
      setBusy(false);
      refreshDiag();
    }
  }

  // 伺服器端測試：走完整推播管線（web-push → APNs → 裝置），需伺服器已設定 VAPID。
  async function sendTest() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error("test");
      const data = await res.json();
      setMsg(data.devices > 0 ? "測試通知已送出" : "沒有已訂閱的裝置");
    } catch {
      setMsg("測試通知發送失敗（請確認伺服器已設定 VAPID 金鑰）");
    } finally {
      setBusy(false);
    }
  }

  // 本機測試：直接用 registration.showNotification 在本機顯示，不經伺服器、
  // 不需 VAPID。用來驗證「這台裝置能否顯示通知」，與推播管線問題隔離。
  async function sendLocalTest() {
    setBusy(true);
    setMsg(null);
    try {
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setMsg(perm === "denied" ? "已封鎖通知權限" : "尚未允許通知權限");
          return;
        }
      }
      const reg = await ensureReady(8000);
      await reg.showNotification("SubTracker 測試通知", {
        body: "這是一則本機測試通知 🎉",
        icon: "/web-app-manifest-192x192.png",
        badge: "/favicon-96x96.png",
        tag: "local-test",
      });
      setMsg("已顯示本機測試通知（若沒看到，請檢查系統通知設定）");
    } catch (err) {
      const detail = err instanceof Error && err.message === "timeout"
        ? "Service Worker 未就緒，請按下方「重新註冊 SW」再試"
        : "本機測試失敗，請稍後再試";
      setMsg(detail);
    } finally {
      setBusy(false);
      refreshDiag();
    }
  }

  // 強制重新註冊 SW：先移除舊 registration 再重新註冊 /sw.js，
  // 解決 iOS PWA 舊 SW 卡住 / 未 active 的情況。
  async function reregister() {
    setBusy(true);
    setMsg(null);
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      await navigator.serviceWorker.register("/sw.js");
      await ensureReady(10000);
      setMsg("已重新註冊 Service Worker，請再試一次");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(sub ? "subscribed" : "subscribable");
    } catch (err) {
      const detail = err instanceof Error && err.message === "timeout"
        ? "重新註冊後仍未就緒，請將 App 從多工列滑掉重開"
        : "重新註冊失敗";
      setMsg(detail);
    } finally {
      setBusy(false);
      refreshDiag();
    }
  }

  if (status === "loading") return null;

  const showReregister =
    status === "subscribable" || status === "subscribed" || status === "unsupported";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Bell className="w-4 h-4" />
        推播通知
      </div>

      {status === "unsupported" && (
        <p className="text-sm text-muted-foreground">此裝置或瀏覽器不支援推播通知。</p>
      )}

      {status === "ios-needs-install" && (
        <p className="text-sm text-muted-foreground">
          iPhone / iPad 需先將此 App 加入主畫面才能開啟通知：點下方分享按鈕 → 「加入主畫面」，再從主畫面開啟。
        </p>
      )}

      {status === "denied" && (
        <p className="text-sm text-muted-foreground">
          通知權限已被封鎖，請到瀏覽器 / 系統設定中重新允許本站通知。
        </p>
      )}

      {status === "subscribable" && (
        <>
          <p className="text-sm text-muted-foreground">開啟後，提醒日當天早上會推播到此裝置。</p>
          <Button onClick={enable} disabled={busy} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BellRing className="w-4 h-4 mr-1.5" />}
            開啟通知
          </Button>
          <Button variant="outline" onClick={sendLocalTest} disabled={busy} className="w-full">
            <FlaskConical className="w-4 h-4 mr-1.5" />
            本機測試通知
          </Button>
        </>
      )}

      {status === "subscribed" && (
        <>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <BellRing className="w-4 h-4" /> 已開啟通知
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={sendTest} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              發送測試
            </Button>
            <Button variant="outline" onClick={sendLocalTest} disabled={busy}>
              <FlaskConical className="w-4 h-4 mr-1.5" />
              本機測試
            </Button>
          </div>
          <Button variant="ghost" onClick={disable} disabled={busy} className="w-full">
            <BellOff className="w-4 h-4 mr-1.5" />
            關閉通知
          </Button>
        </>
      )}

      {showReregister && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="sm" onClick={reregister} disabled={busy} className="text-muted-foreground">
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            重新註冊 SW
          </Button>
          <Button variant="ghost" size="sm" onClick={checkFiles} disabled={busy} className="text-muted-foreground">
            檢查 SW 檔案
          </Button>
        </div>
      )}

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      {diag && <p className="text-[11px] text-muted-foreground/70 font-mono whitespace-pre-line">{diag}</p>}
    </div>
  );
}
