#!/bin/bash

###############################################################################
# Firebase Test Runner Script
# Spouští všechny testy pro diagnostiku Firebase problémů
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print header
echo -e "${PURPLE}=================================${NC}"
echo -e "${PURPLE}🚀 Firebase Test Suite Runner${NC}"
echo -e "${PURPLE}=================================${NC}"
echo ""

# Project directory
PROJECT_DIR="/home/pi/programovani/ovladani-brany-v2/gate-control"
cd "$PROJECT_DIR"

echo -e "${BLUE}📂 Working Directory: $PROJECT_DIR${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Are you in the right directory?${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

echo -e "${CYAN}=== Phase 1: Jest Tests ===${NC}"
echo ""

# Run Jest tests with our custom config
echo -e "${BLUE}🧪 Running Firebase Authentication Tests...${NC}"
npx jest src/__tests__/firebase-auth.test.ts --config=src/__tests__/jest.config.js --verbose

echo ""
echo -e "${BLUE}🧪 Running UserApprovalPanel Component Tests...${NC}"
npx jest src/__tests__/components/UserApprovalPanel.test.tsx --config=src/__tests__/jest.config.js --verbose

echo ""
echo -e "${BLUE}🧪 Running AuthContext Tests...${NC}"
npx jest src/__tests__/contexts/AuthContext.test.tsx --config=src/__tests__/jest.config.js --verbose

echo ""
echo -e "${BLUE}🧪 Running Firebase Rules Integration Tests...${NC}"
npx jest src/__tests__/integration/firebase-rules.test.ts --config=src/__tests__/jest.config.js --verbose

echo ""
echo -e "${CYAN}=== Phase 2: Node.js Firebase Script ===${NC}"
echo ""

# Run Node.js Firebase test script
echo -e "${BLUE}🔥 Running Direct Firebase Test Script...${NC}"
if [ -f "scripts/firebase-test-script.js" ]; then
    node scripts/firebase-test-script.js
else
    echo -e "${YELLOW}⚠️  Firebase test script not found at scripts/firebase-test-script.js${NC}"
fi

echo ""
echo -e "${CYAN}=== Phase 3: Coverage Report ===${NC}"
echo ""

# Generate coverage report
echo -e "${BLUE}📊 Generating Test Coverage Report...${NC}"
npx jest --config=src/__tests__/jest.config.js --coverage --watchAll=false

echo ""
echo -e "${CYAN}=== Phase 4: Test Summary ===${NC}"
echo ""

# Run all tests together for final summary
echo -e "${BLUE}🎯 Running Complete Test Suite...${NC}"
npx jest src/__tests__ --config=src/__tests__/jest.config.js --verbose --watchAll=false

echo ""
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""

# Show coverage report location
if [ -d "coverage" ]; then
    echo -e "${BLUE}📊 Coverage report generated in: ./coverage/${NC}"
    echo -e "${BLUE}   - HTML report: ./coverage/lcov-report/index.html${NC}"
    echo -e "${BLUE}   - LCOV file: ./coverage/lcov.info${NC}"
fi

echo ""
echo -e "${PURPLE}=== Test Recommendations ===${NC}"
echo -e "${YELLOW}1. Check the coverage report for untested code${NC}"
echo -e "${YELLOW}2. Run Firebase script with --help for more options${NC}"
echo -e "${YELLOW}3. Use --mock flag to create test pending users${NC}"
echo -e "${YELLOW}4. Use --cleanup flag to remove test data${NC}"
echo ""

echo -e "${PURPLE}=== Debugging Commands ===${NC}"
echo -e "${CYAN}# Run specific test file:${NC}"
echo -e "npx jest src/__tests__/firebase-auth.test.ts --config=src/__tests__/jest.config.js"
echo ""
echo -e "${CYAN}# Run Firebase script with specific flags:${NC}"
echo -e "node scripts/firebase-test-script.js --connection"
echo -e "node scripts/firebase-test-script.js --users"
echo -e "node scripts/firebase-test-script.js --mock"
echo ""
echo -e "${CYAN}# Debug in watch mode:${NC}"
echo -e "npx jest --config=src/__tests__/jest.config.js --watch"
echo ""

echo -e "${GREEN}🎉 Firebase test suite execution completed!${NC}"