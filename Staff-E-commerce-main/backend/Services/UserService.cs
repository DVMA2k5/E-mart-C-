using backend.DTO;
using backend.Models;
using backend.Repository;

namespace backend.Services
{
    public class UserService
    {
        public enum ChangePasswordResult
        {
            Success,
            UserNotFound,
            InvalidCurrentPassword
        }

        private readonly UserRepository _userRepository;

        public UserService(UserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<List<UserDTO>> GetAllUsersAsync()
        {
            var users = await _userRepository.GetAllAsync();
            return users.Select(MapToUserDto).ToList();
        }

        public async Task<PaginationResult<UserDTO>> GetPaginatedAsync(int page, int pageSize)
        {
            var result = await _userRepository.GetPaginatedAsync(page, pageSize);

            return new PaginationResult<UserDTO>
            {
                Items = result.Items.Select(MapToUserDto).ToList(),
                TotalItems = result.TotalItems,
                CurrentPage = result.CurrentPage,
                PageSize = result.PageSize,
                TotalPages = result.TotalPages,
                HasPrevious = result.HasPrevious,
                HasNext = result.HasNext
            };
        }

        public async Task<PaginationResult<UserDTO>> GetStaffPaginatedAsync(int page, int pageSize)
        {
            var result = await _userRepository.GetStaffPaginatedAsync(page, pageSize);

            return new PaginationResult<UserDTO>
            {
                Items = result.Items.Select(MapToUserDto).ToList(),
                TotalItems = result.TotalItems,
                CurrentPage = result.CurrentPage,
                PageSize = result.PageSize,
                TotalPages = result.TotalPages,
                HasPrevious = result.HasPrevious,
                HasNext = result.HasNext
            };
        }

        public async Task<UserDTO?> GetUserByIdAsync(int id)
        {
            var user = await _userRepository.GetByIdAsync(id);
            return user == null ? null : MapToUserDto(user);
        }

        public async Task<UserDTO?> CreateUserAsync(UserDTO request)
        {
            if (string.IsNullOrWhiteSpace(request.Password))
                throw new ArgumentException("Password is required", nameof(request.Password));

            var roleName = NormalizeRole(request.Role);
            var role = await _userRepository.GetRoleByNameAsync(roleName);
            if (role == null || !role.IsActive)
                throw new ArgumentException($"Role '{roleName}' does not exist or is inactive.", nameof(request.Role));
            if (request.EmployeeId.HasValue && roleName != "staff")
                throw new ArgumentException("Tài khoản nhân viên phải có role staff.", nameof(request.EmployeeId));
            if (request.CustomerId.HasValue && roleName != "customer")
                throw new ArgumentException("Tài khoản khách hàng phải có role customer.", nameof(request.CustomerId));
            if (request.EmployeeId.HasValue && await _userRepository.EmployeeHasAccountAsync(request.EmployeeId.Value))
                throw new ArgumentException("Hồ sơ nhân viên này đã được cấp tài khoản.", nameof(request.EmployeeId));
            if (request.CustomerId.HasValue && await _userRepository.CustomerHasAccountAsync(request.CustomerId.Value))
                throw new ArgumentException("Hồ sơ khách hàng này đã được cấp tài khoản.", nameof(request.CustomerId));

            var employee = request.EmployeeId.HasValue
                ? await _userRepository.GetEmployeeAsync(request.EmployeeId.Value)
                : null;
            var customer = request.CustomerId.HasValue
                ? await _userRepository.GetCustomerAsync(request.CustomerId.Value)
                : null;
            if (request.EmployeeId.HasValue && employee == null)
                throw new ArgumentException("Hồ sơ nhân viên không tồn tại.", nameof(request.EmployeeId));
            if (request.CustomerId.HasValue && customer == null)
                throw new ArgumentException("Hồ sơ khách hàng không tồn tại.", nameof(request.CustomerId));

            var now = DateTime.UtcNow;

            var user = new User
            {
                Username = request.Username.Trim(),
                Email = employee?.Email ?? customer?.Email ?? request.Email?.Trim(),
                FullName = employee?.FullName ?? customer?.FullName ??
                    (string.IsNullOrWhiteSpace(request.FullName) ? request.Username.Trim() : request.FullName.Trim()),
                RoleId = role.Id,
                RoleEntity = role,
                EmployeeId = request.EmployeeId,
                CustomerId = request.CustomerId,
                IsActive = request.IsActive,
                IsLocked = !request.IsActive,
                CreatedAt = now,
                UpdatedAt = now,
                PasswordHash = HashPassword(request.Password)
            };

            var createdUser = await _userRepository.AddAsync(user);
            return MapToUserDto(createdUser);
        }

        public async Task<UserDTO?> UpdateUserAsync(int id, UserDTO request)
        {
            var existingUser = await _userRepository.GetByIdAsync(id);
            if (existingUser == null) return null;

            existingUser.Username = request.Username.Trim();
            var role = await _userRepository.GetRoleByNameAsync(NormalizeRole(request.Role));
            if (role == null || !role.IsActive)
                throw new ArgumentException($"Role '{request.Role}' does not exist or is inactive.", nameof(request.Role));

            var employee = request.EmployeeId.HasValue
                ? await _userRepository.GetEmployeeAsync(request.EmployeeId.Value)
                : null;
            var customer = request.CustomerId.HasValue
                ? await _userRepository.GetCustomerAsync(request.CustomerId.Value)
                : null;
            if (request.EmployeeId.HasValue && employee == null)
                throw new ArgumentException("Hồ sơ nhân viên không tồn tại.", nameof(request.EmployeeId));
            if (request.CustomerId.HasValue && customer == null)
                throw new ArgumentException("Hồ sơ khách hàng không tồn tại.", nameof(request.CustomerId));

            existingUser.Email = employee?.Email ?? customer?.Email ?? request.Email?.Trim();
            existingUser.FullName = employee?.FullName ?? customer?.FullName ??
                (string.IsNullOrWhiteSpace(request.FullName) ? existingUser.FullName : request.FullName.Trim());
            existingUser.RoleId = role.Id;
            existingUser.RoleEntity = role;
            existingUser.EmployeeId = request.EmployeeId;
            existingUser.CustomerId = request.CustomerId;
            if (request.EmployeeId.HasValue && await _userRepository.EmployeeHasAccountAsync(request.EmployeeId.Value, id))
                throw new ArgumentException("Hồ sơ nhân viên này đã được cấp tài khoản.", nameof(request.EmployeeId));
            if (request.CustomerId.HasValue && await _userRepository.CustomerHasAccountAsync(request.CustomerId.Value, id))
                throw new ArgumentException("Hồ sơ khách hàng này đã được cấp tài khoản.", nameof(request.CustomerId));
            existingUser.IsActive = request.IsActive;
            existingUser.IsLocked = !request.IsActive;
            existingUser.UpdatedAt = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                existingUser.PasswordHash = HashPassword(request.Password);
            }

            var updatedUser = await _userRepository.UpdateAsync(existingUser);
            return MapToUserDto(updatedUser);
        }

