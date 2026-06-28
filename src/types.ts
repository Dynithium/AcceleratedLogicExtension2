/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  temperature?: number;
}

export interface ExtensionSettings {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export type ViewMode = 'simulator' | 'standalone';
