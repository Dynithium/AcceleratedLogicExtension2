/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLibModule from './pdf.min.mjs';
import * as tesseractModule from './tesseract.esm.min.js';

// Storage and State Keys
const STORAGE_KEYS = {
  SETTINGS: 'omnichat_settings',
  CHATS: 'omnichat_chats',
  ACTIVE_CHAT_ID: 'omnichat_active_chat_id',
  VISION_MODELS: 'omnichat_vision_models',
};

const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelId: 'gpt-4o',
  systemPrompt: 'You are a helpful, context-aware AI assistant running inside a browser extension. Be concise, accurate, and direct.',
  temperature: 0.7,
  maxTokens: 1024,
  pdfPageLimit: 5,
  forceVision: false,
};

// Global App State
let settings = { ...DEFAULT_SETTINGS };
let chats = [];
let activeChatId = null;
let isSending = false;
let editingChatId = null;
let activeAttachments = []; // Array of Base64 strings with data URI prefix
let activeAbortController = null; // To support stop/pause generation function
let testedVisionModels = {}; // Dynamic vision capability cache


// Is Extension Context Checker
const isExtensionContext = () => {
  return typeof chrome !== 'undefined' && chrome.storage !== undefined && chrome.storage.local !== undefined;
};

// Async Storage Wrappers (supports both Extension storage and local web storage fallbacks)
const getStorageItem = async (key, defaultValue) => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  } else {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }
};

const setStorageItem = async (key, value) => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Dom Elements Cache
const elements = {
  sidebarToggle: document.getElementById('sidebar-toggle-btn'),
  chatsCountBadge: document.getElementById('chats-count-badge'),
  headerChatTitle: document.getElementById('header-chat-title'),
  headerModelSubtitle: document.getElementById('header-model-subtitle'),
  headerAddBtn: document.getElementById('header-add-btn'),
  settingsToggle: document.getElementById('settings-toggle-btn'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  sidebar: document.getElementById('sidebar'),
  sidebarAddBtn: document.getElementById('sidebar-add-btn'),
  chatsList: document.getElementById('chats-list'),
  messagesScreen: document.getElementById('messages-screen'),
  inputForm: document.getElementById('input-form'),
  warningAlert: document.getElementById('warning-alert'),
  warningConfigLink: document.getElementById('warning-config-link'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  authStatusHint: document.getElementById('auth-status-hint'),
  chatView: document.getElementById('chat-view'),
  settingsView: document.getElementById('settings-view'),
  settingsForm: document.getElementById('settings-form'),
  settingBaseUrl: document.getElementById('setting-base-url'),
  settingApiKey: document.getElementById('setting-api-key'),
  settingModelId: document.getElementById('setting-model-id'),
  settingSystemPrompt: document.getElementById('setting-system-prompt'),
  settingTemperature: document.getElementById('setting-temperature'),
  sliderTempVal: document.getElementById('slider-temp-val'),
  toggleKeyVisibility: document.getElementById('toggle-key-visibility'),
  testConnectionBtn: document.getElementById('test-connection-btn'),
  testBtnSparkle: document.getElementById('test-btn-sparkle'),
  testBtnText: document.getElementById('test-btn-text'),
  testAlertBanner: document.getElementById('test-alert-banner'),
  resetSettingsBtn: document.getElementById('reset-settings-btn'),
  attachBtn: document.getElementById('attach-btn'),
  fileInput: document.getElementById('file-input'),
  attachmentPreviewContainer: document.getElementById('attachment-preview-container'),
  settingPdfPageLimit: document.getElementById('setting-pdf-page-limit'),
  settingForceVision: document.getElementById('setting-force-vision'),
};

// Initialize Application
const init = async () => {
  // 1. Load Settings
  const loadedSettings = await getStorageItem(STORAGE_KEYS.SETTINGS, null);
  if (loadedSettings) {
    settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
  } else {
    settings = { ...DEFAULT_SETTINGS };
    await setStorageItem(STORAGE_KEYS.SETTINGS, settings);
  }

  // Populate settings form inputs
  elements.settingBaseUrl.value = settings.baseUrl;
  elements.settingApiKey.value = settings.apiKey;
  elements.settingModelId.value = settings.modelId;
  elements.settingSystemPrompt.value = settings.systemPrompt;
  elements.settingTemperature.value = settings.temperature;
  elements.sliderTempVal.innerText = settings.temperature;
  if (elements.settingPdfPageLimit) {
    elements.settingPdfPageLimit.value = settings.pdfPageLimit !== undefined ? settings.pdfPageLimit : DEFAULT_SETTINGS.pdfPageLimit;
  }
  if (elements.settingForceVision) {
    elements.settingForceVision.checked = settings.forceVision !== undefined ? settings.forceVision : DEFAULT_SETTINGS.forceVision;
  }

  // 1.5. Load tested vision models cache
  testedVisionModels = await getStorageItem(STORAGE_KEYS.VISION_MODELS, {});

  // 2. Load Chats log
  chats = await getStorageItem(STORAGE_KEYS.CHATS, []);
  activeChatId = await getStorageItem(STORAGE_KEYS.ACTIVE_CHAT_ID, null);

  if (chats.length === 0) {
    await handleCreateChat('Welcome Session');
  } else if (!activeChatId || !chats.some(c => c.id === activeChatId)) {
    activeChatId = chats[0].id;
    await setStorageItem(STORAGE_KEYS.ACTIVE_CHAT_ID, activeChatId);
  }

  updateAuthStatusHint();
  renderChatsList();
  renderActiveChat();
  setupEventListeners();
  updateSendButtonState();

  // Trigger non-blocking live vision check on start
  triggerVisionTest(settings.modelId);
};

// Update Hint & Warning Indicator based on credentials
const updateAuthStatusHint = () => {
  const isOfficial = settings.baseUrl.includes('api.openai.com');
  const hasKey = settings.apiKey.trim().length > 0;

  if (hasKey) {
    elements.authStatusHint.innerText = 'API Key Configured';
    elements.authStatusHint.style.color = 'var(--success)';
    elements.warningAlert.classList.add('hidden');
  } else {
    if (isOfficial) {
      elements.authStatusHint.innerText = 'API Key Required';
      elements.authStatusHint.style.color = 'var(--error)';
      elements.warningAlert.classList.remove('hidden');
    } else {
      elements.authStatusHint.innerText = 'Local/Proxy Mode';
      elements.authStatusHint.style.color = 'var(--primary)';
      elements.warningAlert.classList.add('hidden');
    }
  }

  // Update badge count
  elements.chatsCountBadge.innerText = chats.length;
  elements.headerModelSubtitle.innerText = settings.modelId || 'gpt-4o';
};

// Event Listeners Binding
const setupEventListeners = () => {
  // Sidebar toggles
  elements.sidebarToggle.addEventListener('click', toggleSidebar);
  elements.sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

  // Add chat triggers
  elements.headerAddBtn.addEventListener('click', () => handleCreateChat());
  elements.sidebarAddBtn.addEventListener('click', () => handleCreateChat());

  // Input Warnings
  elements.warningConfigLink.addEventListener('click', () => switchView('settings'));

  // Settings visibility toggle
  elements.settingsToggle.addEventListener('click', () => {
    if (elements.settingsView.classList.contains('hidden')) {
      switchView('settings');
    } else {
      switchView('chat');
    }
  });

  // Toggle API Key dots visibility
  elements.toggleKeyVisibility.addEventListener('click', () => {
    const isPass = elements.settingApiKey.type === 'password';
    elements.settingApiKey.type = isPass ? 'text' : 'password';
  });

  // Slider change label sync
  elements.settingTemperature.addEventListener('input', (e) => {
    elements.sliderTempVal.innerText = e.target.value;
  });

  // Reset fields to default
  elements.resetSettingsBtn.addEventListener('click', () => {
    elements.settingBaseUrl.value = DEFAULT_SETTINGS.baseUrl;
    elements.settingApiKey.value = DEFAULT_SETTINGS.apiKey;
    elements.settingModelId.value = DEFAULT_SETTINGS.modelId;
    elements.settingSystemPrompt.value = DEFAULT_SETTINGS.systemPrompt;
    elements.settingTemperature.value = DEFAULT_SETTINGS.temperature;
    elements.sliderTempVal.innerText = DEFAULT_SETTINGS.temperature;
    if (elements.settingPdfPageLimit) {
      elements.settingPdfPageLimit.value = DEFAULT_SETTINGS.pdfPageLimit;
    }
    if (elements.settingForceVision) {
      elements.settingForceVision.checked = DEFAULT_SETTINGS.forceVision;
    }
    
    // Clear warning banners
    elements.testAlertBanner.classList.add('hidden');
  });

  // Test diagnostic button trigger
  elements.testConnectionBtn.addEventListener('click', handleTestConnection);

  // Form Submission
  elements.settingsForm.addEventListener('submit', handleSaveSettings);
  elements.inputForm.addEventListener('submit', handleSendMessage);

  // Stop/Pause generation on button click
  elements.sendBtn.addEventListener('click', (e) => {
    if (isSending) {
      e.preventDefault();
      e.stopPropagation();
      if (activeAbortController) {
        activeAbortController.abort();
      }
    }
  });

  // Attachment button and input triggers
  elements.attachBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files);
    elements.fileInput.value = ''; // Reset input to allow re-selecting same file
  });

  // Paste image handler directly in message input
  elements.messageInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (items) {
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
          files.push(items[i].getAsFile());
        }
      }
      if (files.length > 0) {
        handleFileSelect(files);
      }
    }
  });

  // Drag & drop file handlers with visually responsive highlighted state
  const dragEvents = ['dragenter', 'dragover'];
  const undragEvents = ['dragleave', 'drop'];

  dragEvents.forEach(eventName => {
    elements.inputForm.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.inputForm.classList.add('dragover');
    }, false);
  });

  undragEvents.forEach(eventName => {
    elements.inputForm.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      elements.inputForm.classList.remove('dragover');
    }, false);
  });

  elements.inputForm.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (validFiles.length > 0) {
        handleFileSelect(validFiles);
      }
    }
  });

  // Message area key down triggers for Shift+Enter support
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.inputForm.requestSubmit();
    }
  });

  // Auto-resize textbox height based on text lines
  elements.messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    updateSendButtonState();
  });

  // Non-inline event delegation for code copying (satisfies strict CSP)
  elements.messagesScreen.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.code-block-copy');
    if (!copyBtn) return;

    const blockId = copyBtn.getAttribute('data-block-id');
    if (!blockId) return;

    const preElement = document.getElementById(`pre-${blockId}`);
    if (!preElement) return;

    navigator.clipboard.writeText(preElement.innerText).then(() => {
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg class="icon" style="color: var(--success); width: 10px; height: 10px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span style="color: var(--success);">Copied!</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
      }, 1500);
    });
  });
};

