using Microsoft.AspNetCore.Mvc;

namespace backend.Helpers
{
    /// <summary>
    /// Unexpected errors are written to the server log; the client only gets a generic message and a trace id,
    /// never exception text (SQL, file paths, stack details).
    /// </summary>
    public static class ServerErrorResult
    {
        public static ObjectResult ServerError(this ControllerBase controller, Exception exception)
        {
            var context = controller.HttpContext;
            var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger(controller.GetType());
            logger.LogError(exception, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
            return controller.StatusCode(500, new
            {
                message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại hoặc liên hệ quản trị viên.",
                traceId = context.TraceIdentifier
            });
        }
    }
}
