# Professional Profile Analytics - Chrome Plugin

A Chrome extension that automates the download and upload of LinkedIn analytics data to the Professional Profile Analytics service.

## Features

- Automatically downloads LinkedIn analytics data
- Uploads data to the Professional Profile Analytics service
- Configurable execution frequency
- Multi-language support for LinkedIn interfaces
- Retry mechanism for failed executions
- Logging and error tracking

## Multi-language Support

The extension now supports multiple languages for LinkedIn interfaces:

- English (default)
- German
- Spanish
- French

The language detection is automatic, based on the LinkedIn interface language. The extension will try to find UI elements in the appropriate language.

## Implementation Details

The multi-language support is implemented through:

1. A language dictionary that contains translations for UI elements
2. Automatic language detection based on HTML attributes and URL patterns
3. Enhanced tab interactions that try all possible translations when looking for UI elements

## Adding New Languages

To add support for a new language:

1. Open `tab_interactions_multilingual.js`
2. Add a new entry to the `LANGUAGE_DICTIONARY` object with the language code as the key
3. Add translations for all the UI element texts

Example:
```javascript
// Italian translations
it: {
  postImpressions: 'Impressioni del post',
  past7Days: 'Ultimi 7 giorni',
  past28Days: 'Ultimi 28 giorni',
  showResults: 'Mostra risultati',
  export: 'Esporta'
}
```

## Usage

1. Install the extension
2. Configure your email in the options page
3. The extension will automatically run according to the configured schedule
4. You can also trigger a manual execution from the popup menu