// Pure client-side PDF text extraction using PDF.js (runs locally)
const extractTextFromPdf = async (arrayBuffer) => {
  try {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    
    let extractedText = "";
    // Extract text page-by-page (up to settings.pdfPageLimit pages)
    const limit = settings.pdfPageLimit !== undefined ? parseInt(settings.pdfPageLimit, 10) || 5 : 5;
    const maxPagesToExtract = Math.min(pdf.numPages, limit);
    for (let pageNum = 1; pageNum <= maxPagesToExtract; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      if (pageText.trim().length > 0) {
        extractedText += `--- PDF Page ${pageNum} Text ---\n${pageText}\n\n`;
      }
    }
    
    return extractedText.trim();
  } catch (err) {
    console.error("PDF.js text extraction failed:", err);
    return "";
  }
};

// Convert SVG base64 to PNG base64 to ensure broad multimodal model compatibility
const convertSvgToPng = (svgDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width || 1024;
        const height = img.naturalHeight || img.height || 1024;
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Render SVG onto a clean white background for high visual contrast
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error("SVG rendering to Canvas failed:", err);
        showToast("SVG to PNG rendering failed. Using original SVG content.");
        resolve(svgDataUrl);
      }
    };
    img.onerror = (err) => {
      console.error("SVG Image loading error during SVG to PNG conversion:", err);
      showToast("SVG image parsing failed. Using original content.");
      resolve(svgDataUrl);
    };
    img.src = svgDataUrl;
  });
};

// Scale down and compress any image to safe visual dimensions and a clean PNG format
const resizeAndCompressImage = (dataUrl, maxDimension = 1024) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw solid white background for transparency fallback
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        // Force output to PNG as requested by user
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error("Image resizing/compression failed:", err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
};

// Check if a model supports vision capabilities natively
const doesModelSupportVision = (modelId) => {
  // If user has explicitly forced vision/multimodal mode, bypass checks and return true
  if (settings.forceVision) return true;

  const id = (modelId || '').trim();
  if (!id) return false;

  // Check the dynamic live tested cache!
  if (testedVisionModels[id] === true) {
    return true;
  }

  return false;
};

// Dynamically probes the configured model with a microscopic 1x1 base64 PNG
// to verify real-time vision capabilities without throwing user-visible exceptions.
const testModelVisionCapability = async (modelId, customSettings = null) => {
  const currentSettings = customSettings || settings;
  const baseUrl = currentSettings.baseUrl || 'https://api.openai.com/v1';
  const apiKey = currentSettings.apiKey || '';
  
  if (!modelId) return false;

  // If apiKey is empty and baseUrl is official OpenAI, do not run the test yet to avoid unnecessary 401s
  if (!apiKey && baseUrl.includes('api.openai.com')) {
    console.log(`Bypassing vision test for ${modelId} as API key is not configured yet.`);
    return false;
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Ok' },
              { type: 'image_url', image_url: { url: tinyPng } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 5
      })
    });

    if (res.ok) {
      console.log(`Vision capability dynamic check: Model "${modelId}" natively supports vision/multimodal payloads!`);
      testedVisionModels[modelId] = true;
      await setStorageItem(STORAGE_KEYS.VISION_MODELS, testedVisionModels);
      return true;
    } else {
      const errText = await res.text();
      console.warn(`Vision capability check rejected for model "${modelId}" with status ${res.status}:`, errText);
      testedVisionModels[modelId] = false;
      await setStorageItem(STORAGE_KEYS.VISION_MODELS, testedVisionModels);
      return false;
    }
  } catch (err) {
    console.error(`Vision capability check failed due to network error for model "${modelId}":`, err);
    return false;
  }
};

// Async wrapper to execute vision checks and update visual indicator states smoothly
const triggerVisionTest = async (modelId, customSettings = null) => {
  if (!modelId) return;
  
  // Set UI state to checking
  updateModelVisionUIState(modelId, 'checking');
  
  const supports = await testModelVisionCapability(modelId, customSettings);
  
  updateModelVisionUIState(modelId, supports ? 'vision' : 'text');
};

// Syncs subtitle display with current detection state
const updateModelVisionUIState = (modelId, state) => {
  if (settings.modelId !== modelId) return; // Ignore stale check states

  let text = modelId;
  let color = 'var(--text-muted)';
  
  if (state === 'checking') {
    text += ' (🔄 Verifying vision support...)';
    color = 'var(--primary)';
  } else if (state === 'vision' || testedVisionModels[modelId] === true) {
    text += ' (📷 Vision Enabled)';
    color = 'var(--success)';
  } else if (state === 'text' || testedVisionModels[modelId] === false) {
    text += ' (📝 Text-Only)';
    color = 'var(--text-muted)';
  } else {
    text += ' (🔍 Unverified)';
  }
  
  if (elements.headerModelSubtitle) {
    elements.headerModelSubtitle.innerText = text;
    elements.headerModelSubtitle.style.color = color;
  }
};

// Dynamic local import of Tesseract.js (compliant with local Chrome security & Manifest V3)
const loadTesseract = async () => {
  return tesseractModule.createWorker ? tesseractModule : (tesseractModule.default || tesseractModule);
};

