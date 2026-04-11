import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: { role: string; content: string }[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AiChatModal({
  isOpen,
  onClose,
  messages,
  isLoading,
  input,
  onInputChange,
  onSubmit,
}: AiChatModalProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-5 pt-8 pb-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-inner">
            <Bot size={20} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">DigiWell AI</h3>
            <p className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
              <Sparkles size={10} /> Trợ lý Premium
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
            <Bot size={48} className="text-indigo-400" />
            <p className="text-slate-400 text-sm text-center">
              Hãy thử: "Ghi nhận giúp tôi 1 ly trà đào 300ml"<br/>hoặc hỏi về chế độ dinh dưỡng.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-2 flex-shrink-0 self-end mb-1"><Bot size={14} className="text-indigo-400" /></div>}
            <div className={`max-w-[75%] p-3.5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-cyan-500 text-slate-900 rounded-br-sm font-medium' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}><p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p></div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start items-end"><div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-2 flex-shrink-0 mb-1"><Bot size={14} className="text-indigo-400" /></div><div className="max-w-[75%] p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 rounded-bl-sm flex gap-1.5 items-center h-[46px]"><div className="w-2 h-2 rounded-full bg-indigo-400/70 animate-bounce" /><div className="w-2 h-2 rounded-full bg-indigo-400/70 animate-bounce" style={{ animationDelay: '0.15s' }} /><div className="w-2 h-2 rounded-full bg-indigo-400/70 animate-bounce" style={{ animationDelay: '0.3s' }} /></div></div>}
        <div ref={chatEndRef} className="h-2" />
      </div>

      <div className="p-4 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl pb-8">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input type="text" value={input} onChange={(e) => onInputChange(e.target.value)} placeholder="Hỏi AI hoặc nhờ thêm nước..." className="flex-1 bg-slate-800/80 border border-slate-700 rounded-full px-5 py-3.5 text-sm text-white outline-none focus:border-cyan-500 shadow-inner" />
          <button type="submit" disabled={isLoading || !input.trim()} className="w-[50px] h-[50px] rounded-full bg-cyan-500 flex items-center justify-center text-slate-900 disabled:opacity-50 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex-shrink-0"><Send size={20} className="ml-1" /></button>
        </form>
      </div>
    </div>
  );
}