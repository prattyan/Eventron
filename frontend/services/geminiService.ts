export type AIProvider = 'gemini' | 'groq' | null;

export interface GeminiStatusState {
  isConfigured: boolean;
  isOnline: boolean;
  status: 'online' | 'offline' | 'checking';
  reason: 'missing_key' | 'network_error' | 'ok' | null;
  errorMessage: string | null;
  lastChecked: number | null;
  activeProvider: AIProvider;
}

const baseUrl = import.meta.env.PROD ? '' : 'http://127.0.0.1:5005';

let currentStatus: GeminiStatusState = {
  isConfigured: false,
  isOnline: false,
  status: 'checking',
  reason: null,
  errorMessage: null,
  lastChecked: null,
  activeProvider: null,
};

const listeners = new Set<(status: GeminiStatusState) => void>();

export const getGeminiStatus = (): GeminiStatusState => ({ ...currentStatus });

export const onGeminiStatusChange = (listener: (status: GeminiStatusState) => void): (() => void) => {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
};

const updateStatus = (updates: Partial<GeminiStatusState>) => {
  currentStatus = { ...currentStatus, ...updates };
  listeners.forEach(cb => {
    try {
      cb(currentStatus);
    } catch (e) {
      console.error("Error in status listener:", e);
    }
  });
};

export const checkGeminiHealth = async (force: boolean = false): Promise<GeminiStatusState> => {
  if (!force && currentStatus.lastChecked && Date.now() - currentStatus.lastChecked < 60000 && currentStatus.status !== 'checking') {
    return currentStatus;
  }

  updateStatus({ status: 'checking' });

  try {
    const response = await fetch(`${baseUrl}/api/ai/status`);
    if (!response.ok) throw new Error('Status check failed');
    
    const data = await response.json();
    
    if (data.configured) {
      updateStatus({
        isConfigured: true,
        isOnline: true,
        status: 'online',
        reason: 'ok',
        errorMessage: null,
        activeProvider: data.activeProvider,
        lastChecked: Date.now()
      });
    } else {
      updateStatus({
        isConfigured: false,
        isOnline: false,
        status: 'offline',
        reason: 'missing_key',
        errorMessage: 'AI keys not configured on server',
        activeProvider: null,
        lastChecked: Date.now()
      });
    }
  } catch (error: any) {
    updateStatus({
      isConfigured: false,
      isOnline: false,
      status: 'offline',
      reason: 'network_error',
      errorMessage: 'Cannot connect to AI service',
      activeProvider: null,
      lastChecked: Date.now()
    });
  }

  return currentStatus;
};

// Initial health check trigger in background
if (typeof window !== 'undefined') {
  setTimeout(() => {
    checkGeminiHealth();
  }, 100);
}

export const generateEventDescription = async (title: string, date: string, location: string): Promise<string | null> => {
  try {
    const response = await fetch(`${baseUrl}/api/ai/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, location })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.description || null;
  } catch (error) {
    console.error("Failed to generate description via backend:", error);
    return null;
  }
};

export const getEventRecommendations = async (
  pastEvents: any[],
  upcomingEvents: any[]
): Promise<string[]> => {
  // Now relies purely on the backend's vector embeddings endpoint /api/recommendations which we don't handle directly here, 
  // but to keep the frontend types happy if it's imported somewhere:
  console.warn("getEventRecommendations should be handled via the backend's /api/recommendations endpoint using the storageService.");
  return [];
};

export const streamChatWithAI = async (
  query: string,
  eventsContext: any[],
  onChunk: (chunkText: string, fullTextSoFar: string) => void
): Promise<string> => {
  
  if (!currentStatus.isConfigured && currentStatus.status !== 'checking') {
    const msg = "⚠️ **AI Assistant Offline**\n\nThe AI API keys are not configured on the server.";
    onChunk(msg, msg);
    return msg;
  }

  let fullText = '';
  try {
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context: eventsContext })
    });

    if (!response.ok || !response.body) {
      throw new Error("Chat request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.text) {
            fullText += parsed.text;
            onChunk(parsed.text, fullText);
          }
        } catch {
          // Ignore parse errors on chunks
        }
      }
    }
    
    return fullText || "I couldn't process your request at the moment.";
  } catch (error) {
    const msg = `⚠️ **Error communicating with AI Assistant**. Please try again later.`;
    if (!fullText) onChunk(msg, msg);
    return fullText || msg;
  }
};

export const chatWithAI = async (
  query: string,
  eventsContext: any[]
): Promise<string> => {
  return streamChatWithAI(query, eventsContext, () => {});
};