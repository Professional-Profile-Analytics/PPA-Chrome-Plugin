# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Professional Profile Analytics Chrome Extension.

## Workflows

### 🧪 `ci.yml` - Continuous Integration (Recommended)
**Triggers:** Push to `main` branch, Pull Requests to `main`

**What it does:**
- ✅ Runs all tests (ConfigManager + Advanced Post Analytics)
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

## GitHub Enterprise Compatibility

Both workflows are designed to work with **GitHub Enterprise** environments:

- ✅ Uses standard GitHub Actions (`checkout@v4`, `setup-node@v4`)
- ✅ No external dependencies beyond npm packages
- ✅ Works with private repositories
- ✅ Compatible with GitHub Enterprise Server
- ✅ Uses `working-directory` for proper path handling

## Setup Instructions

### 1. Enable GitHub Actions
Ensure GitHub Actions are enabled in your GitHub Enterprise instance and repository settings.

### 2. Choose Your Workflow
- **For most cases**: Use `ci.yml` (simpler, faster)
- **For comprehensive testing**: Use `test.yml` (multi-node, coverage upload)

### 3. Customize if Needed
Edit the workflow files to match your specific requirements:

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
