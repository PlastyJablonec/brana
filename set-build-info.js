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

  // Read existing .env file and update only build info
  const envPath = path.join(__dirname, '.env');
  let existingContent = '';
  
  if (fs.existsSync(envPath)) {
    existingContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Remove old build info lines
  const lines = existingContent.split('\n').filter(line => 
    !line.startsWith('REACT_APP_BUILD_TIME=') &&
    !line.startsWith('REACT_APP_VERSION=') &&
    !line.startsWith('REACT_APP_COMMIT_HASH=') &&
    line.trim() !== ''
  );
  
  // Add build info at the beginning
  const buildInfoLines = [
    '# Build info (auto-generated)',
    `REACT_APP_BUILD_TIME=${buildTime}`,
    `REACT_APP_VERSION=${version}`,
    `REACT_APP_COMMIT_HASH=${commitHash}`,
    ''
  ];
  
  const finalContent = buildInfoLines.concat(lines).join('\n');
  fs.writeFileSync(envPath, finalContent);
  
  console.log('✅ Build info set:');
  console.log(`   Version: ${version}`);
  console.log(`   Build time: ${buildTime}`);
  console.log(`   Commit: ${commitHash.substring(0, 7)}`);
  
} catch (error) {
  console.error('❌ Failed to set build info:', error.message);
  
  // Fallback: Only update build info, preserve existing .env
  const envPath = path.join(__dirname, '.env');
  let existingContent = '';
  
  if (fs.existsSync(envPath)) {
    existingContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const lines = existingContent.split('\n').filter(line => 
    !line.startsWith('REACT_APP_BUILD_TIME=') &&
    !line.startsWith('REACT_APP_VERSION=') &&
    !line.startsWith('REACT_APP_COMMIT_HASH=') &&
    line.trim() !== ''
  );
  
  const fallbackLines = [
    '# Build info (fallback)',
    'REACT_APP_BUILD_TIME=2025-02-08T09:00:00.000Z',
    'REACT_APP_VERSION=2.1.0',
    'REACT_APP_COMMIT_HASH=dev',
    ''
  ];
  
  const finalContent = fallbackLines.concat(lines).join('\n');
  fs.writeFileSync(envPath, finalContent);
  console.log('⚠️ Using fallback build info (preserving existing .env)');
}