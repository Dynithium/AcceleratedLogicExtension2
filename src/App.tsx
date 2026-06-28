/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Puzzle, 
  Monitor, 
  Smartphone, 
  ExternalLink, 
  Code,
  Sparkles,
  Layers,
  Flame,
  Download
} from 'lucide-react';
import ExtensionSimulator from './components/ExtensionSimulator';
import DiagnosticsPanel from './components/DiagnosticsPanel';

export default function App() {
  const [previewMode, setPreviewMode] = useState<'simulator' | 'standalone'>('simulator');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 select-none">
      
      {/* GLOBAL SANDBOX NAVIGATION HEADER */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-zinc-950 text-xs shadow-md">
              O
            </div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              OmniChat AI <span className="text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">Browser Extension Developer Portal</span>
            </h1>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            A secure, context-aware extension popover applet supporting customizable OpenAI-compatible models, local-sync storage, and infinite chat histories.
          </p>
        </div>

        {/* Action controllers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Extension Zip Download Reminder */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
            <Download size={12} className="text-amber-400" />
            <span>Click Settings ➔ <b>Export to ZIP</b> in AI Studio to load locally!</span>
          </div>
        </div>
      </header>

      {/* CORE LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE EXTENSION RENDERER AND SIMULATORS (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col space-y-4 w-full">
          {/* VIEW CONTROLS BANNER */}
          <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl select-none shrink-0">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">Active Canvas Preview Mode:</span>
            </div>

            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-850">
              <button
                onClick={() => setPreviewMode('simulator')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  previewMode === 'simulator'
                    ? 'bg-zinc-850 text-white shadow-inner'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                id="preview_mode_simulator"
              >
                <Monitor size={12} />
                <span>Chrome Simulator</span>
              </button>
              
              <button
                onClick={() => setPreviewMode('standalone')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  previewMode === 'standalone'
                    ? 'bg-zinc-850 text-white shadow-inner'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                id="preview_mode_standalone"
              >
                <Smartphone size={12} />
                <span>Isolated Sidebar UI</span>
              </button>
            </div>
          </div>

          {/* SIMULATOR OR RAW PREVIEW CANVAS */}
          <div 
            className="w-full flex items-center justify-center bg-gradient-to-b from-zinc-900/40 to-zinc-950 rounded-2xl border border-zinc-850 overflow-hidden relative"
            style={{ 
              height: '640px',
              minHeight: '640px'
            }}
            id="preview_canvas_container"
          >
            {previewMode === 'simulator' ? (
              <div className="w-full h-full p-4 flex items-center justify-center">
                <ExtensionSimulator />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 w-full max-w-sm px-4">
                <div className="w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative bg-zinc-950 flex flex-col h-[540px]">
                  {/* Sidebar simulated header */}
                  <div className="h-8 bg-zinc-900 border-b border-zinc-950 px-3 flex items-center justify-between text-[10px] text-zinc-400 font-medium shrink-0 select-none">
                    <span className="flex items-center gap-1.5 font-bold tracking-tight text-zinc-300">
                      <Puzzle size={11} className="text-amber-400" />
                      Side panel: OmniChat AI
                    </span>
                    <div className="h-3.5 w-3.5 flex items-center justify-center rounded text-zinc-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  <iframe 
                    src="/popup.html" 
                    className="flex-1 w-full border-none bg-zinc-950" 
                    title="OmniChat Extension Standalone" 
                  />
                </div>
                <div className="text-[10px] text-zinc-600 font-mono tracking-wider text-center">
                  BOUNDS: RESPONSIVE SIDEBAR WIDTH (SIMULATED SIDE PANEL)
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: INTEGRATION MANUAL & DIAGNOSTIC LOGS (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col space-y-6 w-full h-full select-text">
          <DiagnosticsPanel />
        </section>

      </main>

      {/* FOOTER METRICS */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-[10px] text-zinc-600 select-none">
        <p>© 2026 OmniChat AI. Built as an unpackable Chromium Manifest V3 compliant extension boilerplate.</p>
      </footer>

    </div>
  );
}
