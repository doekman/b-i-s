@echo off
cd /d %ProgramFiles%\BIS
cscript //nologo bis.js -r
regedit /s setup.reg