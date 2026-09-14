import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Copy, Check, Terminal, ShieldAlert, Bot, User, RefreshCw } from 'lucide-react';
import { UnifiedIncident } from '../../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  content: string;
  timestamp: string;
  source?: string;
}

interface SecOpsCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incident?: UnifiedIncident | null;
}

export const SecOpsCopilotDrawer: React.FC<SecOpsCopilotDrawerProps> = ({
  isOpen,
  onClose,
  incident
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or greet when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);

      if (messages.length === 0) {
        setMessages([
          {
            id: 'init-1',
            sender: 'copilot',
            content: `Hello! I'm **mSec Copilot**, your AI SecOps Assistant.\n\n${
              incident
                ? `I see you are inspecting **${incident.id}: ${incident.title}** (${incident.severity} severity). How can I assist your investigation?`
                : 'I can generate **KQL hunting queries**, analyze **incident blast radius**, draft **containment playbooks**, or explain attack techniques.'
            }`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
      }
    }
  }, [isOpen, incident]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          incident: incident || undefined
        })
      });

      if (!res.ok) throw new Error('Copilot response error');
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          id: `copilot-${Date.now()}`,
          sender: 'copilot',
          content: data.reply || 'No response generated.',
          timestamp: new Date().toLocaleTimeString(),
          source: data.source
        }
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `copilot-err-${Date.now()}`,
          sender: 'copilot',
          content: '⚠️ Unable to connect to the SecOps Copilot API. Ensure the backend server is running.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg bg-slate-900/98 border-l border-cyan-500/30 shadow-2xl flex flex-col h-full text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide text-white">mSec Copilot</h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  AI ASSISTANT
                </span>
              </div>
              <p className="text-xs text-slate-400">Context-aware SecOps investigation & KQL hunting assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Incident Context Banner */}
        {incident && (
          <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-cyan-400 font-bold">{incident.id}</span>
              <span className="truncate text-slate-300">{incident.title}</span>
            </div>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {incident.severity}
            </span>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isUser ? 'bg-indigo-600/80 text-white' : 'bg-cyan-950/80 border border-cyan-500/30 text-cyan-400'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`relative group max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600/30 border border-indigo-500/30 text-white'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200'
                  }`}
                >
                  {/* Markdown-style Content Formatting */}
                  <div className="space-y-2 whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>

                  {/* Message Meta & Copy Button */}
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-slate-400 hover:text-cyan-400"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="p-2 rounded-xl shrink-0 bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-xs text-cyan-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing telemetry & generating SecOps guidance...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-950/50 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handleSend('Generate Microsoft Sentinel & Defender KQL hunting query for this incident')}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1"
          >
            <Terminal className="w-3 h-3 text-cyan-400" /> KQL Query
          </button>
          <button
            onClick={() => handleSend('Summarize incident scope, affected identities, and blast radius')}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1"
          >
            <ShieldAlert className="w-3 h-3 text-amber-400" /> Blast Radius
          </button>
          <button
            onClick={() => handleSend('Recommend containment steps and mitigation commands for this alert')}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Containment Plan
          </button>
          <button
            onClick={() => handleSend('Draft an email notice to the affected user informing them of the security event')}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Draft User Email
          </button>
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Copilot a question, query, or command..."
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                isLoading || !input.trim()
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

