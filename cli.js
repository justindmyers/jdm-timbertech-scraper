#!/usr/bin/env node

const ElementScraper = require("./src/scraper");
const configs = require("./config/scraping-configs");

async function runScraper() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Web Element Scraper CLI

Usage:
  node cli.js <config-name>           # Use predefined configuration
  node cli.js <url> <selector>        # Custom scraping
  node cli.js <url> <selector> <prefix>  # Custom with class prefix

Available configurations:
${Object.keys(configs)
  .map((key) => `  - ${key}: ${configs[key].description}`)
  .join("\n")}

Examples:
  node cli.js buttons                 # Scrape Bootstrap buttons
  node cli.js cards                   # Scrape Bootstrap cards  
  node cli.js https://example.com .item  # Custom scraping
  node cli.js https://example.com .btn btn-  # Custom with prefix
        `);
    return;
  }

  const scraper = new ElementScraper();
  let config;

  // Check if first argument is a predefined config
  if (configs[args[0]]) {
    config = configs[args[0]];
    console.log(`Using configuration: ${args[0]} - ${config.description}`);
  } else if (args.length >= 2) {
    // Custom configuration from command line
    config = {
      url: args[0],
      selector: args[1],
      variationClassPrefix: args[2] || "",
      description: "Custom configuration",
    };
    console.log(`Using custom configuration`);
  } else {
    console.error('Invalid arguments. Use "node cli.js" for help.');
    return;
  }

  try {
    console.log(`\nStarting scrape of: ${config.url}`);
    console.log(`Selector: ${config.selector}`);
    if (config.variationClassPrefix) {
      console.log(`Class prefix filter: ${config.variationClassPrefix}`);
    }
    console.log("---");

    const result = await scraper.scrape(
      config.url,
      config.selector,
      config.variationClassPrefix
    );

    console.log(`\n✅ Scraping completed successfully!`);
    console.log(`📊 Found ${result.variations.length} variations`);
    console.log(`📄 Report saved to: ${result.reportPath}`);
    console.log(`📁 Screenshots saved to: output/screenshots/`);
  } catch (error) {
    console.error("❌ Scraping failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runScraper().catch(console.error);
}

module.exports = runScraper;
