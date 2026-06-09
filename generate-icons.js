const { createCanvas } = require('canvas')
const fs = require('fs')

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#1D9E75')
  grad.addColorStop(1, '#0F6E56')
  ctx.fillStyle = grad
  
  const radius = size * 0.22
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.lineTo(size - radius, 0)
  ctx.quadraticCurveTo(size, 0, size, radius)
  ctx.lineTo(size, size - radius)
  ctx.quadraticCurveTo(size, size, size - radius, size)
  ctx.lineTo(radius, size)
  ctx.quadraticCurveTo(0, size, 0, size - radius)
  ctx.lineTo(0, radius)
  ctx.quadraticCurveTo(0, 0, radius, 0)
  ctx.fill()
  
  ctx.fillStyle = 'white'
  ctx.font = `bold ${size * 0.45}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚡', size / 2, size / 2)
  
  return canvas.toBuffer('image/png')
}

fs.writeFileSync('public/icon-192.png', generateIcon(192))
fs.writeFileSync('public/icon-512.png', generateIcon(512))
console.log('Icons generated!')
