-- Authorization schema migration for an existing store_management database.
-- Run after backing up the database. This preserves users and maps old role names
-- to the new foreign-key based role model.

USE [store_management];
GO

IF OBJECT_ID(N'employees', N'U') IS NULL
BEGIN
    CREATE TABLE employees (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        date_of_birth DATE NULL,
        address NVARCHAR(MAX),
        note NVARCHAR(MAX),
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE UNIQUE INDEX ux_employees_email ON employees(email) WHERE email IS NOT NULL;
END;
GO

IF COL_LENGTH('employees', 'date_of_birth') IS NULL
    ALTER TABLE employees ADD date_of_birth DATE NULL;
IF COL_LENGTH('customers', 'date_of_birth') IS NULL
    ALTER TABLE customers ADD date_of_birth DATE NULL;
GO

IF OBJECT_ID(N'roles', N'U') IS NULL
BEGIN
    CREATE TABLE roles (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_roles PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description NVARCHAR(255) NULL,
        is_active BIT NOT NULL CONSTRAINT df_roles_is_active DEFAULT 1
    );
    CREATE UNIQUE INDEX ux_roles_name ON roles(name);
END;
GO

IF OBJECT_ID(N'permissions', N'U') IS NULL
BEGIN
    CREATE TABLE permissions (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_permissions PRIMARY KEY,
        code VARCHAR(100) NOT NULL,
        name NVARCHAR(150) NOT NULL,
        description NVARCHAR(255) NULL
    );
    CREATE UNIQUE INDEX ux_permissions_code ON permissions(code);
END;
GO

IF OBJECT_ID(N'role_permissions', N'U') IS NULL
BEGIN
    CREATE TABLE role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin')
    INSERT INTO roles (name, description) VALUES ('admin', N'Quản trị toàn hệ thống');
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'staff')
    INSERT INTO roles (name, description) VALUES ('staff', N'Nhân viên bán hàng');
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'customer')
    INSERT INTO roles (name, description) VALUES ('customer', N'Khách hàng');
GO

IF COL_LENGTH('users', 'role_id') IS NULL
    ALTER TABLE users ADD role_id INT NULL;
GO

IF COL_LENGTH('users', 'employee_id') IS NULL
    ALTER TABLE users ADD employee_id INT NULL;
IF COL_LENGTH('users', 'customer_id') IS NULL
    ALTER TABLE users ADD customer_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_employee')
    ALTER TABLE users ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_customer')
    ALTER TABLE users ADD CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
GO

UPDATE u
SET role_id = r.id
FROM users u
JOIN roles r ON r.name = LOWER(COALESCE(u.role, 'staff'))
WHERE u.role_id IS NULL;
GO

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'staff')
WHERE role_id IS NULL;
GO

ALTER TABLE users ALTER COLUMN role_id INT NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_users_role')
    ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id);
GO

-- Seed permission codes used by the application. New modules can add codes
-- without changing the users table.
INSERT INTO permissions (code, name) 
SELECT v.code, v.name
FROM (VALUES
    ('users.read', N'Xem tài khoản'),
    ('users.write', N'Tạo và cập nhật tài khoản'),
    ('roles.read', N'Xem vai trò và quyền'),
    ('roles.write', N'Gán quyền cho vai trò'),
    ('customers.read', N'Tra cứu khách hàng'),
    ('customers.write', N'Tạo và cập nhật khách hàng')
) v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);
GO

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
GO
