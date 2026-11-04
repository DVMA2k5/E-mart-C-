using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Repository
{
    public class CustomerRepository
    {
        private readonly AppDbContext _context;

        /*************  ✨ Windsurf Command ⭐  *************/
        /// <summary>
        /// Constructor for CustomerRepository.
        /// </summary>
        /// <param name="context">The AppDbContext instance.</param>
        /*******  de317274-e941-4a67-8e12-78d4c12762df  *******/
        public CustomerRepository(AppDbContext context)
        {
            _context = context;
        }

        // Lấy tất cả khách hàng
        public async Task<List<Customer>> GetAllAsync()
        {
            return await _context.Customers
                .AsNoTracking()
                .OrderBy(c => c.FullName)
                .ToListAsync();
        }

        // Lấy khách hàng theo Id
        public async Task<Customer?> GetByIdAsync(int id)
        {
            return await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        // Lấy khách hàng theo phone hoặc email
        public async Task<Customer?> GetByPhoneAsync(string phone)
        {
            return await _context.Customers
                .FirstOrDefaultAsync(c => c.Phone == phone);
        }

        public async Task<Customer?> GetByEmailAsync(string email)
        {
            return await _context.Customers
                .FirstOrDefaultAsync(c => c.Email == email);
        }

        // Thêm khách hàng mới
        public async Task<Customer> AddAsync(Customer customer)
        {
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
            return customer;
        }

        // Cập nhật khách hàng
        public async Task<Customer> UpdateAsync(Customer customer)
        {
            _context.Customers.Update(customer);
            await _context.SaveChangesAsync();
            return customer;
        }

        // Xóa khách hàng
        public async Task<bool> DeleteAsync(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null)
                return false;

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
            return true;
        }

        // Kiểm tra tồn tại khách hàng theo Id
        public async Task<bool> ExistsAsync(int id)
        {
            return await _context.Customers.AnyAsync(c => c.Id == id);
        }

        public Task<bool> HasLoginAccountAsync(int customerId) =>
            _context.Users.AnyAsync(user => user.CustomerId == customerId);

        /// <summary>True when deleting the profile would orphan orders, invoices, vouchers or reward points.</summary>
        public async Task<bool> HasBusinessHistoryAsync(int customerId) =>
            await _context.Orders.AnyAsync(order => order.CustomerId == customerId) ||
            await _context.Invoices.AnyAsync(invoice => invoice.CustomerId == customerId) ||
            await _context.CustomerVouchers.AnyAsync(voucher => voucher.CustomerId == customerId) ||
            await _context.Customers.AnyAsync(customer => customer.Id == customerId && customer.RewardPoints > 0);

        public Task<bool> PhoneTakenAsync(string phone, int excludeId) =>
            _context.Customers.AnyAsync(customer => customer.Id != excludeId && customer.Phone == phone);

        public async Task<bool> EmailTakenAsync(string email, int excludeId) =>
            await _context.Customers.AnyAsync(customer => customer.Id != excludeId && customer.Email == email) ||
            await _context.Users.AnyAsync(user => user.Email == email && user.CustomerId != excludeId);

        /// <summary>Keeps the linked login account showing the same name and e-mail as the customer profile.</summary>
        public async Task SyncLinkedAccountAsync(Customer customer)
        {
            var account = await _context.Users.FirstOrDefaultAsync(user => user.CustomerId == customer.Id);
            if (account == null) return;
            account.FullName = customer.FullName;
            account.Email = customer.Email;
            // Customers sign in with their phone, so the username follows a phone change.
            var phone = customer.Phone?.Trim();
            if (!string.IsNullOrEmpty(phone) && account.Username != phone &&
                !await _context.Users.AnyAsync(user => user.Username == phone && user.Id != account.Id))
            {
                account.Username = phone;
                account.SessionVersion++; // old tokens carry the old username
            }
            account.UpdatedAt = DateTime.UtcNow;
        }

        public async Task<Customer> UpdateActiveAsync(Customer customer, bool isActive)
        {
            customer.IsActive = isActive;
            customer.UpdatedAt = DateTime.UtcNow;
            var account = await _context.Users.FirstOrDefaultAsync(user => user.CustomerId == customer.Id);
            if (account != null)
            {
                account.IsActive = isActive;
                account.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
            return customer;
        }


        public async Task<int> CountAsync() =>
            await _context.Customers.CountAsync();
    }
}
