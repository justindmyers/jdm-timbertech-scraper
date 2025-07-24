#!/bin/bash

# Local GitHub Pages build test script
# This simulates what the GitHub Action will do

echo "🔄 Setting up local GitHub Pages build test..."

# Clean previous build
rm -rf pages

# Run the scraper
echo "🚀 Running TimberTech scraper..."
node cli.js timbertech-sitemap

# Prepare GitHub Pages content
echo "📄 Preparing GitHub Pages content..."
mkdir -p pages

# Copy the generated report
cp output/sitemap_variations_report.html pages/index.html

# Copy screenshots directory
cp -r output/screenshots pages/screenshots

# Create a README
cat > pages/README.md << 'EOF'
# TimberTech Element Analysis

This site contains an automated analysis of WordPress block elements from the TimberTech website.

## Latest Analysis Report

[View the full element variations report](index.html)

## About

This analysis is generated automatically using a web scraper that:
- Crawls TimberTech's website pages
- Identifies unique WordPress block elements
- Captures screenshots of each variation
- Generates a comprehensive report

**Last Updated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
EOF

echo "✅ GitHub Pages content prepared in ./pages/"
echo "🌐 You can serve it locally with:"
echo "   cd pages && python3 -m http.server 8000"
echo "   Then visit: http://localhost:8000"