// Runs OCR on an image (base64 or URL) locally using bundled Tesseract.js
const runOcrOnImage = async (imageUrl) => {
  try {
    const Tesseract = await loadTesseract();
    // Support both direct exports and default export wrappers depending on compilation/bundle state
    const createWorker = Tesseract.createWorker || (Tesseract.default && Tesseract.default.createWorker);
    if (!createWorker) {
      throw new Error("createWorker is not available in the Tesseract.js bundle");
    }

    // Configure worker with fully localized asset paths to avoid remote CDN loads (Manifest V3 compliance)
    let workerPath = isExtensionContext() ? chrome.runtime.getURL('worker.min.js') : '/worker.min.js';
    let corePath = isExtensionContext() ? chrome.runtime.getURL('tesseract-core.wasm.js') : '/tesseract-core.wasm.js';

    if (!isExtensionContext()) {
      try {
        const testRes = await fetch(workerPath, { method: 'HEAD' });
        if (!testRes.ok) {
          workerPath = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js';
          corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js';
        }
      } catch (e) {
        workerPath = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js';
        corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js';
      }
    }

    console.log("Local OCR initializing worker with paths:", { workerPath, corePath });
    const worker = await createWorker('eng', 1, {
      workerPath: workerPath,
      corePath: corePath,
      logger: m => console.log("OCR Progress:", m)
    });

    const ret = await worker.recognize(imageUrl);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    console.error("Local OCR recognition failed:", err);
    return '';
  }
};

// Asynchronously runs OCR on rendered PDF page PNGs to extract text from scanned documents
const runOcrOnPdfPages = async (renderedPages) => {
  let combinedOcr = '';
  if (!renderedPages || renderedPages.length === 0) return combinedOcr;

  for (let i = 0; i < renderedPages.length; i++) {
    const page = renderedPages[i];
    try {
      console.log(`Extracting text from PDF page ${page.pageNum}/${renderedPages.length} using local OCR...`);
      const pageText = await runOcrOnImage(page.url);
      if (pageText && pageText.trim().length > 0) {
        combinedOcr += `\n--- PDF Page ${page.pageNum} Local OCR Text ---\n${pageText.trim()}\n`;
      }
    } catch (e) {
      console.error(`Local OCR failed on PDF page ${page.pageNum}:`, e);
    }
  }
  return combinedOcr.trim();
};

// Dynamic local import of PDF.js with automated fallback layers (Vite, MV3, & CDN)
const loadPdfJs = async () => {
  const lib = pdfjsLibModule.getDocument ? pdfjsLibModule : (pdfjsLibModule.default || pdfjsLibModule);
  if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
    const workerUrl = isExtensionContext() ? chrome.runtime.getURL('pdf.worker.min.mjs') : './pdf.worker.min.mjs';
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return lib;
};

// Convert PDF pages to highly optimized PNG data URLs (first 3 pages to stay within token/payload limits)
const convertPdfToPngs = async (arrayBuffer) => {
  try {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    
    const pageUrls = [];
    const limit = settings.pdfPageLimit !== undefined ? parseInt(settings.pdfPageLimit, 10) || 5 : 5;
    const maxPagesToRender = Math.min(pdf.numPages, limit);
    
    for (let pageNum = 1; pageNum <= maxPagesToRender; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      // Draw solid white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      await page.render(renderContext).promise;
      
      // Generate highly optimized PNG images as requested by user
      const pngUrl = canvas.toDataURL('image/png');
      pageUrls.push({
        url: pngUrl,
        pageNum: pageNum
      });
    }
    return pageUrls;
  } catch (err) {
    console.error("Failed to render PDF pages to PNG:", err);
    return [];
  }
};

// Beautiful non-blocking notification toast (iframe-friendly fallback for window.alert)
const showToast = (message, type = 'error') => {
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.style.position = 'fixed';
  toast.style.top = '12px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%) translateY(-20px)';
  toast.style.backgroundColor = type === 'error' ? 'var(--error)' : 'var(--success)';
  toast.style.color = '#ffffff';
  toast.style.padding = '8px 14px';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '10px';
  toast.style.fontWeight = '500';
  toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
  toast.style.zIndex = '99999';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  toast.style.whiteSpace = 'nowrap';
  
  toast.innerText = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3000);
};

