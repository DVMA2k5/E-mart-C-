using System.ComponentModel;
using backend.DTO;
using backend.Services.AI.SemanticSearch;
using Microsoft.SemanticKernel;

namespace backend.Services.AI.Plugins
{
    public class ProductSemanticSearchPlugin
    {
        private readonly ISemanticSearchService _searchService;
        private readonly ProductService _productService;

        public ProductSemanticSearchPlugin(IServiceProvider sp)
        {
            _searchService = sp.GetRequiredService<ISemanticSearchService>();
            _productService = sp.GetRequiredService<ProductService>();
        }

        [KernelFunction("semantic_search_products")]
        [Description("Tìm sản phẩm theo ý nghĩa, đồng nghĩa. Dùng khi user mô tả triệu chứng, nhu cầu, hoặc tìm kiếm không chính xác tên. Ví dụ: 'thuốc nhức đầu', 'thuốc ho cho trẻ', 'đồ chăm sóc da mụn'")]
        public async Task<List<ProductDTO>> SemanticSearchProductsAsync(
            [Description("Câu truy vấn bằng tiếng Việt mô tả sản phẩm cần tìm")] string query,
            [Description("Số lượng kết quả tối đa (mặc định 10)")] int limit = 10)
        {
            var products = await _searchService.SearchProductsAsync(query, limit);

            var dtos = new List<ProductDTO>();
            foreach (var p in products)
            {
                var dto = await _productService.GetProductByIdAsync(p.Id);
                if (dto != null) dtos.Add(dto);
            }

            return dtos;
        }

        [KernelFunction("find_similar_products")]
        [Description("Tìm sản phẩm tương tự với sản phẩm đã cho. Dùng khi user hỏi 'có sản phẩm nào giống X không?'")]
        public async Task<List<ProductDTO>> FindSimilarProductsAsync(
            [Description("Tên hoặc mô tả sản phẩm gốc để tìm sản phẩm tương tự")] string productDescription,
            [Description("Số lượng kết quả tối đa")] int limit = 5)
        {
            var products = await _searchService.SearchProductsAsync(productDescription, limit + 1);

            var dtos = new List<ProductDTO>();
            foreach (var p in products.Take(limit))
            {
                var dto = await _productService.GetProductByIdAsync(p.Id);
                if (dto != null) dtos.Add(dto);
            }

            return dtos;
        }
    }
}
