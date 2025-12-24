
import { LottoDraw } from "../types";

const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/"
];

const LOCAL_CSV_PATH = "./history.csv"; 
const TRIAL_LIMITS = [2000, 1000, 500, 100];

/**
 * 将数据转换为 CSV 字符串 (DataFrame 格式)
 */
export const convertToCSV = (data: LottoDraw[]): string => {
  const header = "id,date,f1,f2,f3,f4,f5,b1,b2\n";
  const rows = data.map(d => 
    `${d.id},${d.date},${d.front.join(',')},${d.back.join(',')}`
  ).join('\n');
  return header + rows;
};

/**
 * 解析 CSV 字符串为 LottoDraw 数组
 */
export const parseCSV = (csvText: string): LottoDraw[] => {
  const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('id'));
  return lines.map(line => {
    const parts = line.split(',');
    if (parts.length < 9) return null;
    return {
      id: parts[0],
      date: parts[1],
      front: parts.slice(2, 7).map(n => parseInt(n)),
      back: parts.slice(7, 9).map(n => parseInt(n))
    };
  }).filter((d): d is LottoDraw => d !== null);
};

/**
 * 读取项目目录下的 history.csv
 */
export const fetchLocalCSV = async (): Promise<LottoDraw[]> => {
  try {
    const response = await fetch(LOCAL_CSV_PATH);
    if (!response.ok) throw new Error("Local CSV not found");
    const text = await response.text();
    return parseCSV(text);
  } catch (e) {
    console.warn("读取本地 history.csv 失败，将使用初始常量数据", e);
    return [];
  }
};

/**
 * 从 500.com 抓取数据
 */
async function fetchWithLimit(limit: number, proxyBase: string): Promise<LottoDraw[]> {
  const url = `https://datachart.500.com/dlt/history/newinc/history.php?limit=${limit}&sort=0`;
  const targetUrl = `${proxyBase}${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); 

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Status ${response.status}`);
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const trElements = Array.from(doc.querySelectorAll('tr.t_tr1'));
    const results: LottoDraw[] = [];

    trElements.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 9) return;
      const drawId = tds[0].textContent?.trim() || "";
      const front = [1,2,3,4,5].map(i => parseInt(tds[i].textContent || "0"));
      const back = [6,7].map(i => parseInt(tds[i].textContent || "0"));
      let drawDate = "";
      for (let i = tds.length - 1; i >= 0; i--) {
        const val = tds[i].textContent?.trim() || "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) { drawDate = val; break; }
      }
      if (drawId && drawDate) results.push({ id: drawId, date: drawDate, front, back });
    });
    return results;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

export const crawlLottoHistory = async (): Promise<LottoDraw[]> => {
  let lastError: Error | null = null;
  for (const proxy of PROXIES) {
    for (const limit of TRIAL_LIMITS) {
      try {
        const data = await fetchWithLimit(limit, proxy);
        if (data.length > 5) return data;
      } catch (err) { lastError = err as Error; }
    }
  }
  throw lastError || new Error("All sync attempts failed");
};