// Process newly added image and PDF files (converts to Base64 data urls with dynamic resizing)
const handleFileSelect = (files) => {
  if (!files || files.length === 0) return;

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

  Array.from(files).forEach(file => {
    if (activeAttachments.length >= 10) {
      showToast("Maximum limit of 10 attachments reached.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast(`"${file.name}" exceeds 25MB limit.`);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) return;

    if (isPdf) {
      // For PDFs, we read the array buffer to extract text and render page screenshots
      const bufferReader = new FileReader();
      bufferReader.onload = async (ev) => {
        const arrayBuffer = ev.target.result;
        const extractedText = await extractTextFromPdf(arrayBuffer);
        const renderedPages = await convertPdfToPngs(arrayBuffer);
        
        // Then we read the data URL for UI display / download support
        const urlReader = new FileReader();
        urlReader.onload = (e) => {
          let base64Url = e.target.result;
          if (!base64Url.startsWith('data:application/pdf')) {
            const parts = base64Url.split(',');
            if (parts.length > 1) {
              base64Url = 'data:application/pdf;base64,' + parts[1];
            }
          }

          const attachmentObj = {
            url: base64Url,
            name: file.name,
            type: 'application/pdf',
            size: file.size,
            extractedText: extractedText,
            renderedPages: renderedPages,
            ocrStatus: renderedPages.length > 0 ? 'processing' : 'done',
            ocrText: ''
          };

          const exists = activeAttachments.some(att => {
            const existingUrl = typeof att === 'string' ? att : att.url;
            return existingUrl === base64Url;
          });

          if (!exists) {
            activeAttachments.push(attachmentObj);
            renderAttachmentPreviews();
            updateSendButtonState();

            // Run local OCR on PDF pages asynchronously to find text in scanned files
            if (renderedPages.length > 0) {
              const ocrPromise = runOcrOnPdfPages(renderedPages).then(combinedOcrText => {
                attachmentObj.ocrText = combinedOcrText;
                attachmentObj.ocrStatus = 'done';
                if (combinedOcrText) {
                  // Merge the OCR text with the extracted text so it gets sent in payloads
                  attachmentObj.extractedText = (attachmentObj.extractedText ? attachmentObj.extractedText + '\n\n' : '') + combinedOcrText;
                }
                renderAttachmentPreviews();
                return combinedOcrText;
              }).catch(err => {
                console.error("PDF local OCR error:", err);
                attachmentObj.ocrStatus = 'failed';
                renderAttachmentPreviews();
                return '';
              });
              attachmentObj.ocrPromise = ocrPromise;
            }
          }
        };
        urlReader.readAsDataURL(file);
      };
      bufferReader.readAsArrayBuffer(file);
    } else {
      // Flow for image files (including SVGs)
      const reader = new FileReader();
      reader.onload = async (e) => {
        let base64Url = e.target.result;
        let fileType = file.type;
        let fileName = file.name;
        
        const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
        if (isSvg) {
          base64Url = await convertSvgToPng(base64Url);
          fileType = 'image/png';
          if (!fileName.toLowerCase().endsWith('.png')) {
            fileName += '.png';
          }
        }

        // Resize and compress ALL images to super compact PNG format as requested by the user
        base64Url = await resizeAndCompressImage(base64Url, 1024);
        fileType = 'image/png';
        if (fileName.lastIndexOf('.') !== -1) {
          fileName = fileName.substring(0, fileName.lastIndexOf('.')) + '.png';
        } else {
          fileName += '.png';
        }

        const attachmentObj = {
          url: base64Url,
          name: fileName,
          type: fileType,
          size: file.size,
          ocrStatus: 'processing',
          ocrText: ''
        };

        const exists = activeAttachments.some(att => {
          const existingUrl = typeof att === 'string' ? att : att.url;
          return existingUrl === base64Url;
        });

        if (!exists) {
          activeAttachments.push(attachmentObj);
          renderAttachmentPreviews();
          updateSendButtonState();

          // Run local OCR on image asynchronously
          const ocrPromise = runOcrOnImage(base64Url).then(ocrResult => {
            attachmentObj.ocrText = ocrResult;
            attachmentObj.ocrStatus = 'done';
            renderAttachmentPreviews();
            return ocrResult;
          }).catch(err => {
            console.error("Image local OCR error:", err);
            attachmentObj.ocrStatus = 'failed';
            renderAttachmentPreviews();
            return '';
          });
          attachmentObj.ocrPromise = ocrPromise;
        }
      };
      reader.readAsDataURL(file);
    }
  });
};

// Renders thumbnail previews for current attachments
const renderAttachmentPreviews = () => {
  const container = elements.attachmentPreviewContainer;
  container.innerHTML = '';

  if (activeAttachments.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  activeAttachments.forEach((att, index) => {
    const url = typeof att === 'string' ? att : att.url;
    const name = typeof att === 'string' ? 'Attachment' : att.name;
    const type = typeof att === 'string' ? (url.startsWith('data:application/pdf') ? 'application/pdf' : 'image/') : att.type;
    const isPdf = type.startsWith('application/pdf') || url.startsWith('data:application/pdf');

    const div = document.createElement('div');
    div.className = 'attachment-preview';

    if (isPdf) {
      // Style as beautiful PDF document preview card
      div.className += ' pdf-preview';
      div.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      div.style.border = '1px dashed rgba(239, 68, 68, 0.4)';
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      div.style.padding = '2px';
      div.title = name;

      // Icon
      const pdfIcon = document.createElement('div');
      pdfIcon.style.display = 'flex';
      pdfIcon.style.alignItems = 'center';
      pdfIcon.style.justifyContent = 'center';
      pdfIcon.innerHTML = `
        <svg class="icon" style="color: #ef4444; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      `;
      div.appendChild(pdfIcon);

      // Name label
      const label = document.createElement('span');
      label.innerText = 'PDF';
      label.style.fontSize = '8px';
      label.style.fontWeight = 'bold';
      label.style.color = '#ef4444';
      label.style.marginTop = '-2px';
      div.appendChild(label);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Attachment thumbnail';
      div.appendChild(img);
    }

    // Render loading or complete overlays/badges for local OCR progress
    if (att.ocrStatus === 'processing') {
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.backgroundColor = 'rgba(9, 9, 11, 0.75)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.color = 'var(--primary)';
      overlay.style.fontSize = '8px';
      overlay.style.fontWeight = 'bold';
      overlay.style.fontFamily = 'monospace';
      overlay.innerText = 'OCR...';
      div.style.position = 'relative';
      div.appendChild(overlay);
    } else if (att.ocrStatus === 'done' && att.ocrText) {
      const checkBadge = document.createElement('div');
      checkBadge.style.position = 'absolute';
      checkBadge.style.bottom = '1px';
      checkBadge.style.right = '1px';
      checkBadge.style.backgroundColor = 'rgba(52, 211, 153, 0.9)'; // Success color
      checkBadge.style.borderRadius = '50%';
      checkBadge.style.width = '10px';
      checkBadge.style.height = '10px';
      checkBadge.style.display = 'flex';
      checkBadge.style.alignItems = 'center';
      checkBadge.style.justifyContent = 'center';
      checkBadge.style.color = '#fff';
      checkBadge.style.fontSize = '6px';
      checkBadge.innerHTML = '✓';
      checkBadge.title = 'Local OCR successfully extracted text!';
      div.appendChild(checkBadge);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'attachment-remove-btn';
    removeBtn.innerText = '×';
    removeBtn.title = 'Remove';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      activeAttachments.splice(index, 1);
      renderAttachmentPreviews();
      updateSendButtonState();
    };

    div.appendChild(removeBtn);
    container.appendChild(div);
  });
};

// Syncs send button highlighted state
const updateSendButtonState = () => {
  if (isSending) {
    elements.sendBtn.classList.add('active');
    elements.sendBtn.classList.add('generating');
    elements.sendBtn.title = "Stop generating";
    elements.sendBtn.innerHTML = `
      <!-- Pause Icon -->
      <svg class="icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="4" width="4" height="16" rx="1"></rect>
        <rect x="15" y="4" width="4" height="16" rx="1"></rect>
      </svg>
    `;
  } else {
    elements.sendBtn.classList.remove('generating');
    elements.sendBtn.title = "Send Message";
    elements.sendBtn.innerHTML = `
      <!-- Send Icon -->
      <svg class="icon" style="width: 11px; height: 11px;" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    `;

    const hasText = elements.messageInput.value.trim().length > 0;
    const hasFiles = activeAttachments.length > 0;

    if (hasText || hasFiles) {
      elements.sendBtn.classList.add('active');
    } else {
      elements.sendBtn.classList.remove('active');
    }
  }
};

// Switch view screen layout
const switchView = (viewName) => {
  if (viewName === 'settings') {
    elements.chatView.classList.add('hidden');
    elements.settingsView.classList.remove('hidden');
    elements.settingsToggle.classList.add('active');
    toggleSidebar(false);
  } else {
    elements.settingsView.classList.add('hidden');
    elements.chatView.classList.remove('hidden');
    elements.settingsToggle.classList.remove('active');
    // Save settings implicitly if form changes
    renderActiveChat();
  }
};

// Sidebar drawer visibility control
const toggleSidebar = (forceState) => {
  const isShow = typeof forceState === 'boolean' ? forceState : !elements.sidebar.classList.contains('show');
  
  if (isShow) {
    elements.sidebar.classList.add('show');
    elements.sidebarBackdrop.classList.add('show');
  } else {
    elements.sidebar.classList.remove('show');
    elements.sidebarBackdrop.classList.remove('show');
    editingChatId = null;
    renderChatsList();
  }
};

// Save form credentials
const handleSaveSettings = async (e) => {
  if (e) e.preventDefault();

  settings = {
    baseUrl: elements.settingBaseUrl.value.trim() || DEFAULT_SETTINGS.baseUrl,
    apiKey: elements.settingApiKey.value.trim(),
    modelId: elements.settingModelId.value.trim() || DEFAULT_SETTINGS.modelId,
    systemPrompt: elements.settingSystemPrompt.value,
    temperature: parseFloat(elements.settingTemperature.value) || DEFAULT_SETTINGS.temperature,
    maxTokens: DEFAULT_SETTINGS.maxTokens,
    pdfPageLimit: elements.settingPdfPageLimit ? parseInt(elements.settingPdfPageLimit.value, 10) || DEFAULT_SETTINGS.pdfPageLimit : DEFAULT_SETTINGS.pdfPageLimit,
    forceVision: elements.settingForceVision ? elements.settingForceVision.checked : DEFAULT_SETTINGS.forceVision,
  };

  await setStorageItem(STORAGE_KEYS.SETTINGS, settings);
  updateAuthStatusHint();
  
  // Immediately trigger live dynamic vision capabilities verification
  triggerVisionTest(settings.modelId);

  switchView('chat');
};

// Diagnostic test endpoint credentials connection
const handleTestConnection = async () => {
  const tempBase = elements.settingBaseUrl.value.trim() || DEFAULT_SETTINGS.baseUrl;
  const tempKey = elements.settingApiKey.value.trim();
  const tempModel = elements.settingModelId.value.trim() || DEFAULT_SETTINGS.modelId;

  elements.testConnectionBtn.disabled = true;
  elements.testBtnText.innerText = 'Testing Connection...';
  elements.testBtnSparkle.classList.add('spinner');
  
  elements.testAlertBanner.classList.add('hidden');

  const url = `${tempBase.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (tempKey) headers['Authorization'] = `Bearer ${tempKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: tempModel,
        messages: [{ role: 'user', content: 'Say "Ok" in exactly one word.' }],
        temperature: 0.1,
        max_tokens: 5,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Connected';
      elements.testAlertBanner.className = 'alert-banner success';
      elements.testAlertBanner.innerHTML = `<strong>Success!</strong> API is fully responsive. Replied: "${reply}"`;
    } else {
      let details = `HTTP ${res.status} ${res.statusText}`;
      try {
        const err = await res.json();
        if (err?.error?.message) details = err.error.message;
      } catch (e) {}
      throw new Error(details);
    }
  } catch (err) {
    elements.testAlertBanner.className = 'alert-banner error';
    let msg = err.message || 'Network unreachable';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg += ' (This is likely due to iframe CORS blocks inside browser preview tools. Rest assured, browser extensions completely bypass CORS by design!)';
    }
    elements.testAlertBanner.innerHTML = `<strong>Connection Error:</strong> ${msg}`;
  } finally {
    elements.testAlertBanner.classList.remove('hidden');
    elements.testConnectionBtn.disabled = false;
    elements.testBtnText.innerText = 'Test API Connection';
    elements.testBtnSparkle.classList.remove('spinner');
  }
};

// Create a new empty chat conversation session
const handleCreateChat = async (presetTitle) => {
  const newChat = {
    id: 'chat_' + Date.now(),
    title: presetTitle || `New Chat (${chats.length + 1})`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  chats = [newChat, ...chats];
  activeChatId = newChat.id;

  await setStorageItem(STORAGE_KEYS.CHATS, chats);
  await setStorageItem(STORAGE_KEYS.ACTIVE_CHAT_ID, activeChatId);

  toggleSidebar(false);
  updateAuthStatusHint();
  renderChatsList();
  renderActiveChat();
};

// Render chats in sidebar list
const renderChatsList = () => {
  elements.chatsList.innerHTML = '';
  
  chats.forEach(chat => {
    const isActive = chat.id === activeChatId;
    const isEditing = chat.id === editingChatId;

    const div = document.createElement('div');
    div.className = `chat-item ${isActive ? 'active' : ''}`;
    div.id = `chat-item-${chat.id}`;

    if (isEditing) {
      // Inline rename textbox
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'chat-item-rename-input';
      input.value = chat.title;
      input.autofocus = true;
      
      const saveRename = async () => {
        const val = input.value.trim();
        if (val && val !== chat.title) {
          chat.title = val;
          chat.updatedAt = Date.now();
          await setStorageItem(STORAGE_KEYS.CHATS, chats);
          renderActiveChat();
        }
        editingChatId = null;
        renderChatsList();
      };

      input.addEventListener('blur', saveRename);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') {
          editingChatId = null;
          renderChatsList();
        }
      });
      
      div.appendChild(input);
    } else {
      // Standard list text and operations
      div.onclick = async () => {
        activeChatId = chat.id;
        await setStorageItem(STORAGE_KEYS.ACTIVE_CHAT_ID, activeChatId);
        toggleSidebar(false);
        renderChatsList();
        renderActiveChat();
      };

      const meta = document.createElement('div');
      meta.className = 'chat-item-meta';

      // SVG bubble icon
      meta.innerHTML = `
        <svg class="icon" style="color: ${isActive ? 'var(--primary)' : 'var(--text-muted)'}; width: 13px; height: 13px;" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="chat-item-title">${chat.title}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'chat-item-actions';

      // Rename button icon
      const renameBtn = document.createElement('button');
      renameBtn.className = 'chat-item-btn';
      renameBtn.title = 'Rename';
      renameBtn.innerHTML = '<svg class="icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        editingChatId = chat.id;
        renderChatsList();
      };

      // Delete button icon
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'chat-item-btn';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '<svg class="icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        chats = chats.filter(c => c.id !== chat.id);
        
        if (chats.length === 0) {
          activeChatId = null;
          await handleCreateChat();
        } else if (activeChatId === chat.id) {
          activeChatId = chats[0].id;
          await setStorageItem(STORAGE_KEYS.ACTIVE_CHAT_ID, activeChatId);
        }

        await setStorageItem(STORAGE_KEYS.CHATS, chats);
        updateAuthStatusHint();
        renderChatsList();
        renderActiveChat();
      };

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      
      div.appendChild(meta);
      div.appendChild(actions);
    }

    elements.chatsList.appendChild(div);
  });
};

// Render messages in currently active conversation session
const renderActiveChat = () => {
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Header Title Updates
  elements.headerChatTitle.innerText = chat.title;

  elements.messagesScreen.innerHTML = '';

  if (chat.messages.length === 0) {
    // Render starting layout welcome menu
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <div class="empty-icon-wrap">
        <svg class="icon" style="width: 20px; height: 20px;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <span class="empty-title">Welcome Session Ready</span>
      <p class="empty-desc">Your context-aware browser companion is initialized. Ask or click a quick prompt below to begin!</p>
      
      <div class="presets-grid">
        <button class="preset-btn" id="preset-1">💡 Explain manifest.json</button>
        <button class="preset-btn" id="preset-2">🎨 CSS Pulse animation</button>
        <button class="preset-btn" id="preset-3">⚙️ Extension storage vs localStorage</button>
      </div>
    `;
    elements.messagesScreen.appendChild(div);

    // Bind preset button triggers
    document.getElementById('preset-1').onclick = () => sendPreset('Explain browser extension manifest.json format in simple terms.');
    document.getElementById('preset-2').onclick = () => sendPreset('Write an elegant CSS pulse animation code block.');
    document.getElementById('preset-3').onclick = () => sendPreset('How does Chrome Extension local storage differ from standard localStorage?');
  } else {
    // Render System instructions indicators if set
    if (settings.systemPrompt && settings.systemPrompt.trim().length > 0) {
      const systemDiv = document.createElement('div');
      systemDiv.className = 'system-notice';
      systemDiv.innerHTML = `
        <div class="system-notice-pill">
          <svg class="icon" style="width: 10px; height: 10px; color: var(--primary);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>System prompt active (Default)</span>
        </div>
      `;
      elements.messagesScreen.appendChild(systemDiv);
    }

    // Append Chat logs
    chat.messages.forEach(msg => {
      const isUser = msg.role === 'user';
      const row = document.createElement('div');
      row.className = `message-row ${isUser ? 'user' : 'assistant'}`;

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      if (isUser) {
        let contentHtml = escapeHtml(msg.content || '');
        if (msg.attachments && msg.attachments.length > 0) {
          contentHtml += `<div class="msg-bubble-attachments" style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">`;
          msg.attachments.forEach(att => {
            const url = typeof att === 'string' ? att : att.url;
            const name = typeof att === 'string' ? 'Attachment' : att.name;
            const isPdf = url.startsWith('data:application/pdf') || url.includes('pdf');

            if (isPdf) {
              contentHtml += `
                <a href="${url}" download="${name}" class="pdf-attachment-link" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; color: var(--text-main); text-decoration: none; max-width: 220px; transition: background-color 0.2s;" title="Click to download ${escapeHtml(name)}">
                  <svg class="icon" style="color: #ef4444; width: 18px; height: 18px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; display: flex; flex-direction: column; text-align: left;">
                    <span style="font-weight: 500; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(name)}</span>
                    <span style="font-size: 8px; color: var(--text-muted);">PDF Document • Click to download</span>
                  </div>
                </a>
              `;
            } else {
              contentHtml += `<img src="${url}" style="max-width: 140px; max-height: 140px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); display: block;" />`;
            }
          });
          contentHtml += `</div>`;
        }
        bubble.innerHTML = contentHtml || '<span style="font-style: italic; color: var(--text-muted);">Sent attachment</span>';
      } else {
        bubble.className += ' formatted-text';
        bubble.innerHTML = extractThinkingAndFormat(msg.content || '', msg.id);
      }

      const meta = document.createElement('div');
      meta.className = 'message-meta';
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      meta.innerText = isUser ? timeStr : `${timeStr} • ${msg.model || settings.modelId}`;

      row.appendChild(bubble);
      row.appendChild(meta);
      elements.messagesScreen.appendChild(row);
    });

    // Render loading dot animation if typing
    if (isSending) {
      const loadingRow = document.createElement('div');
      loadingRow.className = 'message-row assistant';
      loadingRow.innerHTML = `
        <div class="message-bubble" style="padding: 6px 12px;">
          <div class="typing-dots">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
        <div class="message-meta">Generating response...</div>
      `;
      elements.messagesScreen.appendChild(loadingRow);
    }
  }

  // Scroll to bottom
  elements.messagesScreen.scrollTop = elements.messagesScreen.scrollHeight;
};

// Quick send action for presets
const sendPreset = (promptText) => {
  elements.messageInput.value = promptText;
  elements.sendBtn.classList.add('active');
  elements.inputForm.requestSubmit();
};

// Form Send Message Controller
const handleSendMessage = async (e) => {
  if (e) e.preventDefault();
  const inputVal = elements.messageInput.value.trim();
  const hasAttachments = activeAttachments.length > 0;
  if ((!inputVal && !hasAttachments) || isSending) return;

  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Wait for all active attachments' OCR tasks to finish (with a visual status or temporary indicator)
  const pendingOcrAttachments = activeAttachments.filter(att => att.ocrStatus === 'processing' && att.ocrPromise);
  if (pendingOcrAttachments.length > 0) {
    const sendBtnOriginalHtml = elements.sendBtn.innerHTML;
    elements.sendBtn.disabled = true;
    elements.sendBtn.innerHTML = `
      <svg class="icon spinner" style="width: 10px; height: 10px; margin-right: 2px;" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
      <span>OCR...</span>
    `;
    try {
      await Promise.all(pendingOcrAttachments.map(att => att.ocrPromise));
    } catch (e) {
      console.warn("Error waiting for pending OCR:", e);
    } finally {
      elements.sendBtn.disabled = false;
      elements.sendBtn.innerHTML = sendBtnOriginalHtml;
    }
  }

  // Preserve active attachments and clear immediately
  const msgAttachments = [...activeAttachments];
  activeAttachments = [];
  renderAttachmentPreviews();

  // Create User message payload
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: inputVal,
    attachments: msgAttachments,
    timestamp: Date.now(),
  };

  chat.messages.push(userMsg);
  chat.updatedAt = Date.now();

  // If chat list has no custom title, auto rename it based on first 4 words
  if (chat.messages.length === 1 && chat.title.startsWith('New Chat')) {
    const titleBase = inputVal || 'Image Query';
    const words = titleBase.split(/\s+/).slice(0, 4).join(' ');
    chat.title = words + (titleBase.split(/\s+/).length > 4 ? '...' : '');
  }

  // Update storage state
  await setStorageItem(STORAGE_KEYS.CHATS, chats);
  
  // Clear inputs
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  elements.sendBtn.classList.remove('active');
  
  isSending = true;
  activeAbortController = new AbortController();
  updateSendButtonState();
  renderChatsList();
  renderActiveChat();

  try {
    // Call the OpenAI-compatible API
    const aiReply = await sendChatApiRequest(chat);

    // Create assistant message
    const botMsg = {
      id: 'msg_' + (Date.now() + 1),
      role: 'assistant',
      content: aiReply,
      timestamp: Date.now(),
      model: settings.modelId,
    };

    chat.messages.push(botMsg);
    chat.updatedAt = Date.now();
    await setStorageItem(STORAGE_KEYS.CHATS, chats);
  } catch (error) {
    if (error.name === 'AbortError') {
      const stoppedMsg = {
        id: 'msg_' + (Date.now() + 1),
        role: 'assistant',
        content: `⏹️ **Generation stopped.**`,
        timestamp: Date.now(),
        model: settings.modelId,
      };
      chat.messages.push(stoppedMsg);
      chat.updatedAt = Date.now();
      await setStorageItem(STORAGE_KEYS.CHATS, chats);
    } else {
      console.error('API Error:', error);
      const errorMsg = {
        id: 'msg_' + (Date.now() + 1),
        role: 'assistant',
        content: `❌ **API Connection Error:** ${error.message || 'An unexpected error occurred.'}\n\nPlease check your credentials in settings.`,
        timestamp: Date.now(),
        model: 'Error Diagnostics',
      };
      chat.messages.push(errorMsg);
    }
  } finally {
    isSending = false;
    activeAbortController = null;
    renderActiveChat();
    updateSendButtonState();
  }
};

