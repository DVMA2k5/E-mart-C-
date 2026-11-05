namespace backend.Helpers;

/// <summary>
/// Stores product images under wwwroot/assets/images/products. Every upload gets a new unique file name, so an
/// upload never overwrites or deletes the image the product currently uses; the old file is removed only after
/// the product has been saved with the new URL.
/// </summary>
public static class ProductImageStorage
{
    public const string PublicFolder = "/assets/images/products/";
    public const long MaxBytes = 5 * 1024 * 1024;

    private static readonly Dictionary<string, Func<byte[], bool>> Signatures = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = IsJpeg,
        [".jpeg"] = IsJpeg,
        [".png"] = header => header.Length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
                             header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A,
        [".gif"] = header => header.Length >= 6 && header[0] == 'G' && header[1] == 'I' && header[2] == 'F' && header[3] == '8',
        [".webp"] = header => header.Length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F' &&
                              header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P'
    };

    private static bool IsJpeg(byte[] header) => header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

    private static string Folder => Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "assets", "images", "products");

    /// <summary>Returns an error message, or null when the file is a real image of an allowed type and size.</summary>
    public static async Task<string?> ValidateAsync(IFormFile? file)
    {
        if (file == null || file.Length == 0) return "Chưa chọn file ảnh.";
        if (file.Length > MaxBytes) return "Ảnh vượt quá 5MB.";
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Signatures.TryGetValue(extension, out var matches)) return "Chỉ chấp nhận ảnh JPG, PNG, GIF hoặc WEBP.";
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header);
        return matches(header[..read]) ? null : "Nội dung file không phải là ảnh hợp lệ.";
    }

    public static async Task<string> SaveAsync(IFormFile file, int? productId)
    {
        Directory.CreateDirectory(Folder);
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var prefix = productId.HasValue ? $"product-{productId.Value}" : "new";
        var fileName = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8]}{extension}";
        await using (var output = new FileStream(Path.Combine(Folder, fileName), FileMode.CreateNew))
            await file.CopyToAsync(output);
        return PublicFolder + fileName;
    }

    /// <summary>Deletes a previously uploaded local image. External URLs and shared demo images are left alone.</summary>
    public static void DeleteIfUploaded(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl) || !imageUrl.StartsWith(PublicFolder, StringComparison.OrdinalIgnoreCase)) return;
        var fileName = Path.GetFileName(imageUrl.Split('?')[0]);
        if (!(fileName.StartsWith("product-", StringComparison.OrdinalIgnoreCase) ||
              fileName.StartsWith("new-", StringComparison.OrdinalIgnoreCase) ||
              fileName.StartsWith("temp-", StringComparison.OrdinalIgnoreCase))) return;
        try
        {
            var path = Path.Combine(Folder, fileName);
            if (File.Exists(path)) File.Delete(path);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
