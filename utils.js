const path = require("path");
const fs = require("fs-extra");
const https = require("https");
const http = require("http");

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

  /**
   * Fetch and parse sitemap.xml from a website
   * @param {string} baseUrl - Base URL of the website (e.g., 'https://example.com')
   * @param {Object} options - Options for sitemap parsing
   * @param {number} options.maxUrls - Maximum number of URLs to return (default: 50)
   * @param {Array<string>} options.includePatterns - URL patterns to include (default: all)
   * @param {Array<string>} options.excludePatterns - URL patterns to exclude (default: none)
   * @returns {Promise<Array<string>>} Array of URLs from sitemap
   */
  static async fetchSitemapUrls(baseUrl, options = {}) {
    const {
      maxUrls = 50,
      includePatterns = [],
      excludePatterns = [],
    } = options;

    console.log(`🗺️  Fetching sitemap from: ${baseUrl}`);

    try {
      // Normalize base URL
      const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

      // Try different sitemap URLs in order of preference
      const sitemapUrls = [
        `${normalizedBaseUrl}/sitemap_index.xml`,
        `${normalizedBaseUrl}/sitemap.xml`,
      ];

      let sitemapContent = null;
      let usedSitemapUrl = null;

      // Try each sitemap URL until we find one that works
      for (const sitemapUrl of sitemapUrls) {
        try {
          console.log(`🔍 Trying: ${sitemapUrl}`);
          sitemapContent = await this._fetchUrl(sitemapUrl);
          usedSitemapUrl = sitemapUrl;
          console.log(`✅ Successfully fetched: ${sitemapUrl}`);
          break;
        } catch (error) {
          console.log(`❌ Failed to fetch ${sitemapUrl}: ${error.message}`);
          continue;
        }
      }

      if (!sitemapContent) {
        throw new Error(
          "No accessible sitemap found (tried sitemap_index.xml and sitemap.xml)"
        );
      }

      // Parse XML to extract URLs
      let urls = [];

      // Check if this is a sitemap index (contains <sitemap> tags with <loc> for other sitemaps)
      if (
        sitemapContent.includes("<sitemap>") &&
        sitemapContent.includes("<sitemapindex>")
      ) {
        console.log(
          "📑 Detected sitemap index, fetching individual sitemaps..."
        );

        // Extract sitemap URLs from the index
        const sitemapUrls = this._parseSitemapXml(sitemapContent);
        console.log(`📋 Found ${sitemapUrls.length} sitemaps in index`);

        // Fetch URLs from each sitemap (limit to first 3 sitemaps to avoid overwhelming)
        const maxSitemaps = 3;
        for (let i = 0; i < Math.min(sitemapUrls.length, maxSitemaps); i++) {
          const sitemapUrl = sitemapUrls[i];
          try {
            console.log(
              `🔍 Fetching sitemap ${i + 1}/${Math.min(
                sitemapUrls.length,
                maxSitemaps
              )}: ${sitemapUrl}`
            );
            const individualSitemapContent = await this._fetchUrl(sitemapUrl);
            const sitemapUrls = this._parseSitemapXml(individualSitemapContent);
            urls.push(...sitemapUrls);
            console.log(
              `   ✅ Added ${sitemapUrls.length} URLs from this sitemap`
            );
          } catch (error) {
            console.log(
              `   ❌ Failed to fetch ${sitemapUrl}: ${error.message}`
            );
            continue;
          }
        }

        if (sitemapUrls.length > maxSitemaps) {
          console.log(
            `📏 Limited to first ${maxSitemaps} sitemaps (of ${sitemapUrls.length} total)`
          );
        }
      } else {
        // Regular sitemap, parse directly
        urls = this._parseSitemapXml(sitemapContent);
      }

      console.log(`📋 Found ${urls.length} total URLs from sitemap(s)`);

      // Filter URLs based on patterns
      let filteredUrls = urls;

      // Apply include patterns
      if (includePatterns.length > 0) {
        filteredUrls = filteredUrls.filter((url) =>
          includePatterns.some((pattern) => url.includes(pattern))
        );
        console.log(`🔍 After include filters: ${filteredUrls.length} URLs`);
      }

      // Apply exclude patterns
      if (excludePatterns.length > 0) {
        filteredUrls = filteredUrls.filter(
          (url) => !excludePatterns.some((pattern) => url.includes(pattern))
        );
        console.log(`🚫 After exclude filters: ${filteredUrls.length} URLs`);
      }

      // Limit to maxUrls
      const limitedUrls = filteredUrls.slice(0, maxUrls);

      if (limitedUrls.length < filteredUrls.length) {
        console.log(
          `📏 Limited to first ${maxUrls} URLs (of ${filteredUrls.length} total)`
        );
      }

      return limitedUrls;
    } catch (error) {
      console.error("❌ Error fetching sitemap:", error.message);
      throw error;
    }
  }

  /**
   * Fetch content from a URL
   * @private
   */
  static _fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https:") ? https : http;

      const request = client.get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
          );
          return;
        }

        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          resolve(data);
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  /**
   * Parse sitemap XML to extract URLs
   * @private
   */
  static _parseSitemapXml(xmlContent) {
    const urls = [];

    // Simple regex-based XML parsing for <loc> tags
    // This handles both regular sitemaps and sitemap index files
    const locRegex = /<loc[^>]*>(.*?)<\/loc>/gi;
    let match;

    while ((match = locRegex.exec(xmlContent)) !== null) {
      let url = match[1].trim();

      // Decode XML entities
      url = url
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      if (url && this._isValidUrl(url)) {
        urls.push(url);
      }
    }

    return urls;
  }

  /**
   * Validate if a string is a valid HTTP/HTTPS URL
   * @private
   */
  static _isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
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
    case "sitemap":
      const url = process.argv[3];
      if (!url) {
        console.log(
          "❌ Please provide a URL: node utils.js sitemap https://example.com"
        );
        break;
      }
      ScraperUtils.fetchSitemapUrls(url)
        .then((urls) => {
          console.log("\n📄 Sitemap URLs:");
          urls.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
          });
        })
        .catch((error) => {
          console.error("❌ Failed to fetch sitemap:", error.message);
        });
      break;
    default:
      console.log(`
Scraper Utils

Commands:
  node utils.js open     # Open the latest report
  node utils.js clean    # Clean output directory  
  node utils.js status   # Show project status
  node utils.js sitemap <url>  # Fetch and display sitemap URLs
            `);
  }
}
