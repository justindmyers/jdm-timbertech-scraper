<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Element Scraper Project Guidelines

This is a Node.js web scraping project using Playwright for automating browser interactions and capturing screenshots of web elements.

## Key Technologies and Libraries

- **Playwright**: For browser automation and element interaction
- **fs-extra**: For enhanced file system operations
- **Node.js**: Runtime environment

## Project Structure

- `src/scraper.js`: Main ElementScraper class
- `cli.js`: Command-line interface for running scraper
- `config/scraping-configs.js`: Predefined scraping configurations
- `example.js`: Example usage and demo code
- `output/`: Generated reports and screenshots

## Code Patterns and Best Practices

### Element Selection

- Use CSS selectors for targeting elements
- Support class prefix filtering for variation detection
- Handle element not found scenarios gracefully

### Screenshot Management

- Save screenshots with unique timestamps
- Organize screenshots in dedicated folders
- Generate relative paths for HTML reports

### Error Handling

- Wrap browser operations in try-catch blocks
- Provide meaningful error messages
- Clean up browser resources in finally blocks

### HTML Report Generation

- Create responsive HTML layouts
- Include element metadata (classes, dimensions, text)
- Link screenshots with proper relative paths
- Use modern CSS for styling

## Common Selectors and Use Cases

- Buttons: `.btn`, `button`, `[type="button"]`
- Cards: `.card`, `.card-body`
- Navigation: `nav a`, `.nav-link`
- Form elements: `input`, `select`, `textarea`
- Content blocks: `.content`, `article`, `section`

## When suggesting code changes:

1. Maintain the existing class structure
2. Follow async/await patterns consistently
3. Include proper error handling
4. Update HTML templates with semantic markup
5. Ensure cross-browser compatibility with Playwright
