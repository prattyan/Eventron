import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_GEMINI_API_KEY) return String(import.meta.env.VITE_GEMINI_API_KEY);
    if (import.meta.env.GEMINI_API_KEY) return String(import.meta.env.GEMINI_API_KEY);
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_GEMINI_API_KEY) return String(process.env.VITE_GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY) return String(process.env.GEMINI_API_KEY);
    if (process.env.API_KEY) return String(process.env.API_KEY);
  }
  return '';
};

export const isGeminiConfigured = (): boolean => {
  const key = getApiKey();
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed.length < 10 ||
    trimmed === 'your_google_gemini_key' ||
    trimmed === 'YOUR_API_KEY' ||
    trimmed === 'YOUR_GEMINI_API_KEY' ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return false;
  }
  return true;
};

export interface GeminiStatusState {
  isConfigured: boolean;
  isOnline: boolean;
  status: 'online' | 'offline' | 'checking';
  reason: 'missing_key' | 'invalid_key' | 'suspended_account' | 'network_error' | 'ok' | null;
  errorMessage: string | null;
  lastChecked: number | null;
}

export interface GeminiErrorDetails {
  isAuthOrStateError: boolean;
  message: string;
}

export const parseGeminiError = (error: any): GeminiErrorDetails => {
  if (!error) {
    return { isAuthOrStateError: false, message: "Unknown error occurred" };
  }

  const rawMessage = typeof error === 'string' ? error : (error.message || JSON.stringify(error));

  // Try parsing JSON if error.message is stringified JSON
  try {
    const parsed = typeof rawMessage === 'string' && (rawMessage.startsWith('{') || rawMessage.includes('{"error"'))
      ? JSON.parse(rawMessage.substring(rawMessage.indexOf('{')))
      : null;

    if (parsed && parsed.error) {
      const { code, message, status, details } = parsed.error;
      const reason = details?.[0]?.reason || '';

      if (
        code === 401 ||
        code === 403 ||
        status === 'UNAUTHENTICATED' ||
        status === 'PERMISSION_DENIED' ||
        reason === 'ACCOUNT_STATE_INVALID' ||
        reason === 'API_KEY_INVALID' ||
        (message && (
          message.includes('deleted or disabled') ||
          message.includes('API key') ||
          message.includes('suspended') ||
          message.includes('not valid')
        ))
      ) {
        return {
          isAuthOrStateError: true,
          message: message || "The Gemini API key or bound service account is disabled, suspended, or invalid."
        };
      }
      return { isAuthOrStateError: false, message: message || "Gemini API error" };
    }
  } catch {
    // Continue to substring checks
  }

  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('deleted or disabled') ||
    lower.includes('account_state_invalid') ||
    lower.includes('unauthenticated') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api key expired') ||
    lower.includes('permission_denied') ||
    lower.includes('suspended')
  ) {
    let cleanMsg = "The Gemini API key or bound service account is disabled, suspended, or invalid.";
    if (lower.includes('deleted or disabled')) {
      cleanMsg = "The service account bound to the Gemini API key is deleted or disabled.";
    } else if (lower.includes('expired')) {
      cleanMsg = "The Gemini API key has expired.";
    } else if (lower.includes('api key not valid') || lower.includes('api_key_invalid')) {
      cleanMsg = "The Gemini API key is invalid.";
    }
    return { isAuthOrStateError: true, message: cleanMsg };
  }

  return { isAuthOrStateError: false, message: rawMessage };
};