// Build messages query payload combining system prompts + message histories
const buildPayloadMessages = (chat) => {
  const payload = [];

  // 1. Add System Instructions
  if (settings.systemPrompt && settings.systemPrompt.trim().length > 0) {
    payload.push({
      role: 'system',
      content: settings.systemPrompt.trim()
    });
  }

  const supportsVision = doesModelSupportVision(settings.modelId);

  // 2. Add message context history
  chat.messages.forEach(m => {
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      let extraTextPrompt = '';
      const contentArray = [];
      
      m.attachments.forEach(att => {
        const url = typeof att === 'string' ? att : att.url;
        const name = typeof att === 'string' ? 'document.pdf' : att.name;
        const isPdf = url.startsWith('data:application/pdf') || url.includes('pdf');

        if (isPdf) {
          const extractedText = typeof att === 'object' && att.extractedText ? att.extractedText : '';
          
          // Only send rendered PDF page screenshots as visual images if the model supports vision
          if (supportsVision && typeof att === 'object' && att.renderedPages && att.renderedPages.length > 0) {
            att.renderedPages.forEach(page => {
              contentArray.push({
                type: 'image_url',
                image_url: { url: page.url }
              });
            });
          }

          if (extractedText) {
            extraTextPrompt += `\n\n[Content of PDF Document "${name}":]\n${extractedText}\n[End of PDF Document content]\n`;
          } else {
            extraTextPrompt += `\n[Attached PDF Document: ${name}]`;
          }
        } else {
          // It's an image
          const ocrText = typeof att === 'object' && att.ocrText ? att.ocrText : '';

          if (supportsVision) {
            contentArray.push({
              type: 'image_url',
              image_url: { url: url }
            });
            if (ocrText) {
              // Add OCR text helper to maximize visual analysis accuracy
              extraTextPrompt += `\n[Local OCR text extracted from image "${name}":]\n${ocrText}\n`;
            }
          } else {
            // Text-only fallback conversion: send the image converted into local OCR text
            extraTextPrompt += `\n\n[Image "${name}" - Converted to Text via Local OCR because AI model is text-only:]\n`;
            if (ocrText) {
              extraTextPrompt += ocrText;
            } else {
              extraTextPrompt += `(No text could be extracted or OCR is still processing)`;
            }
            extraTextPrompt += `\n[End of Image "${name}" content]\n`;
          }
        }
      });

      if (supportsVision) {
        // Add the final text block with fallback markers
        contentArray.unshift({
          type: 'text',
          text: (m.content || '') + extraTextPrompt
        });

        payload.push({
          role: m.role,
          content: contentArray
        });
      } else {
        // Text-only fallback payload (no images array, purely a text block)
        payload.push({
          role: m.role,
          content: (m.content || '') + extraTextPrompt
        });
      }
    } else {
      payload.push({
        role: m.role,
        content: m.content
      });
    }
  });

  return payload;
};

