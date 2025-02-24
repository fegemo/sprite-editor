import { lineEFLA, equalPosition, floodFill, bresenhamEllipse } from './algorithms.js'
import { Editor } from './editor.js'

/**
 * Represents a command that can be executed on the editor, for instance, to change
 * specific pixels of the main canvas to some color (as is the case of the PencilCommand).
 *  
 * This is an abstract class and should not be instantiated directly.
 * The `execute` method should be implemented by subclasses.
 */
export class Command {
  /**
   * 
   * @param {string} name The name of the command (e.g., 'pencil', 'bucket').
   * @param {object} params The parameters required to execute the command (e.g., 
   *  the color and positions to paint).
   * @param {boolean} taintsCanvas Whether the command taints the main canvas or not.
   *  This is used as a hint to the editor to notify observers that the canvas has changed.
   *  For instance, the MultiCanvasPlugin implements a 2-way data binding between the main
   *  canvas and the other canvases. When the main canvas changes, the respective other canvas
   *  should also change. However, if the command does not taint the canvas, the plugin does
   *  not need to update the other canvases.
   */
  constructor(name, params, taintsCanvas = true) {
    this.name = name
    this.params = params
    this.taintsCanvas = taintsCanvas
  }

  execute(editor) {
    throw new Error('Abstract "execute" method on Command was called.')
  }
}

/**
 * Represents a command that paints pixels on the canvas.
 */
export class PencilCommand extends Command {
  /**
   * Creates a new pencil command to define the color of some pixels.
   * 
   * @param {string} color The color used to paint the pixels.
   * @param {Array} paintedPositions Array of pixel positions to paint. This list can grow
   *  by calling the method logPosition(position).
   */
  constructor(color, paintedPositions) {
    super('pencil', { color, paintedPositions })
    this.previousPosition = this.params.paintedPositions[0]
  }

  configure(editor) {
    // saves the canvas state to restore it after the command is executed
    editor.canvas.ctx.save()
    editor.canvas.ctx.fillStyle = this.params.color
  }
  
  deconfigure(editor) {
    // restores the canvas state to the previous state
    editor.canvas.ctx.restore()
  }

  /**
   * Executes the pencil command, effectively changing the colors of pixels on the canvas.
   * @param {Editor} editor 
   */
  execute(editor) {
    // 1. saves the canvas state
    // 2. iterates over the pixels to paint, setting the color of each one
    // 3. restores the state
    this.configure(editor)
    this.previousPosition = this.params.paintedPositions[0]
    for (let position of this.params.paintedPositions) {
      this.#iterateConfigured(editor, position)
    }
    this.deconfigure(editor)
  }

  #iterateConfigured(editor, position) {
    if (equalPosition(position, this.previousPosition)) {
      editor.canvas.ctx.fillRect(position.x, position.y, 1, 1)
    } else {
      // if there was a jump between the previous and current positions, instead of just filling the
      // current pixel, we draw a line between the previous and the current positions
      lineEFLA((x, y) => editor.canvas.ctx.fillRect(x, y, 1, 1), this.previousPosition, position)
    }
    this.previousPosition = position
  }

  iterate(editor, position) {
    this.configure(editor)
    this.#iterateConfigured(editor, position)    
    this.deconfigure(editor)
  }

  /**
   * Registers a new pixel position to be painted.
   * 
   * @param {object} position An object containing x and y properties.
   */
  logPosition(position) {
    // saves a new position (x,y) into the list of painted positions
    if (equalPosition(this.previousPosition, position)) {
      return
    }
    this.params.paintedPositions.push(position)
  }
}


export class EraserCommand extends PencilCommand {
  constructor(color, erasedPositions) {
    super(color, erasedPositions)
    this.name = 'eraser'
  }

  configure(editor) {
    super.configure(editor)
    editor.canvas.ctx.fillStyle = this.params.color
    editor.canvas.ctx.globalCompositeOperation = 'destination-out'
  }
}

export class PenCommand extends Command {
  constructor(color, paintedPositions) {
    super('pencil', { color, paintedPositions })
  }

