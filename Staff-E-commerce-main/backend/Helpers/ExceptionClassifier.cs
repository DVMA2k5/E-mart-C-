using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace backend.Helpers;

/// <summary>
/// Maps an unexpected exception to the HTTP answer the client should get. Shared by GlobalExceptionMiddleware and
/// the controllers' <c>this.ServerError(ex)</c>, so a busy lock is a retryable 503 whichever path catches it.
/// </summary>
public static class ExceptionClassifier
{
    public const string BusyMessage = "Hệ thống đang xử lý lượt mua cao, vui lòng thử lại sau vài giây.";
    public const string GenericMessage = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại hoặc liên hệ quản trị viên.";
    public const int RetryAfterSeconds = 3;

    public static (int Status, string Message, bool Retryable) Classify(Exception exception)
    {
        foreach (var error in Chain(exception))
        {
            switch (error)
            {
                case DbUpdateConcurrencyException:
                    return (StatusCodes.Status409Conflict,
                        "Dữ liệu vừa được người khác cập nhật. Vui lòng tải lại và thử lại.", false);
                case SqlException sql when IsBusy(sql):
                    return (StatusCodes.Status503ServiceUnavailable, BusyMessage, true);
                case SqlException sql when sql.Number is 2601 or 2627:
                    return (StatusCodes.Status409Conflict,
                        "Dữ liệu bị trùng hoặc đang được sử dụng. Vui lòng tải lại và thử lại.", false);
                case TimeoutException:
                    return (StatusCodes.Status503ServiceUnavailable, BusyMessage, true);
            }
        }
        return (StatusCodes.Status500InternalServerError, GenericMessage, false);
    }

    // 51000 = our sp_getapplock THROW (checkout / payment / registration busy), 1205 = deadlock victim,
    // 1222 = lock request time-out, -2 = command time-out.
    private static bool IsBusy(SqlException exception) =>
        exception.Number is 51000 or 1205 or 1222 or -2 ||
        exception.Errors.Cast<SqlError>().Any(error => error.Number is 51000 or 1205 or 1222);

    private static IEnumerable<Exception> Chain(Exception exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is AggregateException aggregate)
                foreach (var inner in aggregate.Flatten().InnerExceptions)
                    foreach (var nested in Chain(inner)) yield return nested;
            yield return current;
        }
    }
}
