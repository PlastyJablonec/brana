const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Get build info from git and package.json
try {
  // Get current commit hash
  const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  
  // Get current timestamp (actual build time)
  const buildTime = new Date().toISOString();
  
  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const version = packageJson.version;

  // Create .env file for build
  const envContent = `REACT_APP_BUILD_TIME=${buildTime}
REACT_APP_VERSION=${version}
REACT_APP_COMMIT_HASH=${commitHash}
`;

  fs.writeFileSync(path.join(__dirname, '.env'), envContent);
  
  console.log('✅ Build info set:');
  console.log(`   Version: ${version}`);
  console.log(`   Build time: ${buildTime}`);
  console.log(`   Commit: ${commitHash.substring(0, 7)}`);
  
} catch (error) {
  console.error('❌ Failed to set build info:', error.message);
  
  // Fallback values
  const fallbackContent = `REACT_APP_BUILD_TIME=2025-02-08T09:00:00.000Z
REACT_APP_VERSION=2.1.0
REACT_APP_COMMIT_HASH=dev
`;
  
  fs.writeFileSync(path.join(__dirname, '.env'), fallbackContent);
  console.log('⚠️ Using fallback build info');
}