document.getElementById('upload').addEventListener('change', handleImageUpload)

const showBoundingBoxCheckbox = document.getElementById('showBoundingBox')
const bbCheckboxDiv = document.getElementById('bbCheckboxDiv')
const messageElement = document.getElementById('message')
const loadingText = document.getElementById('loading')

let currentImage = null
let currentPredictions = null
let scaleRatio = 1

showBoundingBoxCheckbox.addEventListener('change', () => {
  if (currentImage && currentPredictions) {
    redrawCanvasWithBoundingBoxes() // Display / hide any bounding boxes and labels
  }
})

function handleImageUpload (event) {
  canvas.style.display = 'none' // Hide image initially until processing is complete
  messageElement.style.display = 'none' // Hide message that no common objects were found
  bbCheckboxDiv.style.display = 'none' // Hide option to see bounding box & labels

  // Show the "Loading..." text
  loadingText.style.display = 'block'

  const file = event.target.files[0]
  if (!file) {
    error('No file found.')
  }

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

  scaleRatio = Math.min(maxWidth / img.width, maxHeight / img.height)
  const newWidth = img.width * scaleRatio
  const newHeight = img.height * scaleRatio

  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = newWidth
  canvas.height = newHeight

  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  showBoundingBoxCheckbox.checked = false

  const model = await cocoSsd.load()
  const predictions = await model.detect(img)

  currentImage = img
  currentPredictions = predictions

  if (predictions.length === 0) {
    loadingText.style.display = 'none' // Hide "Loading..." text
    messageElement.style.display = 'block' // Show message that no common objects were found
    canvas.style.display = 'block' // Show canvas with original image
    return
  }

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
    console.log(className)

    pixelateArea(ctx, x, y, width, height, pixelationFactor)
  })

  loadingText.style.display = 'none' // Hide "Loading..." text
  canvas.style.display = 'block' // Show canvas once image has been processed
  bbCheckboxDiv.style.display = 'block' // Show option to see bounding box & labels
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

function redrawCanvasWithBoundingBoxes () {
  const canvas = document.getElementById('canvas')
  const ctx = canvas.getContext('2d')

  // Clear the canvas first
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Redraw the image
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height)

  // Redraw the pixelated areas and bounding boxes
  currentPredictions.forEach(prediction => {
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
    const maxPixelation = Math.sqrt(canvas.width * canvas.height) / 20 // The larger the image, the greater the maximum pixelation can be
    const pixelationFactor = Math.max(1, Math.floor(score * maxPixelation))
    console.log(className)

    pixelateArea(ctx, x, y, width, height, pixelationFactor)

    // If the checkbox is checked, draw the bounding box and label
    if (showBoundingBoxCheckbox.checked) {
      // Draw bounding box
      ctx.strokeStyle = 'red'
      ctx.lineWidth = Math.max(3, 2 * scaleRatio) // Scale bounding box line width according to image
      ctx.strokeRect(x, y, width, height)
      // Draw class label and confidence score
      const fontSize = Math.max(20, 16 * scaleRatio) // Scale font size according to image
      ctx.fillStyle = 'red'
      ctx.font = `${fontSize}px Arial`
      ctx.fillText(
        `${className} (${Math.round(score * 100)}%)`,
        x,
        y > 10 ? y - 5 : 10
      )
    }
  })
}

function saveImage () {
  const canvas = document.getElementById('canvas')

  // Get the canvas data as a data URL (base64 encoded PNG)
  const imageData = canvas.toDataURL('image/jpeg')

  // Create a temporary link element
  const link = document.createElement('a')
  link.href = imageData
  link.download = 'uncommon-object.jpg' // Set file name

  // Trigger the download by programmatically clicking the link
  link.click()
}
