# PPA Chrome Extension Installation Helper
# This script helps install the PPA Chrome Extension by bypassing common antivirus false positives

Write-Host "PPA Chrome Extension Installation Helper" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  Note: Running without administrator privileges" -ForegroundColor Yellow
    Write-Host "   Some antivirus software may still block the download" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🔍 Checking for Chrome installation..." -ForegroundColor Cyan

# Check if Chrome is installed
$chromeExe = Get-Command "chrome.exe" -ErrorAction SilentlyContinue
if (-not $chromeExe) {
    $chromeExe = Get-ChildItem "C:\Program Files\Google\Chrome\Application\chrome.exe" -ErrorAction SilentlyContinue
    if (-not $chromeExe) {
        $chromeExe = Get-ChildItem "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" -ErrorAction SilentlyContinue
    }
}

if ($chromeExe) {
    Write-Host "✅ Chrome found: $($chromeExe.Source)" -ForegroundColor Green
} else {
    Write-Host "❌ Chrome not found. Please install Google Chrome first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 PPA Chrome Extension Installation Instructions:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Download the extension ZIP file from GitHub releases" -ForegroundColor White
Write-Host "   - Go to: https://github.com/[your-repo]/PPA-Chrome-Plugin/releases" -ForegroundColor Gray
Write-Host "   - Download the latest ppa-chrome-extension-*.zip file" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If your browser blocks the download:" -ForegroundColor White
Write-Host "   - Right-click the download and select 'Keep'" -ForegroundColor Gray
Write-Host "   - Or temporarily disable your antivirus" -ForegroundColor Gray
Write-Host "   - The file is safe - it's just a Chrome extension" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Extract the ZIP file to a folder" -ForegroundColor White
Write-Host ""
Write-Host "4. Install in Chrome:" -ForegroundColor White
Write-Host "   - Open Chrome and go to chrome://extensions/" -ForegroundColor Gray
Write-Host "   - Enable 'Developer mode' (toggle in top right)" -ForegroundColor Gray
Write-Host "   - Click 'Load unpacked'" -ForegroundColor Gray
Write-Host "   - Select the extracted folder" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Configure the extension:" -ForegroundColor White
Write-Host "   - Click the extension icon in Chrome toolbar" -ForegroundColor Gray
Write-Host "   - Go to Options and enter your email address" -ForegroundColor Gray
Write-Host ""

# Offer to open Chrome extensions page
Write-Host "Would you like to open Chrome extensions page now? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "🚀 Opening Chrome extensions page..." -ForegroundColor Green
    Start-Process "chrome://extensions/"
} else {
    Write-Host "👍 You can manually open chrome://extensions/ when ready" -ForegroundColor Green
}

Write-Host ""
Write-Host "🛡️  Security Note:" -ForegroundColor Cyan
Write-Host "The PPA Chrome Extension is open source and safe to use." -ForegroundColor White
Write-Host "Antivirus software sometimes flags browser extensions as suspicious," -ForegroundColor White
Write-Host "but this is a false positive. The source code is available for review." -ForegroundColor White
Write-Host ""
Write-Host "✅ Installation helper completed!" -ForegroundColor Green
