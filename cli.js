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
  node cli.js sitemap <base-url> <selector> [options]  # Scrape from sitemap

Available configurations:
${Object.keys(configs)
  .map((key) => `  - ${key}: ${configs[key].description}`)
  .join("\n")}

Examples:
  node cli.js buttons                 # Scrape Bootstrap buttons
  node cli.js cards                   # Scrape Bootstrap cards  
  node cli.js https://example.com .item  # Custom scraping
  node cli.js https://example.com .btn btn-  # Custom with prefix
  
Sitemap Examples:
  node cli.js sitemap https://example.com .btn  # Scrape buttons from sitemap
  node cli.js sitemap https://example.com .wp-block wp-block-  # WordPress blocks from sitemap
        `);
    return;
  }

  const scraper = new ElementScraper();
  let config;

  // Check for sitemap scraping
  if (args[0] === "sitemap") {
    if (args.length < 3) {
      console.error(
        "❌ Sitemap scraping requires: node cli.js sitemap <base-url> <selector> [class-prefix]"
      );
      return;
    }

    const baseUrl = args[1];
    const selector = args[2];
    const variationClassPrefix = args[3] || "";

    try {
      console.log(`🗺️  Starting sitemap scraping for: ${baseUrl}`);
      console.log(`🎯 Selector: ${selector}`);
      if (variationClassPrefix) {
        console.log(`🏷️  Class prefix filter: ${variationClassPrefix}`);
      }
      console.log("---");

      const result = await scraper.scrapeSitemap(
        baseUrl,
        selector,
        variationClassPrefix,
        {
          maxUrls: 10,
          delayBetweenPages: 2000,
          continueOnError: true,
        }
      );

      console.log(`\n🎉 Sitemap scraping completed successfully!`);
      console.log(`📊 Total variations found: ${result.variations.length}`);
      console.log(
        `✅ Successful pages: ${result.stats.successfulPages}/${result.stats.totalPages}`
      );
      console.log(`📄 Report saved to: ${result.reportPath}`);
      console.log(`📁 Screenshots saved to: output/screenshots/`);

      if (result.failedUrls.length > 0) {
        console.log(`\n⚠️  Some pages failed to scrape:`);
        result.failedUrls.forEach(({ url, error }) => {
          console.log(`   - ${url}: ${error}`);
        });
      }

      return;
    } catch (error) {
      console.error("❌ Sitemap scraping failed:", error.message);
      process.exit(1);
    }
  }

  // Check if first argument is a predefined config
  if (configs[args[0]]) {
    config = configs[args[0]];
    console.log(`Using configuration: ${args[0]} - ${config.description}`);

    // Handle sitemap configurations
    if (config.isSitemap) {
      try {
        console.log(`🗺️  Starting sitemap scraping for: ${config.url}`);
        console.log(`🎯 Selector: ${config.selector}`);
        if (config.variationClassPrefix) {
          console.log(
            `🏷️  Class prefix filter: ${config.variationClassPrefix}`
          );
        }
        console.log("---");

        const result = await scraper.scrapeSitemap(
          config.url,
          config.selector,
          config.variationClassPrefix,
          {
            maxUrls: config.maxUrls || 15,
            delayBetweenPages: 2000,
            continueOnError: true,
            manualUrls: config.manualUrls || null,
            followLinks: config.followLinks !== false, // Default to true unless explicitly disabled
            maxDepth: config.maxDepth || 2,
          }
        );

        console.log(`\n🎉 Sitemap scraping completed successfully!`);
        console.log(`📊 Total variations found: ${result.variations.length}`);
        console.log(
          `✅ Successful pages: ${result.stats.successfulPages}/${result.stats.totalPages}`
        );
        console.log(`📄 Report saved to: ${result.reportPath}`);
        console.log(`📁 Screenshots saved to: output/screenshots/`);

        if (result.failedUrls.length > 0) {
          console.log(`\n⚠️  Some pages failed to scrape:`);
          result.failedUrls.forEach(({ url, error }) => {
            console.log(`   - ${url}: ${error}`);
          });
        }

        return;
      } catch (error) {
        console.error("❌ Sitemap scraping failed:", error.message);
        process.exit(1);
      }
    }
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
