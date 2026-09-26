import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Error Boundary cho AI Chat component
 * Bắt lỗi runtime và hiển thị fallback UI thay vì white screen
 */
class AiChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error to console (có thể gửi đến error tracking service)
    console.error("AiChat Error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b bg-red-600 rounded-t-lg">
            <div className="p-2 bg-red-500 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Lỗi xảy ra</h2>
              <p className="text-sm text-red-100">AI Chat gặp sự cố</p>
            </div>
          </div>

          {/* Error Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Đã xảy ra lỗi
            </h3>
            <p className="text-gray-600 mb-4 max-w-xs">
              AI Chat gặp sự cố không mong muốn. Vui lòng thử lại hoặc tải lại trang.
            </p>

            {/* Error details (chỉ hiện trong development) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-4 text-left w-full max-w-md">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Chi tiết lỗi (Dev only)
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AiChatErrorBoundary;
