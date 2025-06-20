# Developer Documentation - PPA Chrome Extension

**Technical documentation for developers working on the Professional Profile Analytics Chrome Extension.**

## 🏗️ **Architecture Overview**

### **Core Components**
- **`manifest.json`** - Chrome Extension manifest (v3)
- **`background.js`** - Service worker handling automation logic
- **`popup.html/js/css`** - Extension popup interface
- **`options.html/js/css`** - Extension settings page
- **`content.js`** - Content script for LinkedIn page interaction
- **`icons/`** - Extension icon assets

### **Key Features**
- **LinkedIn Analytics Automation** - Individual and company page data collection
- **Multi-language Support** - EN/DE/ES/FR LinkedIn interface compatibility
- **Shiny Integration** - R Shiny app communication for post creation
- **Advanced Post Analytics** - Configurable post limits (5-50 posts)
- **Smart Retry System** - Automatic failure recovery
- **Professional Logging** - Clean production-ready output

## 🧪 **Test Coverage**

This extension has comprehensive test coverage with **154 automated tests** across 5 test suites:

### **📊 Test Suite Summary**
| Test Suite | Tests | Coverage |
|------------|-------|----------|
| **ConfigManager** | 24 | Configuration management, storage operations |
| **Advanced Post Analytics** | 20 | Posts limit slider, URL processing, success messages |
| **Download Tracking** | 25 | WebRequest API, LinkedIn URL capture, promise management |
| **Language Detection** | 43 | Multi-language support (EN/DE/ES/FR), UI element detection |
| **File Upload Integration** | 42 | API endpoints, base64 encoding, error handling |
| **Total** | **154** | **Complete feature coverage** |

### **🚀 Running Tests**
```bash
cd tests
npm test                    # Run all 154 tests
node run-tests.js config    # ConfigManager tests only
node run-tests.js analytics # Advanced Analytics tests only
node run-tests.js download  # Download Tracking tests only
node run-tests.js language  # Language Detection tests only
node run-tests.js upload    # File Upload tests only
```

### **✅ Quality Assurance**
- **Automated CI/CD** - GitHub Actions run all tests on every push
- **100% Feature Coverage** - All major functionality tested
- **Error Handling** - Comprehensive edge case and error scenario testing
- **Performance Testing** - Memory management and efficiency validation
- **Cross-Language Testing** - Multi-language LinkedIn interface support

## 🚀 **Creating New Releases**

### **GitHub Workflow Process**
The extension uses GitHub Actions for automated package creation:

1. **Create and Push Version Tag**:
   ```bash
   git tag v1.7.5
   git push origin v1.7.5
   ```

2. **Automated Build Process**:
   - GitHub Actions workflow triggers on tag push
   - Creates `ppa-chrome-extension-X.X.X` artifact
   - Validates manifest.json and required files
   - Runs all 154 tests for quality assurance

3. **Download Package**:
   - Go to **Actions** tab in GitHub repository
   - Find the **"Build Chrome Extension"** workflow run
   - Download the artifact ZIP file
   - Extract to get the Chrome Extension folder

### **Manual Version Updates**
Update version numbers in:
- `manifest.json` - `"version": "1.7.5"`
- `README.md` - Version history section
- `DEVELOPER.md` - This file

## 🛠️ **Development Setup**

### **Prerequisites**
- Node.js (for running tests)
- Chrome browser
- Git

### **Local Development**
1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-repo/PPA-Chrome-Plugin.git
   cd PPA-Chrome-Plugin
   ```

2. **Install Test Dependencies**:
   ```bash
   cd tests
   npm install
   ```

3. **Load Extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **"Load unpacked"**
   - Select the project root directory

4. **Run Tests**:
   ```bash
   cd tests
   npm test
   ```

## 🔧 **Implementation Details**

### **Analytics Collection Process**
1. **Background Service Worker** opens LinkedIn in background tab
2. **Content Script** navigates to analytics sections
3. **Export Button Detection** using multi-language selectors
4. **File Download** with WebRequest API monitoring
5. **Data Upload** to PPA service endpoints
6. **Clean Logging** with progress tracking

### **Multi-Language Support**
The extension supports LinkedIn interfaces in multiple languages through:

```javascript
const LANGUAGE_DICTIONARY = {
  en: { export: 'Export', analytics: 'Analytics' },
  de: { export: 'Exportieren', analytics: 'Analysen' },
  es: { export: 'Exportar', analytics: 'Analíticas' },
  fr: { export: 'Exporter', analytics: 'Analyses' }
};
```

### **Adding New Languages**
To add support for a new language:

1. **Locate** the `LANGUAGE_DICTIONARY` in `background.js`
2. **Add New Entry**:
   ```javascript
   it: {
     export: 'Esporta',
     analytics: 'Analisi',
     postImpressions: 'Impressioni del post',
     // ... other translations
   }
   ```
3. **Test** with Italian LinkedIn interface
4. **Update Tests** in `tests/languageDetection.test.js`

### **Shiny Integration**
The extension supports R Shiny app communication:

```javascript
// In Shiny app
chrome.runtime.sendMessage(extensionId, {
  action: "openTabAndType",
  url: "https://www.linkedin.com/feed/",
  text: postContent,
  delay: 100,
  autoSubmit: false
}, callback);
```

## 🧩 **Extending the Extension**

### **Adding New Features**
1. **Update `manifest.json`** with new permissions if needed
2. **Implement Logic** in `background.js` or content scripts
3. **Add UI Elements** to popup or options pages
4. **Write Tests** in appropriate test suite
5. **Update Documentation** in this file

### **API Integration**
The extension communicates with PPA service endpoints:
- **Individual Analytics**: POST to `/individual-analytics`
- **Company Analytics**: POST to `/company-analytics`
- **Configuration**: Stored in Chrome local storage

### **Error Handling**
Comprehensive error handling includes:
- **Retry Mechanisms** for failed operations
- **Detailed Logging** for debugging
- **User Notifications** for critical errors
- **Graceful Degradation** for missing features

## 🔍 **Troubleshooting**

### **Common Development Issues**

#### **Extension Not Loading**
- Check `manifest.json` syntax
- Verify all file paths exist
- Look for console errors in Chrome DevTools

#### **Tests Failing**
- Run `npm install` in tests directory
- Check Node.js version compatibility
- Verify test file paths and imports

#### **LinkedIn Automation Issues**
- Check if LinkedIn UI has changed
- Verify language detection is working
- Test with different LinkedIn interface languages

#### **Build Process Failing**
- Ensure all required files are present
- Check GitHub Actions workflow logs
- Verify tag format matches `v*` pattern

### **Debug Mode**
Enable detailed logging by setting debug flags in `background.js`:
```javascript
const DEBUG_MODE = true;
const VERBOSE_LOGGING = true;
```

## 📚 **Additional Resources**

- **Chrome Extension Documentation**: https://developer.chrome.com/docs/extensions/
- **Manifest V3 Guide**: https://developer.chrome.com/docs/extensions/mv3/
- **Testing Best Practices**: https://jestjs.io/docs/getting-started
- **GitHub Actions**: https://docs.github.com/en/actions

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch
3. **Write Tests** for new functionality
4. **Ensure** all 154 tests pass
5. **Submit** a pull request with detailed description

## 📄 **License**

See LICENSE file in the repository root.

---

**For end-user documentation, see the main [README.md](README.md)**
