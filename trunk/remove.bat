@echo off
cls
echo BIS uninstallation
echo.
echo Remove start menu item
rd /s /q "%USERPROFILE%\Start Menu\Programs\Barebone Installation System"
echo Removing registry entries
regedit /s remove.reg
echo Removing files, including self
cd /d %ProgramFiles%
rd /s /q BIS
