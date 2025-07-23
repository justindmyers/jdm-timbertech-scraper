const ElementScraper = require("./src/scraper");

async function main() {
  const scraper = new ElementScraper();

  // Example usage - scrape buttons from a demo website
  try {
    const result = await scraper.scrape(
      "https://example.com", // Replace with your target URL
      "button", // CSS selector for elements to scrape
      "btn" // Optional: filter by class prefix
    );

    console.log(`\nSuccess! Found ${result.variations.length} variations`);
    console.log(`Report available at: ${result.reportPath}`);
  } catch (error) {
    console.error("Scraping failed:", error);
  }
}

// Run the example
if (require.main === module) {
  main();
}
