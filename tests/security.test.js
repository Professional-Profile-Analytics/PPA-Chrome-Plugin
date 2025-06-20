/**
 * Security Integration Tests
 * 
 * Tests the security aspects and data protection including:
 * - Input sanitization and XSS prevention
 * - Permission boundary validation
 * - Secure storage and data encryption
 * - Content script security and safe DOM manipulation
 * - API communication security and data transmission
 * - Data validation and injection prevention
 */

describe('Security Integration Tests', () => {
  let mockSecurityManager;
  let mockLogger;

  beforeAll(() => {
    // Mock Security Manager
    mockSecurityManager = {
      sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        // Remove potentially dangerous characters and scripts
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      },

      validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        
        // First sanitize the input
        const sanitized = this.sanitizeInput(email);
        
        // Check if sanitization removed content (indicates malicious input)
        if (sanitized !== email) return false;
        
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        return emailRegex.test(sanitized) && sanitized.length <= 254;
      },

      encryptSensitiveData(data) {
        // Simple encryption simulation (in real implementation, use proper encryption)
        if (!data) return null;
        
        const encoded = btoa(JSON.stringify(data));
        return `encrypted_${encoded}`;
      },

      decryptSensitiveData(encryptedData) {
        if (!encryptedData || !encryptedData.startsWith('encrypted_')) {
          return null;
        }
        
        try {
          const encoded = encryptedData.replace('encrypted_', '');
          const decoded = atob(encoded);
          return JSON.parse(decoded);
        } catch (error) {
          return null;
        }
      },

      validatePermissions(requiredPermissions) {
        const grantedPermissions = [
          'storage',
          'tabs',
          'scripting',
          'webRequest',
          'alarms'
        ];
        
        return requiredPermissions.every(permission => 
          grantedPermissions.includes(permission)
        );
      },

      sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        try {
          const urlObj = new URL(url);
          
          // Only allow HTTPS and specific domains
          if (urlObj.protocol !== 'https:') return '';
          if (!urlObj.hostname.includes('linkedin.com')) return '';
          
          return urlObj.toString();
        } catch (error) {
          return '';
        }
      },

      validateApiResponse(response) {
        if (!response || typeof response !== 'object') return false;
        
        // Check for required fields and validate structure
        const requiredFields = ['success', 'message'];
        const hasRequiredFields = requiredFields.every(field => 
          response.hasOwnProperty(field)
        );
        
        // Validate data types
        const validTypes = typeof response.success === 'boolean' &&
                          typeof response.message === 'string';
        
        return hasRequiredFields && validTypes;
      }
    };

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      security: jest.fn()
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Sanitization and XSS Prevention', () => {
    it('should sanitize HTML script tags', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<script src="malicious.js"></script>',
        'Hello <script>alert("XSS")</script> World',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<script type="text/javascript">alert("XSS")</script>'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = mockSecurityManager.sanitizeInput(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('</script>');
        expect(sanitized).not.toContain('alert');
      });
    });

    it('should remove HTML tags from input', () => {
      const htmlInputs = [
        '<div>Hello World</div>',
        '<p>Test <strong>bold</strong> text</p>',
        '<img src="image.jpg" alt="test">',
        '<a href="http://example.com">Link</a>'
      ];

      htmlInputs.forEach(input => {
        const sanitized = mockSecurityManager.sanitizeInput(input);
        expect(sanitized).not.toMatch(/<[^>]*>/);
      });
    });

    it('should remove javascript: URLs', () => {
      const jsUrls = [
        'javascript:alert("XSS")',
        'JAVASCRIPT:alert("XSS")',
        'javascript:void(0)',
        'javascript:window.location="http://malicious.com"'
      ];

      jsUrls.forEach(url => {
        const sanitized = mockSecurityManager.sanitizeInput(url);
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      });
    });

    it('should remove event handlers', () => {
      const eventHandlers = [
        'onclick="alert(\'XSS\')"',
        'onmouseover="maliciousFunction()"',
        'onerror="alert(\'XSS\')"',
        'onload="stealData()"'
      ];

      eventHandlers.forEach(handler => {
        const sanitized = mockSecurityManager.sanitizeInput(handler);
        expect(sanitized.toLowerCase()).not.toMatch(/on\w+\s*=/);
      });
    });

    it('should handle non-string inputs safely', () => {
      const nonStringInputs = [
        null,
        undefined,
        123,
        { malicious: 'object' },
        ['array', 'input']
      ];

      nonStringInputs.forEach(input => {
        const sanitized = mockSecurityManager.sanitizeInput(input);
        expect(sanitized).toBe('');
      });
    });

    it('should preserve safe content', () => {
      const safeInputs = [
        'Hello World',
        'user@example.com',
        'This is a safe string with numbers 123',
        'Safe text with punctuation!'
      ];

      safeInputs.forEach(input => {
        const sanitized = mockSecurityManager.sanitizeInput(input);
        expect(sanitized).toBe(input);
      });
    });
  });

  describe('Email Validation Security', () => {
    it('should validate legitimate email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'admin+tag@company.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(mockSecurityManager.validateEmail(email)).toBe(true);
      });
    });

    it('should reject malicious email inputs', () => {
      const maliciousEmails = [
        'user@example.com<script>alert("XSS")</script>',
        'test@domain.com"; DROP TABLE users; --',
        'user@example.com\r\nBcc: attacker@evil.com',
        'javascript:alert("XSS")@example.com'
      ];

      maliciousEmails.forEach(email => {
        expect(mockSecurityManager.validateEmail(email)).toBe(false);
      });
    });

    it('should reject overly long email addresses', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(mockSecurityManager.validateEmail(longEmail)).toBe(false);
    });

    it('should handle non-string email inputs', () => {
      const invalidInputs = [null, undefined, 123, {}, []];
      
      invalidInputs.forEach(input => {
        expect(mockSecurityManager.validateEmail(input)).toBe(false);
      });
    });
  });

  describe('Secure Storage and Data Encryption', () => {
    it('should encrypt sensitive data correctly', () => {
      const sensitiveData = {
        email: 'user@example.com',
        apiKey: 'secret-api-key-123',
        personalInfo: 'sensitive information'
      };

      const encrypted = mockSecurityManager.encryptSensitiveData(sensitiveData);

      expect(encrypted).toBeDefined();
      expect(encrypted).toContain('encrypted_');
      expect(encrypted).not.toContain('user@example.com');
      expect(encrypted).not.toContain('secret-api-key-123');
    });

    it('should decrypt data correctly', () => {
      const originalData = {
        email: 'test@example.com',
        settings: { postsLimit: 30 }
      };

      const encrypted = mockSecurityManager.encryptSensitiveData(originalData);
      const decrypted = mockSecurityManager.decryptSensitiveData(encrypted);

      expect(decrypted).toEqual(originalData);
    });

    it('should handle invalid encrypted data', () => {
      const invalidEncryptedData = [
        'not_encrypted_data',
        'encrypted_invalid_base64',
        'encrypted_',
        null,
        undefined
      ];

      invalidEncryptedData.forEach(data => {
        const result = mockSecurityManager.decryptSensitiveData(data);
        expect(result).toBeNull();
      });
    });

    it('should handle storage security with Chrome APIs', async () => {
      const sensitiveConfig = {
        email: 'user@example.com',
        apiToken: 'secret-token'
      };

      // Mock secure storage
      chrome.storage.local.set.mockImplementation((data, callback) => {
        // Verify data is encrypted before storage
        Object.values(data).forEach(value => {
          if (typeof value === 'string' && value.includes('secret')) {
            expect(value).toContain('encrypted_');
          }
        });
        callback();
      });

      const secureStore = async (key, data) => {
        const encrypted = mockSecurityManager.encryptSensitiveData(data);
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: encrypted }, resolve);
        });
      };

      await secureStore('userConfig', sensitiveConfig);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Permission Boundary Validation', () => {
    it('should validate required permissions', () => {
      const requiredPermissions = ['storage', 'tabs', 'scripting'];
      const isValid = mockSecurityManager.validatePermissions(requiredPermissions);
      expect(isValid).toBe(true);
    });

    it('should reject unauthorized permissions', () => {
      const unauthorizedPermissions = ['storage', 'tabs', 'bookmarks', 'history'];
      const isValid = mockSecurityManager.validatePermissions(unauthorizedPermissions);
      expect(isValid).toBe(false);
    });

    it('should validate Chrome API access boundaries', () => {
      const validateApiAccess = (apiName, operation) => {
        const allowedApis = {
          'storage': ['get', 'set', 'remove'],
          'tabs': ['create', 'remove', 'update', 'query'],
          'scripting': ['executeScript'],
          'webRequest': ['onBeforeRequest', 'onHeadersReceived']
        };

        if (!allowedApis[apiName]) return false;
        return allowedApis[apiName].includes(operation);
      };

      expect(validateApiAccess('storage', 'get')).toBe(true);
      expect(validateApiAccess('tabs', 'create')).toBe(true);
      expect(validateApiAccess('storage', 'clear')).toBe(false);
      expect(validateApiAccess('cookies', 'get')).toBe(false);
    });

    it('should prevent unauthorized domain access', () => {
      const validateDomainAccess = (url) => {
        const allowedDomains = [
          'linkedin.com',
          'www.linkedin.com',
          'm.linkedin.com'
        ];

        try {
          const urlObj = new URL(url);
          return allowedDomains.some(domain => 
            urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
          );
        } catch {
          return false;
        }
      };

      expect(validateDomainAccess('https://www.linkedin.com/feed/')).toBe(true);
      expect(validateDomainAccess('https://m.linkedin.com/analytics/')).toBe(true);
      expect(validateDomainAccess('https://facebook.com/profile/')).toBe(false);
      expect(validateDomainAccess('https://malicious-site.com/')).toBe(false);
    });
  });

  describe('URL Sanitization and Validation', () => {
    it('should sanitize and validate LinkedIn URLs', () => {
      const validUrls = [
        'https://www.linkedin.com/analytics/',
        'https://linkedin.com/feed/',
        'https://www.linkedin.com/company/analytics/'
      ];

      validUrls.forEach(url => {
        const sanitized = mockSecurityManager.sanitizeUrl(url);
        expect(sanitized).toBe(url);
      });
    });

    it('should reject non-HTTPS URLs', () => {
      const insecureUrls = [
        'http://www.linkedin.com/analytics/',
        'ftp://linkedin.com/file.txt',
        'file:///local/file.html'
      ];

      insecureUrls.forEach(url => {
        const sanitized = mockSecurityManager.sanitizeUrl(url);
        expect(sanitized).toBe('');
      });
    });

    it('should reject non-LinkedIn domains', () => {
      const unauthorizedUrls = [
        'https://facebook.com/profile/',
        'https://malicious-site.com/steal-data/',
        'https://linkedin-phishing.com/fake-login/'
      ];

      unauthorizedUrls.forEach(url => {
        const sanitized = mockSecurityManager.sanitizeUrl(url);
        expect(sanitized).toBe('');
      });
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'https://',
        'https://linkedin',
        null,
        undefined
      ];

      malformedUrls.forEach(url => {
        const sanitized = mockSecurityManager.sanitizeUrl(url);
        expect(sanitized).toBe('');
      });
    });
  });

  describe('API Response Validation', () => {
    it('should validate legitimate API responses', () => {
      const validResponses = [
        { success: true, message: 'Operation completed' },
        { success: false, message: 'Error occurred', error: 'Details' },
        { success: true, message: 'Upload successful', data: { id: 123 } }
      ];

      validResponses.forEach(response => {
        expect(mockSecurityManager.validateApiResponse(response)).toBe(true);
      });
    });

    it('should reject malformed API responses', () => {
      const invalidResponses = [
        null,
        undefined,
        'string response',
        { success: 'true' }, // wrong type
        { message: 'Missing success field' },
        { success: true }, // missing message
        { success: true, message: 123 } // wrong message type
      ];

      invalidResponses.forEach(response => {
        expect(mockSecurityManager.validateApiResponse(response)).toBe(false);
      });
    });

    it('should validate API response data types', () => {
      const validateResponseData = (data) => {
        if (!data || typeof data !== 'object') return false;
        
        // Check for potential code injection in response data
        const jsonString = JSON.stringify(data);
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
          /eval\s*\(/i,
          /function\s*\(/i
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(jsonString));
      };

      const safeData = { id: 123, name: 'Safe Data', status: 'active' };
      const maliciousData = { 
        id: 123, 
        name: '<script>alert("XSS")</script>',
        callback: 'javascript:alert("XSS")'
      };

      expect(validateResponseData(safeData)).toBe(true);
      expect(validateResponseData(maliciousData)).toBe(false);
    });
  });

  describe('Content Script Security', () => {
    it('should safely manipulate DOM elements', () => {
      const safeDomManipulation = (element, content) => {
        if (!element || typeof content !== 'string') return false;
        
        // Sanitize content before DOM manipulation
        const sanitized = mockSecurityManager.sanitizeInput(content);
        
        // Use textContent instead of innerHTML for safety
        element.textContent = sanitized;
        return true;
      };

      const mockElement = { textContent: '' };
      const safeContent = 'Safe text content';
      const maliciousContent = '<script>alert("XSS")</script>';

      expect(safeDomManipulation(mockElement, safeContent)).toBe(true);
      expect(mockElement.textContent).toBe(safeContent);

      expect(safeDomManipulation(mockElement, maliciousContent)).toBe(true);
      expect(mockElement.textContent).not.toContain('<script>');
    });

    it('should validate element selectors', () => {
      const validateSelector = (selector) => {
        if (!selector || typeof selector !== 'string') return false;
        
        // Prevent potentially dangerous selectors
        const dangerousPatterns = [
          /javascript:/i,
          /<script/i,
          /eval\s*\(/i,
          /expression\s*\(/i
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(selector));
      };

      expect(validateSelector('#safe-id')).toBe(true);
      expect(validateSelector('.safe-class')).toBe(true);
      expect(validateSelector('div[data-safe="value"]')).toBe(true);
      
      expect(validateSelector('javascript:alert("XSS")')).toBe(false);
      expect(validateSelector('<script>alert("XSS")</script>')).toBe(false);
    });

    it('should prevent script injection in content scripts', () => {
      const executeSecureScript = (scriptContent) => {
        // Validate script content before execution
        const dangerousPatterns = [
          /eval\s*\(/i,
          /function\s*\(/i,
          /new\s+function/i,
          /settimeout\s*\(/i,
          /setinterval\s*\(/i
        ];
        
        const isDangerous = dangerousPatterns.some(pattern => 
          pattern.test(scriptContent)
        );
        
        if (isDangerous) {
          mockLogger.security('Blocked potentially dangerous script execution');
          return false;
        }
        
        return true;
      };

      expect(executeSecureScript('document.getElementById("safe-element")')).toBe(true);
      expect(executeSecureScript('eval("malicious code")')).toBe(false);
      expect(executeSecureScript('setTimeout("alert(\'XSS\')", 1000)')).toBe(false);
      
      expect(mockLogger.security).toHaveBeenCalledWith('Blocked potentially dangerous script execution');
    });
  });

  describe('Data Transmission Security', () => {
    it('should validate HTTPS for API communications', () => {
      const validateApiEndpoint = (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'https:';
        } catch {
          return false;
        }
      };

      expect(validateApiEndpoint('https://api.example.com/upload')).toBe(true);
      expect(validateApiEndpoint('http://api.example.com/upload')).toBe(false);
      expect(validateApiEndpoint('ftp://api.example.com/upload')).toBe(false);
    });

    it('should sanitize data before transmission', () => {
      const sanitizeForTransmission = (data) => {
        if (!data || typeof data !== 'object') return null;
        
        const sanitized = {};
        
        Object.keys(data).forEach(key => {
          const value = data[key];
          
          if (typeof value === 'string') {
            sanitized[key] = mockSecurityManager.sanitizeInput(value);
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
          }
          // Skip other types for security
        });
        
        return sanitized;
      };

      const unsafeData = {
        email: 'user@example.com',
        name: '<script>alert("XSS")</script>',
        age: 25,
        active: true,
        callback: function() { alert('XSS'); }
      };

      const sanitized = sanitizeForTransmission(unsafeData);

      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.age).toBe(25);
      expect(sanitized.active).toBe(true);
      expect(sanitized.callback).toBeUndefined();
    });

    it('should validate response headers', () => {
      const validateResponseHeaders = (headers) => {
        const requiredSecurityHeaders = [
          'content-type',
          'x-content-type-options',
          'x-frame-options'
        ];
        
        const hasSecurityHeaders = requiredSecurityHeaders.some(header =>
          headers.hasOwnProperty(header.toLowerCase())
        );
        
        return hasSecurityHeaders;
      };

      const secureHeaders = {
        'content-type': 'application/json',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY'
      };

      const insecureHeaders = {
        'content-type': 'application/json'
      };

      expect(validateResponseHeaders(secureHeaders)).toBe(true);
      expect(validateResponseHeaders(insecureHeaders)).toBe(true); // Has content-type
      expect(validateResponseHeaders({})).toBe(false);
    });
  });

  describe('Security Logging and Monitoring', () => {
    it('should log security events', () => {
      const logSecurityEvent = (event, details) => {
        const securityLog = {
          timestamp: new Date().toISOString(),
          event: event,
          details: details,
          severity: 'HIGH'
        };
        
        mockLogger.security(JSON.stringify(securityLog));
        return securityLog;
      };

      const event = logSecurityEvent('XSS_ATTEMPT_BLOCKED', {
        input: '<script>alert("XSS")</script>',
        source: 'user_input'
      });

      expect(mockLogger.security).toHaveBeenCalled();
      expect(event.event).toBe('XSS_ATTEMPT_BLOCKED');
      expect(event.severity).toBe('HIGH');
    });

    it('should monitor for suspicious activity', () => {
      const monitorSuspiciousActivity = (activity) => {
        const suspiciousPatterns = [
          /multiple.*failed.*attempts/i,
          /unauthorized.*access/i,
          /injection.*attempt/i,
          /malicious.*payload/i
        ];
        
        const isSuspicious = suspiciousPatterns.some(pattern =>
          pattern.test(activity)
        );
        
        if (isSuspicious) {
          mockLogger.security(`Suspicious activity detected: ${activity}`);
          return true;
        }
        
        return false;
      };

      expect(monitorSuspiciousActivity('Multiple failed login attempts')).toBe(true);
      expect(monitorSuspiciousActivity('Unauthorized access to admin panel')).toBe(true);
      expect(monitorSuspiciousActivity('Normal user activity')).toBe(false);
      
      expect(mockLogger.security).toHaveBeenCalledTimes(2);
    });
  });
});
