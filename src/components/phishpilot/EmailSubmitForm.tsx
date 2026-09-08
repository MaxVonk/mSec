import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, Send } from 'lucide-react';
import { PhishPilotReport } from '../../phishpilotTypes';

interface Props {
  onAnalysisComplete: (report: PhishPilotReport) => void;
}

export const EmailSubmitForm: React.FC<Props> = ({ onAnalysisComplete }) => {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawEmail, setRawEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/phishpilot/analyze/file', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const report = await res.json();
        onAnalysisComplete(report);
      } else {
        console.error('Analysis failed');
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSubmit = async () => {
    if (!rawEmail.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/phishpilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawEmail }),
      });
      if (res.ok) {
        const report = await res.json();
        onAnalysisComplete(report);
        setRawEmail('');
      } else {
        console.error('Analysis failed');
      }
    } catch (err) {
      console.error('Failed to submit raw email:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            mode === 'upload' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Upload .eml File
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            mode === 'paste' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Raw Email
        </button>
      </div>

      <div className="p-6">
        {mode === 'upload' ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${
              isDragging ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {isAnalyzing ? (
              <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
            ) : (
              <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
            )}
            <h3 className="text-lg font-bold text-slate-200 mb-1">
              {isAnalyzing ? 'Analyzing Email...' : 'Drag & Drop .eml File Here'}
            </h3>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              {isAnalyzing 
                ? 'Our engine is tearing down the headers and scanning attachments...'
                : 'Upload a raw .eml file to perform full header, attachment, and URL analysis.'}
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".eml"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <textarea
              value={rawEmail}
              onChange={(e) => setRawEmail(e.target.value)}
              placeholder="Paste complete raw email including headers here..."
              className="w-full h-48 bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
              disabled={isAnalyzing}
            />
            <div className="flex justify-end">
              <button
                onClick={handlePasteSubmit}
                disabled={isAnalyzing || !rawEmail.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Analyze Email
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
