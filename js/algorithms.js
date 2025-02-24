// EFLA algorithm from: https://stackoverflow.com/a/40888742/1783793
export function lineEFLA(setPixel, {x: x1, y: y1}, {x: x2, y: y2}) {

    var dlt, mul,
        sl = y2 - y1,
        ll = x2 - x1,
        yl = false,
        lls = ll >> 31,
        sls = sl >> 31,
        i

    if ((sl ^ sls) - sls > (ll ^ lls) - lls) {
        sl ^= ll
        ll ^= sl
        sl ^= ll
        yl = true
    }

    dlt = ll < 0 ? -1 : 1
    mul = (ll === 0) ? sl : sl / ll

    if (yl) {
        x1 += 0.5
        for (i = 0; i !== ll; i += dlt)
            setPixel((x1 + i * mul) | 0, y1 + i)
    }
    else {
        y1 += 0.5
        for (i = 0; i !== ll; i += dlt)
            setPixel(x1 + i, (y1 + i * mul) | 0)
    }
    setPixel(x2, y2)
}

export function manhattanDistance({x: x1, y: y1}, {x: x2, y: y2}) {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1)
}

export function equalPosition({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return x1 === x2 && y1 === y2
}

export function equalColor(color1, color2) {
    return Array.isArray(color1) && Array.isArray(color2) && color1.every((value, i) => value === color2[i])
}

export function floodFill(imageData, sourcePosition, setPixel) {
    const posToIndex = (x, y) => y * imageData.width * 4 + x * 4
    const getColor = pixelIndex => {
        const color = Array.from(imageData.data.slice(pixelIndex, pixelIndex + 4))
        return color.length ? color : [0, 0, 0, 0]
    }
    const sourceColor = getColor(posToIndex(sourcePosition.x, sourcePosition.y))
    
    const visited = []
    const hasVisited = (vx, vy) => visited.some(({x, y}) => vx === x && vy === y)

    function floodFillRecursive(x, y) {
        if (x < 0 || x > imageData.width - 1) return
        if (y < 0 || y > imageData.height - 1) return

        const currentColor = getColor(posToIndex(x, y))
        if (!equalColor(currentColor, sourceColor)) return

        setPixel({x, y})
        visited.push({x, y})

        if (!hasVisited(x, y - 1)) floodFillRecursive(x, y - 1)
        if (!hasVisited(x + 1, y)) floodFillRecursive(x + 1, y)
        if (!hasVisited(x, y + 1)) floodFillRecursive(x, y + 1)
        if (!hasVisited(x - 1, y)) floodFillRecursive(x - 1, y)
    }

    floodFillRecursive(sourcePosition.x, sourcePosition.y)
}

// This algorithm is based on the Bresenham Line Algorithm. Given the center point of the ellipse and its radius on both semi-axes, calculated based on the start and final mouse positions, we plot the line corresponding to the ellipse's first quadrant. This is done by separating the first quadrant in two regions according to the tangent line. The division point is the one in which the tangent's slope is equal to -1. In the first region, the variation of movement is greater on y-axis, so we will increment x. In the second region, the variation of movement is greater on x-axis, so we increment y. We plot the pixels successively through integer increments and decrements in both axes.
export function bresenhamEllipse(ctx, centerX, centerY, radiusX, radiusY, color) {
    ctx.fillStyle = color;

    // The drawing starts at point (0, b) and goes until it reaches the point (a, 0).
    let x = 0;
    let y = radiusY;

    // The p1 formula is based on the ellipse's general equation 'x^2/a^2 + y^2/b^2 = 1'. Its goal is to determine the next point inside the first region (in which dx < dy). In that region, x will always be incremented, but we need to choose if y will either be decremented or remain the same. As our possibilities are (x+1, y) and (x+1, y-1), we use x and y as the medium point i.e. (x+1, y-0.5) and apply them to the general equation.
    // p1 = b² -a²b + 0.25a²
    let p1 = radiusY * radiusY - radiusX * radiusX * radiusY + 0.25 * radiusX * radiusX;

    // Partial derivatives of the equation 'b^2*x^2 + a^2*y^2 - a^2*b^2 = 0' (general equation transformed) in relation to x and y. These values give us the increment values in each axis.  
    let dx = 2 * radiusY * radiusY * x; //2b²x
    let dy = 2 * radiusX * radiusX * y; //2a²y

    // Region 1: begins at (0, b) and goes until dx >= dy. In this region, we will always increment x and we will choose when we decrement y.
    while (dx < dy) {
      plotEllipseLines(ctx, centerX, centerY, x, y);

      if (p1 < 0) {
        // Moves on x-axis.
        x++;
        dx += 2 * radiusY * radiusY;
        p1 += dx + radiusY * radiusY;
      } else {
        // Moves on both axis (x increment and y decrement).
        x++;
        y--;
        dx += 2 * radiusY * radiusY;
        dy -= 2 * radiusX * radiusX;
        p1 += dx - dy + radiusY * radiusY;
      }
    }

    // Similar to the p1 logic. But, in the second region, as dx >= dy, we will always increment y and will choose either we decrement x or not. So, between the possibilities (x, y+) and (x-1, y+1) we will use the medium point (x-0.5, y+1). 
    // p2 = b² * (x+0.5)² + a² * (y-1)² - a²b²
    let p2 = radiusY * radiusY * (x + 0.5) * (x + 0.5) + radiusX * radiusX * (y - 1) * (y - 1) - radiusX * radiusX * radiusY * radiusY;

    // Region 2.
    while (y >= 0) {
      plotEllipseLines(ctx, centerX, centerY, x, y);

      if (p2 > 0) {
        // Moves on y-axis.
        y--;
        dy -= 2 * radiusX * radiusX;
        p2 += radiusX * radiusX - dy;
      } else {
        // Moves on both axes.
        y--;
        x++;
        dx += 2 * radiusY * radiusY;
        dy -= 2 * radiusX * radiusX;
        p2 += dx - dy + radiusX * radiusX;
      }
    }
  }

// Currently plotting a filled ellipse. In order to plot it stroked, the last lines must be uncommented.
function plotEllipseLines(ctx, cx, cy, x, y) {
    ctx.fillRect(cx - x, cy + y, x * 2 + 1, 1);
    ctx.fillRect(cx - x, cy - y, x * 2 + 1, 1);
    // ctx.fillRect(cx + x, cy + y, 1, 1);
    // ctx.fillRect(cx - x, cy + y, 1, 1);
    // ctx.fillRect(cx + x, cy - y, 1, 1);
    // ctx.fillRect(cx - x, cy - y, 1, 1);
  }