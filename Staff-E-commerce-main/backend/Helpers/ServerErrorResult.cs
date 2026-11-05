using Microsoft.AspNetCore.Mvc;

namespace backend.Helpers
{
    /// <summary>
    /// Unexpected errors are written to the server log; the client only gets a generic message and a trace id,
    /// never exception text (SQL, file paths, stack details). Busy locks and conflicts are classified exactly like
    /// GlobalExceptionMiddleware does (503 + Retry-After / 409), so controllers that catch every exception still
    /// tell the client when a retry is safe.
    /// </summary>
    public static class ServerErrorResult
    {
        public static ObjectResult ServerError(this ControllerBase controller, Exception exception)
        {
            var context = controller.HttpContext;
            var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger(controller.GetType());
            var (status, message, retryable) = ExceptionClassifier.Classify(exception);
            if (status >= 500 && !retryable)
                logger.LogError(exception, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
            else
                logger.LogWarning("{Status} on {Method} {Path}: {Error}", status, context.Request.Method, context.Request.Path, exception.Message);
            if (retryable) context.Response.Headers.RetryAfter = ExceptionClassifier.RetryAfterSeconds.ToString();
            return controller.StatusCode(status, new
            {
                message,
                retryable,
                traceId = context.TraceIdentifier
            });
        }
    }
}