// Fallback message builder that strips base64 images but preserves full document/PDF extracted text & OCRs
const buildPayloadMessagesTextOnly = (chat) => {
  const payload = [];

  // 1. Add System Instructions
  if (settings.systemPrompt && settings.systemPrompt.trim().length > 0) {
    payload.push({
      role: 'system',
      content: settings.systemPrompt.trim()
    });
  }

  // 2. Add message context history with text descriptions only
  chat.messages.forEach(m => {
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      let extraTextPrompt = '';
      
      m.attachments.forEach(att => {
        const url = typeof att === 'string' ? att : att.url;
        const name = typeof att === 'string' ? 'Attachment' : att.name;
        const isPdf = url.startsWith('data:application/pdf') || url.includes('pdf');

        if (isPdf) {
          const extractedText = typeof att === 'object' && att.extractedText ? att.extractedText : '';
          if (extractedText) {
            extraTextPrompt += `\n\n[Content of PDF Document "${name}":]\n${extractedText}\n[End of PDF Document content]\n`;
          } else {
            extraTextPrompt += `\n[Attached PDF Document: ${name}]`;
          }
        } else {
          // Send local OCR text of the image as the ultimate text fallback
          const ocrText = typeof att === 'object' && att.ocrText ? att.ocrText : '';
          extraTextPrompt += `\n\n[Image "${name}" - Converted to Text via Local OCR (Text Fallback Mode):]\n`;
          if (ocrText) {
            extraTextPrompt += ocrText;
          } else {
            extraTextPrompt += `(No text could be extracted or OCR is still processing)`;
          }
          extraTextPrompt += `\n[End of Image "${name}" content]\n`;
        }
      });

      payload.push({
        role: m.role,
        content: (m.content || '') + extraTextPrompt
      });
    } else {
      payload.push({
        role: m.role,
        content: m.content
      });
    }
  });

  return payload;
};