  execute(editor) {
    const ctx = editor.canvas.ctx
    ctx.save()
    ctx.fillStyle = this.params.color
    ctx.lineJoin = 'miter'
    ctx.miterLimit = 1
    ctx.lineCap = 'butt'
    ctx.lineWidth = 1
    ctx.imageSmoothingEnabled = false
    ctx.beginPath()
    const { x, y } = this.params.paintedPositions[0]
    ctx.moveTo(x, y)
    ctx.stroke()
    for (const {x, y} of this.params.paintedPositions) {
      this.iterate(editor, {x, y})
    }
    ctx.closePath()
    ctx.restore()
    console.log("Finished drawing cold")
  }

  iterate(editor, position) {
    editor.canvas.ctx.lineTo(position.x, position.y)
    editor.canvas.ctx.stroke()
  }
}

/**
 * Represents a command that paints a polygon with two points (e.g., begin and end).
 * 
 * This is an abstract class and should not be instantiated directly.
 * The `execute` method should be implemented by subclasses.
 * 
 * This class can be used by commands that require two points to define a polygon, such as
 * LineCommand and RectangleCommand. Others could be CircleCommand, EllipseCommand, etc.
 */
class TwoPointPolygonCommand extends Command {
  constructor(color, startPosition, endPosition) {
    super('generic two line', { color, startPosition, endPosition })
  }

  configure(editor) {
    editor.canvas.ctx.save()
    editor.canvas.ctx.fillStyle = this.params.color
  }

  deconfigure(editor) {
    editor.canvas.ctx.restore()
  }

  execute(editor) {

  }

  updatePosition(position) {
    this.params.endPosition = position
  }
}

export class LineCommand extends TwoPointPolygonCommand {
  constructor(color, start, end) {
    super(color, start, end)
    this.name = 'line'
  }

  execute(editor) {
    this.configure(editor)
    const startPosition = this.params.startPosition
    const endPosition = this.params.endPosition
    lineEFLA((x, y) => editor.canvas.ctx.fillRect(x, y, 1, 1), startPosition, endPosition)
    this.deconfigure(editor)
  }
}

export class RectangleCommand extends TwoPointPolygonCommand {
  constructor(color, start, end) {
    super(color, start, end)
    this.name = 'rectangle'
  }

  execute(editor) {
    this.configure(editor)
    const startPosition = this.params.startPosition
    const endPosition = this.params.endPosition
    const ctx = editor.canvas.ctx
    ctx.fillRect(startPosition.x, startPosition.y, endPosition.x - startPosition.x, endPosition.y - startPosition.y)
    this.deconfigure(editor)
  }
}

export class EllipseCommand extends TwoPointPolygonCommand {
  constructor(color, start, end) {
    super(color, start, end);
    this.name = "ellipse";
  }

  execute(editor) {
    this.configure(editor);

    const startPosition = this.params.startPosition;
    const endPosition = this.params.endPosition;
    const ctx = editor.canvas.ctx;

  
    const width = Math.abs(endPosition.x - startPosition.x);
    const height = Math.abs(endPosition.y - startPosition.y);
    
    //The center point of the ellipse is needed to draw the symmetric pixels given the pixels of the first quadrant, as the algorithm calculates only such coordinates.
    const centerX = startPosition.x + Math.sign(endPosition.x - startPosition.x) * Math.floor(width / 2);
    const centerY = startPosition.y + Math.sign(endPosition.y - startPosition.y) * Math.floor(height / 2);

    //Ellipse's semi-major (a) and semi-minor (b) axes.
    const radiusX = Math.floor(width / 2);
    const radiusY = Math.floor(height / 2);

    bresenhamEllipse(ctx, centerX, centerY, radiusX, radiusY, this.params.color);
    
    this.deconfigure(editor);
  }
}

export class BucketCommand extends Command {
  constructor(color, position) {
    super('bucket', { color, position })
  }

  configure(editor) {
    editor.canvas.ctx.save()
    editor.canvas.ctx.fillStyle = this.params.color
  }

  deconfigure(editor) {
    editor.canvas.ctx.restore()
  }

  execute(editor) {
    const ctx = editor.canvas.ctx
    this.configure(editor)
    floodFill(
      ctx.getImageData(0, 0, editor.canvas.width, editor.canvas.height),
      this.params.position,
      ({x, y}) => ctx.fillRect(x, y, 1, 1)
    )
    this.deconfigure(editor)
  }
}

export class PasteCommand extends Command {
  constructor(image) {
    super('paste', { image })
  }

  execute(editor) {
    const image = this.params.image
    editor.canvas.restore(image)
  }
}
