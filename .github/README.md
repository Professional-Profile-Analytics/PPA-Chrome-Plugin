# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Professional Profile Analytics Chrome Extension.

## Workflows

### 🧪 `ci.yml` - Continuous Integration (Recommended)
**Triggers:** Push to `main` branch, Pull Requests to `main`

**What it does:**
- ✅ Runs all tests (ConfigManager + Advanced Post Analytics + Download Tracking)
- 📊 Generates coverage reports
- 🔍 Validates Chrome extension manifest
- 📁 Checks file structure
- 🎯 Provides test summary in GitHub

**Jobs:**
1. **Test Job** - Runs npm tests with Node.js 18
2. **Lint Job** - Validates file structure and manifest

### 🔄 `test.yml` - Multi-Node Testing (Advanced)
**Triggers:** Push to `main` branch, Pull Requests to `main`

**What it does:**
- 🧪 Runs tests across multiple Node.js versions (16, 18, 20)
- 📊 Uploads coverage to Codecov
- 🔍 Runs individual test suites separately
- 🎯 Matrix testing for compatibility

### 📦 `release.yml` - Chrome Extension Release Builder (NEW)
**Triggers:** New releases/tags (`v*`)

**What it does:**
- 🏗️ **Builds Chrome extension package** from source code
- 📝 **Updates manifest.json version** automatically
- 🗜️ **Creates ZIP package** with only extension files
- 📋 **Validates package integrity** (manifest, required files)
- 📤 **Uploads to GitHub release** automatically
- 📖 **Generates comprehensive release notes**

**Package Contents:**
- ✅ All Chrome extension files (`.js`, `.html`, `.css`, `.json`)
- ✅ Icons and assets
- ✅ Bootstrap and dependencies
- ❌ **Excludes:** Tests, GitHub files, documentation, node_modules

## Release Workflow Usage

### 🚀 Creating a New Release

#### **Option 1: Using the Helper Script (Recommended)**
```bash
# Run the release creation script
./scripts/create-release.sh

# Follow the prompts:
# 1. Enter new version (e.g., 1.7.4)
# 2. Confirm the release
# 3. Script handles everything automatically
```

#### **Option 2: Manual Release Creation**
```bash
# 1. Update version in manifest.json
vim manifest.json  # Change version to "1.7.4"

# 2. Commit the version change
git add manifest.json
git commit -m "Bump version to 1.7.4 for release"

# 3. Create and push tag
git tag -a v1.7.4 -m "Release v1.7.4"
git push origin main
git push origin v1.7.4

# 4. GitHub Actions will automatically build the package
```

### 📦 What Gets Built

The release workflow creates a ZIP package containing:

#### **✅ Included Files:**
```
professional-profile-analytics-chrome-extension-v1.7.4.zip
├── manifest.json                    # Updated with release version
├── background.js                    # Main service worker
├── popup.html & popup.js           # Extension popup
├── options.html & options.js       # Options page
├── content.js                       # Content script
├── advanced-post-analytics.js       # Advanced analytics
├── linkedin-post-helper-typing.js   # Shiny integration
├── excel-processor.js               # File processing
├── file-reader-content.js           # File reading
├── bootstrap.min.css                # UI framework
├── bootstrap.bundle.min.js          # UI framework
├── bootstrap-icons.css              # Icons
├── xlsx.full.min.js                 # Excel processing
├── fonts/                           # Icon fonts
├── PPA_chrome_icon_48.png          # Extension icons
└── PPA_chrome_icon_128.png         # Extension icons
```

#### **❌ Excluded Files:**
- `tests/` - Test files and dependencies
- `.github/` - GitHub Actions workflows
- `node_modules/` - Development dependencies
- `*.md` - Documentation files
- `package*.json` - npm configuration
- `.git*` - Git configuration

## GitHub Enterprise Compatibility

All workflows are designed to work with **GitHub Enterprise** environments:

- ✅ Uses standard GitHub Actions (`checkout@v4`, `setup-node@v4`)
- ✅ No external dependencies beyond npm packages
- ✅ Works with private repositories
- ✅ Compatible with GitHub Enterprise Server
- ✅ Uses `working-directory` for proper path handling

## Setup Instructions