let currentStatus: GeminiStatusState = {
  isConfigured: isGeminiConfigured(),
  isOnline: false,
  status: isGeminiConfigured() ? 'checking' : 'offline',
  reason: isGeminiConfigured() ? null : 'missing_key',
  errorMessage: isGeminiConfigured() ? null : 'Gemini API key is not configured in .env',
  lastChecked: null,
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

let aiInstance: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI | null => {
  if (!isGeminiConfigured()) {
    return null;
  }
  if (!aiInstance) {
    try {
      const apiKey = getApiKey().trim();
      aiInstance = new GoogleGenAI({ apiKey });
    } catch (error) {
      console.warn("Failed to initialize GoogleGenAI client:", error);
      return null;
    }
  }
  return aiInstance;
};

export const checkGeminiHealth = async (force: boolean = false): Promise<GeminiStatusState> => {
  if (!isGeminiConfigured()) {
    updateStatus({
      isConfigured: false,
      isOnline: false,
      status: 'offline',
      reason: 'missing_key',
      errorMessage: 'Gemini API key is not configured in .env',
      lastChecked: Date.now()
    });
    return currentStatus;
  }

  // Cache check for 60 seconds if not forced
  if (!force && currentStatus.lastChecked && Date.now() - currentStatus.lastChecked < 60000 && currentStatus.status !== 'checking') {
    return currentStatus;
  }

  const ai = getAIClient();
  if (!ai) {
    updateStatus({
      isConfigured: false,
      isOnline: false,
      status: 'offline',
      reason: 'missing_key',
      errorMessage: 'Unable to initialize Gemini client',
      lastChecked: Date.now()
    });
    return currentStatus;
  }

  updateStatus({ status: 'checking' });

  try {
    // Perform a lightweight getModel call to verify active API key and service account
    await ai.models.get({ model: "gemini-3.6-flash" });

    updateStatus({
      isConfigured: true,
      isOnline: true,
      status: 'online',
      reason: 'ok',
      errorMessage: null,
      lastChecked: Date.now()
    });
  } catch (error: any) {
    const errorDetails = parseGeminiError(error);
    console.warn("Gemini health check failed:", errorDetails.message);

    updateStatus({
      isConfigured: true,
      isOnline: false,
      status: 'offline',
      reason: errorDetails.isAuthOrStateError ? 'suspended_account' : 'network_error',
      errorMessage: errorDetails.message,
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
  if (!isGeminiConfigured() || !currentStatus.isOnline) {
    console.warn("Gemini API is offline or not configured. Skipping event description generation.");
    return null;
  }

  const ai = getAIClient();
  if (!ai) return null;

  try {
    const prompt = `
      You are an expert event planner. Write a compelling, professional, and exciting description for an event.
      
      Event Details:
      Title: ${title}
      Date: ${date}
      Location: ${location}

      Requirements:
      1. Two concise paragraphs engaging the potential attendee.
      2. A suggested simplified agenda (3-4 bullet points) formatted cleanly.
      3. Tone: Professional yet enthusiastic.
      4. Return ONLY the text, no markdown code blocks.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const text = response.text;
    return text?.trim() || null;
  } catch (error: any) {
    const errorDetails = parseGeminiError(error);
    console.error("Gemini API Error details:", errorDetails.message);
    if (errorDetails.isAuthOrStateError) {
      updateStatus({
        isOnline: false,
        status: 'offline',
        reason: 'suspended_account',
        errorMessage: errorDetails.message,
        lastChecked: Date.now()
      });
    }
    return `Error: ${errorDetails.message}`;
  }
};

export const getEventRecommendations = async (
  pastEvents: { title: string; description: string; type: string }[],
  upcomingEvents: { id: string; title: string; description: string; date: string; type: string }[]
): Promise<string[]> => {
  if (pastEvents.length === 0 || upcomingEvents.length === 0) return [];
  if (!isGeminiConfigured() || !currentStatus.isOnline) {
    return [];
  }

  const ai = getAIClient();
  if (!ai) return [];

  try {
    const pastEventsContext = pastEvents.map(e => `- ${e.title} (${e.type}): ${e.description.substring(0, 100)}...`).join('\n');
    const upcomingEventsContext = upcomingEvents.map(e => `ID: ${e.id} | Title: ${e.title} (${e.type}) | Desc: ${e.description.substring(0, 100)}...`).join('\n');

    const prompt = `
      As an AI Recommender System, analyze the user's past event attendance and recommend the top 3 most relevant upcoming events.

      User's Past Events:
      ${pastEventsContext}

      Available Upcoming Events:
      ${upcomingEventsContext}

      Task:
      1. Identify patterns in the user's interests based on past events.
      2. Match these interests with the upcoming events.
      3. Return ONLY a JSON array of the top 3 matching Event IDs. Do not include any explanations or markdown formatting.
      Example Output: ["ev_123", "ev_456", "ev_789"]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const text = response.text ?? "";
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const recommendedIds = JSON.parse(cleanedText);

    return Array.isArray(recommendedIds) ? recommendedIds : [];
  } catch (error: any) {
    const errorDetails = parseGeminiError(error);
    console.error("Gemini Recommendation Error:", errorDetails.message);
    if (errorDetails.isAuthOrStateError) {
      updateStatus({
        isOnline: false,
        status: 'offline',
        reason: 'suspended_account',
        errorMessage: errorDetails.message,
        lastChecked: Date.now()
      });
    }
    return [];
  }
};

export const chatWithAI = async (
  query: string,
  eventsContext: { title: string; date: string; location: string; description: string; type: string; isPaid?: boolean; price?: number; capacity?: number }[]
): Promise<string> => {
  if (!isGeminiConfigured()) {
    return "⚠️ **AI Assistant Offline**\n\nThe Gemini API key is not configured. Please set `VITE_GEMINI_API_KEY` in your `.env` file.";
  }

  const ai = getAIClient();
  if (!ai) {
    return "⚠️ **AI Assistant Offline**\n\nThe AI assistant client could not be initialized.";
  }

  try {
    const eventsSummary = eventsContext.map(e =>
      `- ${e.title} (${e.type}) on ${e.date} at ${e.location}. Price: ${e.isPaid ? `₹${e.price}` : 'Free'}. Capacity: ${e.capacity}. Details: ${e.description.substring(0, 150)}...`
    ).join('\n');

    const currentDateTime = new Date().toLocaleString();

    const prompt = `
      You are an intelligent virtual assistant for an event management platform called "Eventron".
      Your role is to help users find information about events based on the provided list.

      Current Date: ${currentDateTime}

      Context - Available Events:
      ${eventsSummary}

      User Query: "${query}"

      Instructions:
      1. Answer the user's question accurately based ONLY on the provided event context.
      2. If the user asks for "upcoming" events, strictly ONLY list events scheduled AFTER the Current Date provided above. Do not list events that have already passed.
      3. If the user asks about something not in the list, politely say you don't have information on that.
      4. Be helpful, concise, and professional.
      5. If recommending an event, mention its title and date.
      6. Do not invent facts.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    // If previously marked offline or checking, update to online
    if (!currentStatus.isOnline) {
      updateStatus({
        isOnline: true,
        status: 'online',
        reason: 'ok',
        errorMessage: null,
        lastChecked: Date.now()
      });
    }

    const text = response.text;
    return text?.trim() || "I apologize, but I couldn't process your request at the moment.";
  } catch (error: any) {
    const errorDetails = parseGeminiError(error);
    console.error("Gemini Chat Error:", errorDetails.message);

    // If it's an authentication or account state error (suspended/disabled/invalid), immediately mark as offline
    if (errorDetails.isAuthOrStateError) {
      updateStatus({
        isOnline: false,
        status: 'offline',
        reason: 'suspended_account',
        errorMessage: errorDetails.message,
        lastChecked: Date.now()
      });

      return `⚠️ **AI Assistant Offline**\n\n${errorDetails.message}\n\nPlease update your \`VITE_GEMINI_API_KEY\` with an active Google Gemini key in the \`.env\` file.`;
    }

    return `⚠️ **Error communicating with Gemini**: ${errorDetails.message}. Please try again later.`;
  }
};