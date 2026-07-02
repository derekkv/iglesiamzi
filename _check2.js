const fs = require('fs');
const c = fs.readFileSync('app/dashboard/censo/page.tsx', 'utf8');
const idx = c.indexOf('censoService.create(formData');
console.log('Found at:', idx);
console.log('Snippet:', JSON.stringify(c.substring(idx, idx + 200)));
