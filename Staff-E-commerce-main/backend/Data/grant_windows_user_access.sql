USE master;
GO

IF DB_ID(N'store_management') IS NULL
BEGIN
    THROW 50000, 'Database store_management does not exist. Import backend/Data/store_management_full.sql first.', 1;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'ADMIN-PC\Admin')
BEGIN
    CREATE LOGIN [ADMIN-PC\Admin] FROM WINDOWS;
END;
GO

USE [store_management];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ADMIN-PC\Admin')
BEGIN
    CREATE USER [ADMIN-PC\Admin] FOR LOGIN [ADMIN-PC\Admin];
END;
GO

ALTER ROLE db_datareader ADD MEMBER [ADMIN-PC\Admin];
ALTER ROLE db_datawriter ADD MEMBER [ADMIN-PC\Admin];
GO
