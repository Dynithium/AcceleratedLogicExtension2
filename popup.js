/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Storage and State Keys
const STORAGE_KEYS = {
  SETTINGS: 'omnichat_settings',
  CHATS: 'omnichat_chats',
  ACTIVE_CHAT_ID: 'omnichat_active_chat_id',
};

const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelId: 'gpt-4o',
  systemPrompt: 'You are a helpful, context-aware AI assistant running inside a browser extension. Be concise, accurate, and direct.',
  temperature: 0.7,
  maxTokens: 1024,
};

// Global App State
let settings = { ...DEFAULT_SETTINGS };
let chats = [];
let activeChatId = null;
let isSending = false;
let editingChatId = null;
let activeAttachments = []; // Array of Base64 strings with data URI prefix

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
    
    // Clear warning banners
    elements.testAlertBanner.classList.add('hidden');
  });

  // Test diagnostic button trigger
  elements.testConnectionBtn.addEventListener('click', handleTestConnection);

  // Form Submission
  elements.settingsForm.addEventListener('submit', handleSaveSettings);
  elements.inputForm.addEventListener('submit', handleSendMessage);

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
      const imgFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imgFiles.length > 0) {
        handleFileSelect(imgFiles);
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
};

// Process newly added image files (converts to Base64 data urls)
const handleFileSelect = (files) => {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target.result;
      
      // Prevent duplicates
      if (!activeAttachments.includes(base64Url)) {
        activeAttachments.push(base64Url);
        renderAttachmentPreviews();
        updateSendButtonState();
      }
    };
    reader.readAsDataURL(file);
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

  activeAttachments.forEach((b64, index) => {
    const div = document.createElement('div');
    div.className = 'attachment-preview';

    const img = document.createElement('img');
    img.src = b64;
    img.alt = 'Attachment thumbnail';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'attachment-remove-btn';
    removeBtn.innerText = '×';
    removeBtn.title = 'Remove image';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      activeAttachments.splice(index, 1);
      renderAttachmentPreviews();
      updateSendButtonState();
    };

    div.appendChild(img);
    div.appendChild(removeBtn);
    container.appendChild(div);
  });
};

// Syncs send button highlighted state
const updateSendButtonState = () => {
  const hasText = elements.messageInput.value.trim().length > 0;
  const hasFiles = activeAttachments.length > 0;

  if (hasText || hasFiles) {
    elements.sendBtn.classList.add('active');
  } else {
    elements.sendBtn.classList.remove('active');
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
  };

  await setStorageItem(STORAGE_KEYS.SETTINGS, settings);
  updateAuthStatusHint();
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
          contentHtml += `<div class="msg-bubble-attachments" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">`;
          msg.attachments.forEach(url => {
            contentHtml += `<img src="${url}" style="max-width: 140px; max-height: 140px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); display: block;" />`;
          });
          contentHtml += `</div>`;
        }
        bubble.innerHTML = contentHtml || '<span style="font-style: italic; color: var(--text-muted);">Sent an image</span>';
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
    console.error('API Error:', error);
    const errorMsg = {
      id: 'msg_' + (Date.now() + 1),
      role: 'assistant',
      content: `❌ **API Connection Error:** ${error.message || 'An unexpected error occurred.'}\n\nPlease check your credentials in settings.`,
      timestamp: Date.now(),
      model: 'Error Diagnostics',
    };
    chat.messages.push(errorMsg);
  } finally {
    isSending = false;
    renderActiveChat();
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

  // 2. Add message context history
  chat.messages.forEach(m => {
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      const contentArray = [{ type: 'text', text: m.content || '' }];
      m.attachments.forEach(b64 => {
        contentArray.push({
          type: 'image_url',
          image_url: { url: b64 }
        });
      });
      payload.push({
        role: m.role,
        content: contentArray
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

// API chat completions client
const sendChatApiRequest = async (chat) => {
  const isOfficial = settings.baseUrl.includes('api.openai.com');
  if (!settings.apiKey && isOfficial) {
    throw new Error('API Key is missing for official OpenAI endpoints. Please configure it in settings.');
  }

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;

  const messagePayloads = buildPayloadMessages(chat);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.modelId || 'gpt-4o',
      messages: messagePayloads,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.maxTokens || 1024,
    }),
  });

  if (!response.ok) {
    let errText = `Status ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) errText = errJson.error.message;
    } catch (e) {}
    throw new Error(errText);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Response format is missing choices content.');

  return reply;
};

// Extracts any <thinking> or <thought> tag structures from model response and styles them as a beautiful accordion
const extractThinkingAndFormat = (text, msgId) => {
  let thinkingBlocks = [];
  let remainingText = text;

  // Pattern matches case-insensitive <thinking> or <thought> blocks
  // Handles unclosed tags too by matching up to end of string if close tag is missing
  const regex = /<(thinking|thought)>([\s\S]*?)(?:<\/\1>|$)/gi;
  
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
            <button class="code-block-copy" onclick="copySnippet('${part.blockId}')" id="btn-${part.blockId}">
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
          if (typeof katex !== 'undefined') {
            try {
              return `<div class="latex-block">${katex.renderToString(seg.formula, { displayMode: true, throwOnError: false })}</div>`;
            } catch (e) {
              return `<div class="latex-block-error">$$${escapeHtml(seg.formula)}$$</div>`;
            }
          } else {
            return `<pre class="latex-block-fallback">$$${escapeHtml(seg.formula)}$$</pre>`;
          }
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

              if (typeof katex !== 'undefined') {
                try {
                  return `<span class="latex-inline">${katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })}</span>`;
                } catch (e) {
                  return `<span class="latex-inline-error">${escapeHtml(m)}</span>`;
                }
              } else {
                return `<code>${escapeHtml(m)}</code>`;
              }
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

// Utils: escape tags
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Global clipboard copy helper accessible from HTML
window.copySnippet = (blockId) => {
  const element = document.getElementById(`pre-${blockId}`);
  if (!element) return;

  navigator.clipboard.writeText(element.innerText).then(() => {
    const btn = document.getElementById(`btn-${blockId}`);
    if (btn) {
      btn.innerHTML = `
        <svg class="icon" style="color: var(--success); width: 10px; height: 10px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span style="color: var(--success);">Copied!</span>
      `;
      setTimeout(() => {
        btn.innerHTML = `
          <svg class="icon" style="width: 10px; height: 10px;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        `;
      }, 1500);
    }
  });
};

// Launch App
init();
