
import { LottoDraw, AnalysisSummary } from "../types";

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.deepseek.com/chat/completions";

/**
 * 通用 DeepSeek 请求包装
 */
async function requestDeepSeek(messages: any[], isJson: boolean = true): Promise<any> {
  if (!API_KEY) {
    throw new Error("DeepSeek API Key is not configured.");
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: messages,
      response_format: isJson ? { type: "json_object" } : { type: "text" },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "DeepSeek API 调用失败");
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return isJson ? JSON.parse(content) : content;
}

/**
 * 解析历史文本数据
 */
export const parseHistoryData = async (rawText: string): Promise<LottoDraw[]> => {
  const messages = [
    { 
      role: "system", 
      content: "你是一个彩票数据处理助手。请将用户提供的文本解析为指定格式的 JSON。必须返回 JSON 数组。" 
    },
    { 
      role: "user", 
      content: `请将以下大乐透历史开奖数据解析为 JSON 数组。
      格式要求：
      [
        { "id": "期号", "date": "YYYY-MM-DD", "front": [5个数字], "back": [2个数字] }
      ]
      
      原始数据：
      ${rawText}` 
    }
  ];

  try {
    const result = await requestDeepSeek(messages);
    return Array.isArray(result) ? result : (result.data || []);
  } catch (e) {
    console.error("DeepSeek Parsing error", e);
    return [];
  }
};

/**
 * 智能选号分析
 */
export const getSmartAnalysis = async (history: LottoDraw[], predictedSum?: number): Promise<AnalysisSummary> => {
  const simplifiedHistory = history.slice(0, 50).map(h => `${h.id}: ${h.front.join(',')}+${h.back.join(',')}`).join('\n');
  const sumRef = predictedSum || 90;
  
  const messages = [
    { 
      role: "system", 
      content: "你是一个专业的彩票趋势分析专家。你需要基于历史数据提供理性的概率分析，并以 JSON 格式输出。输出必须包含 hotNumbers, coldNumbers, recommendation, explanation 字段。" 
    },
    { 
      role: "user", 
      content: `基于以下最近50期的大乐透数据进行深度智能分析。
    
      【预测参考值】：
      系统建议下一期的“前区和值”目标大约为：${sumRef}。
      在推荐号码时，前区5个数字之和请控制在 [${sumRef - 5}, ${sumRef + 5}] 范围内。

      【参考准则】：
      大乐透组合极其多样，历史大奖概率极低。请基于当前号码分布、奇偶比、连号走势提供一组理性的“平衡型”组合。
      
      请完成：
      1. 识别前区（1-35）和后区（1-12）的热码与冷码。
      2. 提供一组最符合当前趋势预测的推荐号码（5个前区，2个后区）。
      3. 给出简短的分析理由。
      
      历史数据摘要：
      ${simplifiedHistory}` 
    }
  ];

  try {
    return await requestDeepSeek(messages);
  } catch (e) {
    console.error("DeepSeek Analysis error", e);
    return {
      hotNumbers: [],
      coldNumbers: [],
      recommendation: [1, 8, 15, 22, 30, 5, 10],
      explanation: "分析服务暂时不可用，已提供默认组合。"
    };
  }
};
