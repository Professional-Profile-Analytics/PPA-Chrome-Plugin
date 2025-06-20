/**
 * UI Integration Tests
 * 
 * Tests the user interface components and interactions including:
 * - Options page functionality and form validation
 * - Popup interface interactions and status display
 * - Bootstrap UI component integration
 * - Form validation and user input handling
 * - Accessibility features and keyboard navigation
 * - Configuration flow and user experience
 */

describe('UI Integration Tests', () => {
  let mockDocument;
  let mockWindow;
  let mockBootstrap;

  beforeAll(() => {
    // Mock DOM environment for UI testing
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    mockWindow = {
      location: { href: 'chrome-extension://test/options.html' },
      alert: jest.fn(),
      confirm: jest.fn(),
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      }
    };

    // Mock Bootstrap components
    mockBootstrap = {
      Modal: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        hide: jest.fn(),
        toggle: jest.fn()
      })),
      Tooltip: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        hide: jest.fn(),
        enable: jest.fn(),
        disable: jest.fn()
      })),
      Alert: jest.fn().mockImplementation(() => ({
        close: jest.fn()
      }))
    };

    global.document = mockDocument;
    global.window = mockWindow;
    global.bootstrap = mockBootstrap;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete chrome.runtime.lastError;
  });

  describe('Options Page Integration', () => {
    let mockEmailInput;
    let mockPostsLimitSlider;
    let mockAdvancedStatsToggle;
    let mockSaveButton;

    beforeEach(() => {
      // Mock DOM elements for options page
      mockEmailInput = {
        value: '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn(),
          contains: jest.fn()
        },
        setAttribute: jest.fn(),
        removeAttribute: jest.fn()
      };

      mockPostsLimitSlider = {
        value: '30',
        min: '5',
        max: '50',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      mockAdvancedStatsToggle = {
        checked: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      mockSaveButton = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        disabled: false,
        textContent: 'Save Settings'
      };

      mockDocument.getElementById.mockImplementation((id) => {
        switch (id) {
          case 'email': return mockEmailInput;
          case 'postsLimit': return mockPostsLimitSlider;
          case 'advancedPostStats': return mockAdvancedStatsToggle;
          case 'saveButton': return mockSaveButton;
          default: return null;
        }
      });
    });

    it('should load existing configuration on page load', async () => {
      const mockConfig = {
        email: 'test@example.com',
        postsLimit: 25,
        advancedPostStats: true
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockConfig);
      });

      // Simulate options page load
      const loadOptions = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['email', 'postsLimit', 'advancedPostStats'], (result) => {
            if (result.email) mockEmailInput.value = result.email;
            if (result.postsLimit) mockPostsLimitSlider.value = result.postsLimit.toString();
            if (result.advancedPostStats !== undefined) mockAdvancedStatsToggle.checked = result.advancedPostStats;
            resolve(result);
          });
        });
      };

      const config = await loadOptions();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['email', 'postsLimit', 'advancedPostStats'], expect.any(Function));
      expect(mockEmailInput.value).toBe('test@example.com');
      expect(mockPostsLimitSlider.value).toBe('25');
      expect(mockAdvancedStatsToggle.checked).toBe(true);
    });

    it('should validate email input correctly', () => {
      const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      const validEmails = [
        'test@example.com',
        'user.name@company.co.uk',
        'admin+test@domain.org'
      ];

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        ''
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should handle posts limit slider changes', () => {
      const mockSliderOutput = {
        textContent: '30'
      };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'postsLimitValue') return mockSliderOutput;
        if (id === 'postsLimit') return mockPostsLimitSlider;
        return null;
      });

      // Simulate slider change
      const handleSliderChange = (event) => {
        const value = event.target.value;
        mockSliderOutput.textContent = value;
        
        // Validate range
        const numValue = parseInt(value);
        return numValue >= 5 && numValue <= 50;
      };

      // Test valid values
      expect(handleSliderChange({ target: { value: '15' } })).toBe(true);
      expect(mockSliderOutput.textContent).toBe('15');

      expect(handleSliderChange({ target: { value: '50' } })).toBe(true);
      expect(mockSliderOutput.textContent).toBe('50');

      expect(handleSliderChange({ target: { value: '5' } })).toBe(true);
      expect(mockSliderOutput.textContent).toBe('5');

      // Test boundary values
      expect(handleSliderChange({ target: { value: '4' } })).toBe(false);
      expect(handleSliderChange({ target: { value: '51' } })).toBe(false);
    });

    it('should save configuration correctly', async () => {
      mockEmailInput.value = 'user@test.com';
      mockPostsLimitSlider.value = '20';
      mockAdvancedStatsToggle.checked = true;

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const saveOptions = async () => {
        const config = {
          email: mockEmailInput.value,
          postsLimit: parseInt(mockPostsLimitSlider.value),
          advancedPostStats: mockAdvancedStatsToggle.checked
        };

        return new Promise((resolve, reject) => {
          chrome.storage.local.set(config, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(config);
            }
          });
        });
      };

      const savedConfig = await saveOptions();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        email: 'user@test.com',
        postsLimit: 20,
        advancedPostStats: true
      }, expect.any(Function));

      expect(savedConfig.email).toBe('user@test.com');
      expect(savedConfig.postsLimit).toBe(20);
      expect(savedConfig.advancedPostStats).toBe(true);
    });

    it('should handle save errors gracefully', async () => {
      chrome.storage.local.set.mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });

      const saveOptions = async () => {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({}, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      };

      await expect(saveOptions()).rejects.toThrow('Storage quota exceeded');
    });

    it('should show validation feedback for invalid inputs', () => {
      const showValidationFeedback = (element, isValid, message) => {
        if (isValid) {
          element.classList.remove('is-invalid');
          element.classList.add('is-valid');
        } else {
          element.classList.remove('is-valid');
          element.classList.add('is-invalid');
        }
      };

      // Test invalid email
      showValidationFeedback(mockEmailInput, false, 'Invalid email format');
      expect(mockEmailInput.classList.remove).toHaveBeenCalledWith('is-valid');
      expect(mockEmailInput.classList.add).toHaveBeenCalledWith('is-invalid');

      // Test valid email
      showValidationFeedback(mockEmailInput, true, '');
      expect(mockEmailInput.classList.remove).toHaveBeenCalledWith('is-invalid');
      expect(mockEmailInput.classList.add).toHaveBeenCalledWith('is-valid');
    });
  });

  describe('Popup Interface Integration', () => {
    let mockStatusElement;
    let mockLastExecutionElement;
    let mockManualTriggerButton;

    beforeEach(() => {
      mockStatusElement = {
        textContent: '',
        className: ''
      };

      mockLastExecutionElement = {
        textContent: ''
      };

      mockManualTriggerButton = {
        addEventListener: jest.fn(),
        disabled: false,
        textContent: 'Run Now'
      };

      mockDocument.getElementById.mockImplementation((id) => {
        switch (id) {
          case 'status': return mockStatusElement;
          case 'lastExecution': return mockLastExecutionElement;
          case 'manualTrigger': return mockManualTriggerButton;
          default: return null;
        }
      });
    });

    it('should display current execution status', async () => {
      const mockStatus = {
        executionStatus: '✅Success',
        lastExecution: '2025-06-20T09:00:00Z'
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockStatus);
      });

      const updatePopupStatus = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['executionStatus', 'lastExecution'], (result) => {
            if (result.executionStatus) {
              mockStatusElement.textContent = result.executionStatus;
              mockStatusElement.className = result.executionStatus.includes('✅') ? 'text-success' : 'text-danger';
            }
            if (result.lastExecution) {
              const date = new Date(result.lastExecution);
              mockLastExecutionElement.textContent = date.toLocaleString();
            }
            resolve(result);
          });
        });
      };

      await updatePopupStatus();

      expect(mockStatusElement.textContent).toBe('✅Success');
      expect(mockStatusElement.className).toBe('text-success');
      expect(mockLastExecutionElement.textContent).toBe(new Date('2025-06-20T09:00:00Z').toLocaleString());
    });

    it('should handle manual trigger button click', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true, message: 'Manual execution started' });
      });

      const handleManualTrigger = async () => {
        mockManualTriggerButton.disabled = true;
        mockManualTriggerButton.textContent = 'Running...';

        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'manualTrigger' }, (response) => {
            mockManualTriggerButton.disabled = false;
            mockManualTriggerButton.textContent = 'Run Now';
            resolve(response);
          });
        });
      };

      const response = await handleManualTrigger();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'manualTrigger' }, expect.any(Function));
      expect(response.success).toBe(true);
      expect(mockManualTriggerButton.disabled).toBe(false);
      expect(mockManualTriggerButton.textContent).toBe('Run Now');
    });

    it('should show error status correctly', async () => {
      const mockErrorStatus = {
        executionStatus: '❌Failed: Network error',
        lastExecution: '2025-06-20T08:30:00Z'
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockErrorStatus);
      });

      const updatePopupStatus = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['executionStatus', 'lastExecution'], (result) => {
            if (result.executionStatus) {
              mockStatusElement.textContent = result.executionStatus;
              mockStatusElement.className = result.executionStatus.includes('✅') ? 'text-success' : 'text-danger';
            }
            resolve(result);
          });
        });
      };

      await updatePopupStatus();

      expect(mockStatusElement.textContent).toBe('❌Failed: Network error');
      expect(mockStatusElement.className).toBe('text-danger');
    });

    it('should handle popup loading errors', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Storage access denied' };
        callback({});
      });

      const loadPopupData = async () => {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(['executionStatus'], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      };

      await expect(loadPopupData()).rejects.toThrow('Storage access denied');
    });
  });

  describe('Bootstrap Component Integration', () => {
    it('should initialize Bootstrap modals correctly', () => {
      const mockModalElement = {
        id: 'settingsModal',
        classList: { contains: jest.fn().mockReturnValue(true) }
      };

      mockDocument.getElementById.mockReturnValue(mockModalElement);

      const initializeModal = (modalId) => {
        const modalElement = mockDocument.getElementById(modalId);
        if (modalElement) {
          return new mockBootstrap.Modal(modalElement);
        }
        return null;
      };

      const modal = initializeModal('settingsModal');

      expect(mockBootstrap.Modal).toHaveBeenCalledWith(mockModalElement);
      expect(modal).toBeDefined();
      expect(modal.show).toBeDefined();
      expect(modal.hide).toBeDefined();
    });

    it('should initialize Bootstrap tooltips correctly', () => {
      const mockTooltipElements = [
        { getAttribute: jest.fn().mockReturnValue('Tooltip text 1') },
        { getAttribute: jest.fn().mockReturnValue('Tooltip text 2') }
      ];

      mockDocument.querySelectorAll.mockReturnValue(mockTooltipElements);

      const initializeTooltips = () => {
        const tooltipElements = mockDocument.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltips = [];
        
        tooltipElements.forEach(element => {
          tooltips.push(new mockBootstrap.Tooltip(element));
        });
        
        return tooltips;
      };

      const tooltips = initializeTooltips();

      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('[data-bs-toggle="tooltip"]');
      expect(mockBootstrap.Tooltip).toHaveBeenCalledTimes(2);
      expect(tooltips).toHaveLength(2);
    });

    it('should handle Bootstrap alert dismissal', () => {
      const mockAlertElement = {
        classList: { add: jest.fn(), remove: jest.fn() },
        style: { display: '' }
      };

      mockDocument.querySelector.mockReturnValue(mockAlertElement);

      const dismissAlert = (alertSelector) => {
        const alertElement = mockDocument.querySelector(alertSelector);
        if (alertElement) {
          const alert = new mockBootstrap.Alert(alertElement);
          alert.close();
          return true;
        }
        return false;
      };

      const result = dismissAlert('.alert-success');

      expect(mockDocument.querySelector).toHaveBeenCalledWith('.alert-success');
      expect(mockBootstrap.Alert).toHaveBeenCalledWith(mockAlertElement);
      expect(result).toBe(true);
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate form submission', () => {
      const mockForm = {
        checkValidity: jest.fn().mockReturnValue(true),
        reportValidity: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      };

      const validateForm = (form) => {
        const isValid = form.checkValidity();
        
        if (isValid) {
          form.classList.remove('was-validated');
          form.classList.add('was-validated');
        } else {
          form.reportValidity();
        }
        
        return isValid;
      };

      const isValid = validateForm(mockForm);

      expect(mockForm.checkValidity).toHaveBeenCalled();
      expect(isValid).toBe(true);
      expect(mockForm.classList.add).toHaveBeenCalledWith('was-validated');
    });

    it('should handle invalid form submission', () => {
      const mockForm = {
        checkValidity: jest.fn().mockReturnValue(false),
        reportValidity: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      };

      const validateForm = (form) => {
        const isValid = form.checkValidity();
        
        if (!isValid) {
          form.reportValidity();
        }
        
        return isValid;
      };

      const isValid = validateForm(mockForm);

      expect(mockForm.checkValidity).toHaveBeenCalled();
      expect(mockForm.reportValidity).toHaveBeenCalled();
      expect(isValid).toBe(false);
    });

    it('should validate posts limit range', () => {
      const validatePostsLimit = (value) => {
        const numValue = parseInt(value);
        return !isNaN(numValue) && numValue >= 5 && numValue <= 50;
      };

      expect(validatePostsLimit('5')).toBe(true);
      expect(validatePostsLimit('30')).toBe(true);
      expect(validatePostsLimit('50')).toBe(true);
      
      expect(validatePostsLimit('4')).toBe(false);
      expect(validatePostsLimit('51')).toBe(false);
      expect(validatePostsLimit('abc')).toBe(false);
      expect(validatePostsLimit('')).toBe(false);
    });
  });

  describe('Accessibility Integration', () => {
    it('should support keyboard navigation', () => {
      const mockElements = [
        { tabIndex: 0, focus: jest.fn() },
        { tabIndex: 1, focus: jest.fn() },
        { tabIndex: 2, focus: jest.fn() }
      ];

      const handleKeyboardNavigation = (event, elements) => {
        if (event.key === 'Tab') {
          const currentIndex = elements.findIndex(el => el === event.target);
          const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
          
          if (nextIndex >= 0 && nextIndex < elements.length) {
            elements[nextIndex].focus();
            return true;
          }
        }
        return false;
      };

      const mockEvent = { key: 'Tab', shiftKey: false, target: mockElements[0] };
      const handled = handleKeyboardNavigation(mockEvent, mockElements);

      expect(handled).toBe(true);
      expect(mockElements[1].focus).toHaveBeenCalled();
    });

    it('should provide ARIA labels for screen readers', () => {
      const addAriaLabels = (element, label, description) => {
        element.setAttribute('aria-label', label);
        if (description) {
          element.setAttribute('aria-describedby', description);
        }
      };

      const mockElement = {
        setAttribute: jest.fn()
      };

      addAriaLabels(mockElement, 'Email input field', 'Enter your email address');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-label', 'Email input field');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'Enter your email address');
    });

    it('should announce status changes to screen readers', () => {
      const announceToScreenReader = (message) => {
        const announcement = mockDocument.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.textContent = message;
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        
        return announcement;
      };

      mockDocument.createElement.mockReturnValue({
        setAttribute: jest.fn(),
        style: {},
        textContent: ''
      });

      const announcement = announceToScreenReader('Settings saved successfully');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(announcement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(announcement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
    });
  });

  describe('Configuration Flow Integration', () => {
    it('should guide users through initial setup', async () => {
      const mockSetupSteps = [
        { id: 'step1', completed: false, element: { classList: { add: jest.fn(), remove: jest.fn() } } },
        { id: 'step2', completed: false, element: { classList: { add: jest.fn(), remove: jest.fn() } } },
        { id: 'step3', completed: false, element: { classList: { add: jest.fn(), remove: jest.fn() } } }
      ];

      const updateSetupProgress = (steps, currentStep) => {
        steps.forEach((step, index) => {
          if (index < currentStep) {
            step.completed = true;
            step.element.classList.add('completed');
          } else if (index === currentStep) {
            step.element.classList.add('active');
          } else {
            step.element.classList.remove('active', 'completed');
          }
        });
      };

      updateSetupProgress(mockSetupSteps, 1);

      expect(mockSetupSteps[0].completed).toBe(true);
      expect(mockSetupSteps[0].element.classList.add).toHaveBeenCalledWith('completed');
      expect(mockSetupSteps[1].element.classList.add).toHaveBeenCalledWith('active');
    });

    it('should validate complete configuration', () => {
      const validateConfiguration = (config) => {
        const errors = [];
        
        if (!config.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
          errors.push('Valid email is required');
        }
        
        if (!config.postsLimit || config.postsLimit < 5 || config.postsLimit > 50) {
          errors.push('Posts limit must be between 5 and 50');
        }
        
        return {
          isValid: errors.length === 0,
          errors: errors
        };
      };

      const validConfig = {
        email: 'test@example.com',
        postsLimit: 30,
        advancedPostStats: true
      };

      const invalidConfig = {
        email: 'invalid-email',
        postsLimit: 100
      };

      const validResult = validateConfiguration(validConfig);
      const invalidResult = validateConfiguration(invalidConfig);

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Valid email is required');
      expect(invalidResult.errors).toContain('Posts limit must be between 5 and 50');
    });
  });
});
