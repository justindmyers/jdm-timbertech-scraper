# Element Scraper

A powerful Node.js web scraper built with Playwright that automates the process of finding HTML element variations, capturing screenshots, and generating comprehensive visual documentation.

## Features

- 🎯 **DOM Query Selection**: Use CSS selectors to target specific HTML elements
- 🔍 **Variation Detection**: Automatically find different versions of elements based on class names
- 📸 **Screenshot Capture**: Take high-quality screenshots of each element variation
- 📊 **Visual Documentation**: Generate HTML reports with screenshots and metadata
- 🛠️ **CLI Interface**: Easy-to-use command line interface
- ⚙️ **Configurable**: Predefined configurations for common use cases

## Installation

1. Clone or create the project:

```bash
mkdir element-scraper
cd element-scraper
```

2. Install dependencies:

```bash
npm install
```

3. Install Playwright browsers:

```bash
npx playwright install
```

## Quick Start

### Using the CLI

```bash
# Show help and available configurations
npm start

# Use predefined configurations
npm run scrape:buttons    # Scrape Bootstrap buttons
npm run scrape:cards      # Scrape Bootstrap cards

# Custom scraping
node cli.js https://example.com .btn
node cli.js https://example.com .btn btn-  # With class prefix filter
```

### Using the API

```javascript
const ElementScraper = require("./src/scraper");

async function scrapeElements() {
  const scraper = new ElementScraper();

  const result = await scraper.scrape(
    "https://your-website.com", // Target URL
    ".your-selector", // CSS selector
    "variation-prefix" // Optional class prefix filter
  );

  console.log(`Found ${result.variations.length} variations`);
  console.log(`Report: ${result.reportPath}`);
}

scrapeElements();
```

## Configuration

Create custom scraping configurations in `config/scraping-configs.js`:

```javascript
const scrapingConfigs = {
  myCustomScrape: {
    url: "https://your-website.com",
    selector: ".my-elements",
    variationClassPrefix: "variant-",
    description: "My custom element scraping",
  },
};
```

## API Reference

### ElementScraper Class

#### Methods

- `initialize()`: Sets up browser and output directories
- `navigateToPage(url)`: Navigates to the target URL
- `findElementVariations(selector, variationClassPrefix)`: Finds element variations
- `takeScreenshots()`: Captures screenshots of all variations
- `generateReport()`: Creates HTML report with results
- `scrape(url, selector, variationClassPrefix)`: Complete scraping workflow

#### Configuration Options

- `outputDir`: Directory for generated files (default: 'output')
- `screenshotsDir`: Directory for screenshots (default: 'output/screenshots')

## Output

The scraper generates:

1. **Screenshots**: PNG files of each element variation in `output/screenshots/`
2. **HTML Report**: Comprehensive report at `output/variations_report.html` containing:
   - Element screenshots
   - CSS selectors
   - Class names
   - Text content
   - Dimensions and positioning
   - Summary statistics

## GitHub Pages Integration

This project includes automated GitHub Pages deployment for the TimberTech analysis:

### Automated Publishing

The project includes a GitHub Action (`.github/workflows/publish-timbertech.yml`) that:

- **Runs automatically** on push to main branch
- **Updates weekly** to keep analysis current
- **Can be triggered manually** from GitHub Actions tab

### Local Testing

Test the GitHub Pages build locally:

```bash
# Build and prepare GitHub Pages content
npm run build:pages

# Serve locally for testing
cd pages && python3 -m http.server 8000
# Visit: http://localhost:8000
```

### Setup Instructions

1. Enable GitHub Pages in repository Settings → Pages
2. Select "GitHub Actions" as the source
3. The workflow will automatically deploy to your GitHub Pages URL

See [GITHUB_PAGES.md](GITHUB_PAGES.md) for detailed setup instructions.

## Example Use Cases

### UI Component Documentation

```bash
# Document button variations
node cli.js https://your-design-system.com .btn btn-

# Document card components
node cli.js https://your-site.com .card card-
```

### A/B Testing Analysis

```bash
# Compare different versions of elements
node cli.js https://your-site.com .cta-button variant-
```

### Design System Auditing

```bash
# Find all navigation variations
node cli.js https://your-site.com nav a nav-
```

## Project Structure

```
element-scraper/
├── src/
│   └── scraper.js          # Main scraper class
├── config/
│   └── scraping-configs.js # Predefined configurations
├── output/                 # Generated files
│   ├── screenshots/        # Element screenshots
│   └── variations_report.html
├── cli.js                  # Command line interface
├── example.js              # Usage examples
└── package.json
```

## Browser Support

Supports all Playwright browsers:

- Chromium (default)
- Firefox
- WebKit/Safari

Change browser in `src/scraper.js`:

```javascript
// Use Firefox instead of Chromium
this.browser = await firefox.launch({ headless: false });
```

## Troubleshooting

### Common Issues

1. **Elements not found**: Verify your CSS selector is correct
2. **Screenshots failed**: Ensure elements are visible in viewport
3. **Browser launch failed**: Run `npx playwright install` to install browsers

### Debug Mode

Run with browser visible for debugging:

```javascript
this.browser = await chromium.launch({ headless: false, slowMo: 1000 });
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review Playwright documentation
3. Open an issue with detailed reproduction steps
