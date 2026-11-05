using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Helpers;

/// <summary>
/// The database stores UTC, but EF returns DateTime values with Kind = Unspecified, which System.Text.Json writes
/// without an offset ("2026-11-03T14:00:00"). Browsers then read them as local time and show the clock 7 hours
/// early. Writing them with "Z" lets every client convert to Vietnamese time correctly. Reading is unchanged.
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc);
    }
}
