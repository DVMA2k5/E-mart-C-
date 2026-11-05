using System.Security.Cryptography;

namespace backend.Security;

/// <summary>
/// Resolves the JWT signing key without keeping it in source control. A key from configuration
/// (environment variable Jwt__Key or user-secrets) wins; otherwise a random key is generated once and
/// stored in an untracked local file so every developer machine gets its own secret.
/// </summary>
public static class JwtKeyStore
{
    // The key that used to be committed in appsettings.json is public, so it is never accepted.
    private const string LeakedKey = "b293jf9a3jfa9348hf9834hf983hf9WHF983hf983hf983hf983h";

    public static string Resolve(IConfiguration configuration, string contentRoot)
    {
        var configured = configuration["Jwt:Key"];
        if (!string.IsNullOrWhiteSpace(configured) && configured != LeakedKey && configured.Length >= 32)
            return configured;

        var directory = Path.Combine(contentRoot, ".local-secrets");
        var path = Path.Combine(directory, "jwt-signing.key");
        if (File.Exists(path))
        {
            var stored = File.ReadAllText(path).Trim();
            if (stored.Length >= 32) return stored;
        }

        Directory.CreateDirectory(directory);
        var generated = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        File.WriteAllText(path, generated);
        return generated;
    }
}
