/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Puzzle, Download } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen h-screen bg-zinc-950 text-zinc-100 flex flex-row overflow-hidden font-sans selection:bg-amber-500/30">
      
      {/* MAIN MAINPAGE AREA: Ultra-minimalist showcase representing the browser tab */}
      <div className="flex-1 flex flex-col justify-between p-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.03),transparent_50%)] select-none">
        
        {/* Subtle top branding */}
        <div className="flex items-center justify-between opacity-40">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-widest text-zinc-500 uppercase">OMNICHAT EXTENSION ENVIRONMENT</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>MANIFEST V3</span>
            <span>CHROME SIDE PANEL ACTIVE</span>
          </div>
        </div>

        {/* The beautiful "omni" text centering the page */}
        <div className="my-auto flex flex-col items-center justify-center text-center space-y-4">
          <h1 className="text-8xl sm:text-9xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600 drop-shadow-[0_10px_50px_rgba(255,255,255,0.03)] select-all leading-none">
            omni
          </h1>
          <p className="text-xs text-zinc-500 font-mono tracking-wide max-w-sm leading-relaxed">
            personal context-aware browser companion sidepanel.
          </p>
          
          {/* Helpful local installation instruction capsule */}
          <div className="pt-8 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 shadow-xl backdrop-blur">
              <Download size={14} className="text-amber-500" />
              <span>Click <b>Export to ZIP</b> in settings to load locally in your browser!</span>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono flex gap-4">
              <span>1. Unzip folder</span>
              <span>2. Go to chrome://extensions</span>
              <span>3. Load Unpacked</span>
            </div>
          </div>
        </div>

        {/* Simple bottom reference */}
        <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono">
          <span>OMNICHAT COMPANION</span>
          <span>COMPLIANT BUILD DIRECTORY: /dist</span>
        </div>
      </div>

      {/* PERSISTENT FULL-HEIGHT SIDE PANEL ON THE RIGHT */}
      <aside className="w-[340px] sm:w-[360px] md:w-[380px] h-full bg-zinc-950 border-l border-zinc-900 flex flex-col shrink-0 relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-20">
        
        {/* Real Chrome-styled Side Panel Top bar */}
        <div className="h-11 bg-zinc-900 border-b border-zinc-950 px-4 flex items-center justify-between text-xs text-zinc-400 font-medium shrink-0 select-none">
          <span className="flex items-center gap-2 font-bold tracking-tight text-zinc-300">
            <Puzzle size={13} className="text-amber-500 animate-pulse" />
            Side panel: OmniChat AI
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Active
            </span>
          </div>
        </div>

        {/* Embedded Extension HTML Core View */}
        <div className="flex-1 w-full bg-zinc-950 overflow-hidden">
          <iframe 
            src="/popup.html" 
            className="w-full h-full border-none bg-zinc-950" 
            title="OmniChat Extension Simulated Sidepanel" 
          />
        </div>
      </aside>

    </div>
  );
}
