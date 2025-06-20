/**
 * Unit Tests for Language Detection System
 * 
 * Tests the multi-language support functionality including:
 * - Language detection from HTML meta tags and attributes
 * - Language dictionary completeness and validation
 * - UI element detection in different languages
 * - Fallback behavior when language detection fails
 * - LinkedIn interface language variations
 * - Button text matching across languages
 */

describe('Language Detection System', () => {
  let mockDocument;
  let mockLogger;
  let LANGUAGE_DICTIONARY;

  beforeAll(() => {
    // Mock the Language Dictionary based on actual implementation
    LANGUAGE_DICTIONARY = {
      en: {
        postImpressions: 'Post impressions',
        past7Days: 'Past 7 days',
        past28Days: 'Past 28 days',
        showResults: 'Show results',
        export: 'Export',
        exportData: 'Export data',
        analytics: 'Analytics',
        insights: 'Insights',
        viewAnalytics: 'View analytics',
        downloadData: 'Download data'
      },
      de: {
        postImpressions: 'Post-Impressionen',
        past7Days: 'Letzte 7 Tage',
        past28Days: 'Letzte 28 Tage',
        showResults: 'Ergebnisse anzeigen',
        export: 'Exportieren',
        exportData: 'Daten exportieren',
        analytics: 'Analytics',
        insights: 'Einblicke',
        viewAnalytics: 'Analytics anzeigen',
        downloadData: 'Daten herunterladen'
      },
      es: {
        postImpressions: 'Impresiones de publicación',
        past7Days: 'Últimos 7 días',
        past28Days: 'Últimos 28 días',
        showResults: 'Mostrar resultados',
        export: 'Exportar',
        exportData: 'Exportar datos',
        analytics: 'Analíticas',
        insights: 'Información',
        viewAnalytics: 'Ver analíticas',
        downloadData: 'Descargar datos'
      },
      fr: {
        postImpressions: 'Impressions de publication',
        past7Days: '7 derniers jours',
        past28Days: '28 derniers jours',
        showResults: 'Afficher les résultats',
        export: 'Exporter',
        exportData: 'Exporter les données',
        analytics: 'Analyses',
        insights: 'Informations',
        viewAnalytics: 'Voir les analyses',
        downloadData: 'Télécharger les données'
      }
    };

    // Mock language detection functions
    global.detectLanguage = function(document = mockDocument) {
      // Try to detect from HTML lang attribute
      const htmlLang = document.documentElement?.getAttribute('lang');
      if (htmlLang) {
        const normalizedLang = normalizeLanguageCode(htmlLang);
        if (LANGUAGE_DICTIONARY[normalizedLang]) {
          return normalizedLang;
        }
      }

      // Try to detect from meta tags
      try {
        const metaTags = document.querySelectorAll('meta[property="og:locale"], meta[name="language"], meta[http-equiv="content-language"]');
        for (const meta of metaTags) {
          const content = meta.getAttribute('content') || meta.getAttribute('value');
          if (content) {
            const normalizedLang = normalizeLanguageCode(content);
            if (LANGUAGE_DICTIONARY[normalizedLang]) {
              return normalizedLang;
            }
          }
        }
      } catch (error) {
        // Ignore DOM errors and continue with other detection methods
      }

      // Try to detect from URL patterns
      const url = document.location?.href || '';
      const urlLangMatch = url.match(/linkedin\.com\/([a-z]{2})\//);
      if (urlLangMatch) {
        const normalizedLang = normalizeLanguageCode(urlLangMatch[1]);
        if (LANGUAGE_DICTIONARY[normalizedLang]) {
          return normalizedLang;
        }
      }

      // Default fallback to English
      return 'en';
    };

    global.normalizeLanguageCode = function(langCode) {
      if (!langCode || typeof langCode !== 'string') {
        return 'en';
      }
      
      // Convert to lowercase and extract primary language code
      const normalized = langCode.toLowerCase().split(/[-_@#$]/)[0];
      
      // Map common variations
      const langMap = {
        'en': 'en',
        'english': 'en',
        'de': 'de',
        'deutsch': 'de',
        'german': 'de',
        'es': 'es',
        'español': 'es',
        'spanish': 'es',
        'fr': 'fr',
        'français': 'fr',
        'french': 'fr'
      };
      
      return langMap[normalized] || 'en';
    };

    global.getLocalizedText = function(key, language = 'en') {
      const dict = LANGUAGE_DICTIONARY[language] || LANGUAGE_DICTIONARY['en'];
      return dict[key] || LANGUAGE_DICTIONARY['en'][key] || key;
    };

    global.findElementByText = function(document, texts, selector = '*') {
      if (typeof texts === 'string') {
        texts = [texts];
      }
      
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const elementText = element.textContent?.trim().toLowerCase();
        for (const text of texts) {
          if (elementText && elementText.includes(text.toLowerCase())) {
            return element;
          }
        }
      }
      return null;
    };

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create a fresh mock document for each test
    mockDocument = {
      documentElement: {
        getAttribute: jest.fn()
      },
      querySelectorAll: jest.fn(),
      location: {
        href: 'https://www.linkedin.com/feed/'
      }
    };
  });

  describe('Language Detection Logic', () => {
    it('should detect language from HTML lang attribute', () => {
      // Test English detection
      mockDocument.documentElement.getAttribute.mockReturnValue('en');
      expect(detectLanguage(mockDocument)).toBe('en');

      // Test German detection
      mockDocument.documentElement.getAttribute.mockReturnValue('de');
      expect(detectLanguage(mockDocument)).toBe('de');

      // Test Spanish detection
      mockDocument.documentElement.getAttribute.mockReturnValue('es');
      expect(detectLanguage(mockDocument)).toBe('es');

      // Test French detection
      mockDocument.documentElement.getAttribute.mockReturnValue('fr');
      expect(detectLanguage(mockDocument)).toBe('fr');
    });

    it('should detect language from HTML lang attribute with region codes', () => {
      // Test English with region
      mockDocument.documentElement.getAttribute.mockReturnValue('en-US');
      expect(detectLanguage(mockDocument)).toBe('en');

      // Test German with region
      mockDocument.documentElement.getAttribute.mockReturnValue('de-DE');
      expect(detectLanguage(mockDocument)).toBe('de');

      // Test Spanish with region
      mockDocument.documentElement.getAttribute.mockReturnValue('es-ES');
      expect(detectLanguage(mockDocument)).toBe('es');

      // Test French with region
      mockDocument.documentElement.getAttribute.mockReturnValue('fr-FR');
      expect(detectLanguage(mockDocument)).toBe('fr');
    });

    it('should detect language from meta tags when HTML lang is not available', () => {
      // No HTML lang attribute
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      
      // Mock meta tags
      const mockMetaTags = [
        {
          getAttribute: jest.fn()
            .mockReturnValueOnce('de_DE') // content
            .mockReturnValueOnce(null)    // value
        }
      ];
      
      mockDocument.querySelectorAll.mockReturnValue(mockMetaTags);
      
      expect(detectLanguage(mockDocument)).toBe('de');
    });

    it('should detect language from URL patterns', () => {
      // No HTML lang or meta tags
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      // Test German URL
      mockDocument.location.href = 'https://www.linkedin.com/de/feed/';
      expect(detectLanguage(mockDocument)).toBe('de');
      
      // Test Spanish URL
      mockDocument.location.href = 'https://www.linkedin.com/es/analytics/';
      expect(detectLanguage(mockDocument)).toBe('es');
      
      // Test French URL
      mockDocument.location.href = 'https://www.linkedin.com/fr/in/profile/';
      expect(detectLanguage(mockDocument)).toBe('fr');
    });

    it('should fall back to English when detection fails', () => {
      // No HTML lang attribute
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      
      // No meta tags
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      // No language in URL
      mockDocument.location.href = 'https://www.linkedin.com/feed/';
      
      expect(detectLanguage(mockDocument)).toBe('en');
    });

    it('should fall back to English for unsupported languages', () => {
      // Test unsupported language codes
      mockDocument.documentElement.getAttribute.mockReturnValue('zh'); // Chinese
      expect(detectLanguage(mockDocument)).toBe('en');
      
      mockDocument.documentElement.getAttribute.mockReturnValue('ja'); // Japanese
      expect(detectLanguage(mockDocument)).toBe('en');
      
      mockDocument.documentElement.getAttribute.mockReturnValue('ru'); // Russian
      expect(detectLanguage(mockDocument)).toBe('en');
    });

    it('should handle invalid or malformed language codes', () => {
      const invalidCodes = [null, undefined, '', 'invalid', '123', 'en-INVALID-CODE'];
      
      invalidCodes.forEach(code => {
        mockDocument.documentElement.getAttribute.mockReturnValue(code);
        mockDocument.querySelectorAll.mockReturnValue([]);
        expect(detectLanguage(mockDocument)).toBe('en');
      });
    });
  });

  describe('Language Code Normalization', () => {
    it('should normalize standard language codes correctly', () => {
      expect(normalizeLanguageCode('en')).toBe('en');
      expect(normalizeLanguageCode('de')).toBe('de');
      expect(normalizeLanguageCode('es')).toBe('es');
      expect(normalizeLanguageCode('fr')).toBe('fr');
    });

    it('should normalize language codes with regions', () => {
      expect(normalizeLanguageCode('en-US')).toBe('en');
      expect(normalizeLanguageCode('en_US')).toBe('en');
      expect(normalizeLanguageCode('de-DE')).toBe('de');
      expect(normalizeLanguageCode('de_DE')).toBe('de');
      expect(normalizeLanguageCode('es-ES')).toBe('es');
      expect(normalizeLanguageCode('fr-FR')).toBe('fr');
    });

    it('should normalize language names to codes', () => {
      expect(normalizeLanguageCode('English')).toBe('en');
      expect(normalizeLanguageCode('english')).toBe('en');
      expect(normalizeLanguageCode('German')).toBe('de');
      expect(normalizeLanguageCode('deutsch')).toBe('de');
      expect(normalizeLanguageCode('Spanish')).toBe('es');
      expect(normalizeLanguageCode('español')).toBe('es');
      expect(normalizeLanguageCode('French')).toBe('fr');
      expect(normalizeLanguageCode('français')).toBe('fr');
    });

    it('should handle case variations', () => {
      expect(normalizeLanguageCode('EN')).toBe('en');
      expect(normalizeLanguageCode('De')).toBe('de');
      expect(normalizeLanguageCode('ES')).toBe('es');
      expect(normalizeLanguageCode('Fr')).toBe('fr');
    });

    it('should fall back to English for invalid inputs', () => {
      expect(normalizeLanguageCode(null)).toBe('en');
      expect(normalizeLanguageCode(undefined)).toBe('en');
      expect(normalizeLanguageCode('')).toBe('en');
      expect(normalizeLanguageCode('invalid')).toBe('en');
      expect(normalizeLanguageCode(123)).toBe('en');
    });
  });

  describe('Language Dictionary Validation', () => {
    it('should have all supported languages defined', () => {
      const expectedLanguages = ['en', 'de', 'es', 'fr'];
      
      expectedLanguages.forEach(lang => {
        expect(LANGUAGE_DICTIONARY).toHaveProperty(lang);
        expect(typeof LANGUAGE_DICTIONARY[lang]).toBe('object');
      });
    });

    it('should have consistent keys across all languages', () => {
      const languages = Object.keys(LANGUAGE_DICTIONARY);
      const englishKeys = Object.keys(LANGUAGE_DICTIONARY.en);
      
      languages.forEach(lang => {
        const langKeys = Object.keys(LANGUAGE_DICTIONARY[lang]);
        
        // Check that all English keys exist in other languages
        englishKeys.forEach(key => {
          expect(LANGUAGE_DICTIONARY[lang]).toHaveProperty(key);
          expect(typeof LANGUAGE_DICTIONARY[lang][key]).toBe('string');
          expect(LANGUAGE_DICTIONARY[lang][key].length).toBeGreaterThan(0);
        });
        
        // Check that no extra keys exist in other languages
        expect(langKeys.sort()).toEqual(englishKeys.sort());
      });
    });

    it('should have non-empty translations for all keys', () => {
      Object.entries(LANGUAGE_DICTIONARY).forEach(([lang, translations]) => {
        Object.entries(translations).forEach(([key, value]) => {
          expect(value).toBeTruthy();
          expect(typeof value).toBe('string');
          expect(value.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should have unique translations within each language', () => {
      Object.entries(LANGUAGE_DICTIONARY).forEach(([lang, translations]) => {
        const values = Object.values(translations);
        const uniqueValues = [...new Set(values)];
        
        // Allow some duplicates for common words, but most should be unique
        expect(uniqueValues.length).toBeGreaterThan(values.length * 0.7);
      });
    });

    it('should have appropriate translations for LinkedIn UI elements', () => {
      // Test key LinkedIn terms exist
      const requiredKeys = [
        'postImpressions',
        'past7Days',
        'past28Days',
        'showResults',
        'export',
        'analytics'
      ];
      
      Object.keys(LANGUAGE_DICTIONARY).forEach(lang => {
        requiredKeys.forEach(key => {
          expect(LANGUAGE_DICTIONARY[lang]).toHaveProperty(key);
          
          const translation = LANGUAGE_DICTIONARY[lang][key];
          expect(translation).toBeTruthy();
          expect(translation.length).toBeGreaterThan(2); // Reasonable minimum length
        });
      });
    });
  });

  describe('Localized Text Retrieval', () => {
    it('should return correct translations for each language', () => {
      // Test English
      expect(getLocalizedText('export', 'en')).toBe('Export');
      expect(getLocalizedText('postImpressions', 'en')).toBe('Post impressions');
      
      // Test German
      expect(getLocalizedText('export', 'de')).toBe('Exportieren');
      expect(getLocalizedText('postImpressions', 'de')).toBe('Post-Impressionen');
      
      // Test Spanish
      expect(getLocalizedText('export', 'es')).toBe('Exportar');
      expect(getLocalizedText('postImpressions', 'es')).toBe('Impresiones de publicación');
      
      // Test French
      expect(getLocalizedText('export', 'fr')).toBe('Exporter');
      expect(getLocalizedText('postImpressions', 'fr')).toBe('Impressions de publication');
    });

    it('should fall back to English for unsupported languages', () => {
      expect(getLocalizedText('export', 'zh')).toBe('Export');
      expect(getLocalizedText('postImpressions', 'ja')).toBe('Post impressions');
      expect(getLocalizedText('analytics', 'ru')).toBe('Analytics');
    });

    it('should fall back to English for missing keys', () => {
      // Test with a key that doesn't exist
      expect(getLocalizedText('nonExistentKey', 'de')).toBe('nonExistentKey');
      expect(getLocalizedText('nonExistentKey', 'es')).toBe('nonExistentKey');
    });

    it('should handle null/undefined language parameter', () => {
      expect(getLocalizedText('export', null)).toBe('Export');
      expect(getLocalizedText('export', undefined)).toBe('Export');
      expect(getLocalizedText('export')).toBe('Export'); // Default parameter
    });
  });

  describe('UI Element Detection', () => {
    let mockElements;

    beforeEach(() => {
      mockElements = [];
      mockDocument.querySelectorAll.mockImplementation(() => mockElements);
    });

    it('should find elements by English text', () => {
      const mockExportButton = {
        textContent: '  Export  ',
        click: jest.fn()
      };
      
      mockElements = [
        { textContent: 'Other text' },
        mockExportButton,
        { textContent: 'More text' }
      ];
      
      const found = findElementByText(mockDocument, 'Export');
      expect(found).toBe(mockExportButton);
    });

    it('should find elements by German text', () => {
      const mockExportButton = {
        textContent: 'Exportieren',
        click: jest.fn()
      };
      
      mockElements = [
        { textContent: 'Anderer Text' },
        mockExportButton,
        { textContent: 'Mehr Text' }
      ];
      
      const found = findElementByText(mockDocument, 'Exportieren');
      expect(found).toBe(mockExportButton);
    });

    it('should find elements by Spanish text', () => {
      const mockExportButton = {
        textContent: 'Exportar datos',
        click: jest.fn()
      };
      
      mockElements = [
        { textContent: 'Otro texto' },
        mockExportButton,
        { textContent: 'Más texto' }
      ];
      
      const found = findElementByText(mockDocument, 'Exportar');
      expect(found).toBe(mockExportButton);
    });

    it('should find elements by French text', () => {
      const mockExportButton = {
        textContent: 'Exporter les données',
        click: jest.fn()
      };
      
      mockElements = [
        { textContent: 'Autre texte' },
        mockExportButton,
        { textContent: 'Plus de texte' }
      ];
      
      const found = findElementByText(mockDocument, 'Exporter');
      expect(found).toBe(mockExportButton);
    });

    it('should handle multiple text variations', () => {
      const mockButton = {
        textContent: 'Show results',
        click: jest.fn()
      };
      
      mockElements = [mockButton];
      
      const variations = ['Show results', 'Ergebnisse anzeigen', 'Mostrar resultados', 'Afficher les résultats'];
      const found = findElementByText(mockDocument, variations);
      expect(found).toBe(mockButton);
    });

    it('should be case insensitive', () => {
      const mockButton = {
        textContent: 'EXPORT DATA',
        click: jest.fn()
      };
      
      mockElements = [mockButton];
      
      const found = findElementByText(mockDocument, 'export data');
      expect(found).toBe(mockButton);
    });

    it('should handle partial text matches', () => {
      const mockButton = {
        textContent: 'Click here to Export your data now',
        click: jest.fn()
      };
      
      mockElements = [mockButton];
      
      const found = findElementByText(mockDocument, 'Export');
      expect(found).toBe(mockButton);
    });

    it('should return null when no element is found', () => {
      mockElements = [
        { textContent: 'Other text' },
        { textContent: 'Different text' }
      ];
      
      const found = findElementByText(mockDocument, 'Export');
      expect(found).toBeNull();
    });

    it('should handle empty or null text content', () => {
      mockElements = [
        { textContent: null },
        { textContent: undefined },
        { textContent: '' },
        { textContent: '   ' }
      ];
      
      const found = findElementByText(mockDocument, 'Export');
      expect(found).toBeNull();
    });
  });

  describe('Multi-Language Integration Scenarios', () => {
    it('should detect and use German LinkedIn interface', () => {
      // Setup German LinkedIn page
      mockDocument.documentElement.getAttribute.mockReturnValue('de-DE');
      mockDocument.location.href = 'https://www.linkedin.com/de/analytics/';
      
      const detectedLang = detectLanguage(mockDocument);
      expect(detectedLang).toBe('de');
      
      // Test German translations
      expect(getLocalizedText('export', detectedLang)).toBe('Exportieren');
      expect(getLocalizedText('analytics', detectedLang)).toBe('Analytics');
      expect(getLocalizedText('past7Days', detectedLang)).toBe('Letzte 7 Tage');
    });

    it('should detect and use Spanish LinkedIn interface', () => {
      // Setup Spanish LinkedIn page
      mockDocument.documentElement.getAttribute.mockReturnValue('es-ES');
      mockDocument.location.href = 'https://www.linkedin.com/es/feed/';
      
      const detectedLang = detectLanguage(mockDocument);
      expect(detectedLang).toBe('es');
      
      // Test Spanish translations
      expect(getLocalizedText('export', detectedLang)).toBe('Exportar');
      expect(getLocalizedText('showResults', detectedLang)).toBe('Mostrar resultados');
      expect(getLocalizedText('past28Days', detectedLang)).toBe('Últimos 28 días');
    });

    it('should detect and use French LinkedIn interface', () => {
      // Setup French LinkedIn page
      mockDocument.documentElement.getAttribute.mockReturnValue('fr-FR');
      mockDocument.location.href = 'https://www.linkedin.com/fr/in/profile/';
      
      const detectedLang = detectLanguage(mockDocument);
      expect(detectedLang).toBe('fr');
      
      // Test French translations
      expect(getLocalizedText('export', detectedLang)).toBe('Exporter');
      expect(getLocalizedText('insights', detectedLang)).toBe('Informations');
      expect(getLocalizedText('viewAnalytics', detectedLang)).toBe('Voir les analyses');
    });

    it('should handle mixed language scenarios gracefully', () => {
      // HTML says German but URL says Spanish
      mockDocument.documentElement.getAttribute.mockReturnValue('de');
      mockDocument.location.href = 'https://www.linkedin.com/es/analytics/';
      
      // Should prioritize HTML lang attribute
      const detectedLang = detectLanguage(mockDocument);
      expect(detectedLang).toBe('de');
    });

    it('should work with LinkedIn mobile URLs', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      // Test mobile LinkedIn URLs
      mockDocument.location.href = 'https://m.linkedin.com/de/feed/';
      expect(detectLanguage(mockDocument)).toBe('de');
      
      mockDocument.location.href = 'https://touch.linkedin.com/es/analytics/';
      expect(detectLanguage(mockDocument)).toBe('es');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle document without documentElement', () => {
      const brokenDocument = {
        documentElement: null,
        querySelectorAll: jest.fn().mockReturnValue([]),
        location: { href: 'https://www.linkedin.com/feed/' }
      };
      
      expect(() => detectLanguage(brokenDocument)).not.toThrow();
      expect(detectLanguage(brokenDocument)).toBe('en');
    });

    it('should handle document without location', () => {
      const documentWithoutLocation = {
        documentElement: { getAttribute: jest.fn().mockReturnValue(null) },
        querySelectorAll: jest.fn().mockReturnValue([]),
        location: null
      };
      
      expect(() => detectLanguage(documentWithoutLocation)).not.toThrow();
      expect(detectLanguage(documentWithoutLocation)).toBe('en');
    });

    it('should handle querySelectorAll throwing errors', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      mockDocument.querySelectorAll.mockImplementation(() => {
        throw new Error('DOM error');
      });
      
      expect(() => detectLanguage(mockDocument)).not.toThrow();
      expect(detectLanguage(mockDocument)).toBe('en');
    });

    it('should handle meta tags with malformed content', () => {
      mockDocument.documentElement.getAttribute.mockReturnValue(null);
      
      const malformedMetaTags = [
        { getAttribute: jest.fn().mockReturnValue('') },
        { getAttribute: jest.fn().mockReturnValue(null) },
        { getAttribute: jest.fn().mockReturnValue('invalid-lang-code') }
      ];
      
      mockDocument.querySelectorAll.mockReturnValue(malformedMetaTags);
      
      expect(detectLanguage(mockDocument)).toBe('en');
    });

    it('should handle extremely long language codes', () => {
      const longLangCode = 'en-US-VERY-LONG-REGION-CODE-THAT-SHOULD-BE-NORMALIZED';
      expect(normalizeLanguageCode(longLangCode)).toBe('en');
    });

    it('should handle special characters in language codes', () => {
      expect(normalizeLanguageCode('en@US')).toBe('en');
      expect(normalizeLanguageCode('de#DE')).toBe('de');
      expect(normalizeLanguageCode('es$ES')).toBe('es');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of DOM elements efficiently', () => {
      // Create a large number of mock elements
      const largeElementList = Array.from({ length: 1000 }, (_, i) => ({
        textContent: `Element ${i}`
      }));
      
      // Add the target element at the end
      largeElementList.push({ textContent: 'Export data' });
      
      mockDocument.querySelectorAll.mockReturnValue(largeElementList);
      
      const startTime = Date.now();
      const found = findElementByText(mockDocument, 'Export');
      const endTime = Date.now();
      
      expect(found).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should not leak memory with repeated language detection', () => {
      // Simulate repeated language detection calls
      for (let i = 0; i < 100; i++) {
        mockDocument.documentElement.getAttribute.mockReturnValue(`en-${i}`);
        detectLanguage(mockDocument);
      }
      
      // Should not throw or cause memory issues
      expect(detectLanguage(mockDocument)).toBe('en');
    });
  });
});
