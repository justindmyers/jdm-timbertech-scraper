const ElementScraper = require("./src/scraper");

async function testScraper() {
  console.log("🧪 Testing Element Scraper...\n");

  try {
    // Test basic initialization
    console.log("1. Testing initialization...");
    const scraper = new ElementScraper();
    await scraper.initialize();
    console.log("✅ Initialization successful\n");

    // Test navigation to a simple page
    console.log("2. Testing navigation...");
    await scraper.navigateToPage(
      'data:text/html,<html><body><button class="btn btn-primary">Test Button</button><button class="btn btn-secondary">Another Button</button></body></html>'
    );
    console.log("✅ Navigation successful\n");

    // Test element detection
    console.log("3. Testing element detection...");
    const variations = await scraper.findElementVariations("button", "btn");
    console.log(`✅ Found ${variations.length} element variations\n`);

    // Test screenshot capture
    console.log("4. Testing screenshot capture...");
    await scraper.takeScreenshots();
    console.log("✅ Screenshots captured\n");

    // Test report generation
    console.log("5. Testing report generation...");
    const reportPath = await scraper.generateReport();
    console.log(`✅ Report generated at: ${reportPath}\n`);

    // Cleanup
    if (scraper.browser) {
      await scraper.browser.close();
    }

    console.log("🎉 All tests passed! The scraper is working correctly.");
    console.log(`📄 Check the generated report at: ${reportPath}`);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testScraper();
}

module.exports = testScraper;
