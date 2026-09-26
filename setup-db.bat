@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Staff-E-commerce-main\scripts\setup-db.ps1"
