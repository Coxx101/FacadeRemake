// Quick diagnostic - run with: node e:\FacadeRemake\frontend\check.cjs
const fs = require('fs');

// Check index.html
const html = fs.readFileSync('e:/FacadeRemake/frontend/dist/index.html', 'utf8');
console.log('=== index.html ===');
console.log(html);

// Check for potential issues in store
const storeCode = fs.readFileSync('e:/FacadeRemake/frontend/src/store/useStore.ts', 'utf8');

// Look for potential issues
if (storeCode.includes('canUndo') || storeCode.includes('canRedo')) {
  console.log('\n=== WARNING: canUndo/canRedo method calls found ===');
  console.log('These may call .getState() in selectors which causes infinite re-renders');
}
if (storeCode.includes('_undoCount')) {
  console.log('\n=== _undoCount found ===');
  // Find how it's used in selectors
  const lines = storeCode.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('_undoCount') && (line.includes('useStore') || line.includes('s =>') || line.includes('s.'))) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  });
}
