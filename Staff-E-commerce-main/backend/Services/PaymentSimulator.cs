using System.Security.Cryptography;
using System.Text;
using backend.DTO;

namespace backend.Services;

/// <summary>
/// Simulated payment gateway for the coursework demo. In "Simulated" mode (the default) no real
/// MoMo or bank call is made: a local page lets the tester choose success or failure, and the result
/// is delivered through the same signed callback / confirmation code that a real gateway would use.
/// Set Payments:Mode = "Live" (with real Momo keys) to talk to the MoMo sandbox instead.
/// </summary>
public sealed class PaymentSimulator(IConfiguration configuration, IHttpContextAccessor httpContextAccessor)
{
    private const string SimulatedPartnerCode = "MOMO-SIMULATOR";
    private const string SimulatedAccessKey = "SIMULATED-ACCESS-KEY";
    private const string SimulatedSecretKey = "SIMULATED-SECRET-KEY";

    public bool Enabled => !string.Equals(configuration["Payments:Mode"], "Live", StringComparison.OrdinalIgnoreCase);

    public string PartnerCode => Enabled ? SimulatedPartnerCode : configuration["Momo:PartnerCode"] ?? "";
    public string AccessKey => Enabled ? SimulatedAccessKey : configuration["Momo:AccessKey"] ?? "";
    public string SecretKey => Enabled ? SimulatedSecretKey : configuration["Momo:SecretKey"] ?? "";

    public bool MomoAvailable => Enabled ||
        !string.IsNullOrWhiteSpace(configuration["Momo:Endpoint"]) && !string.IsNullOrWhiteSpace(configuration["Momo:SecretKey"]);

    /// <summary>Origin the caller used to reach the API, so phones on the LAN or a tunnel can open the page.</summary>
    public string PublicOrigin
    {
        get
        {
            var request = httpContextAccessor.HttpContext?.Request;
            if (request != null && request.Host.HasValue) return $"{request.Scheme}://{request.Host}";
            return (configuration["App:BaseUrl"] ?? "http://localhost:5099").TrimEnd('/');
        }
    }

    public string MomoPageUrl(string attemptReference) =>
        $"{PublicOrigin}/api/payment/simulator/momo/{Uri.EscapeDataString(attemptReference)}";

    public string BankPageUrl(int orderId) =>
        $"{PublicOrigin}/api/payment/simulator/bank/{orderId}/{BankToken(orderId)}";

    /// <summary>Unguessable per-order token so only the person holding the order's link can simulate its transfer.</summary>
    public string BankToken(int orderId)
    {
        var key = Encoding.UTF8.GetBytes(configuration["Jwt:Key"] ?? SimulatedSecretKey);
        var hash = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"bank-simulator:{orderId}"));
        return Convert.ToHexString(hash)[..32].ToLowerInvariant();
    }

    public bool IsValidBankToken(int orderId, string token)
    {
        var expected = Encoding.UTF8.GetBytes(BankToken(orderId));
        var actual = Encoding.UTF8.GetBytes((token ?? "").ToLowerInvariant());
        return expected.Length == actual.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    /// <summary>Builds the IPN body MoMo would post, signed exactly like the real gateway.</summary>
    public MomoIpnCallbackDTO BuildMomoCallback(string attemptReference, long amount, bool success)
    {
        var callback = new MomoIpnCallbackDTO
        {
            PartnerCode = PartnerCode,
            OrderId = attemptReference,
            RequestId = "sim_" + Guid.NewGuid().ToString("N"),
            Amount = amount,
            OrderInfo = "Thanh toan gia lap",
            OrderType = "momo_wallet",
            TransId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            ResultCode = success ? 0 : 1006,
            Message = success ? "Successful." : "Transaction denied by user.",
            PayType = "simulator",
            ResponseTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            ExtraData = ""
        };
        callback.Signature = Sign(MomoCallbackRawSignature(AccessKey, callback), SecretKey);
        return callback;
    }

    public static string MomoCallbackRawSignature(string accessKey, MomoIpnCallbackDTO callback) =>
        $"accessKey={accessKey}" +
        $"&amount={callback.Amount}" +
        $"&extraData={callback.ExtraData}" +
        $"&message={callback.Message}" +
        $"&orderId={callback.OrderId}" +
        $"&orderInfo={callback.OrderInfo}" +
        $"&orderType={callback.OrderType}" +
        $"&partnerCode={callback.PartnerCode}" +
        $"&payType={callback.PayType}" +
        $"&requestId={callback.RequestId}" +
        $"&responseTime={callback.ResponseTime}" +
        $"&resultCode={callback.ResultCode}" +
        $"&transId={callback.TransId}";

    public static string Sign(string message, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(message))).ToLowerInvariant();
    }
}
