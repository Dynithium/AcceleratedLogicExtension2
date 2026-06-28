/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chat, ExtensionSettings, Message } from '../types';

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

/**
 * Clean up the system prompt and merge it with the history of messages
 */
export const buildApiMessages = (
  chat: Chat,
  settings: ExtensionSettings
): { role: 'system' | 'user' | 'assistant'; content: string }[] => {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

  // Add system prompt if configured
  const activeSystemPrompt = chat.systemPrompt || settings.systemPrompt;
  if (activeSystemPrompt.trim()) {
    messages.push({
      role: 'system',
      content: activeSystemPrompt.trim(),
    });
  }

  // Add previous messages (filtering out local metadata if any)
  chat.messages.forEach((msg) => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  return messages;
};

/**
 * Sends a chat message and returns the response content
 */
export const sendChatMessage = async (
  chat: Chat,
  settings: ExtensionSettings
): Promise<string> => {
  if (!settings.apiKey && settings.baseUrl.includes('api.openai.com')) {
    throw new Error('API Key is required for official OpenAI endpoints. Please set it in Settings.');
  }

  const messagesPayload = buildApiMessages(chat, settings);
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.modelId || 'gpt-4o',
      messages: messagesPayload,
      temperature: chat.temperature !== undefined ? chat.temperature : settings.temperature,
      max_tokens: settings.maxTokens || 1024,
    }),
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch (e) {
      // If parsing fails, use fallback error message
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice || !choice.message?.content) {
    throw new Error('Invalid API response format: No message content returned.');
  }

  return choice.message.content;
};

/**
 * Tests connection with a very small prompt
 */
export const testApiConnection = async (settings: ExtensionSettings): Promise<TestConnectionResult> => {
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.modelId || 'gpt-4o',
        messages: [
          { role: 'user', content: 'Say "Ready" in exactly one word.' }
        ],
        temperature: 0.1,
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      let msg = `Status ${response.status}`;
      try {
        const err = await response.json();
        if (err?.error?.message) msg = err.error.message;
      } catch (e) {}
      return { success: false, message: msg };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Connected';
    return { success: true, message: `Successfully connected! API replied: "${reply}"` };
  } catch (error: any) {
    console.error('Test connection error:', error);
    let errorDetail = error.message || 'Unknown network error';
    
    // Add context about CORS for web preview
    if (errorDetail.includes('Failed to fetch') || errorDetail.includes('NetworkError')) {
      errorDetail += ' (This might be a browser CORS restriction in the iframe preview. Rest assured, this will connect perfectly when loaded as an unpacked browser extension!)';
    }
    
    return {
      success: false,
      message: errorDetail,
    };
  }
};
