/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chat, ExtensionSettings } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'omnichat_settings',
  CHATS: 'omnichat_chats',
  ACTIVE_CHAT_ID: 'omnichat_active_chat_id',
};

const DEFAULT_SETTINGS: ExtensionSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelId: 'gpt-4o',
  systemPrompt: 'You are a helpful, context-aware AI assistant running inside a browser extension. Be concise, accurate, and direct.',
  temperature: 0.7,
  maxTokens: 1024,
};

// Check if chrome.storage is available
const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && chrome.storage !== undefined && chrome.storage.local !== undefined;
};

export const getSettings = async (): Promise<ExtensionSettings> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
        const stored = result[STORAGE_KEYS.SETTINGS] as any;
        resolve(stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS);
      });
    });
  } else {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch (e) {
      console.error('Failed to parse settings from localStorage', e);
      return DEFAULT_SETTINGS;
    }
  }
};

export const saveSettings = async (settings: ExtensionSettings): Promise<void> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
        resolve();
      });
    });
  } else {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
};

export const getChats = async (): Promise<Chat[]> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.CHATS], (result) => {
        const stored = result[STORAGE_KEYS.CHATS] as Chat[] | undefined;
        resolve(stored || []);
      });
    });
  } else {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHATS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse chats from localStorage', e);
      return [];
    }
  }
};

export const saveChats = async (chats: Chat[]): Promise<void> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.CHATS]: chats }, () => {
        resolve();
      });
    });
  } else {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  }
};

export const getActiveChatId = async (): Promise<string | null> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.ACTIVE_CHAT_ID], (result) => {
        const activeId = result[STORAGE_KEYS.ACTIVE_CHAT_ID] as string | undefined;
        resolve(activeId || null);
      });
    });
  } else {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID) || null;
  }
};

export const saveActiveChatId = async (id: string | null): Promise<void> => {
  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_CHAT_ID]: id }, () => {
        resolve();
      });
    });
  } else {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    }
  }
};
