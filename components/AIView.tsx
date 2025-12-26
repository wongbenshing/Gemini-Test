
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LottoDraw, AnalysisSummary, PrizeResult } from '../types';
import { getSmartAnalysis } from '../services/deepseekService';
import { calculateHistoricalPrizes, predictNextSum } from '../utils';
import * as htmlToImage from 'html-to-image';

interface Props {
  history: LottoDraw[];
}

const AIView: React.FC<Props> = ({ history }) => {
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const predictedSum = useMemo(() => predictNextSum(history), [history]);

  const performAnalysis = async () => {
    if (history.length === 0) return;
    setLoading(true);
    try {
      const res = await getSmartAnalysis(history, predictedSum);
      setAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImage = async () => {
    if (!captureRef.current) return;
    setIsSaving(true);
    try {
      const dataUrl = await htmlToImage.toPng(captureRef.current, {
        backgroundColor: '#f8fafc',
        cacheBust: true,
        style: {
          borderRadius: '0',
          padding: '20px'
        }
      });
      const link = document.createElement('a');
      link.download = `DLT_DeepSeek_Analysis_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save image', err);
      alert('保存图片失败，请尝试截图保存。');
    } finally {
      setIsSaving(false);
    }
  };

  const recommendationBacktest = useMemo(() => {
    if (!analysis || history.length === 0) return null;
    const fNums = analysis.recommendation.slice(0, 5).sort((a, b) => a - b);
    const bNums = analysis.recommendation.slice(5, 7).sort((a, b) => a - b);
    const results = calculateHistoricalPrizes(fNums, bNums, history);
    return results.filter(r => r.count > 0);
  }, [analysis, history]);

  const recommendedSum = useMemo(() => {
    if (!analysis) return 0;
    return analysis.recommendation.slice(0, 5).reduce((a, b) => a + b, 0);
  }, [analysis]);

  useEffect(() => {
    if (!analysis && history.length > 0) {
      performAnalysis();
    }
  }, [history]);

  return (
    <div className="space-y-6">
      <div ref={captureRef} className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h2 className="text-xl font-bold">DeepSeek 深度分析建议</h2>
          </div>

          <div className="mb-4 bg-white/5 px-4 py-2 rounded-2xl flex justify-between items-center text-xs">
            <span className="text-slate-400">和值趋势预测范围:</span>
            <span className="font-black text-blue-400 text-sm">
              {predictedSum - 5} ~ {predictedSum + 5}
            </span>
          </div>
          
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-4">
               <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
               <p className="text-slate-400 animate-pulse">DeepSeek 正在进行深度概率建模...</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider text-center">AI 推荐组合 (5+2)</p>
                <div className="flex gap-2 justify-center">
                  {analysis.recommendation.slice(0, 5).map((n, i) => (
                    <div key={i} className="w-10 h-10 bg-white text-slate-900 font-black rounded-full flex items-center justify-center shadow-lg text-sm">
                      {n.toString().padStart(2, '0')}
                    </div>
                  ))}
                  <div className="w-px h-8 bg-white/20 self-center"></div>
                  {analysis.recommendation.slice(5).map((n, i) => (
                    <div key={i} className="w-10 h-10 bg-blue-500 text-white font-black rounded-full flex items-center justify-center shadow-lg text-sm">
                      {n.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-center mt-3 text-slate-400 font-bold">
                  组合预计和值: <span className="text-blue-400">{recommendedSum}</span>
                </p>

                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">该组合历史中奖频次</p>
                  {recommendationBacktest && recommendationBacktest.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {recommendationBacktest.map(res => (
                        <div key={res.tier} className="bg-white/5 px-3 py-2 rounded-xl flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-300">{res.name}</span>
                          <span className="text-xs font-black text-blue-400">{res.count}次</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic text-center">此组合在历史库中暂无中奖记录</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  DeepSeek 分析逻辑
                </h4>
                <p className="text-sm leading-relaxed text-slate-400">
                  {analysis.explanation}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <button onClick={performAnalysis} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg">启动智能分析</button>
            </div>
          )}
        </div>

        {analysis && !loading && (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
            <div className="flex gap-3">
              <span className="text-blue-500 text-lg">💡</span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">理性购彩提醒</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  本结果由 DeepSeek 模型基于历史开奖趋势生成。彩票是纯概率游戏，AI 分析无法改变随机性，请在娱乐范围内理性参与。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {analysis && !loading && (
        <div className="flex flex-col gap-3 pb-4">
          <button 
            onClick={performAnalysis}
            className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-900 active:scale-95 transition-all"
          >
            换一组 DeepSeek 建议
          </button>
          <button 
            onClick={handleSaveImage}
            disabled={isSaving}
            className={`w-full py-3 flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold shadow-sm active:scale-95 transition-all ${isSaving ? 'opacity-50' : ''}`}
          >
            <svg className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            {isSaving ? '导出中...' : '保存为分享图'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIView;
