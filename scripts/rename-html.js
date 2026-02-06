import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');

// Check if index.html exists
const indexPath = path.join(distDir, 'index.html');
const managementPath = path.join(distDir, 'management.html');

if (fs.existsSync(indexPath)) {
  fs.renameSync(indexPath, managementPath);
  console.log('Renamed index.html to management.html');
} else {
  console.log('index.html not found in dist folder');
}