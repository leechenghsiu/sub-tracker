import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Bell, BellOff, BellRing, Loader2, Send, FlaskConical } from "lucide-react";

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

// 為可能永遠 pending 的 Promise（iOS 的 serviceWorker.ready / pushManager.subscribe
// 有時不會 settle）加逾時保護，避免 UI 無限轉圈。
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
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
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      // serviceWorker.ready 在 SW 尚未 active 時會一直 pending，
      // 不能讓整張卡片卡在 loading 而隱形；用 timeout 保底成 subscribable。
      try {
        const readyOrTimeout = Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
        ]);
        const reg = await readyOrTimeout;
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setStatus(sub ? "subscribed" : "subscribable");
      } catch {
        if (!cancelled) setStatus("subscribable");
      }
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
      if (!keyRes.ok) throw new Error("伺服器缺少 VAPID 金鑰設定");
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("伺服器缺少 VAPID 金鑰設定");

      // 這兩步在 iOS 有機率永遠 pending，加逾時避免無限轉圈。
      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
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
        ? "開啟逾時，請將 App 從多工列滑掉重開後再試"
        : err instanceof Error && err.message.includes("VAPID")
          ? "伺服器尚未設定 VAPID 金鑰（環境變數）"
          : "開啟通知失敗，請稍後再試";
      setMsg(detail);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
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
      const reg = await withTimeout(navigator.serviceWorker.ready, 8000);
      await reg.showNotification("SubTracker 測試通知", {
        body: "這是一則本機測試通知 🎉",
        icon: "/web-app-manifest-192x192.png",
        badge: "/favicon-96x96.png",
        tag: "local-test",
      });
      setMsg("已顯示本機測試通知（若沒看到，請檢查系統通知設定）");
    } catch (err) {
      const detail = err instanceof Error && err.message === "timeout"
        ? "Service Worker 尚未就緒，請將 App 從多工列滑掉重開後再試"
        : "本機測試失敗，請稍後再試";
      setMsg(detail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;

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

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
