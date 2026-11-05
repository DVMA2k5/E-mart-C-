using backend.Helpers;

namespace backend.Middlewares;

/// <summary>
/// Last line of defence for exceptions that escape a controller. Busy/lock/deadlock errors become a retryable
/// 503 (with Retry-After), concurrency conflicts a 409, and anything else a generic 500. Every response is the
/// usual <c>{ message }</c> JSON, so clients never see a stack trace or an HTML error page.
/// </summary>
public sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public const string BusyMessage = ExceptionClassifier.BusyMessage;

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away; there is nobody to answer.
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            var (status, message, retryable) = ExceptionClassifier.Classify(exception);
            if (status >= 500 && !retryable)
                logger.LogError(exception, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
            else
                logger.LogWarning("{Status} on {Method} {Path}: {Error}", status, context.Request.Method, context.Request.Path, exception.Message);

            context.Response.Clear(); // CORS headers are re-applied when the response starts
            context.Response.StatusCode = status;
            if (retryable) context.Response.Headers.RetryAfter = ExceptionClassifier.RetryAfterSeconds.ToString();
            await context.Response.WriteAsJsonAsync(new
            {
                message,
                retryable,
                traceId = context.TraceIdentifier
            });
        }
    }
}
