const { chromium } = require("playwright");
const fs = require("fs-extra");
const path = require("path");

class ElementScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.outputDir = "output";
    this.screenshotsDir = path.join(this.outputDir, "screenshots");
    this.variations = [];
    this.currentUrl = null;
  }

  async initialize() {
    // Create output directories
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(this.screenshotsDir);

    // Determine if we should run in headless mode (for CI/CD environments)
    const isCI = process.env.CI === 'true' || process.env.PLAYWRIGHT_HEADLESS === 'true';
    
    // Launch browser with optimized viewport for better element capture
    this.browser = await chromium.launch({
      headless: isCI,
      args: ["--start-maximized"],
    });
    this.page = await this.browser.newPage();

    // Set a narrower viewport to ensure consistent element rendering
    await this.page.setViewportSize({
      width: 1024,
      height: 768,
    });
  }

  async navigateToPage(url) {
    console.log(`Navigating to: ${url}`);
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait a bit for dynamic content to load
    await this.page.waitForTimeout(3000);

    // Try to wait for network idle but don't fail if it times out
    try {
      await this.page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (error) {
      console.log("Network idle timeout - continuing anyway...");
    }

    // Remove floating elements and popups
    await this.removeFloatingElements();
  }

  async removeFloatingElements() {
    console.log("Removing floating elements and popups...");

    // Common selectors for floating/overlay elements
    const floatingSelectors = [
      // Site headers (add these first for priority)
      ".site-header",
      "#site-header",
      "header.header",
      'header[class*="header"]',
      '[class*="site-header"]',
      '[id*="site-header"]',

      // Cookie banners
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="gdpr"]',
      '[id*="gdpr"]',

      // Chat widgets
      '[class*="chat"]',
      '[id*="chat"]',
      '[class*="intercom"]',
      '[id*="intercom"]',
      '[class*="zendesk"]',
      '[id*="zendesk"]',

      // Popups and modals
      '[class*="popup"]',
      '[id*="popup"]',
      '[class*="modal"]',
      '[id*="modal"]',
      '[class*="overlay"]',
      '[id*="overlay"]',

      // Newsletter/subscription popups
      '[class*="newsletter"]',
      '[id*="newsletter"]',
      '[class*="subscribe"]',
      '[id*="subscribe"]',
      '[class*="signup"]',
      '[id*="signup"]',

      // Notification bars
      '[class*="notification"]',
      '[id*="notification"]',
      '[class*="banner"]',
      '[id*="banner"]',
      '[class*="alert"]',
      '[id*="alert"]',

      // Fixed positioned elements
      '[style*="position: fixed"]',
      '[style*="position:fixed"]',

      // Common WordPress popup plugins
      ".pum-overlay",
      ".elementor-popup-modal",
      ".mfp-bg",
      ".fancybox-overlay",

      // Sticky headers that might interfere
      '[class*="sticky"]',
      '[class*="fixed"]',
    ];

    for (const selector of floatingSelectors) {
      try {
        await this.page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel);
          elements.forEach((el) => {
            // Check if element is actually floating/fixed and not part of main content
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            // Be more aggressive with headers
            if (sel.includes("header") || sel.includes("Header")) {
              if (style.position === "fixed" || style.position === "sticky") {
                console.log(`Hiding header element: ${sel}`);
                el.style.visibility = "hidden";
                return;
              }
            }

            // Only remove if it's clearly a floating element (fixed/sticky position with high z-index)
            // and not in the main content area
            if (
              (style.position === "fixed" || style.position === "sticky") &&
              parseInt(style.zIndex) > 999 &&
              !el.closest(".entry-content, .main-content, .content, main")
            ) {
              console.log(`Removing floating element: ${sel}`);
              el.style.display = "none"; // Hide instead of remove to be safer
            }
          });
        }, selector);
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }

    // Also try to close any visible popups by clicking close buttons
    const closeButtonSelectors = [
      '[aria-label*="close" i]',
      '[title*="close" i]',
      ".close",
      ".modal-close",
      ".popup-close",
      '[class*="close"]',
      'button:has-text("×")',
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
    ];

    for (const selector of closeButtonSelectors) {
      try {
        const closeButton = this.page.locator(selector).first();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click({ timeout: 2000 });
          console.log(`Clicked close button: ${selector}`);
          await this.page.waitForTimeout(500); // Wait for animation
        }
      } catch (error) {
        // Continue if button not found or not clickable
      }
    }

    console.log("Floating elements removal completed");
  }

  async findElementVariations(selector, variationClassPrefix = "") {
    console.log(`Finding variations for selector: ${selector}`);

    // Find all elements matching the base selector
    const elements = await this.page
      .locator(selector)
      // .filter({ hasNot: [":has([class*=__])"] })
      .all();
    console.log(`Found ${elements.length} elements matching the selector`);

    const variations = [];
    const processedElements = new Set(); // Track processed elements to avoid duplicates

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      try {
        // Get element information
        const classNames = (await element.getAttribute("class")) || "";
        const tagName = await element.evaluate((el) =>
          el.tagName.toLowerCase()
        );

        // Enhanced text content extraction that handles images properly
        const contentInfo = await element.evaluate((el) => {
          // Check if element contains images
          const images = el.querySelectorAll("img");
          const hasImages = images.length > 0;

          // Get regular text content
          let textContent = el.textContent || "";

          // If element has images, provide image information instead of long alt text
          if (hasImages) {
            const imageInfo = Array.from(images)
              .map((img) => {
                const src = img.src || img.getAttribute("src") || "";
                const alt = img.alt || "";
                const filename = src.split("/").pop() || src;

                // Return concise image info
                if (alt && alt.length > 0) {
                  return `[Image: ${alt.substring(0, 50)}${
                    alt.length > 50 ? "..." : ""
                  }]`;
                } else if (filename) {
                  return `[Image: ${filename}]`;
                } else {
                  return "[Image]";
                }
              })
              .join(", ");

            // If there's minimal text content (less than 20 chars), show image info
            if (textContent.trim().length < 20) {
              return imageInfo;
            } else {
              // Combine brief text with image info
              const briefText = textContent.trim().substring(0, 30);
              return `${briefText}${
                textContent.length > 30 ? "..." : ""
              } (${imageInfo})`;
            }
          }

          // For non-image content, return trimmed text
          return textContent.trim();
        });

        // Get anchor information (ID and any links within the element)
        const anchorInfo = await element.evaluate((el) => {
          // Check if the element itself has an ID
          const elementId = el.id;

          // Look for headings with IDs within the element
          const headingsWithIds = Array.from(
            el.querySelectorAll(
              "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
            )
          )
            .map((heading) => heading.id)
            .filter((id) => id && id.trim());

          // Look for any elements with IDs within the element
          const elementsWithIds = Array.from(el.querySelectorAll("[id]"))
            .map((elem) => elem.id)
            .filter((id) => id && id.trim() && !headingsWithIds.includes(id)); // Avoid duplicates

          // Look for anchor links within the element
          const anchorLinks = Array.from(el.querySelectorAll('a[href*="#"]'))
            .map((link) => {
              const href = link.getAttribute("href");
              if (href && href.includes("#")) {
                const anchor = href.split("#")[1];
                return anchor;
              }
              return null;
            })
            .filter((anchor) => anchor && anchor.trim());

          return {
            elementId: elementId || null,
            headingIds: headingsWithIds,
            otherIds: elementsWithIds,
            anchorLinks: anchorLinks,
          };
        });

        const boundingBox = await element.boundingBox();

        // Get the actual DOM position of this element relative to its parent
        const actualPosition = await element.evaluate((el) => {
          const parent = el.parentElement;
          if (!parent) return 1;

          // Find the position among all children (not just matching ones)
          const allChildren = Array.from(parent.children);
          return allChildren.indexOf(el) + 1; // +1 for nth-child which is 1-based
        });

        // Create a unique identifier for the element
        const elementId = `${tagName}-${classNames}-${boundingBox?.x || 0}-${
          boundingBox?.y || 0
        }`;

        // Skip if we've already processed this element
        if (processedElements.has(elementId)) {
          console.log(`Skipping duplicate element at index ${i}`);
          continue;
        }

        // Create variation info with the correct selector
        const baseSelector = selector.replace(/:\s*nth-child\(\d+\)/, ""); // Remove any existing nth-child
        const variation = {
          index: i,
          selector: `${baseSelector.replace(
            "*",
            tagName
          )}:nth-child(${actualPosition})`,
          actualSelector: `${baseSelector}:nth-child(${actualPosition})`, // Keep original for screenshots
          tagName,
          classNames: classNames.split(" ").filter((cls) => cls.trim()),
          textContent: contentInfo.substring(0, 150), // Use enhanced content info with longer limit for image descriptions
          boundingBox,
          screenshotPath: null,
          anchorInfo: anchorInfo, // Add anchor information
        };

        // Filter by variation class prefix if provided
        if (variationClassPrefix) {
          // Check if element has any classes with the specified prefix (e.g., "wp-block-")
          const hasTargetClass = variation.classNames.some((cls) =>
            cls.includes(variationClassPrefix)
          );

          // Check if element has any classes with the prefix that also contain "__"
          const hasTargetClassWithDoubleUnderscore = variation.classNames.some(
            (cls) => cls.includes(variationClassPrefix) && cls.includes("__")
          );

          // Include element only if it has target classes but NONE of them contain "__"
          if (!hasTargetClass || hasTargetClassWithDoubleUnderscore) {
            continue;
          }
        }

        // Mark this element as processed and add to variations
        processedElements.add(elementId);
        variations.push(variation);
      } catch (error) {
        console.warn(`Error processing element ${i}:`, error.message);
      }
    }

    console.log(
      `After deduplication: ${variations.length} unique variations found`
    );
    this.variations = variations;
    return variations;
  }

  async takeScreenshots() {
    const maxScreenshots = 50; // Limit to prevent overwhelming
    const screenshotCount = Math.min(this.variations.length, maxScreenshots);

    console.log(
      `Taking screenshots for ${screenshotCount} variations (limited from ${this.variations.length} total)`
    );

    for (let i = 0; i < screenshotCount; i++) {
      const variation = this.variations[i];

      try {
        const timestamp = Date.now();
        const screenshotName = `element_${i}_${timestamp}.png`;
        const screenshotPath = path.join(this.screenshotsDir, screenshotName);

        // Find the element again and take screenshot with improved handling
        // Use actualSelector if available, otherwise fall back to selector
        const selectorToUse = variation.actualSelector || variation.selector;
        const element = this.page.locator(selectorToUse).first();

        console.log(`Taking screenshot with selector: ${selectorToUse}`);

        // Check if element is visible before taking screenshot
        const isVisible = await element
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (isVisible) {
          // Get element dimensions first to check if we need special handling
          const boundingBox = await element.boundingBox();

          // Scroll element into view if needed - use center alignment for better capture
          await element
            .scrollIntoViewIfNeeded({ timeout: 5000 })
            .catch(() => {});

          // For large elements, ensure they're fully visible by adjusting scroll
          if (boundingBox && boundingBox.height > 800) {
            // Scroll to the top of the element for tall elements
            await this.page.evaluate((box) => {
              window.scrollTo({
                top: box.y - 100, // Add some padding
                behavior: "instant",
              });
            }, boundingBox);

            // Wait for scroll to complete
            await this.page.waitForTimeout(1000);
          }

          // Quick cleanup of any new floating elements that might have appeared
          await this.page.evaluate(() => {
            // Specifically hide site headers that might be sticky/fixed
            const headers = document.querySelectorAll(
              'header, .site-header, #site-header, [class*="site-header"], [class*="header"]'
            );
            headers.forEach((header) => {
              const style = window.getComputedStyle(header);
              if (style.position === "fixed" || style.position === "sticky") {
                console.log("Hiding header element for screenshot");
                header.style.visibility = "hidden";
              }
            });

            // Also hide other high z-index fixed elements
            const floatingElements = document.querySelectorAll(
              '[style*="position: fixed"]'
            );
            floatingElements.forEach((el) => {
              const style = window.getComputedStyle(el);
              if (
                style.position === "fixed" &&
                parseInt(style.zIndex) > 1000 &&
                !el.closest(".entry-content, .main-content, .content, main")
              ) {
                el.style.visibility = "hidden";
              }
            });
          });

          // Wait a moment for any animations or layout changes
          await this.page.waitForTimeout(500);

          // Use full page screenshot with clipping for better element capture
          // Get updated bounding box after scrolling
          const finalBoundingBox = await element.boundingBox();

          if (
            finalBoundingBox &&
            finalBoundingBox.width > 0 &&
            finalBoundingBox.height > 0
          ) {
            // Add padding around the element for better context
            const padding = 10; // Reduced padding to avoid edge issues
            const pageViewport = this.page.viewportSize();

            // Ensure clipping region is within page bounds with more conservative bounds
            const clipRegion = {
              x: Math.max(0, Math.floor(finalBoundingBox.x - padding)),
              y: Math.max(0, Math.floor(finalBoundingBox.y - padding)),
              width: Math.min(
                pageViewport.width -
                  Math.max(0, Math.floor(finalBoundingBox.x - padding)),
                Math.min(
                  Math.ceil(finalBoundingBox.width + padding * 2),
                  pageViewport.width - 10
                )
              ),
              height: Math.min(
                Math.ceil(finalBoundingBox.height + padding * 2),
                Math.max(200, finalBoundingBox.height + 40) // Ensure reasonable height
              ),
            };

            console.log(`Element ${i} - BoundingBox:`, {
              x: Math.round(finalBoundingBox.x),
              y: Math.round(finalBoundingBox.y),
              width: Math.round(finalBoundingBox.width),
              height: Math.round(finalBoundingBox.height),
            });
            console.log(`Element ${i} - ClipRegion:`, clipRegion);

            // Validate clip region dimensions more strictly
            if (
              clipRegion.width > 10 &&
              clipRegion.height > 10 &&
              clipRegion.x + clipRegion.width <= pageViewport.width
            ) {
              try {
                // Take full page screenshot with clipping
                await this.page.screenshot({
                  path: screenshotPath,
                  timeout: 15000,
                  clip: clipRegion,
                  type: "png",
                  animations: "disabled",
                });
              } catch (clipError) {
                console.log(
                  `Clipping failed for element ${i}, using element screenshot fallback`
                );
                // For very tall elements that failed clipping, try a more conservative approach
                if (finalBoundingBox.height > 1000) {
                  console.log(
                    `Attempting conservative clipping for very tall element ${i}`
                  );
                  // For very tall elements, capture just the top portion with proper width
                  const conservativeClip = {
                    x: Math.max(0, Math.floor(finalBoundingBox.x)),
                    y: Math.max(0, Math.floor(finalBoundingBox.y)),
                    width: Math.min(
                      Math.ceil(finalBoundingBox.width),
                      pageViewport.width - 20
                    ),
                    height: Math.min(800, Math.ceil(finalBoundingBox.height)), // Limit height to 800px
                  };

                  console.log(
                    `Conservative clip region for element ${i}:`,
                    conservativeClip
                  );

                  try {
                    await this.page.screenshot({
                      path: screenshotPath,
                      timeout: 15000,
                      clip: conservativeClip,
                      type: "png",
                      animations: "disabled",
                    });
                    console.log(
                      `Used conservative clipping for tall element ${i}`
                    );
                  } catch (conservativeError) {
                    console.log(
                      `Conservative clipping also failed for element ${i}: ${conservativeError.message}`
                    );

                    // Try to find actual content within the element for a smarter crop
                    try {
                      const contentBounds = await element.evaluate((el) => {
                        // Look for all meaningful content elements within this container
                        const contentElements = el.querySelectorAll(
                          "img, p, h1, h2, h3, h4, h5, h6, div:not(:empty), section, article, .wp-block-group, .wp-block-column"
                        );
                        if (contentElements.length === 0) return null;

                        let minX = Infinity,
                          minY = Infinity,
                          maxX = 0,
                          maxY = 0;
                        let hasContent = false;

                        // Get bounds of all content elements to capture the full scope
                        contentElements.forEach((contentEl) => {
                          const rect = contentEl.getBoundingClientRect();
                          const computedStyle =
                            window.getComputedStyle(contentEl);

                          // Only consider elements that are visible and have meaningful content
                          if (
                            rect.width > 10 &&
                            rect.height > 10 &&
                            computedStyle.display !== "none" &&
                            computedStyle.visibility !== "hidden" &&
                            (contentEl.textContent?.trim().length > 5 ||
                              contentEl.tagName === "IMG" ||
                              contentEl.querySelector("img"))
                          ) {
                            minX = Math.min(minX, rect.left);
                            minY = Math.min(minY, rect.top);
                            maxX = Math.max(maxX, rect.right);
                            maxY = Math.max(maxY, rect.bottom);
                            hasContent = true;
                          }
                        });

                        if (!hasContent) {
                          // Fallback to the element's own bounds but with more reasonable limits
                          const rect = el.getBoundingClientRect();
                          return {
                            x: rect.left,
                            y: rect.top,
                            width: Math.min(rect.width, 900),
                            height: Math.min(rect.height, 800),
                          };
                        }

                        return {
                          x: minX,
                          y: minY,
                          width: maxX - minX,
                          height: Math.min(maxY - minY, 1000), // Allow taller content but limit to 1000px
                        };
                      });

                      if (
                        contentBounds &&
                        contentBounds.width > 0 &&
                        contentBounds.height > 0
                      ) {
                        console.log(
                          `Found content bounds for element ${i}:`,
                          contentBounds
                        );

                        // First scroll to make sure the content is in viewport
                        await this.page.evaluate((bounds) => {
                          window.scrollTo({
                            top: Math.max(0, bounds.y - 100),
                            behavior: "instant",
                          });
                        }, contentBounds);

                        // Wait for scroll to complete
                        await this.page.waitForTimeout(1000);

                        // Recalculate bounds after scrolling
                        const scrolledBounds = await element.evaluate((el) => {
                          const rect = el.getBoundingClientRect();
                          return {
                            x: rect.left,
                            y: rect.top,
                            width: Math.min(rect.width, 900), // Reasonable width limit
                            height: Math.min(rect.height, 600), // Reasonable height limit for viewport
                          };
                        });

                        if (
                          scrolledBounds &&
                          scrolledBounds.y >= 0 &&
                          scrolledBounds.y < 768
                        ) {
                          await this.page.screenshot({
                            path: screenshotPath,
                            timeout: 15000,
                            clip: {
                              x: Math.max(0, Math.floor(scrolledBounds.x)),
                              y: Math.max(0, Math.floor(scrolledBounds.y)),
                              width: Math.ceil(scrolledBounds.width),
                              height: Math.ceil(scrolledBounds.height),
                            },
                            type: "png",
                            animations: "disabled",
                          });
                          console.log(
                            `Used content-aware clipping after scrolling for element ${i}`
                          );
                        } else {
                          // Final fallback to element screenshot
                          await element.screenshot({
                            path: screenshotPath,
                            timeout: 15000,
                            animations: "disabled",
                            type: "png",
                          });
                        }
                      } else {
                        // Final fallback to element screenshot
                        await element.screenshot({
                          path: screenshotPath,
                          timeout: 15000,
                          animations: "disabled",
                          type: "png",
                        });
                      }
                    } catch (contentError) {
                      console.log(
                        `Content-aware clipping failed for element ${i}: ${contentError.message}`
                      );
                      // Final fallback to element screenshot
                      await element.screenshot({
                        path: screenshotPath,
                        timeout: 15000,
                        animations: "disabled",
                        type: "png",
                      });
                    }
                  }
                } else {
                  // More robust fallback - try element screenshot with better error handling
                  try {
                    await element.screenshot({
                      path: screenshotPath,
                      timeout: 15000,
                      animations: "disabled",
                      type: "png",
                    });
                  } catch (elementError) {
                    console.log(
                      `Element screenshot also failed for element ${i}, skipping: ${elementError.message}`
                    );
                    continue; // Skip this element entirely if both methods fail
                  }
                }
              }
            } else {
              console.log(
                `Invalid clip region for element ${i}, using fallback`
              );
              // Fallback to element screenshot
              await element.screenshot({
                path: screenshotPath,
                timeout: 15000,
                animations: "disabled",
                type: "png",
              });
            }
          } else {
            console.log(
              `No valid bounding box for element ${i}, using fallback`
            );
            // Fallback to element screenshot if bounding box fails
            await element.screenshot({
              path: screenshotPath,
              timeout: 15000,
              animations: "disabled",
              type: "png",
            });
          }

          variation.screenshotPath = screenshotName;
          console.log(`Screenshot saved: ${screenshotName}`);
        } else {
          console.log(
            `Skipping screenshot for variation ${i}: element not visible`
          );
        }
      } catch (error) {
        console.warn(
          `Error taking screenshot for variation ${i}:`,
          error.message
        );
      }
    }
  }

  /**
   * Generate HTML report for sitemap scraping with page grouping
   */
  async generateSitemapReport(scrapedUrls, failedUrls) {
    const reportPath = path.join(
      this.outputDir,
      "sitemap_variations_report.html"
    );

    // Helper function to escape HTML
    const escapeHtml = (text) => {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    // Helper function to get the primary block type from classes
    const getBlockType = (classNames) => {
      const blockClass = classNames.find(
        (cls) => cls.startsWith("wp-block-") && !cls.includes("__")
      );
      return blockClass || "other";
    };

    // Group variations by page URL first, then by block type
    const pageGroups = {};
    this.variations.forEach((variation) => {
      const pageUrl = variation.pageUrl || "unknown";
      if (!pageGroups[pageUrl]) {
        pageGroups[pageUrl] = {};
      }

      const blockType = getBlockType(variation.classNames);
      if (!pageGroups[pageUrl][blockType]) {
        pageGroups[pageUrl][blockType] = [];
      }

      pageGroups[pageUrl][blockType].push(variation);
    });

    // Generate variation HTML
    const generateVariationHtml = (variation, groupIndex, totalInGroup) => {
      const screenshotHtml = variation.screenshotPath
        ? `<img src="screenshots/${escapeHtml(variation.screenshotPath)}" 
                 alt="Screenshot of ${getBlockType(
                   variation.classNames
                 )} variation ${groupIndex + 1}" 
                 class="screenshot">`
        : "<p>No screenshot available</p>";

      const classTagsHtml = variation.classNames
        .map((cls) => `<span class="class-tag">${escapeHtml(cls)}</span>`)
        .join("");

      // Create URL with anchor if available
      let sourceUrl = variation.pageUrl;
      if (sourceUrl && variation.anchorInfo) {
        let anchorId = null;

        if (variation.anchorInfo.elementId) {
          anchorId = variation.anchorInfo.elementId;
        } else if (
          variation.anchorInfo.headingIds &&
          variation.anchorInfo.headingIds.length > 0
        ) {
          anchorId = variation.anchorInfo.headingIds[0];
        } else if (
          variation.anchorInfo.otherIds &&
          variation.anchorInfo.otherIds.length > 0
        ) {
          anchorId = variation.anchorInfo.otherIds[0];
        }

        if (anchorId) {
          sourceUrl += `#${anchorId}`;
        }
      }

      const urlLinkHtml = sourceUrl
        ? `<p><strong>Source:</strong> <a href="${escapeHtml(
            sourceUrl
          )}" target="_blank">View on page</a></p>`
        : "";

      return `
      <div class="variation">
          <h5>Variation ${groupIndex + 1} of ${totalInGroup}</h5>
          ${screenshotHtml}
          <div class="metadata">
              <p><strong>Selector:</strong> <code>${escapeHtml(
                variation.selector
              )}</code></p>
              <p><strong>Tag Name:</strong> ${escapeHtml(variation.tagName)}</p>
              <p><strong>Classes:</strong></p>
              <div class="class-list">
                  ${classTagsHtml}
              </div>
              ${urlLinkHtml}
          </div>
      </div>`;
    };

    // Generate page groups HTML
    const pageGroupsHtml = Object.entries(pageGroups)
      .map(([pageUrl, blockTypes]) => {
        const pageTitle = pageUrl
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");
        const totalPageVariations = Object.values(blockTypes).reduce(
          (sum, variations) => sum + variations.length,
          0
        );

        const blockTypesHtml = Object.entries(blockTypes)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([blockType, variations]) => {
            const blockDisplayName = blockType
              .replace("wp-block-", "")
              .replace(/-/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
            const variationsHtml = variations
              .map((variation, index) =>
                generateVariationHtml(variation, index, variations.length)
              )
              .join("");

            return `
            <div class="block-type-group">
                <h4 class="block-type-title">${blockDisplayName} (${
              variations.length
            } variation${variations.length !== 1 ? "s" : ""})</h4>
                <div class="block-variations">
                    ${variationsHtml}
                </div>
            </div>`;
          })
          .join("");

        return `
        <div class="page-group">
            <h3 class="page-title">
                <a href="${escapeHtml(pageUrl)}" target="_blank">${escapeHtml(
          pageTitle
        )}</a>
                <span class="page-stats">(${totalPageVariations} variation${
          totalPageVariations !== 1 ? "s" : ""
        })</span>
            </h3>
            <div class="page-content">
                ${blockTypesHtml}
            </div>
        </div>`;
      })
      .join("");

    // Generate failed URLs section
    const failedUrlsHtml =
      failedUrls.length > 0
        ? `
        <div class="failed-urls">
            <h2>Failed URLs</h2>
            <div class="failed-list">
                ${failedUrls
                  .map(
                    ({ url, error }) => `
                    <div class="failed-item">
                        <strong>${escapeHtml(url)}</strong><br>
                        <span class="error-message">Error: ${escapeHtml(
                          error
                        )}</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `
        : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap Element Variations Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .summary {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .page-group {
            margin: 30px 0;
            border: 2px solid #dee2e6;
            border-radius: 12px;
            padding: 20px;
            background-color: #fafafa;
        }
        .page-title {
            color: #1e40af;
            margin: 0 0 20px 0;
            padding: 10px 0;
            border-bottom: 2px solid #e0e0e0;
            font-size: 1.3em;
        }
        .page-title a {
            color: #1e40af;
            text-decoration: none;
        }
        .page-title a:hover {
            text-decoration: underline;
        }
        .page-stats {
            font-weight: normal;
            color: #666;
            font-size: 0.9em;
        }
        .block-type-group {
            margin: 20px 0;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            background-color: white;
        }
        .block-type-title {
            color: #2c5282;
            margin: 0 0 15px 0;
            font-size: 1.1em;
        }
        .block-variations {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 15px;
        }
        .variation {
            border: 1px solid #ddd;
            margin: 0;
            padding: 12px;
            border-radius: 6px;
            background-color: #fefefe;
        }
        .variation h5 {
            color: #495057;
            margin: 0 0 10px 0;
            font-size: 0.9em;
        }
        .screenshot {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .metadata {
            font-size: 12px;
        }
        .metadata p {
            margin: 8px 0;
        }
        .class-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin: 8px 0;
        }
        .class-tag {
            background-color: #e3f2fd;
            color: #1565c0;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-family: monospace;
        }
        code {
            background-color: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 11px;
        }
        .failed-urls {
            margin: 30px 0;
            padding: 20px;
            background-color: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
        }
        .failed-urls h2 {
            color: #c53030;
            margin: 0 0 15px 0;
        }
        .failed-item {
            margin: 10px 0;
            padding: 10px;
            background-color: white;
            border-radius: 4px;
        }
        .error-message {
            color: #e53e3e;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗺️ Sitemap Element Variations Report</h1>
        
        <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Variations Found:</strong> ${
              this.variations.length
            }</p>
            <p><strong>Pages Scraped:</strong> ${
              scrapedUrls.length - failedUrls.length
            }/${scrapedUrls.length}</p>
            <p><strong>Block Types:</strong> ${
              new Set(this.variations.map((v) => getBlockType(v.classNames)))
                .size
            }</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        ${pageGroupsHtml}
        
        ${failedUrlsHtml}
    </div>
</body>
</html>`;

    await fs.writeFile(reportPath, html);
    console.log(`Report generated: ${reportPath}`);
    return reportPath;
  }

  async generateReport() {
    const reportPath = path.join(this.outputDir, "variations_report.html");

    // Helper function to escape HTML
    const escapeHtml = (text) => {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    // Helper function to get the primary block type from classes
    const getBlockType = (classNames) => {
      // Find the main wp-block- class (not ones with __)
      const blockClass = classNames.find(
        (cls) => cls.startsWith("wp-block-") && !cls.includes("__")
      );
      return blockClass || "other";
    };

    // Group variations by block type
    const groupedVariations = {};
    this.variations.forEach((variation, index) => {
      const blockType = getBlockType(variation.classNames);
      if (!groupedVariations[blockType]) {
        groupedVariations[blockType] = [];
      }
      groupedVariations[blockType].push({ ...variation, originalIndex: index });
    });

    // Generate HTML for each group
    const generateVariationHtml = (variation, groupIndex, totalInGroup) => {
      const screenshotHtml = variation.screenshotPath
        ? `<img src="screenshots/${escapeHtml(variation.screenshotPath)}" 
                 alt="Screenshot of ${getBlockType(
                   variation.classNames
                 )} variation ${groupIndex + 1}" 
                 class="screenshot">`
        : "<p>No screenshot available</p>";

      const classTagsHtml = variation.classNames
        .map((cls) => `<span class="class-tag">${escapeHtml(cls)}</span>`)
        .join("");

      // Create URL with anchor if available
      let sourceUrl = this.currentUrl;
      if (sourceUrl && variation.anchorInfo) {
        // Priority order: element ID > heading IDs > other IDs
        let anchorId = null;

        if (variation.anchorInfo.elementId) {
          anchorId = variation.anchorInfo.elementId;
        } else if (
          variation.anchorInfo.headingIds &&
          variation.anchorInfo.headingIds.length > 0
        ) {
          anchorId = variation.anchorInfo.headingIds[0]; // Use first heading ID
        } else if (
          variation.anchorInfo.otherIds &&
          variation.anchorInfo.otherIds.length > 0
        ) {
          anchorId = variation.anchorInfo.otherIds[0]; // Use first other ID
        }

        if (anchorId) {
          sourceUrl += `#${anchorId}`;
        }
      }

      const urlLinkHtml = sourceUrl
        ? `<p><strong>Source:</strong> <a href="${escapeHtml(
            sourceUrl
          )}" target="_blank">View on page</a></p>`
        : "";

      return `
      <div class="variation">
          <h4>Variation ${groupIndex + 1} of ${totalInGroup}</h4>
          ${screenshotHtml}
          <div class="metadata">
              <p><strong>Selector:</strong> <code>${escapeHtml(
                variation.selector
              )}</code></p>
              <p><strong>Tag Name:</strong> ${escapeHtml(variation.tagName)}</p>
              <p><strong>Classes:</strong></p>
              <div class="class-list">
                  ${classTagsHtml}
              </div>
              ${urlLinkHtml}
          </div>
      </div>`;
    };

    // Generate grouped HTML
    const groupedHtml = Object.entries(groupedVariations)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort groups alphabetically
      .map(([blockType, variations]) => {
        const blockDisplayName = blockType
          .replace("wp-block-", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        const variationsHtml = variations
          .map((variation, index) =>
            generateVariationHtml(variation, index, variations.length)
          )
          .join("");

        return `
        <div class="block-group">
            <h2 class="block-group-title">${escapeHtml(blockDisplayName)} (${
          variations.length
        } variation${variations.length !== 1 ? "s" : ""})</h2>
            <div class="block-group-content">
                ${variationsHtml}
            </div>
        </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Element Variations Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .block-group {
            margin: 30px 0;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            background-color: #fafafa;
        }
        .block-group-title {
            color: #2c5282;
            margin: 0 0 20px 0;
            padding: 10px 0;
            border-bottom: 2px solid #e0e0e0;
            font-size: 1.5em;
        }
        .block-group-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        .variation {
            border: 1px solid #ddd;
            margin: 0;
            padding: 15px;
            border-radius: 8px;
            background-color: white;
        }
        .variation h4 {
            color: #555;
            margin-top: 0;
            font-size: 1.1em;
        }
        .screenshot {
            max-width: 100%;
            height: auto;
            border: 1px solid #ccc;
            border-radius: 4px;
            margin: 10px 0;
        }
        .metadata {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 0.9em;
        }
        .metadata strong {
            color: #333;
        }
        .class-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin: 5px 0;
        }
        .class-tag {
            background-color: #007acc;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
        }
        .summary {
            background-color: #e8f4fd;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary h2 {
            margin-top: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Element Variations Report</h1>
        
        <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Variations Found:</strong> ${
              this.variations.length
            }</p>
            <p><strong>Block Types:</strong> ${
              Object.keys(groupedVariations).length
            }</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        ${groupedHtml}
    </div>
</body>
</html>`;

    await fs.writeFile(reportPath, html);
    console.log(`Report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Scrape elements from multiple URLs found in a sitemap
   * @param {string} baseUrl - Base URL of the website (e.g., 'https://example.com')
   * @param {string} selector - CSS selector for elements to scrape
   * @param {string} variationClassPrefix - Class prefix to filter variations
   * @param {Object} options - Sitemap and scraping options
   * @returns {Promise<Object>} Results containing all variations and report path
   */
  async scrapeSitemap(
    baseUrl,
    selector,
    variationClassPrefix = "",
    options = {}
  ) {
    const {
      maxUrls = 10,
      includePatterns = [],
      excludePatterns = [],
      delayBetweenPages = 2000, // 2 seconds delay between pages
      continueOnError = true,
      manualUrls = null, // Optional manual URL list
      followLinks = true, // Whether to follow same-domain links
      maxDepth = 2, // Maximum crawl depth
    } = options;

    console.log(`🚀 Starting sitemap scraping for: ${baseUrl}`);
    console.log(`🎯 Selector: ${selector}`);
    if (variationClassPrefix) {
      console.log(`🏷️  Class prefix filter: ${variationClassPrefix}`);
    }
    if (followLinks) {
      console.log(`🔗 Link following enabled (max depth: ${maxDepth})`);
    }

    try {
      let urls = [];

      // Use manual URLs if provided, otherwise fetch from sitemap
      if (manualUrls && Array.isArray(manualUrls)) {
        console.log(`📋 Using ${manualUrls.length} manual URLs`);
        urls = manualUrls.slice(0, maxUrls);
      } else {
        // Import ScraperUtils to use sitemap functionality
        const ScraperUtils = require("../utils.js");

        // Fetch URLs from sitemap
        urls = await ScraperUtils.fetchSitemapUrls(baseUrl, {
          maxUrls,
          includePatterns,
          excludePatterns,
        });
      }

      if (urls.length === 0) {
        throw new Error("No URLs found in sitemap or after filtering");
      }

      console.log(`📄 Will scrape ${urls.length} initial pages from sitemap\n`);

      // Initialize browser once for all pages
      await this.initialize();

      // Store all variations from all pages
      const allVariations = [];
      const failedUrls = [];
      const visitedUrls = new Set(); // Track visited URLs to avoid duplicates
      const urlsToProcess = [...urls]; // Queue of URLs to process
      let processedCount = 0;

      // Extract domain from base URL for same-domain filtering
      const baseDomain = new URL(baseUrl).hostname;

      while (urlsToProcess.length > 0 && processedCount < maxUrls) {
        const url = urlsToProcess.shift();

        // Skip if already visited
        if (visitedUrls.has(url)) {
          continue;
        }

        visitedUrls.add(url);

        try {
          processedCount++;
          console.log(
            `\n--- Page ${processedCount}/${Math.min(
              urlsToProcess.length + processedCount,
              maxUrls
            )}: ${url} ---`
          );

          this.currentUrl = url;
          this.variations = []; // Reset variations for this page

          await this.navigateToPage(url);
          await this.findElementVariations(selector, variationClassPrefix);

          if (this.variations.length > 0) {
            console.log(
              `✅ Found ${this.variations.length} variations on this page`
            );

            // Take screenshots immediately for this page's variations
            console.log(
              `📸 Taking screenshots for page ${processedCount} (${this.variations.length} variations)...`
            );
            await this.takeScreenshots();

            // Add page info to each variation after screenshots are taken
            const pageVariations = this.variations.map((variation, index) => ({
              ...variation,
              pageUrl: url,
              pageIndex: processedCount,
              globalIndex: allVariations.length + index,
            }));

            allVariations.push(...pageVariations);
          } else {
            console.log(`ℹ️  No variations found on this page`);
          }

          // Discover and queue new links if link following is enabled
          if (followLinks && processedCount < maxDepth) {
            try {
              const newLinks = await this.discoverSameDomainLinks(
                baseDomain,
                visitedUrls,
                includePatterns,
                excludePatterns
              );

              if (newLinks.length > 0) {
                console.log(
                  `🔍 Discovered ${newLinks.length} new same-domain links`
                );

                // Add new links to the processing queue (up to maxUrls limit)
                const remainingSlots =
                  maxUrls - processedCount - urlsToProcess.length;
                const linksToAdd = newLinks.slice(0, remainingSlots);
                urlsToProcess.push(...linksToAdd);

                if (linksToAdd.length > 0) {
                  console.log(
                    `📝 Added ${linksToAdd.length} links to crawl queue`
                  );
                }
              }
            } catch (linkError) {
              console.log(`⚠️  Failed to discover links: ${linkError.message}`);
            }
          }

          // Add delay between pages to be respectful
          if (processedCount < urls.length && delayBetweenPages > 0) {
            console.log(
              `⏳ Waiting ${delayBetweenPages}ms before next page...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, delayBetweenPages)
            );
          }
        } catch (error) {
          console.error(`❌ Error scraping ${url}:`, error.message);
          failedUrls.push({ url, error: error.message });

          if (!continueOnError) {
            throw error;
          }
        }
      }

      // Set all variations for report generation
      this.variations = allVariations;

      console.log(`📄 Generating consolidated report...`);
      const reportPath = await this.generateSitemapReport(urls, failedUrls);

      console.log(`\n🎉 Sitemap scraping completed!`);
      console.log(`📊 Total variations found: ${this.variations.length}`);
      console.log(
        `✅ Successful pages: ${urls.length - failedUrls.length}/${urls.length}`
      );
      if (failedUrls.length > 0) {
        console.log(`❌ Failed pages: ${failedUrls.length}`);
        failedUrls.forEach(({ url, error }) => {
          console.log(`   - ${url}: ${error}`);
        });
      }
      console.log(`📄 Report saved to: ${reportPath}`);

      return {
        variations: this.variations,
        reportPath,
        scrapedUrls: urls,
        failedUrls,
        stats: {
          totalPages: urls.length,
          successfulPages: urls.length - failedUrls.length,
          totalVariations: this.variations.length,
        },
      };
    } catch (error) {
      console.error("❌ Error during sitemap scraping:", error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Discover same-domain links on the current page
   * @private
   */
  async discoverSameDomainLinks(
    baseDomain,
    visitedUrls,
    includePatterns = [],
    excludePatterns = []
  ) {
    try {
      const links = await this.page.evaluate((domain) => {
        const anchors = document.querySelectorAll("a[href]");
        const discoveredLinks = [];

        anchors.forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (!href) return;

          let absoluteUrl;
          try {
            // Handle relative URLs
            if (href.startsWith("/")) {
              absoluteUrl = `${window.location.protocol}//${domain}${href}`;
            } else if (href.startsWith("http")) {
              absoluteUrl = href;
            } else if (
              !href.startsWith("#") &&
              !href.startsWith("mailto:") &&
              !href.startsWith("tel:")
            ) {
              // Handle relative paths like 'page.html' or '../page.html'
              absoluteUrl = new URL(href, window.location.href).toString();
            } else {
              return; // Skip anchors, mailto, tel, etc.
            }

            // Check if it's the same domain
            const linkDomain = new URL(absoluteUrl).hostname;
            if (linkDomain === domain) {
              // Clean URL (remove fragments and query params for deduplication)
              const cleanUrl = absoluteUrl.split("#")[0].split("?")[0];
              discoveredLinks.push(cleanUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });

        return [...new Set(discoveredLinks)]; // Remove duplicates
      }, baseDomain);

      // Filter out already visited URLs
      const newLinks = links.filter((url) => !visitedUrls.has(url));

      // Apply include/exclude patterns
      let filteredLinks = newLinks;

      if (includePatterns.length > 0) {
        filteredLinks = filteredLinks.filter((url) =>
          includePatterns.some((pattern) => url.includes(pattern))
        );
      }

      if (excludePatterns.length > 0) {
        filteredLinks = filteredLinks.filter(
          (url) => !excludePatterns.some((pattern) => url.includes(pattern))
        );
      }

      return filteredLinks;
    } catch (error) {
      console.log(`⚠️  Error discovering links: ${error.message}`);
      return [];
    }
  }

  async scrape(url, selector, variationClassPrefix = "") {
    try {
      this.currentUrl = url;
      await this.initialize();
      await this.navigateToPage(url);
      await this.findElementVariations(selector, variationClassPrefix);
      await this.takeScreenshots();
      const reportPath = await this.generateReport();

      console.log(`\nScraping completed successfully!`);
      console.log(`Found ${this.variations.length} variations`);
      console.log(`Report saved to: ${reportPath}`);

      return {
        variations: this.variations,
        reportPath,
      };
    } catch (error) {
      console.error("Error during scraping:", error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

module.exports = ElementScraper;
