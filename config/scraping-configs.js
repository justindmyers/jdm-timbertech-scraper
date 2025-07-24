// Configuration file for different scraping scenarios

const scrapingConfigs = {
  // Custom configuration template
  custom: {
    url: "https://your-website.com",
    selector: ".your-selector",
    variationClassPrefix: "your-prefix",
    description: "Your custom scraping configuration",
  },

  // TimberTech wp-block elements
  timbertech: {
    url: "https://www.timbertech.com/",
    selector: '.entry-content > *[class*="wp-block-"]',
    variationClassPrefix: "wp-block-",
    description:
      "TimberTech WordPress block elements (direct children only, excluding __ classes)",
  },

  // TimberTech sitemap scraping
  "timbertech-sitemap": {
    url: "https://www.timbertech.com/",
    selector: '.entry-content > *[class*="wp-block-"]',
    variationClassPrefix: "wp-block-",
    description:
      "TimberTech WordPress blocks from multiple pages with link following",
    isSitemap: true,
    manualUrls: [
      "https://www.timbertech.com/",
      "https://www.timbertech.com/about/",
      "https://www.timbertech.com/decking/",
      "https://www.timbertech.com/railing/",
      "https://www.timbertech.com/inspiration/",
    ],
    followLinks: true,
    maxUrls: 20,
    maxDepth: 2,
  },
};

module.exports = scrapingConfigs;
