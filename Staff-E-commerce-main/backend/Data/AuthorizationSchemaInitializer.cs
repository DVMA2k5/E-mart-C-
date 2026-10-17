using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public static class AuthorizationSchemaInitializer
    {
        public static async Task InitializeAsync(IServiceProvider services)
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            await db.Database.ExecuteSqlRawAsync("""
                IF OBJECT_ID(N'employees', N'U') IS NULL
                BEGIN
                    CREATE TABLE employees (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        full_name NVARCHAR(255) NOT NULL,
                        phone VARCHAR(50) NULL,
                        email VARCHAR(255) NULL,
                        address NVARCHAR(MAX) NULL,
                        note NVARCHAR(MAX) NULL,
                        is_active BIT NOT NULL DEFAULT 1,
                        created_at DATETIME NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME NOT NULL DEFAULT GETDATE()
                    );
                    CREATE UNIQUE INDEX ux_employees_email ON employees(email) WHERE email IS NOT NULL;
                END
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF COL_LENGTH('employees', 'date_of_birth') IS NULL
                    ALTER TABLE employees ADD date_of_birth DATE NULL;
                IF COL_LENGTH('customers', 'date_of_birth') IS NULL
                    ALTER TABLE customers ADD date_of_birth DATE NULL;
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF OBJECT_ID(N'roles', N'U') IS NULL
                BEGIN
                    CREATE TABLE roles (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name VARCHAR(50) NOT NULL,
                        description NVARCHAR(255) NULL,
                        is_active BIT NOT NULL DEFAULT 1
                    );
                    CREATE UNIQUE INDEX ux_roles_name ON roles(name);
                END
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF COL_LENGTH('users', 'employee_id') IS NULL
                    ALTER TABLE users ADD employee_id INT NULL;
                IF COL_LENGTH('users', 'customer_id') IS NULL
                    ALTER TABLE users ADD customer_id INT NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_employee')
                    ALTER TABLE users ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id);
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_customer')
                    ALTER TABLE users ADD CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF OBJECT_ID(N'permissions', N'U') IS NULL
                BEGIN
                    CREATE TABLE permissions (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        code VARCHAR(100) NOT NULL,
                        name NVARCHAR(150) NOT NULL,
                        description NVARCHAR(255) NULL
                    );
                    CREATE UNIQUE INDEX ux_permissions_code ON permissions(code);
                END
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF OBJECT_ID(N'role_permissions', N'U') IS NULL
                BEGIN
                    CREATE TABLE role_permissions (
                        role_id INT NOT NULL,
                        permission_id INT NOT NULL,
                        CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
                        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
                    );
                END
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin')
                    INSERT INTO roles (name, description) VALUES ('admin', N'Quản trị toàn hệ thống');
                IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'staff')
                    INSERT INTO roles (name, description) VALUES ('staff', N'Nhân viên bán hàng');
                IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'customer')
                    INSERT INTO roles (name, description) VALUES ('customer', N'Khách hàng');
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF COL_LENGTH('users', 'role_id') IS NULL
                    ALTER TABLE users ADD role_id INT NULL;
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF COL_LENGTH('users', 'role') IS NOT NULL
                BEGIN
                    EXEC(N'
                        UPDATE u
                        SET role_id = r.id
                        FROM users u
                        JOIN roles r ON r.name = LOWER(COALESCE(u.role, ''staff''))
                        WHERE u.role_id IS NULL;
                    ');
                END

                UPDATE users
                SET role_id = (SELECT id FROM roles WHERE name = 'staff')
                WHERE role_id IS NULL;
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_role')
                    ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id);
                """);

            await db.Database.ExecuteSqlRawAsync("""
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.read')
                    INSERT INTO permissions (code, name) VALUES ('users.read', N'Xem tài khoản');
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.write')
                    INSERT INTO permissions (code, name) VALUES ('users.write', N'Tạo và cập nhật tài khoản');
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'roles.read')
                    INSERT INTO permissions (code, name) VALUES ('roles.read', N'Xem vai trò và quyền');
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'roles.write')
                    INSERT INTO permissions (code, name) VALUES ('roles.write', N'Gán quyền cho vai trò');
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'customers.read')
                    INSERT INTO permissions (code, name) VALUES ('customers.read', N'Tra cứu khách hàng');
                IF NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'customers.write')
                    INSERT INTO permissions (code, name) VALUES ('customers.write', N'Tạo và cập nhật khách hàng');

                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r CROSS JOIN permissions p
                WHERE r.name = 'admin'
                  AND NOT EXISTS (
                      SELECT 1 FROM role_permissions rp
                      WHERE rp.role_id = r.id AND rp.permission_id = p.id
                  );
                """);
        }
    }
}
