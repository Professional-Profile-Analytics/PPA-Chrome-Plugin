@echo off
echo.
echo PPA Chrome Extension Installation Helper
echo =======================================
echo.
echo This script helps you install the PPA Chrome Extension
echo.
echo STEP 1: Download the extension
echo - Go to GitHub releases page
echo - Download ppa-chrome-extension-[version].zip
echo.
echo STEP 2: If antivirus blocks the download
echo - Right-click the download and select "Keep"
echo - The file is safe - it's a legitimate Chrome extension
echo.
echo STEP 3: Extract the ZIP file
echo - Right-click the ZIP file and select "Extract All"
echo - Choose a folder location
echo.
echo STEP 4: Install in Chrome
echo - Open Chrome and go to chrome://extensions/
echo - Enable "Developer mode" (toggle in top right)
echo - Click "Load unpacked"
echo - Select the extracted folder
echo.
echo STEP 5: Configure
echo - Click the extension icon in Chrome
echo - Go to Options and enter your email
echo.
echo Would you like to open Chrome extensions page now? (y/n)
set /p choice=
if /i "%choice%"=="y" (
    echo Opening Chrome extensions page...
    start chrome://extensions/
) else (
    echo You can manually open chrome://extensions/ when ready
)
echo.
echo Installation helper completed!
pause
