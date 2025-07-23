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
};

module.exports = scrapingConfigs;
