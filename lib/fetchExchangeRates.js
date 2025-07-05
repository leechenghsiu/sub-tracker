// 若要用 import，需在 package.json 加上 "type": "module"
import fs from 'fs';
import path from 'path';
import https from 'https';

const symbols = ['TWD', 'USD', 'JPY', 'HKD', 'EUR', 'CNY'];
const url = `https://api.exchangerate.host/latest?base=TWD&symbols=${symbols.join(',')}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.rates) throw new Error('No rates');
      // 以 TWD 為 1，其他貨幣以 TWD 為基準
      const rates = { TWD: 1 };
      for (const k of symbols) {
        if (k === 'TWD') continue;
        // TWD 對其他貨幣的匯率，需轉為 1 單位外幣等於多少台幣
        rates[k] = 1 / json.rates[k];
      }
      const filePath = path.join(path.dirname(new URL(import.meta.url).pathname), 'exchangeRates.json');
      fs.writeFileSync(filePath, JSON.stringify(rates, null, 2));
      console.log('Exchange rates updated:', rates);
    } catch (e) {
      console.error('Failed to update exchange rates:', e);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e);
}); 