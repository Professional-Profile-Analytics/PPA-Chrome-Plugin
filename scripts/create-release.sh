#!/bin/bash

# Professional Profile Analytics Chrome Extension - Release Creator
# This script helps create a new release with proper versioning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Professional Profile Analytics Chrome Extension - Release Creator${NC}"
echo "=================================================================="

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo -e "${RED}❌ Error: manifest.json not found. Please run this script from the extension root directory.${NC}"
    exit 1
fi

# Get current version from manifest
CURRENT_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo -e "${BLUE}📋 Current version in manifest.json: ${CURRENT_VERSION}${NC}"

# Ask for new version
echo ""
echo -e "${YELLOW}Please enter the new version number (e.g., 1.7.4):${NC}"
read -p "New version: " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}❌ Error: Version cannot be empty${NC}"
    exit 1
fi

# Validate version format (basic check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Error: Version must be in format X.Y.Z (e.g., 1.7.4)${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📝 Release Summary:${NC}"
echo "  Current version: $CURRENT_VERSION"
echo "  New version:     $NEW_VERSION"
echo "  Tag:             v$NEW_VERSION"

echo ""
echo -e "${YELLOW}Do you want to proceed with creating this release? (y/N)${NC}"
read -p "Proceed: " CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️  Release creation cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🔄 Creating release...${NC}"

# Update manifest.json version
echo -e "${BLUE}📝 Updating manifest.json version...${NC}"
if command -v jq &> /dev/null; then
    jq --arg version "$NEW_VERSION" '.version = $version' manifest.json > manifest.json.tmp
    mv manifest.json.tmp manifest.json
else
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" manifest.json
    rm -f manifest.json.bak
fi

echo -e "${GREEN}✅ Updated manifest.json to version $NEW_VERSION${NC}"

# Commit the version change
echo -e "${BLUE}📝 Committing version update...${NC}"
git add manifest.json
git commit -m "Bump version to $NEW_VERSION for release

🔖 VERSION UPDATE:
- Updated manifest.json version from $CURRENT_VERSION to $NEW_VERSION
- Preparing for release v$NEW_VERSION

This commit will trigger the release build workflow when tagged."

echo -e "${GREEN}✅ Committed version update${NC}"

# Create and push tag
echo -e "${BLUE}🏷️  Creating and pushing tag v$NEW_VERSION...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

🎉 Professional Profile Analytics Chrome Extension v$NEW_VERSION

This release includes:
- ✅ Advanced Post Analytics with configurable posts limit (5-50)
- ✅ URL-based download tracking system
- ✅ Multi-language LinkedIn interface support
- ✅ Company page analytics automation
- ✅ Shiny integration with human-like typing
- ✅ Comprehensive test suite (69 tests)
- ✅ GitHub Actions CI/CD pipeline

📦 The Chrome extension package will be automatically built and attached to this release.

🚀 Installation:
1. Download the ZIP file from this release
2. Extract and load unpacked in Chrome
3. Configure your email in extension options

Built automatically by GitHub Actions."

# Push the commit and tag
echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo -e "${GREEN}🎉 Release v$NEW_VERSION created successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What happens next:${NC}"
echo "  1. ✅ Version updated in manifest.json"
echo "  2. ✅ Changes committed and pushed to GitHub"
echo "  3. ✅ Tag v$NEW_VERSION created and pushed"
echo "  4. 🔄 GitHub Actions will automatically:"
echo "     - Build the Chrome extension package"
echo "     - Create a ZIP file with all extension files"
echo "     - Attach the ZIP to the GitHub release"
echo "     - Generate comprehensive release notes"
echo ""
echo -e "${YELLOW}🔗 Check the release at:${NC}"
echo "   https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/v$NEW_VERSION"
echo ""
echo -e "${BLUE}⏱️  The build process typically takes 1-2 minutes.${NC}"
echo -e "${GREEN}✨ Your Chrome extension package will be ready for download shortly!${NC}"
