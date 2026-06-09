import fs from 'fs'

const svgIcon = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1D9E75"/>
      <stop offset="100%" style="stop-color:#0F6E56"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size*0.22}" fill="url(#grad)"/>
  <text x="${size/2}" y="${size/2}" font-size="${size*0.5}" text-anchor="middle" dominant-baseline="central" fill="white">⚡</text>
</svg>`

fs.writeFileSync('public/icon-192.svg', svgIcon(192))
fs.writeFileSync('public/icon-512.svg', svgIcon(512))
console.log('SVG icons created!')
