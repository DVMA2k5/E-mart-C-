import { getAuthToken } from "./apiClient";

const BASE_URL = "http://localhost:5099/api";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

function getHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 */
const isRetryableError = (error, response) => {
  if (response) {
    // Retry on server errors and rate limiting
    return response.status >= 500 || response.status === 429;
  }
  // Retry on network errors
  return error.name === 'TypeError' || error.message.includes('fetch');
};

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (isRetryableError(null, response) && attempt < retries) {
          console.warn(`Request failed with ${response.status}, retrying (${attempt}/${retries})...`);
          await sleep(RETRY_DELAY * attempt);
          continue;
        }
        
        // Clone response để có thể đọc lại nếu cần
        const clonedResponse = response.clone();
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch {
          try {
            errorMessage = await clonedResponse.text() || `HTTP ${response.status}`;
          } catch {
            errorMessage = `HTTP ${response.status}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (isRetryableError(error, null) && attempt < retries) {
        console.warn(`Network error, retrying (${attempt}/${retries})...`, error.message);
        await sleep(RETRY_DELAY * attempt);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Gửi tin nhắn đến AI và nhận phản hồi (non-streaming)
 * @param {string} message - Câu hỏi của người dùng
 * @param {number|null} conversationId - ID cuộc hội thoại (null = tạo mới)
 * @returns {Promise<{success: boolean, response: string, error?: string, conversationId?: number}>}
 */
export async function sendMessage(message, conversationId = null) {
  const response = await fetchWithRetry(`${BASE_URL}/ai/chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message, conversationId }),
  });

  return response.json();
}

/**
 * Gửi tin nhắn đến AI và nhận phản hồi dạng STREAM
 * @param {string} message - Câu hỏi
 * @param {number|null} conversationId - ID hội thoại
 * @param {Array<{role: string, content: string}>} history - Lịch sử chat từ frontend
 * @param {function} onChunk - Callback nhận từng đoạn text: (text) => void
 * @param {function} onConversationId - Callback nhận conversationId: (id) => void
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<void>}
 */
export async function streamMessage(
  message, 
  conversationId, 
  history, 
  onChunk, 
  onConversationId = null,
  signal = null
) {
  const fetchOptions = {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message, conversationId, history }),
  };

  if (signal) {
    fetchOptions.signal = signal;
  }

  // Stream requests should not retry mid-stream
  const response = await fetch(`${BASE_URL}/ai/stream`, fetchOptions);

  if (!response.ok) {
    // Clone response để có thể đọc lại nếu cần
    const clonedResponse = response.clone();
    let errorMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || `HTTP ${response.status}`;
    } catch {
      try {
        errorMessage = await clonedResponse.text() || `HTTP ${response.status}`;
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          
          if (data === "[DONE]") {
            return;
          }

          try {
            const json = JSON.parse(data);
            
            if (json.error) {
              throw new Error(json.error);
            }

            if (json.conversationId && onConversationId) {
              onConversationId(json.conversationId);
            }

            if (json.content) {
              onChunk(json.content);
            }
          } catch (e) {
            if (e.message && !e.message.includes("JSON")) {
              throw e; // Re-throw actual errors
            }
            console.warn("Lỗi parse stream chunk:", e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Lấy danh sách cuộc hội thoại của user
 * @returns {Promise<Array<{id: number, title: string, createdAt: string, updatedAt: string}>>}
 */
export async function getConversations() {
  const response = await fetchWithRetry(`${BASE_URL}/ai/conversations`, {
    headers: getHeaders(),
  });

  return response.json();
}

/**
 * Lấy chi tiết cuộc hội thoại với messages
 * @param {number} id - ID cuộc hội thoại
 * @returns {Promise<{id: number, title: string, messages: Array}>}
 */
export async function getConversation(id) {
  if (!id || id <= 0) {
    throw new Error("ID cuộc hội thoại không hợp lệ");
  }

  const response = await fetchWithRetry(`${BASE_URL}/ai/conversations/${id}`, {
    headers: getHeaders(),
  });

  return response.json();
}

/**
 * Xóa cuộc hội thoại
 * @param {number} id - ID cuộc hội thoại
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteConversation(id) {
  if (!id || id <= 0) {
    throw new Error("ID cuộc hội thoại không hợp lệ");
  }

  const response = await fetchWithRetry(`${BASE_URL}/ai/conversations/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return response.json();
}

/**
 * Kiểm tra trạng thái AI service
 * @returns {Promise<{status: string, message: string}>}
 */
export async function checkHealth() {
  const response = await fetch(`${BASE_URL}/ai/health`);

  if (!response.ok) {
    throw new Error("AI Service không khả dụng");
  }

  return response.json();
}
