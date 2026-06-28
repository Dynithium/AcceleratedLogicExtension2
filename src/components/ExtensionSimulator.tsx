/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Home, 
  Search, 
  Puzzle, 
  User, 
  MoreVertical,
  Shield,
  HelpCircle
} from 'lucide-react';

export default function ExtensionSimulator() {
  const [isOpen, setIsOpen] = useState(true);
  const [browserUrl, setBrowserUrl] = useState('https://news.ycombinator.com/');
  const [currentTab, setCurrentTab] = useState('Hacker News');

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl" id="extension_simulator_frame">
      {/* BROWSER TITLEBAR */}
      <div className="flex h-10 items-center bg-zinc-900 border-b border-zinc-950 px-4 shrink-0 select-none">
        {/* Window Controls */}
        <div className="flex items-center gap-1.5 mr-6">
          <div className="h-3 w-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" />
          <div className="h-3 w-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" />
        </div>

        {/* Browser Tabs */}
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden h-full pt-1.5">
          <div 
            onClick={() => {
              setBrowserUrl('https://news.ycombinator.com/');
              setCurrentTab('Hacker News');
            }}
            className={`flex items-center gap-2 px-3 h-full rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
              currentTab === 'Hacker News' 
                ? 'bg-zinc-950 text-zinc-100 border-t-2 border-amber-500/80' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850'
            }`}
            id="tab_ycombinator"
          >
            <span className="truncate max-w-[100px]">HN Hacker News</span>
          </div>

          <div 
            onClick={() => {
              setBrowserUrl('https://github.com/trending');
              setCurrentTab('GitHub Trending');
            }}
            className={`flex items-center gap-2 px-3 h-full rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
              currentTab === 'GitHub Trending' 
                ? 'bg-zinc-950 text-zinc-100 border-t-2 border-amber-500/80' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850'
            }`}
            id="tab_github"
          >
            <span className="truncate max-w-[100px]">🐙 GitHub Trending</span>
          </div>

          <div 
            onClick={() => {
              setBrowserUrl('https://stackoverflow.com/');
              setCurrentTab('Stack Overflow');
            }}
            className={`flex items-center gap-2 px-3 h-full rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
              currentTab === 'Stack Overflow' 
                ? 'bg-zinc-950 text-zinc-100 border-t-2 border-amber-500/80' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850'
            }`}
            id="tab_stackoverflow"
          >
            <span className="truncate max-w-[100px]">💬 Stack Overflow</span>
          </div>
        </div>

        {/* Standard Utility Info */}
        <span className="text-[10px] text-zinc-600 font-mono tracking-wider ml-auto select-none">
          CHROME SIMULATOR
        </span>
      </div>

      {/* BROWSER TOOLBAR / ADDRESS BAR */}
      <div className="flex h-11 items-center bg-zinc-950 border-b border-zinc-900 px-3 gap-2.5 shrink-0 select-none">
        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1.5 text-zinc-500">
          <button className="p-1 rounded hover:text-zinc-300 hover:bg-zinc-900 transition-colors" title="Back">
            <ArrowLeft size={14} />
          </button>
          <button className="p-1 rounded hover:text-zinc-300 hover:bg-zinc-900 transition-colors" title="Forward">
            <ArrowRight size={14} />
          </button>
          <button className="p-1 rounded hover:text-zinc-300 hover:bg-zinc-900 transition-colors" title="Reload">
            <RotateCw size={14} className="animate-spin-once" />
          </button>
          <button className="p-1 rounded hover:text-zinc-300 hover:bg-zinc-900 transition-colors" title="Home">
            <Home size={14} />
          </button>
        </div>

        {/* Address Input Bar */}
        <div className="flex-1 flex items-center bg-zinc-900 rounded-full h-7 px-3 border border-zinc-800 gap-2 focus-within:border-zinc-700 focus-within:bg-zinc-850 transition-all">
          <Shield size={11} className="text-emerald-500 shrink-0" />
          <input 
            type="text" 
            value={browserUrl} 
            onChange={(e) => setBrowserUrl(e.target.value)}
            className="flex-1 bg-transparent border-none text-[11px] text-zinc-300 focus:outline-none placeholder-zinc-600 font-mono truncate select-all" 
            placeholder="Search Google or type a URL"
            id="browser_address_input"
          />
          <Search size={11} className="text-zinc-600 shrink-0" />
        </div>

        {/* Extensions and Profile Icons Section */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          {/* Puzzle piece */}
          <button className="p-1.5 rounded hover:text-zinc-200 hover:bg-zinc-900 transition-colors" title="Extensions Menu">
            <Puzzle size={14} />
          </button>

          {/* OUR ACTUAL CHAT EXTENSION ICON BADGE */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-1.5 rounded transition-all cursor-pointer ${
              isOpen 
                ? 'text-amber-400 bg-amber-500/10 scale-105 border border-amber-500/20' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
            title="OmniChat AI Assistant Popup"
            id="simulator_extension_badge"
          >
            {/* Custom extension icon graphic */}
            <div className="h-4.5 w-4.5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-zinc-950 text-[9px]">
              O
            </div>
            
            {/* Visual pulse showing active loaded state */}
            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-800 mx-0.5" />

          {/* Profile and more */}
          <button className="p-1.5 rounded hover:text-zinc-200 hover:bg-zinc-900 transition-colors">
            <User size={14} />
          </button>
          <button className="p-1.5 rounded hover:text-zinc-200 hover:bg-zinc-900 transition-colors">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* BROWSER VIEW AREA & OVERLAID EXTENSION POPUP */}
      <div className="flex-1 relative bg-zinc-950 overflow-hidden flex flex-col items-center justify-center select-text">
        
        {/* WEBPAGE BACKDROP MOCKUP */}
        <div className="absolute inset-0 p-6 flex flex-col overflow-y-auto space-y-6 select-none opacity-40 pointer-events-none filter blur-[1px]">
          {currentTab === 'Hacker News' ? (
            /* MOCK HACKER NEWS SITE */
            <div className="max-w-2xl w-full mx-auto space-y-4">
              <div className="bg-[#ff6600]/10 border border-[#ff6600]/20 p-3 rounded flex items-center justify-between text-xs text-[#ff6600]">
                <span className="font-bold">Y Hacker News</span>
                <span className="text-[10px]">welcome | submit</span>
              </div>
              <div className="space-y-3 pl-1.5">
                {[
                  { rank: 1, title: "Llama.cpp implements multi-GPU structured outputs via regex parsing", site: "github.com/ggerganov", points: 142, user: "dave", age: "2 hours ago" },
                  { rank: 2, title: "We built a web browser extension supporting local models in under 100 lines", site: "omnichat.ai", points: 308, user: "mila", age: "5 hours ago" },
                  { rank: 3, title: "Show HN: SQLite compiled to WASM with built-in vector search indices", site: "sqlite-wasm.dev", points: 74, user: "vectorizer", age: "6 hours ago" },
                  { rank: 4, title: "What is the security risk of third-party API keys in browser extensions?", site: "owasp.org", points: 215, user: "sec_guy", age: "8 hours ago" },
                ].map((item) => (
                  <div key={item.rank} className="flex gap-2 items-start text-xs text-zinc-400">
                    <span className="text-zinc-600 font-mono w-4 text-right">{item.rank}.</span>
                    <div className="flex-1">
                      <p className="text-zinc-200 font-medium">
                        {item.title} <span className="text-[10px] text-zinc-500">({item.site})</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {item.points} points by {item.user} {item.age} | 42 comments
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentTab === 'GitHub Trending' ? (
            /* MOCK GITHUB TRENDING */
            <div className="max-w-2xl w-full mx-auto space-y-4">
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-200">Trending repositories today</span>
                  <span className="text-[10px] text-zinc-500">Spoken Language: English</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {[
                    { repo: "anthropics / anthropic-cookbook", desc: "A collection of guides and recipes for high-performance integrations with Claude models.", stars: "1,245", lang: "Jupyter Notebook" },
                    { repo: "google / genai-ts-sdk", desc: "Official TypeScript SDK for Google Gemini Developer API. Robust, fully typed API calls.", stars: "3,112", lang: "TypeScript" },
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 space-y-1.5">
                      <h4 className="text-xs font-bold text-amber-400">{item.repo}</h4>
                      <p className="text-[11px] text-zinc-400">{item.desc}</p>
                      <div className="flex gap-4 text-[10px] text-zinc-500 pt-1">
                        <span>{item.lang}</span>
                        <span>⭐ {item.stars}</span>
                        <span>forks: 154</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* MOCK STACKOVERFLOW */
            <div className="max-w-2xl w-full mx-auto space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">How to call third-party APIs from a Chrome extension popup safely?</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  I am writing an extension popup using React and Vite. I need to make requests to an external API like OpenAI or Ollama. 
                  In a normal web page I would hit CORS restrictions. What is the recommended practice for extensions?
                </p>
                <div className="flex gap-2">
                  <span className="bg-zinc-900 px-2 py-0.5 rounded text-[9px] text-zinc-400 font-mono">google-chrome</span>
                  <span className="bg-zinc-900 px-2 py-0.5 rounded text-[9px] text-zinc-400 font-mono">browser-extension</span>
                  <span className="bg-zinc-900 px-2 py-0.5 rounded text-[9px] text-zinc-400 font-mono">cors</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CLICK-TO-OPEN TIP (ONLY IF POPUP IS CLOSED) */}
        {!isOpen && (
          <div className="flex flex-col items-center gap-2 cursor-pointer text-center max-w-[280px]" onClick={() => setIsOpen(true)}>
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center animate-bounce">
              <Puzzle className="text-amber-400" size={24} />
            </div>
            <p className="text-xs font-semibold text-zinc-300">The Extension is Installed!</p>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Click the <strong className="text-amber-400">OmniChat (O) icon</strong> in the simulated browser toolbar above to open the AI chat panel.
            </p>
          </div>
        )}

        {/* FLOATING ACTION EXTENSION POPUP IN PLACE */}
        {isOpen && (
          <div 
            className="absolute right-6 top-1 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-10"
            id="simulator_popup_wrapper"
          >
            <iframe 
              src="/popup.html" 
              className="w-[380px] h-[580px] border-none bg-zinc-950" 
              title="OmniChat Extension Simulated"
            />
          </div>
        )}
      </div>
    </div>
  );
}
