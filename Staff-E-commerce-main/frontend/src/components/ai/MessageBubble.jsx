import { Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

/**
 * Component hiển thị một message bubble trong chat
 */
const MessageBubble = ({ msg }) => {
  let displayContent = msg.content || "";

  // Xóa marker [TOOL_COMPLETE]
  displayContent = displayContent.replace(/\[TOOL_COMPLETE\]/g, "");

  // CHỈ xóa dòng truy vấn khi STREAMING XONG
  if (!msg.isStreaming) {
    displayContent = displayContent
      .replace(/⏳[^⏳]*?Đang truy vấn[^\n]*\n*/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return (
    <div
      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          msg.role === "user"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {msg.role === "user" ? (
          <User className="w-5 h-5" />
        ) : (
          <Bot className="w-5 h-5" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          msg.role === "user"
            ? "bg-blue-600 text-white"
            : msg.isError
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        {msg.isStreaming && !msg.content ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang xử lý...</span>
          </div>
        ) : (
          <>
            {msg.role === "assistant" ? (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-2 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-th:bg-gray-100 prose-tr:border-b prose-table:border prose-table:border-gray-200 prose-table:rounded">
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
