import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import AiChat from "./AiChat";
import AiChatErrorBoundary from "./AiChatErrorBoundary";

const AiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Chat Window with Error Boundary */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] h-[550px] z-50 shadow-2xl rounded-lg overflow-hidden animate-slide-up">
          <AiChatErrorBoundary>
            <AiChat />
          </AiChatErrorBoundary>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? "bg-red-600 hover:bg-red-700"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        title={isOpen ? "Đóng chat" : "Mở trợ lý AI"}
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <MessageCircle className="w-7 h-7 text-white" />
        )}
      </button>
    </>
  );
};

export default AiChatWidget;
