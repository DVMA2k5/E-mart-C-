using CsvHelper;
using OfficeOpenXml.Packaging.Ionic.Zip;

namespace backend.DTO
{
    public class OrderItemReponse
    {
        // Mã sản phẩm
        public int id {get;set;}
        // Tên sản phẩm
        public string product {get;set;}
        // Số lượng
        public int qty {get;set;}
        //Gía trên một sản phẩm
        public int price {get;set;}
        //Tổng tiền
        public int total  {get;set;}
    }
}