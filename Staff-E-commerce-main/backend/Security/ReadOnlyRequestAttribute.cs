namespace backend.Security;

/// <summary>
/// Marks a non-GET endpoint that only reads data. Used by permission and cache filters.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class ReadOnlyRequestAttribute : Attribute;
