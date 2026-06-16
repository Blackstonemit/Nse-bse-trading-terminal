@echo off
echo Building Shared Libraries...
call pnpm run typecheck:libs

echo Building Frontend...
cd artifacts\market-dashboard
call pnpm run build
cd ..\..

echo Building Backend API...
cd artifacts\api-server
call pnpm run build
cd ..\..

echo Packaging into Standalone Windows GUI Executable...
cd artifacts\desktop-app
call pnpm run dist
cd ..\..

echo Build complete. Standalone executable is in the dist-portable directory.
pause
