using System;
using System.Linq;
using backend.Models;
using backend.DTO;
using backend.Repository;

namespace backend.Services
{
    public class InventoryService
    {
        private readonly InventoryRepository _inventoryRepo;

        public InventoryService(InventoryRepository inventoryRepo)
        {
            _inventoryRepo = inventoryRepo;
        }

        public async Task<bool> ReduceInventoryAsync(List<ReduceInventoryDto> items)
        {
            var inventoriesToUpdate = new List<Inventory>();

            foreach (var item in items)
            {
                var inventory = await _inventoryRepo.GetByProductIdAsync(item.ProductId);

                inventory.Quantity = inventory.Quantity - item.Quantity;
                inventory.UpdatedAt = DateTime.Now;
                inventoriesToUpdate.Add(inventory);
            }

            // Cập nhật tất cả cùng lúc
            await _inventoryRepo.UpdateRangeAsync(inventoriesToUpdate);
            return true;
        }

        public async Task<PaginationResult<InventoryListDTO>> GetPaginatedInventoryAsync(
            int page = 1,
            int pageSize = 10,
            string? search = null,
            string? sortBy = "",
            string? stockStatus = null)
        {
            var result = await _inventoryRepo.GetPaginatedAsync(page, pageSize, search, sortBy, stockStatus);

            var dtoItems = result.Items.Select(i => new InventoryListDTO
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product?.ProductName ?? "",
                Sku = i.Product?.Sku,
                ImageUrl = i.Product?.ImageUrl,
                Quantity = i.Quantity,
                LastCheckedAt = i.LastCheckedAt,
                UpdatedAt = i.UpdatedAt,
                CategoryName = i.Product?.Category?.Name,
                Price = i.Product?.Price,
                Unit = i.Product?.Unit?.Name ?? i.Product?.Unit?.Code ?? "—"
            }).ToList();

            return new PaginationResult<InventoryListDTO>
            {
                Items = dtoItems,
                TotalItems = result.TotalItems,
                CurrentPage = result.CurrentPage,
                PageSize = result.PageSize,
                TotalPages = result.TotalPages,
                HasPrevious = result.HasPrevious,
                HasNext = result.HasNext
            };
        }

        public async Task<InventoryListDTO> AdjustInventoryAsync(AdjustInventoryDTO dto)
        {
            var inventory = await _inventoryRepo.GetByIdAsync(dto.InventoryId);
            if (inventory == null)
                throw new ArgumentException($"Không tìm thấy inventory với ID {dto.InventoryId}");

            inventory.Quantity = dto.NewQuantity;
            inventory.UpdatedAt = DateTime.UtcNow;
            inventory.LastCheckedAt = DateTime.UtcNow;

            await _inventoryRepo.UpdateAsync(inventory);

            return new InventoryListDTO
            {
                Id = inventory.Id,
                ProductId = inventory.ProductId,
                ProductName = inventory.Product?.ProductName ?? "",
                Sku = inventory.Product?.Sku,
                ImageUrl = inventory.Product?.ImageUrl,
                Quantity = inventory.Quantity,
                LastCheckedAt = inventory.LastCheckedAt,
                UpdatedAt = inventory.UpdatedAt,
                CategoryName = inventory.Product?.Category?.Name,
                Price = inventory.Product?.Price,
                Unit = inventory.Product?.Unit?.Name ?? inventory.Product?.Unit?.Code ?? "—"
            };
        }

        public async Task<InventoryStatsDTO> GetInventoryStatsAsync()
        {
            var allCount = await _inventoryRepo.GetPaginatedAsync(1, 1, null, "", null);
            var outOfStockCount = await _inventoryRepo.GetPaginatedAsync(1, 1, null, "", "out_of_stock");
            var lowStockCount = await _inventoryRepo.GetPaginatedAsync(1, 1, null, "", "low_stock");
            var inStockCount = await _inventoryRepo.GetPaginatedAsync(1, 1, null, "", "in_stock");

            return new InventoryStatsDTO
            {
                Total = allCount.TotalItems,
                OutOfStock = outOfStockCount.TotalItems,
                LowStock = lowStockCount.TotalItems,
                InStock = inStockCount.TotalItems
            };
        }
    }
}
