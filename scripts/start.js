import { spawn } from 'child_process';
import path from 'path';

console.log('=================================================');
console.log('🌐 STARTING SIGNAL ATLAS PRODUCTION SYSTEM');
console.log('=================================================\n');

const serverDir = path.resolve(process.cwd(), 'server');

// Start backend server (which serves API + static client build)
const serverProc = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: { ...process.env }
});

serverProc.on('error', (err) => {
  console.error('Failed to start server:', err);
});
