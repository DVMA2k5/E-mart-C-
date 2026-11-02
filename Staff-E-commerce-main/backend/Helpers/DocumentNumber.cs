namespace backend.Helpers;

public static class DocumentNumber
{
    public static string Order(int id) => $"DH-{id:D3}";
    public static string Invoice(int id) => $"INV-{id:D3}";
    public static string PurchaseOrder(int id) => $"PN-{id:D3}";

    public static string Temporary(string documentType) =>
        $"TMP-{documentType}-{Guid.NewGuid():N}";
}