### 1. Enable GitHub Actions
Ensure GitHub Actions are enabled in your GitHub Enterprise instance and repository settings.

### 2. Choose Your Workflows
- **For CI/CD**: Use `ci.yml` (simpler) or `test.yml` (comprehensive)
- **For Releases**: Use `release.yml` (automatic package building)

### 3. Monitor Results
- Check the **Actions** tab in your GitHub repository
- View test results and coverage reports
- Download release packages from **Releases** tab
- Get notifications on test failures or build issues

## Test Commands Used

The workflows use these npm commands from the `tests/` directory:

```bash
npm ci                    # Install dependencies
npm test                  # Run all tests (69 total)
npm run test:config       # Run ConfigManager tests only (24 tests)
npm run test:analytics    # Run Advanced Post Analytics tests only (20 tests)
npm run test:download     # Run Download Tracking tests only (25 tests)
npm run test:coverage     # Run tests with coverage report
```

## Expected Output

### ✅ Successful Release Build
```
🎉 Chrome Extension Package Built Successfully

📦 Package Details
- Version: 1.7.4
- Package: professional-profile-analytics-chrome-extension-v1.7.4.zip
- Size: 2.1MB

✅ Validation Results
- Manifest.json: Valid ✅
- Required files: Present ✅
- Package structure: Valid ✅

📥 Download
The extension package is available as an artifact and attached to the GitHub release.
```

## Benefits

### 🛡️ Quality Assurance
- **Prevents broken code** from reaching main branch
- **Validates all tests** before merging
- **Ensures Chrome extension integrity**
- **Automated package validation**

### 🚀 Developer Experience
- **Automatic testing** on every push
- **Clear feedback** on test results
- **One-click release creation**
- **Ready-to-install packages**

### 📦 Release Management
- **Automated package building**
- **Version consistency**
- **Comprehensive release notes**
- **Easy distribution**

---

**The GitHub Actions workflows provide automated testing and release management for your Chrome extension, ensuring code quality and streamlined distribution with every commit and release.**

```yaml
# Change Node.js version
node-version: '18'  # or '16', '20'

# Change branch triggers
branches: [ main, develop ]  # Add more branches

# Modify test commands
run: npm test  # or specific test commands
```

### 4. Monitor Results
- Check the **Actions** tab in your GitHub repository
- View test results and coverage reports
- Get notifications on test failures

## Test Commands Used

The workflows use these npm commands from the `tests/` directory:

```bash
npm ci                    # Install dependencies
npm test                  # Run all tests
npm run test:config       # Run ConfigManager tests only
npm run test:analytics    # Run Advanced Post Analytics tests only
npm run test:coverage     # Run tests with coverage report
```

## Expected Output

### ✅ Successful Run
```
✅ All tests completed successfully
📊 Coverage report generated
🎯 Chrome Extension tests validated
✅ manifest.json is valid JSON
✅ File structure check passed
```

### ❌ Failed Run
The workflow will fail if:
- Any test fails
- npm dependencies can't be installed
- manifest.json is invalid
- Required files are missing

## Troubleshooting

### Common Issues

1. **npm ci fails**
   - Check if `tests/package-lock.json` exists
   - Verify Node.js version compatibility

2. **Tests fail in CI but pass locally**
   - Check for environment-specific issues
   - Verify all dependencies are in package.json

3. **Workflow doesn't trigger**
   - Check branch name matches (case-sensitive)
   - Verify GitHub Actions are enabled
   - Check repository permissions

### Debug Steps

1. Check the Actions tab for detailed logs
2. Look at individual step outputs
3. Verify file paths and working directories
4. Test commands locally first

## Benefits

### 🛡️ Quality Assurance
- **Prevents broken code** from reaching main branch
- **Validates all tests** before merging
- **Ensures Chrome extension integrity**

### 🚀 Developer Experience
- **Automatic testing** on every push
- **Clear feedback** on test results
- **Coverage tracking** over time

### 🔄 Continuous Integration
- **Consistent testing environment**
- **Multi-Node.js version support**
- **Integration with GitHub Enterprise**

---

**The GitHub Actions workflows provide automated testing for your Chrome extension, ensuring code quality and preventing regressions with every commit.**
