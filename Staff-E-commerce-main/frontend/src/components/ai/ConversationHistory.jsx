import { Loader2, ChevronLeft, Plus, Trash2 } from "lucide-react";

/**
 * Component hiển thị lịch sử hội thoại
 */
const ConversationHistory = ({
  conversations,
  conversationId,
  loadingHistory,
  onBack,
  onNewConversation,
  onLoadConversation,
  onDeleteConversation,
  onDeleteAll,
}) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-blue-600 rounded-t-lg">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white">Lịch sử hội thoại</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={onNewConversation}
            className="flex-1 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Hội thoại mới</span>
          </button>
          {conversations.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center gap-2 transition"
              title="Xóa tất cả"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Conversation List */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Chưa có lịch sử hội thoại
          </p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onLoadConversation(conv.id)}
                className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition ${
                  conversationId === conv.id
                    ? "bg-blue-100 border border-blue-300"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {conv.title || "Cuộc hội thoại"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(conv.updatedAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationHistory;
