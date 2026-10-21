using System.Text.RegularExpressions;
using backend.Models;

namespace backend.Helpers;

// Legacy parsing is only a compatibility fallback; new orders store a delivery snapshot.
public sealed record OrderDeliveryDetails(string? Name, string? Phone, string? Address, string? Note)
{
    public static OrderDeliveryDetails FromOrder(Order order)
    {
        if (order.RecipientName != null || order.RecipientPhone != null || order.ShippingAddress != null)
            return new(order.RecipientName, order.RecipientPhone, order.ShippingAddress, order.Note);
        return order.OrderType == "mobile" || order.OrderNumber.StartsWith("WEB-", StringComparison.Ordinal)
            ? Parse(order.Note) : new(null, null, null, order.Note);
    }

    public static OrderDeliveryDetails Parse(string? note)
    {
        if (string.IsNullOrWhiteSpace(note)) return new(null, null, null, note);

        var match = Regex.Match(note,
            @"\ANgười nhận:[ \t]*(?<name>[^\r\n]*)\r?\nSố điện thoại:[ \t]*(?<phone>[^\r\n]*)\r?\nĐịa chỉ giao hàng:[ \t]*(?<address>[\s\S]*?)(?:\r?\nGhi chú:[ \t]*(?<note>[\s\S]*?))?(?: \| (?<rejection>Từ chối:[\s\S]*))?\z",
            RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));
        if (!match.Success) return new(null, null, null, note);

        static string? Value(string text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        var customerNote = string.Join("\n", new[] {
            match.Groups["note"].Value.Trim(), match.Groups["rejection"].Value.Trim()
        }.Where(value => !string.IsNullOrEmpty(value)));
        return new(Value(match.Groups["name"].Value), Value(match.Groups["phone"].Value),
            Value(match.Groups["address"].Value), Value(customerNote));
    }
}
