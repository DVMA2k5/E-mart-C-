import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Sparkles, History, Plus, X } from "lucide-react";
import { streamMessage, getConversations, getConversation, deleteConversation } from "../../api/aiApi";

// Sub-components
import MessageBubble from "./MessageBubble";
import ConversationHistory from "./ConversationHistory";

// Constants
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 20;

const AiChat = () => {
  // Load saved state from localStorage
  const getSavedConversationId = () => {
    try {
      const saved = localStorage.getItem("ai_chat_conversation_id");
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  };

  // State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(getSavedConversationId);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Save conversationId to localStorage
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem("ai_chat_conversation_id", conversationId.toString());
    }
  }, [conversationId]);

  // Welcome message
  const welcomeMessage = useMemo(() => ({
    id: "welcome",
    role: "assistant",
    content: `Xin chào! Tôi là trợ lý AI của hệ thống POS. Tôi có thể giúp bạn:

• Xem thống kê doanh thu, đơn hàng
• Tra cứu sản phẩm bán chạy
• Kiểm tra tồn kho
• Tìm kiếm khách hàng, đơn hàng
• Phân tích báo cáo kinh doanh

Bạn cần hỗ trợ gì?`,
  }), []);

  // Load saved conversation on mount
  useEffect(() => {
    const loadSavedConversation = async () => {
      const savedId = getSavedConversationId();
      if (savedId) {
        try {
          const data = await getConversation(savedId);
          if (data && data.messages && data.messages.length > 0) {
            setConversationId(savedId);
            setMessages(
              data.messages.map((m, index) => ({
                id: m.id || `msg-${index}`,
                role: m.role,
                content: m.content,
                functionCalled: m.functionCalled,
                data: m.data,
              }))
            );
            return;
          }
        } catch (err) {
          console.warn("Could not load saved conversation:", err);
          localStorage.removeItem("ai_chat_conversation_id");
          setConversationId(null);
        }
      }
      setMessages([welcomeMessage]);
    };

    loadSavedConversation();
  }, [welcomeMessage]);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data || []);
    } catch (err) {
      console.error("Lỗi tải lịch sử:", err);
      setError("Không thể tải lịch sử hội thoại");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load specific conversation
  const loadConversation = useCallback(async (id) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await getConversation(id);
      setConversationId(id);
      setMessages(
        data.messages.map((m, index) => ({
          id: m.id || `msg-${index}`,
          role: m.role,
          content: m.content,
          functionCalled: m.functionCalled,
          data: m.data,
        }))
      );
      setShowHistory(false);
    } catch (err) {
      console.error("Lỗi tải hội thoại:", err);
      setError("Không thể tải cuộc hội thoại");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setConversationId(null);
    localStorage.removeItem("ai_chat_conversation_id");
    setMessages([welcomeMessage]);
    setShowHistory(false);
    setError(null);
    setLoading(false);
  }, [welcomeMessage]);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Xóa cuộc hội thoại này?")) return;

    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewConversation();
      }
    } catch (err) {
      console.error("Lỗi xóa:", err);
      setError("Không thể xóa cuộc hội thoại");
    }
  }, [conversationId, startNewConversation]);

  // Delete all conversations
  const handleDeleteAllConversations = useCallback(async () => {
    if (conversations.length === 0) return;
    if (!window.confirm(`Xóa tất cả ${conversations.length} cuộc hội thoại?`)) return;

    try {
      await Promise.all(conversations.map((c) => deleteConversation(c.id)));
      setConversations([]);
      startNewConversation();
    } catch (err) {
      console.error("Lỗi xóa tất cả:", err);
      setError("Không thể xóa tất cả hội thoại");
      loadConversations();
    }
  }, [conversations, startNewConversation, loadConversations]);

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);

    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.isStreaming = false;
        lastMsg.content = lastMsg.content || "Đã hủy";
      }
      return newMessages;
    });
  }, []);

  // Build history for API
  const buildHistory = useCallback(() => {
    return messages
      .filter((m) => {
        if (m.id === "welcome") return false;
        if (!m.content || m.isStreaming) return false;
        return m.role === "user" || m.role === "assistant";
      })
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const userMessage = input.trim();

    if (!userMessage || loading) return;

    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Tin nhắn quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự)`);
      return;
    }

    setInput("");
    setError(null);

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: userMessage },
    ]);

    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    abortControllerRef.current = new AbortController();

    try {
      const history = buildHistory();
      let fullResponse = "";

      await streamMessage(
        userMessage,
        conversationId,
        history,
        (chunk) => {
          fullResponse += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.id === assistantMsgId) {
              lastMsg.content = fullResponse;
            }
            return [...newMessages];
          });
        },
        (newConvId) => {
          if (!conversationId && newConvId) {
            setConversationId(newConvId);
          }
        },
        abortControllerRef.current.signal
      );

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.id === assistantMsgId) {
          lastMsg.isStreaming = false;
        }
        return [...newMessages];
      });
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Request cancelled");
        return;
      }

      console.error("Stream error:", err);

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.id === assistantMsgId) {
          lastMsg.content = lastMsg.content || `Lỗi: ${err.message}`;
          lastMsg.isError = !lastMsg.content || lastMsg.content.startsWith("Lỗi:");
          lastMsg.isStreaming = false;
        }
        return [...newMessages];
      });

      setError(err.message);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  // History Panel
  if (showHistory) {
    return (
      <ConversationHistory
        conversations={conversations}
        conversationId={conversationId}
        loadingHistory={loadingHistory}
        onBack={() => setShowHistory(false)}
        onNewConversation={startNewConversation}
        onLoadConversation={loadConversation}
        onDeleteConversation={handleDeleteConversation}
        onDeleteAll={handleDeleteAllConversations}
      />
    );
  }

  // Main Chat View
  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-blue-600 rounded-t-lg">
        <div className="p-2 bg-blue-500 rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">Trợ lý AI</h2>
          <p className="text-sm text-blue-100">Hỗ trợ quản lý cửa hàng</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startNewConversation}
            className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition"
            title="Cuộc hội thoại mới"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              loadConversations();
              setShowHistory(true);
            }}
            className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition"
            title="Lịch sử hội thoại"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập câu hỏi của bạn..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
            maxLength={MAX_MESSAGE_LENGTH}
          />
          {loading ? (
            <button
              type="button"
              onClick={cancelRequest}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
              title="Hủy"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AiChat;
