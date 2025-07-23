const path = require("path");
const fs = require("fs-extra");

/**
 * Helper utilities for the Element Scraper project
 */
class ScraperUtils {
  /**
   * Open the generated HTML report in the default browser
   * @param {string} reportPath - Path to the HTML report
   */
  static async openReport(reportPath = "output/variations_report.html") {
    const fullPath = path.resolve(reportPath);

    if (!(await fs.pathExists(fullPath))) {
      console.log(
        "❌ Report not found. Run a scrape first to generate a report."
      );
      return;
    }

    const { spawn } = require("child_process");
    const platform = process.platform;

    let command;
    if (platform === "darwin") {
      command = "open";
    } else if (platform === "linux") {
      command = "xdg-open";
    } else if (platform === "win32") {
      command = "start";
    }

    if (command) {
      spawn(command, [fullPath], { detached: true, stdio: "ignore" });
      console.log(`📖 Opening report in browser: ${fullPath}`);
    } else {
      console.log(`📄 Report available at: ${fullPath}`);
    }
  }

  /**
   * Clean up old output files
   */
  static async cleanOutput() {
    const outputDir = "output";

    if (await fs.pathExists(outputDir)) {
      await fs.remove(outputDir);
      console.log("🧹 Cleaned output directory");
    }
  }

  /**
   * Get project statistics
   */
  static async getStats() {
    const outputDir = "output";
    const screenshotsDir = path.join(outputDir, "screenshots");

    let stats = {
      hasReport: false,
      screenshotCount: 0,
      reportSize: 0,
    };

    // Check if report exists
    const reportPath = path.join(outputDir, "variations_report.html");
    if (await fs.pathExists(reportPath)) {
      stats.hasReport = true;
      const reportStat = await fs.stat(reportPath);
      stats.reportSize = Math.round(reportStat.size / 1024); // KB
    }

    // Count screenshots
    if (await fs.pathExists(screenshotsDir)) {
      const screenshots = await fs.readdir(screenshotsDir);
      stats.screenshotCount = screenshots.filter((f) =>
        f.endsWith(".png")
      ).length;
    }

    return stats;
  }

  /**
   * Display project status
   */
  static async showStatus() {
    console.log("📊 Element Scraper Status\n");

    const stats = await this.getStats();

    console.log(`Report exists: ${stats.hasReport ? "✅" : "❌"}`);
    console.log(`Screenshots: ${stats.screenshotCount}`);
    if (stats.hasReport) {
      console.log(`Report size: ${stats.reportSize} KB`);
    }

    if (stats.hasReport) {
      console.log('\n💡 Tip: Use "npm run open-report" to view the report');
    } else {
      console.log('\n💡 Tip: Run "npm start" to begin scraping');
    }
  }
}

module.exports = ScraperUtils;

// CLI usage
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case "open":
      ScraperUtils.openReport();
      break;
    case "clean":
      ScraperUtils.cleanOutput();
      break;
    case "status":
      ScraperUtils.showStatus();
      break;
    default:
      console.log(`
Scraper Utils

Commands:
  node utils.js open    # Open the latest report
  node utils.js clean   # Clean output directory  
  node utils.js status  # Show project status
            `);
  }
}
