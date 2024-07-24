const fs = require('fs');

const pdfPath = './1.pdf';
const base64 = fs.readFileSync(pdfPath, 'base64');
console.log(base64);
