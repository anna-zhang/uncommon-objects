document.getElementById('upload').addEventListener('change', handleImageUpload)

function handleImageUpload (event) {
  const file = event.target.files[0]
  const reader = new FileReader()
  reader.onload = function (e) {
    const img = new Image()
    img.onload = function () {
      processImage(img)
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

async function processImage (img) {
  // Scale to fit window, while maintaining aspect ratio
  const maxWidth = window.innerWidth * 0.9
  const maxHeight = window.innerHeight * 0.7

  const scaleRatio = Math.min(maxWidth / img.width, maxHeight / img.height)
  const newWidth = img.width * scaleRatio
  const newHeight = img.height * scaleRatio

  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')
  canvas.style.display = 'none' // Hide image initially until processing is complete
  canvas.width = newWidth
  canvas.height = newHeight

  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  const model = await cocoSsd.load()
  const predictions = await model.detect(img)

  predictions.forEach(prediction => {
    const { bbox, class: className, score } = prediction
    let [x, y, width, height] = bbox

    // Scale bounding box coordinates
    x *= scaleRatio
    y *= scaleRatio
    width *= scaleRatio
    height *= scaleRatio

    // Round the values to the nearest integer
    x = Math.round(x)
    y = Math.round(y)
    width = Math.round(width)
    height = Math.round(height)

    // Apply pixelation based on confidence score
    const maxPixelation = Math.sqrt(newWidth * newHeight) / 20 // The larger the image, the greater the maximum pixelation can be
    const pixelationFactor = Math.max(1, Math.floor(score * maxPixelation))

    pixelateArea(ctx, x, y, width, height, pixelationFactor)
  })

  canvas.style.display = 'block' // Show canvas once image has been processed
}

function pixelateArea (ctx, x, y, width, height, factor) {
  if (factor <= 1) return // No pixelation needed if factor is 1 or less
  const imageData = ctx.getImageData(x, y, width, height)
  const data = imageData.data

  console.log('x: ' + x, 'y: ' + y, 'width: ' + width, 'height: ' + height)

  for (let row = 0; row < height; row += factor) {
    for (let col = 0; col < width; col += factor) {
      // Initialize sums and count
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0
      let count = 0

      // Sum up all colors in the block
      for (let dx = 0; dx < factor; dx++) {
        for (let dy = 0; dy < factor; dy++) {
          const px = col + dx
          const py = row + dy

          if (px < width && py < height) {
            const index = (py * width + px) * 4
            red += data[index]
            green += data[index + 1]
            blue += data[index + 2]
            alpha += data[index + 3]
            count++
          }
        }
      }

      if (count > 0) {
        // Calculate average colors
        red = Math.floor(red / count)
        green = Math.floor(green / count)
        blue = Math.floor(blue / count)
        alpha = Math.floor(alpha / count)

        // Apply the average color to the block
        for (let dx = 0; dx < factor; dx++) {
          for (let dy = 0; dy < factor; dy++) {
            const px = col + dx
            const py = row + dy

            if (px < width && py < height) {
              const index = (py * width + px) * 4
              data[index] = red
              data[index + 1] = green
              data[index + 2] = blue
              data[index + 3] = alpha
            }
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y)
}