// API chat completions client with automatic vision-to-text fallback resilience
const sendChatApiRequest = async (chat) => {
  const isOfficial = settings.baseUrl.includes('api.openai.com');
  if (!settings.apiKey && isOfficial) {
    throw new Error('API Key is missing for official OpenAI endpoints. Please configure it in settings.');
  }

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;

  const messagePayloads = buildPayloadMessages(chat);
  const hasImagesInPayload = messagePayloads.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      signal: activeAbortController ? activeAbortController.signal : undefined,
      body: JSON.stringify({
        model: settings.modelId || 'gpt-4o',
        messages: messagePayloads,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 1024,
      }),
    });
  } catch (fetchErr) {
    if (hasImagesInPayload && fetchErr.name !== 'AbortError') {
      console.warn("Multimodal request failed, retrying in text-only fallback mode:", fetchErr);
      const textOnlyPayload = buildPayloadMessagesTextOnly(chat);
      response = await fetch(url, {
        method: 'POST',
        headers,
        signal: activeAbortController ? activeAbortController.signal : undefined,
        body: JSON.stringify({
          model: settings.modelId || 'gpt-4o',
          messages: textOnlyPayload,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 1024,
        }),
      });
    } else {
      throw fetchErr;
    }
  }

  if (response && !response.ok) {
    if (hasImagesInPayload) {
      console.warn(`Multimodal request returned status ${response.status}. Retrying in text-only fallback mode...`);
      const textOnlyPayload = buildPayloadMessagesTextOnly(chat);
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers,
        signal: activeAbortController ? activeAbortController.signal : undefined,
        body: JSON.stringify({
          model: settings.modelId || 'gpt-4o',
          messages: textOnlyPayload,
          temperature: settings.temperature || 0.7,
          max_tokens: settings.maxTokens || 1024,
        }),
      });
      if (retryResponse.ok) {
        response = retryResponse;
      }
    }
  }

  if (!response.ok) {
    let errText = `Status ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) errText = errJson.error.message;
    } catch (e) {}
    throw new Error(errText);
  }

  const data = await response.json();
  console.log('API response payload:', data);

  let reply = '';
  let found = false;

  const salvageTextFromObject = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') {
      const trimmed = obj.trim();
      if (trimmed.startsWith('chatcmpl-') || trimmed.startsWith('gen-') || trimmed === 'assistant' || trimmed === 'user' || trimmed === 'stop' || trimmed === 'chat.completion') {
        return null;
      }
      return trimmed.length > 3 ? trimmed : null;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const foundStr = salvageTextFromObject(item);
        if (foundStr) return foundStr;
      }
    } else if (typeof obj === 'object') {
      const priorityKeys = ['content', 'text', 'message', 'body', 'output', 'reply', 'response', 'reasoning', 'thinking', 'thought', 'reasoning_content'];
      for (const key of priorityKeys) {
        if (key in obj) {
          const foundStr = salvageTextFromObject(obj[key]);
          if (foundStr) return foundStr;
        }
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const foundStr = salvageTextFromObject(obj[key]);
          if (foundStr) return foundStr;
        }
      }
    }
    return null;
  };

  if (data) {
    const message = data.choices?.[0]?.message;
    if (message) {
      if (typeof message.content === 'string') {
        reply = message.content;
        found = true;
      } else if (Array.isArray(message.content)) {
        const textParts = message.content
          .filter(part => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
          .map(part => part.text);
        if (textParts.length > 0) {
          reply = textParts.join('');
          found = true;
        }
      }

      // Handle extra reasoning fields (like deepseek reasoning_content or thinking blocks)
      if (message.reasoning_content && typeof message.reasoning_content === 'string') {
        reply = `<think>\n${message.reasoning_content}\n</think>\n\n` + reply;
        found = true;
      } else if (message.thinking && typeof message.thinking === 'string') {
        reply = `<think>\n${message.thinking}\n</think>\n\n` + reply;
        found = true;
      } else if (message.reasoning && typeof message.reasoning === 'string') {
        reply = `<think>\n${message.reasoning}\n</think>\n\n` + reply;
        found = true;
      } else if (message.thought && typeof message.thought === 'string') {
        reply = `<think>\n${message.thought}\n</think>\n\n` + reply;
        found = true;
      }
    } else if (data.choices?.[0]?.text && typeof data.choices[0].text === 'string') {
      reply = data.choices[0].text;
      found = true;
    } else if (data.text && typeof data.text === 'string') {
      reply = data.text;
      found = true;
    }

    // Ultimate fallback: recursively traverse the data object to salvage any text
    if (!found) {
      const salvaged = salvageTextFromObject(data);
      if (salvaged) {
        reply = salvaged;
        found = true;
      }
    }
  }

  // If we couldn't parse any response but there's a specific API error field
  if (!found && data?.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  // If still not parsed successfully
  if (!found) {
    throw new Error(`Response format unrecognized. Expected choices content, but received: ${JSON.stringify(data).substring(0, 250)}`);
  }

  return reply;
};

// Extracts any <thinking>, <thought>, or <think> tag structures from model response and styles them as a beautiful accordion
const extractThinkingAndFormat = (text, msgId) => {
  let thinkingBlocks = [];
  let remainingText = text;

  // Pattern matches case-insensitive <thinking>, <thought>, or <think> blocks
  // Handles unclosed tags too by matching up to end of string if close tag is missing
  const regex = /<(thinking|thought|think)>([\s\S]*?)(?:<\/\1>|$)/gi;
  
  remainingText = text.replace(regex, (match, tag, content) => {
    thinkingBlocks.push(content.trim());
    return '';
  });

  let html = '';
  if (thinkingBlocks.length > 0) {
    thinkingBlocks.forEach(content => {
      if (content.length > 0) {
        html += `
          <details class="thinking-container">
            <summary class="thinking-header">
              <!-- Thinking Sparkle / Mind icon -->
              <svg class="icon" style="color: var(--primary); width: 11px; height: 11px; animation: spin 8s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              </svg>
              <span>Thinking</span>
            </summary>
            <div class="thinking-content">${escapeHtml(content)}</div>
          </details>
        `;
      }
    });
  }

  // Format and append remaining text body
  html += formatMessageContent(remainingText.trim(), msgId);
  return html;
};

// Self-contained simple custom text renderer (parses triple-backticks code blocks, block math LaTeX, and inline formatting)
const formatMessageContent = (text, msgId) => {
  const parts = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const prevText = text.substring(lastIndex, match.index);
    if (prevText) parts.push({ type: 'text', content: prevText });
    
    parts.push({
      type: 'code',
      lang: match[1] || 'code',
      code: match[2],
      blockId: `${msgId}_code_${match.index}`
    });
    
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return parts.map(part => {
    if (part.type === 'code') {
      return `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-block-lang">${part.lang}</span>
            <button class="code-block-copy" data-block-id="${part.blockId}" id="btn-${part.blockId}">
              <!-- Copy Icon SVG -->
              <svg class="icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre class="code-block-content" id="pre-${part.blockId}">${escapeHtml(part.code)}</pre>
        </div>
      `;
    } else {
      // It's a text part. Let's first separate out block LaTeX equations from normal paragraphs
      const segments = [];
      let lastTextIdx = 0;
      const mathBlockRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
      let mathMatch;

      while ((mathMatch = mathBlockRegex.exec(part.content)) !== null) {
        const precedingText = part.content.substring(lastTextIdx, mathMatch.index);
        if (precedingText) {
          segments.push({ type: 'plain', content: precedingText });
        }

        let rawMatch = mathMatch[0];
        let formula = '';
        if (rawMatch.startsWith('$$')) {
          formula = rawMatch.slice(2, -2);
        } else {
          formula = rawMatch.slice(2, -2); // for \[ ... \]
        }
        segments.push({ type: 'math-block', formula: formula.trim() });
        lastTextIdx = mathBlockRegex.lastIndex;
      }

      if (lastTextIdx < part.content.length) {
        segments.push({ type: 'plain', content: part.content.substring(lastTextIdx) });
      }

      return segments.map(seg => {
        if (seg.type === 'math-block') {
          return renderMathToHtml(seg.formula, true);
        } else {
          // Regular paragraphs segment. Process line by line.
          const lines = seg.content.split('\n');
          return lines.map(line => {
            const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
            let content = isBullet ? line.trim().substring(2) : line;

            // Process inline math LaTeX: $ ... $ or \( ... \) BEFORE bold/inline-code to prevent tag conflicts
            const inlineMathRegex = /(\$[^\$\s](?:[^\$]*?[^\$\s])?\$|\\\([\s\S]+?\\\))/g;
            content = content.replace(inlineMathRegex, (m) => {
              let formula = '';
              if (m.startsWith('$')) {
                formula = m.slice(1, -1);
                // Exclude basic currency signs like $10 or $10.99 from LaTeX typesetting
                if (/^\d+(\.\d+)?$/.test(formula)) {
                  return m;
                }
              } else {
                formula = m.slice(2, -2);
              }

              return renderMathToHtml(formula.trim(), false);
            });

            // Parse Bold (**bold**) and inline code (`code`)
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/`(.*?)`/g, '<code>$1</code>');

            if (isBullet) {
              return `<ul style="margin-top: 3px; margin-bottom: 3px; padding-left: 16px; list-style-type: disc;"><li>${content}</li></ul>`;
            }
            return line.trim() === '' ? '<div style="height: 6px;"></div>' : `<p style="margin-bottom: 4px; line-height: 1.5;">${content}</p>`;
          }).join('');
        }
      }).join('');
    }
  }).join('');
};

// Highly robust local math formula compiler using inline-CSS & unicode replacement to run natively offline without remote CDNs
const renderMathToHtml = (formula, displayMode) => {
  let html = escapeHtml(formula);

  // Greek letters replacements
  const greekLetters = {
    '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\delta': 'δ',
    '\\\\epsilon': 'ε', '\\\\zeta': 'ζ', '\\\\eta': 'η', '\\\\theta': 'θ',
    '\\\\iota': 'ι', '\\\\kappa': 'κ', '\\\\lambda': 'λ', '\\\\mu': 'μ',
    '\\\\nu': 'ν', '\\\\xi': 'ξ', '\\\\pi': 'π', '\\\\rho': 'ρ',
    '\\\\sigma': 'σ', '\\\\tau': 'τ', '\\\\upsilon': 'υ', '\\\\phi': 'φ',
    '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\omega': 'ω',
    '\\\\Gamma': 'Γ', '\\\\Delta': 'Δ', '\\\\Theta': 'Θ', '\\\\Lambda': 'Λ',
    '\\\\Xi': 'Ξ', '\\\\Pi': 'Π', '\\\\Sigma': 'Σ', '\\\\Phi': 'Φ',
    '\\\\Psi': 'Ψ', '\\\\Omega': 'Ω'
  };

  for (const [key, val] of Object.entries(greekLetters)) {
    const regex = new RegExp(key, 'g');
    html = html.replace(regex, val);
  }

  // Common math symbols replacements
  const mathSymbols = {
    '\\\\infty': '∞', '\\\\times': '×', '\\\\div': '÷', '\\\\approx': '≈',
    '\\\\ne': '≠', '\\\\le': '≤', '\\\\ge': '≥', '\\\\pm': '±',
    '\\\\cdot': '•', '\\\\partial': '∂', '\\\\nabla': '∇', '\\\\sum': '∑',
    '\\\\int': '∫', '\\\\prod': '∏', '\\\\in': '∈', '\\\\notin': '∉',
    '\\\\forall': '∀', '\\\\exists': '∃', '\\\\rightarrow': '→',
    '\\\\leftarrow': '←', '\\\\leftrightarrow': '↔', '\\\\Rightarrow': '⇒',
    '\\\\Leftarrow': '⇐', '\\\\to': '→'
  };

  for (const [key, val] of Object.entries(mathSymbols)) {
    const regex = new RegExp(key, 'g');
    html = html.replace(regex, val);
  }

  // Handle fractions recursively to handle nested equations
  for (let i = 0; i < 4; i++) {
    html = html.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (match, num, den) => {
      return `<span style="display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; line-height: 1.1; padding: 0 4px;"><span style="border-bottom: 1px solid var(--text-main); padding-bottom: 2px; font-size: 0.95em;">${num}</span><span style="padding-top: 1.5px; font-size: 0.9em;">${den}</span></span>`;
    });
  }

  // Handle square roots recursively
  for (let i = 0; i < 4; i++) {
    html = html.replace(/\\sqrt\s*\{([^{}]+)\}/g, (match, inner) => {
      return `<span style="display: inline-flex; align-items: center; vertical-align: middle;"><span style="font-size: 1.15em; line-height: 1; margin-right: -1px; font-family: sans-serif; font-weight: 200;">√</span><span style="border-top: 1px solid var(--text-main); padding-top: 1px; font-size: 0.95em; margin-left: 1px;">${inner}</span></span>`;
    });
  }

  // Handle superscripts ^{...} and ^char
  html = html.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
  html = html.replace(/\^([0-9a-zA-Z+-=]+)/g, '<sup>$1</sup>');

  // Handle subscripts _{...} and _char
  html = html.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
  html = html.replace(/_([0-9a-zA-Z+-=]+)/g, '<sub>$1</sub>');

  // Handle formatting commands
  html = html.replace(/\\mathrm\s*\{([^{}]+)\}/g, '<span style="font-family: sans-serif;">$1</span>');
  html = html.replace(/\\mathbf\s*\{([^{}]+)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\mathcal\s*\{([^{}]+)\}/g, '<span style="font-family: cursive; font-style: italic;">$1</span>');
  html = html.replace(/\\text\s*\{([^{}]+)\}/g, '<span>$1</span>');
  
  html = html.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  html = html.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  html = html.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}');
  html = html.replace(/\\\{/g, '{').replace(/\\\}/g, '}');

  html = html.replace(/\\\\/g, '<br/>');
  html = html.replace(/\\/g, '');

  if (displayMode) {
    return `<div class="latex-block" style="font-family: var(--font-sans); font-size: 1.15em; line-height: 1.6; overflow-x: auto; display: block; text-align: center; padding: 12px; margin: 10px 0; background-color: rgba(24, 24, 27, 0.4); border-radius: 6px;">${html}</div>`;
  } else {
    return `<span class="latex-inline" style="font-family: var(--font-sans); font-size: 1.05em; line-height: 1.2; padding: 1px 4px; background-color: rgba(39, 39, 42, 0.3); border-radius: 3px;">${html}</span>`;
  }
};

// Utils: escape tags
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
// Launch App
init();