        public async Task<UserDTO?> UpdateProfileAsync(int id, MeDTO request)
        {
            var existingUser = await _userRepository.GetByIdAsync(id);
            if (existingUser == null) return null;

            existingUser.Username = request.Username.Trim();
            existingUser.Email = request.Email?.Trim();
            existingUser.FullName = request.FullName?.Trim() ?? existingUser.FullName;
            existingUser.UpdatedAt = DateTime.UtcNow;

            var updatedUser = await _userRepository.UpdateAsync(existingUser);
            return MapToUserDto(updatedUser);
        }

        public async Task<UserDTO?> UpdateStatusAsync(int id, bool isActive)
        {
            var existingUser = await _userRepository.GetByIdAsync(id);
            if (existingUser == null) return null;

            existingUser.IsActive = isActive;
            existingUser.IsLocked = !isActive;
            existingUser.UpdatedAt = DateTime.UtcNow;

            var updatedUser = await _userRepository.UpdateAsync(existingUser);
            return MapToUserDto(updatedUser);
        }

        public async Task<ChangePasswordResult> ChangePasswordAsync(int id, string currentPassword, string newPassword)
        {
            var existingUser = await _userRepository.GetByIdAsync(id);
            if (existingUser == null) return ChangePasswordResult.UserNotFound;

            if (!VerifyPassword(existingUser.PasswordHash, currentPassword))
                return ChangePasswordResult.InvalidCurrentPassword;

            existingUser.PasswordHash = HashPassword(newPassword);
            existingUser.UpdatedAt = DateTime.UtcNow;

            await _userRepository.UpdateAsync(existingUser);
            return ChangePasswordResult.Success;
        }

        public async Task<bool> DeleteUserAsync(int id)
        {
            return await _userRepository.DeleteAsync(id);
        }

        public async Task<bool> UserExistsEmailAsync(string email, int? excludeUserId = null)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;

            var user = await _userRepository.GetByEmailAsync(email.Trim());
            if (user == null) return false;

            return excludeUserId == null || user.Id != excludeUserId.Value;
        }

        public async Task<bool> UserExistsUsernameAsync(string username, int? excludeUserId = null)
        {
            if (string.IsNullOrWhiteSpace(username)) return false;

            var user = await _userRepository.GetByUsernameAsync(username.Trim());
            if (user == null) return false;

            return excludeUserId == null || user.Id != excludeUserId.Value;
        }

        private UserDTO MapToUserDto(User user)
        {
            return new UserDTO
            {
                Id = user.Id,
                EmployeeId = user.EmployeeId,
                CustomerId = user.CustomerId,
                EmployeeName = user.Employee?.FullName,
                CustomerName = user.Customer?.FullName,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                Role = user.RoleEntity?.Name ?? string.Empty,
                IsActive = user.IsActive,
                IsLocked = user.IsLocked,
                UpdatedAt = user.UpdatedAt,
                LastLogin = user.LastLogin
            };
        }

        private static string NormalizeRole(string role)
        {
            var normalized = string.IsNullOrWhiteSpace(role)
                ? "staff"
                : role.Trim().ToLowerInvariant();

            return normalized;
        }

        private const int BcryptWorkFactor = 11;

        private static string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: BcryptWorkFactor);

        private static bool VerifyPassword(string hashedPassword, string password) =>
            BCrypt.Net.BCrypt.Verify(password, hashedPassword);
    }
}
