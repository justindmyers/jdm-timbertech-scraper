# GitHub Pages Setup for TimberTech Analysis

This project includes a GitHub Action that automatically runs the TimberTech element scraper and publishes the results to GitHub Pages.

## Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under "Source", select **GitHub Actions**
4. The workflow will automatically deploy to `https://[username].github.io/[repository-name]`

### 2. GitHub Action Features

The workflow (`.github/workflows/publish-timbertech.yml`) will:

- **Trigger on**:

  - Push to main branch
  - Manual workflow dispatch
  - Weekly schedule (Mondays at 2 AM UTC)

- **Process**:
  1. Install Node.js and dependencies
  2. Install Playwright browsers
  3. Run the TimberTech sitemap scraper
  4. Generate a comprehensive report with screenshots
  5. Deploy to GitHub Pages

### 3. Local Testing

You can test the GitHub Pages build locally:

```bash
# Run the build script
npm run build:pages

# Serve locally
cd pages && python3 -m http.server 8000

# Visit http://localhost:8000
```

### 4. What Gets Published

The GitHub Pages site will include:

- **Main Report**: Complete element variations analysis (`index.html`)
- **Screenshots**: All captured element screenshots (`screenshots/`)
- **Documentation**: Basic README explaining the analysis

### 5. Automatic Updates

The scraper runs weekly to keep the analysis current with any changes to the TimberTech website. You can also trigger it manually from the GitHub Actions tab.

## File Structure

```
pages/                          # GitHub Pages output
├── index.html                  # Main analysis report
├── screenshots/                # Element screenshots
│   ├── element_0_*.png
│   ├── element_1_*.png
│   └── ...
└── README.md                   # Site documentation
```

## Configuration

The scraper is configured to:

- Follow same-domain links from TimberTech pages
- Capture WordPress block elements (`.wp-block-*`)
- Generate high-quality screenshots
- Create a comprehensive HTML report
- Limit to reasonable crawl depth and page counts

## Troubleshooting

If the GitHub Action fails:

1. Check the **Actions** tab for error logs
2. Ensure GitHub Pages is enabled in repository settings
3. Verify the workflow has proper permissions
4. Test locally with `npm run build:pages`
