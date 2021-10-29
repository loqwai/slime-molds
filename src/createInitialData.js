const times = (n) => [...new Array(n).keys()]


export const createPoint = (n, i) => {
  const max = Math.ceil(Math.sqrt(n)) // 10
  const x = Math.floor(i / max) // 1
  const y = Math.floor(i % max) // 0

  const posX = (2 * x / Math.max(1, (max - 1))) - 1 // (2 * 1 / 10) - 1 === 0.2 - 1 === -0.8
  const posY = (2 * y / Math.max(1, (max - 1))) - 1 // (2 * 0 / 10) - 1 === 0   - 1 === -1

  const velX = -0.1 * posX
  const velY = -0.1 * posY
  const velMagnitude = Math.sqrt((velX * velX) + (velY * velY))

  const outVelX = (isNaN(velX / velMagnitude) ? 0 : velX / velMagnitude)
  const outVelY = (isNaN(velY / velMagnitude) ? 0 : velY / velMagnitude)

  return [
    posX,
    posY,
    outVelX,
    outVelY,
    // initial color
    Math.abs(outVelX),
    Math.abs(outVelY),
    Math.abs(outVelX - outVelY),
    1.0,
  ]
}

export const createInitialData = n => times(n).flatMap(i => createPoint(n, i))

export const extractPositions = (data) => (
  times(data.length).flatMap(i => [data[i * 4], data[(i * 4) + 1]])
)