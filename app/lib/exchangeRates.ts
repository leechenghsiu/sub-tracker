import fs from 'fs';
import path from 'path';
import https from 'https';

const symbols = ['TWD', 'USD', 'JPY', 'HKD', 'EUR', 'CNY'];
const cachePath = path.join(process.cwd(), 'app', 'lib', 'exchangeRates.cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 1 天

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    // 先讀取快取
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      if (Date.now() - stat.mtimeMs < CACHE_TTL) {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        return JSON.parse(raw);
      }
    }
    // 若快取過期則自動更新
    return await updateExchangeRates();
  } catch {
    // 若有任何錯誤，回傳預設匯率
    return { TWD: 1, USD: 0, JPY: 0, HKD: 0, EUR: 0, CNY: 0 };
  }
}

export async function updateExchangeRates(): Promise<Record<string, number>> {
  const url = `https://api.exchangerate.host/latest?base=TWD&symbols=${symbols.join(',')}`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.rates) throw new Error('No rates');
          const rates: Record<string, number> = { TWD: 1 };
          for (const k of symbols) {
            if (k === 'TWD') continue;
            rates[k] = 1 / json.rates[k];
          }
          fs.writeFileSync(cachePath, JSON.stringify(rates, null, 2));
          resolve(rates);
        } catch {
          // 若 API 回傳錯誤，回傳預設匯率
          resolve({ TWD: 1, USD: 0, JPY: 0, HKD: 0, EUR: 0, CNY: 0 });
        }
      });
    }).on('error', () => {
      // 若 API 請求錯誤，回傳預設匯率
      resolve({ TWD: 1, USD: 0, JPY: 0, HKD: 0, EUR: 0, CNY: 0 });
    });
  });
} 