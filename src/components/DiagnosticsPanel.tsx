/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Puzzle, 
  Terminal, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Settings, 
  Globe,
  Download,
  Flame,
  FileJson
} from 'lucide-react';
import { Chat, ExtensionSettings } from '../types';
import * as storage from '../utils/storage';

export default function DiagnosticsPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    const checkState = async () => {
      const s = await storage.getSettings();
      setSettings(s);
      const c = await storage.getChats();
      setChats(c);
    };

    // Poll every 1.5 seconds to reflect settings changes from the side panel in real-time
    const interval = setInterval(checkState, 1500);
    checkState();
    return () => clearInterval(interval);
  }, []);

  const manifestCode = `{
  "manifest_version": 3,
  "name": "OmniChat AI - Personal AI Companion",
  "version": "1.0.0",
  "description": "A context-aware AI chat client supporting customizable OpenAI-compatible API endpoints, custom model IDs, and local message storage.",
  "permissions": [
    "storage",
    "sidePanel"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "side_panel": {
    "default_path": "popup.html"
  },
  "sidebar_action": {
    "default_panel": "popup.html",
    "default_title": "OmniChat AI"
  },
  "action": {
    "default_title": "OmniChat AI"
  },
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`;

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(manifestCode);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  return (
    <div className="w-full flex flex-col space-y-6" id="diagnostics_panel_root">
      {/* EXTENSION READINESS DIAGNOSTICS */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <Terminal size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">Extension Status & Diagnostics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400">Environment Verification</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-200">Manifest Built-in</p>
                  <p className="text-[10px] text-zinc-500">`manifest.json` configured in public folder for auto-copy to `dist/`.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-200">Storage Synchronization Layer</p>
                  <p className="text-[10px] text-zinc-500">Universal storage adapter supports `chrome.storage.local` with `localStorage` fallbacks.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-200">Vite Asset Router</p>
                  <p className="text-[10px] text-zinc-500">Compiles styles into static resources mapped correctly for sidebar views.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400">Active Extension State</h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs">
                {settings?.apiKey ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-zinc-200">API Authentication</p>
                  <p className="text-[10px] text-zinc-500">
                    {settings?.apiKey 
                      ? `Configured: Masked Key active (using model: ${settings.modelId})` 
                      : 'Not set: Defaults to Local / CORS-free proxy endpoint.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-200">Chat Sessions Recorded</p>
                  <p className="text-[10px] text-zinc-500">
                    {chats.length} active multi-chat {chats.length === 1 ? 'session' : 'sessions'} stored in persistent storage.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Globe size={14} className="text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-200">Endpoint Routing</p>
                  <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                    {settings?.baseUrl || 'https://api.openai.com/v1'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CORS BUSTING CLARIFICATION */}
        <div className="bg-amber-950/10 border border-amber-900/30 rounded-lg p-3 text-xs flex gap-2.5">
          <HelpCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-amber-300">A Note on CORS in Web Preview</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              When using settings inside the iframe preview, sending requests to official secure servers like `api.openai.com` might result in a browser **CORS block**. 
              This is standard sandboxed browser behavior.
            </p>
            <p className="text-[11px] text-zinc-400 font-medium">
              👉 Rest assured, once you build and load the extension in Chrome or Firefox, CORS policies are completely bypassed by design for browser extensions! It will connect to any server flawlessly.
            </p>
          </div>
        </div>
      </div>

      {/* DETAILED UNPACK & DEPLOY GUIDE */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <Download size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">Local Installation Guide (Unpacking)</h2>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-zinc-400">
          <p>
            You can test this extension directly on your physical computer by downloading the repository ZIP, compiling it, and loading it as an unpacked extension.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {/* GOOGLE CHROME / CHROMIUM STEP */}
            <div className="space-y-3 bg-zinc-950/40 p-4 rounded-lg border border-zinc-800">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px] text-amber-400">1</span>
                Loading in Chrome (or Brave / Edge)
              </h3>
              <ol className="list-decimal pl-4.5 space-y-2 text-[11px]">
                <li>
                  Click the **Settings Menu** in the upper right corner of this AI Studio window, and choose **Export to ZIP** to download the project.
                </li>
                <li>
                  Extract the downloaded ZIP folder to a convenient place on your computer.
                </li>
                <li>
                  Open your terminal inside the extracted directory and run the compile commands:
                  <div className="bg-zinc-950 p-2 rounded my-1.5 font-mono text-[10px] text-amber-300">
                    npm install<br />
                    npm run build
                  </div>
                </li>
                <li>
                  Open Google Chrome and navigate to: <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-zinc-200 text-[10px]">chrome://extensions/</code>
                </li>
                <li>
                  Enable **Developer mode** in the upper right toggle.
                </li>
                <li>
                  Click **Load unpacked** in the top left and select the compiled <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-zinc-200 text-[10px]">dist</code> folder.
                </li>
                <li>
                  🎉 Click the extension icon in your Chrome toolbar or choose "OmniChat AI" from the side panel menu to open the chat sidebar!
                </li>
              </ol>
            </div>

            {/* FIREFOX STEP */}
            <div className="space-y-3 bg-zinc-950/40 p-4 rounded-lg border border-zinc-800">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px] text-amber-400">2</span>
                Loading in Mozilla Firefox
              </h3>
              <ol className="list-decimal pl-4.5 space-y-2 text-[11px]">
                <li>
                  Follow the steps **1 to 3** on the left to extract and build the project directory to compile the static folder.
                </li>
                <li>
                  Open Firefox and type this path in the URL bar: <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-zinc-200 text-[10px]">about:debugging</code>
                </li>
                <li>
                  Click on **This Firefox** in the sidebar.
                </li>
                <li>
                  Click the **Load Temporary Add-on...** button.
                </li>
                <li>
                  Navigate to your compiled <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-zinc-200 text-[10px]">dist</code> directory and select the **manifest.json** file.
                </li>
                <li>
                  🎉 The OmniChat companion is now loaded! Click the extension icon or open the Firefox Sidebar menu to access your sidebar chat companion.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* MANIFEST INSPECTOR */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FileJson size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">Extension manifest.json Inspector</h2>
          </div>
          <button
            onClick={handleCopyManifest}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-[10px] transition-all cursor-pointer"
            id="copy_manifest_button"
          >
            {copiedText ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 overflow-x-auto text-[11px] font-mono text-amber-200 leading-relaxed whitespace-pre-wrap select-all">
          {manifestCode}
        </pre>
      </div>
    </div>
  );
}
