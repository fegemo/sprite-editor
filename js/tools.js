import { BucketCommand, EraserCommand, LineCommand, RectangleCommand, PencilCommand, PasteCommand, EllipseCommand } from "./commands.js"

/**
 * Base class for tools in the editor.
 * 
 * Each tool must implement the following methods:
 * - activated: called when the tool is activated (e.g., when the user clicks on the tool's button)
 * - deactivated: called when the tool is deactivated (e.g., when the user clicks on another tool's button)
 * 
 * It *can* implement:
 * - preActivation: called before the tool is activated (e.g., to save the state of the editor before
 *     the tool is activated, such as the Eye Dropper, which saves which tool was active before it, to restore
 *     it after the color is picked).
 * 
 * Each tool is a "command player", meaning it can execute commands on the canvas instead of directly
 * changing the pixels. For instance, the Pencil tool creates a PencilCommand that registers the change of
 * color of one or more pixels on the canvas. This allows for undo/redo functionality.
 */
class Tool {
  constructor(name, exclusionGroup, triggerElements, shortcut) {
    this.name = name
    this.exclusionGroup = exclusionGroup
    this.active = false
    this.els = triggerElements
    this.shortcut = shortcut
  }

    /**
   * Called by the Editor itself to attach the tool to it (e.g., create a button in the toolbar).
   * This does not need to be called by the user.
   * This "default" implementation attaches the tool to the editor and adds the event listeners
   * to the trigger elements. It also attaches a keyboard shortcut that activates the tool.
   * @param {Editor} editor 
   */

  attachToEditor(editor) {
    this.editor = editor
    if (!this.editor.tools) {
      this.editor.tools = []
    }
    if (!this.editor.tools.includes(this)) {
      this.editor.tools.append(this)
    }

    this.els.forEach(el => el.addEventListener('click', this.execute.bind(this)))
    if (this.shortcut) {
      this.editor.containerEl.ownerDocument.addEventListener('keyup', e => {
        if (e.key.toLowerCase() === this.shortcut.toLowerCase()) {
          this.execute()
        }
      })
      this.els.forEach(el => el.dataset.shortcut = this.shortcut)
    }
  }

  execute() {
    // allow tools to override
  }
}

class ActivatableTool extends Tool {
  #shouldDisableMenu

  constructor(name, exclusionGroup, triggerElements, shortcut, cursorClass, shouldDisableMenu = true) {
    super(name, exclusionGroup, triggerElements, shortcut)
    this.cursorClass = cursorClass
    this.#shouldDisableMenu = shouldDisableMenu
  }

  /**
 * Called by the Editor itself to attach the tool to it (e.g., create a button in the toolbar).
 * This does not need to be called by the user.
 * This "default" implementation attaches the tool to the editor and adds the event listeners
 * to the trigger elements. It also attaches a keyboard shortcut that activates the tool.
 * @param {Editor} editor 
 */

  execute() {
    this.activate()
  }

  activate() {
    if (!this.editor) {
      throw new Error(`Activated a tool (${this.name}) which was not attached to any editor`)
    }

    // call preActivation hook
    this.preActivation()

    // 1. deactivate previously activated from the same exclusion group
    const activeToolsFromSameGroup = this.editor.tools.filter(t => t.exclusionGroup === this.exclusionGroup && t.active)
    activeToolsFromSameGroup.forEach(t => t.deactivate())

    // 2. call the underlying activation specific to the tool
    this.active = true
    this.els.forEach(el => el.classList.add('active-tool'))

    if (this.#shouldDisableMenu) {
      this.editor.canvas.el.addEventListener('contextmenu', this.#disableContextMenu)
    }

    this.activated()
    this.setToolCursor()
  }

  /**
   * Called by the editor when a tool is deactivated (e.g., another tool was activated).
   * This does not have to be called by the user.
   */
  deactivate() {
    if (!this.editor) {
      throw new Error(`Deactivated a tool (${this.name}) which was not attached to any editor`)
    }
    if (this.#shouldDisableMenu) {
      this.editor.canvas.el.removeEventListener('contextmenu', this.#disableContextMenu)
    }
    this.active = false
    this.els.forEach(el => el.classList.remove('active-tool'))

    this.deactivated()
    this.setToolCursor()
  }

  /**
   * Called before the tool is activated. It can be used to save the state of the editor, to be restored later.
   * Can be overriden.
   */
  preActivation() {
    // allow tools to override
  }

  /**
   * Called when the tool is activated. Must be implemented by the tool.
   */
  activated() {
    throw new Error('Called abstract method "activated" of the Tool')
  }

  /**
   * Called when the tool is deactivated. Must be implemented by the tool, even if empty.
   */
  deactivated() {
    throw new Error('Called abstract method "deactivated" of the Tool')
  }

  setToolCursor() {
    let body = document.querySelector("body")
    
    const cursorClasses = [...body.classList].filter(cls => cls.endsWith("-cursor"))
    body.classList.remove(...cursorClasses)

    body.classList.add(this.cursorClass)
  }

    /**
   * Simply disables the context menu appearing when right-clicking on the main canvas.
   * @param {Event} e click event.
   * @returns false, to prevent the default context menu from appearing.
   */
    #disableContextMenu(e) {
      e.preventDefault()
      return false
    }
}

export class Undo extends Tool {
  constructor(elements) {
    super('Undo', 'regular-tools', elements, "Ctrl+Z")
    this.undo = this.undo.bind(this)
  }

  undo(e) {
    const undone = this.editor.executedCommands.pop()
    if (undone) {
      this.editor.undoneCommands.push(undone)
      this.editor.replayCommands()
    }
  }
  
  execute() {
    this.undo()
  }
}

export class Redo extends Tool {
  constructor(elements) {
    super('Redo', 'regular-tools', elements, "Ctrl+Y")
    this.redo = this.redo.bind(this)
  }

  redo(e) {
    const redone = this.editor.undoneCommands.pop()

    if (redone) {
      this.editor.executedCommands.push(redone)
      this.editor.replayCommands()
    }
  }

  execute() {
    this.redo()
  }
}

export class Pencil extends ActivatableTool {
  constructor(elements) {
    super('Pencil', 'regular-tools', elements, 'P', 'pencil-cursor')
    this.draw = this.draw.bind(this)
  }

  /**
   * Draws on the canvas when the mouse is pressed (mousedown) and moved (mousemove).
   * @param {Event} e mouse event (mousedown, mousemove, mouseup, mouseout). 
   */
  draw(e) {
    // consider only left/right mouse buttons
    if (e.button !== 0 && e.button !== 2) {
      return
    }

    switch (e.type) {
      case 'mousedown':
        // the mouse was pressed on the main canvas (hasn't been released yet)
        if (this.activelyDrawing) {
          return
        }
        // saves the current canvas state (to restore it in case of Ctrl+Z),
        // then creates a "pencil command" to define the color of the pixel being drawn
        this.savedCanvas = this.editor.canvas.save()
        this.command = this.commandBuilder(e)
        
        this.activelyDrawing = true
        break

      case 'mouseout':
      case 'mouseup':
        // when the button is realesead
        // effectively executes the command to paint the pixel on the canvas and register the command
        // as executed, so it can be undone/redone later, if requested by the user
        if (this.activelyDrawing) {
          this.editor.canvas.restore(this.savedCanvas)
          this.editor.executeCommand(this.command)
          this.editor.recordCommand(this.command)
  
          this.activelyDrawing = false
        }
        break

      case 'mousemove':
        // if the mouse is moving while the button is pressed, we keep logging the new position of the
        // mouse and defining the color of the pixel on the canvas
        // the command.iterate() method is called to temporarily draw the pixel on the canvas, even before
        // editor.executeCommand() is called, so the user gets an instant preview of the drawing
        if (this.activelyDrawing) {
          const position = this.editor.mousePosition

          this.command.logPosition(position)
          this.command.iterate(this.editor, position)
        }
        break
    }
  }

  commandBuilder(e) {
    // creates a command to paint the pixel with either the color of the primary or secondary color
    // this command will be executed when the mouse is released
    // it starts with only the initial mouse position (when the button was pressed), but it can
    // grow to include more positions as the mouse moves (by calling command.logPosition(newPosition)).
    const color = e.button == 0 ? this.editor.primaryColor.get() : this.editor.secondaryColor.get()
    return new PencilCommand(color, [this.editor.mousePosition])
  }

  activated() {
    ['mousedown', 'mousemove', 'mouseup', 'mouseout'].forEach(type =>
      this.editor.canvas.el.addEventListener(type, this.draw)
    )
  }

  deactivated() {
    ['mousedown', 'mousemove', 'mouseup', 'mouseout'].forEach(type =>
      this.editor.canvas.el.removeEventListener(type, this.draw)
    )
  }
}

export class Eraser extends Pencil {
  #eraserColor = '#000F'

  constructor(elements) {
    super(elements)
    this.name = 'Eraser'
    this.shortcut = 'E'
    this.cursorClass = 'eraser-cursor'
  }

  commandBuilder() {
    return new EraserCommand(this.#eraserColor, [this.editor.mousePosition])
  }
}

export class Bucket extends ActivatableTool {
  constructor(elements) {
    super('Bucket', 'regular-tools', elements, 'B', 'bucket-cursor')
    this.draw = this.draw.bind(this)
  }

  draw(e) {
    const color = e.button === 0 ? this.editor.primaryColor.get() : this.editor.secondaryColor.get()
    const command = new BucketCommand(color, this.editor.mousePosition)
    this.editor.executeCommand(command)
    this.editor.recordCommand(command)
  }

  activated() {
    this.editor.canvas.el.addEventListener('mouseup', this.draw)
  }

  deactivated() {
    this.editor.canvas.el.removeEventListener('mouseup', this.draw)
  }
}

class TwoPointPolygon extends ActivatableTool {
  constructor(elements) {
    super('Two Point Polygon', 'regular-tools', elements)
    this.draw = this.draw.bind(this)
  }

  draw(e) {
    // consider only left/right buttons
    if (e.button !== 0 && e.button !== 2) {
      return
    }

    switch (e.type) {
      case 'mousedown':
        if (this.activelyDrawing) {
          return
        }
        this.savedCanvas = this.editor.canvas.save()
        this.command = this.commandBuilder(e)
        this.activelyDrawing = true
        break

      case 'mousemove':
        if (this.activelyDrawing) {
          const position = this.editor.mousePosition
          this.editor.canvas.restore(this.savedCanvas)
          this.command.updatePosition(position)
          this.editor.executeCommand(this.command)
        }
        break
      case 'mouseup':
        if (this.activelyDrawing) {
          this.editor.canvas.restore(this.savedCanvas)
          this.editor.executeCommand(this.command)
          this.editor.recordCommand(this.command)

          this.activelyDrawing = false
        }
        break
    }
  }

  activated() {
    ['mousedown', 'mousemove', 'mouseup'].forEach(type =>
      this.editor.canvas.el.addEventListener(type, this.draw)
    )
  }

  deactivated() {
    ['mousedown', 'mousemove', 'mouseup'].forEach(type =>
      this.editor.canvas.el.removeEventListener(type, this.draw)
    )
  }
}

export class Line extends TwoPointPolygon {
  constructor(elements) {
    super(elements)
    this.name = 'Line'
    this.shortcut = 'L'
    this.cursorClass = 'line-cursor'
  }

  commandBuilder(e) {
    const primaryOrSecondary = e.button === 0 ? 'primary' : 'secondary'
    return new LineCommand(
      this.editor[primaryOrSecondary + 'Color'].get(),
      this.editor.mousePosition,
      this.editor.mousePosition
    )
  }
}

export class Rectangle extends TwoPointPolygon {
  constructor(elements) {
    super(elements)
    this.name = 'Rectangle'
    this.shortcut = 'R'
    this.cursorClass = 'rectangle-cursor'
  }

  commandBuilder(e) {
    const primaryOrSecondary = e.button === 0 ? 'primary' : 'secondary'
    return new RectangleCommand(
      this.editor[primaryOrSecondary + 'Color'].get(),
      this.editor.mousePosition,
      this.editor.mousePosition
    )
  }
}

export class Ellipse extends TwoPointPolygon {
  constructor(elements) {
    super(elements)
    this.name = 'Ellipse'
    this.shortcut = 'C'
    this.cursorClass = 'ellipse-cursor'
  }

  commandBuilder(e) {
    const primaryOrSecondary = e.button === 0 ? 'primary' : 'secondary'
    return new EllipseCommand(
      this.editor[primaryOrSecondary + 'Color'].get(),
      this.editor.mousePosition,
      this.editor.mousePosition
    )
  }
}

export class EyeDropper extends ActivatableTool {
  constructor(elements) {
    super('Eye Dropper', 'regular-tools', elements, 'D', 'eye-dropper-cursor')
    this.pickColor = this.pickColor.bind(this)
  }

  pickColor(e) {
    // consider only left/right buttons
    if (e.button !== 0 && e.button !== 2) {
      return
    }

    switch (e.type) {
      case 'mousedown':
        this.primaryOrSecondary = e.button === 0 ? 'primary' : 'secondary'
        this.savedColor = this.editor[this.primaryOrSecondary + 'Color'].get()
        this.picking = true
        // fallthrough to 'mousemove'

      case 'mousemove':
        if (this.picking) {
          const { x, y } = this.editor.mousePosition
          const [r, g, b, a] = this.editor.canvas.ctx.getImageData(x, y, 1, 1).data
          this.editor[this.primaryOrSecondary + 'Color'].set(`rgba(${r}, ${g}, ${b}, ${a})`)
        }
        break

      case 'mouseup':
        this.picking = false
        this.currentPixelColors = null
        if (this.savedTool) {
          this.savedTool.activate()
        }
        break

      case 'mouseout':
        if (this.picking) {
          this.picking = false
          this.editor[this.primaryOrSecondary + 'Color'].set(this.savedColor)
        }
    }
  }

  preActivation() {
    // saves the previous tool to reactivate it upon color selection
    this.savedTool = this.editor.getActiveTool()
  }

  activated() {
    ['mousedown', 'mousemove', 'mouseup', 'mouseout'].forEach(type =>
      this.editor.canvas.el.addEventListener(type, this.pickColor)
    )
  }

  deactivated() {
    ['mousedown', 'mousemove', 'mouseup', 'mouseout'].forEach(type =>
      this.editor.canvas.el.removeEventListener(type, this.pickColor)
    )
  }
}

export class ColorPicker extends Tool {
  constructor(name, elements, defaultColor) {
    super(name, 'color-picker', elements)
    this.inputs = Array.from(elements).map(el => el.querySelector('input[type="color"]')).filter(el => !!el)
    this.bindColor = this.bindColor.bind(this)

    const primaryOrSecondary = ['primary', 'secondary'].find(type => name.toLowerCase().includes(type))
    this.specialColorSlot = primaryOrSecondary // can also be undefined
    this.defaultColor = defaultColor
  }

  activated() {
    this.inputs.forEach(el => el.addEventListener('input', this.bindColor))
  }

  deactivated() {
    this.inputs.forEach(el => el.removeEventListener('input', this.bindColor))
  }

  attachToEditor(editor) {
    super.attachToEditor(editor)

    // binds the color swatches to the value of the editor prop
    // (so it updates when an outside tool (such as eye dropper)
    //  changes the primary/secondary color outside here)
    if (this.specialColorSlot) {
      this.editor[this.specialColorSlot + 'Color'].addListener((value) => {
        // sets the swatch bg color accordingly
        this.inputs.forEach(el => el.closest('.swatch').style.backgroundColor = value)
      })

    }

    this.activated()
    this.inputs[0].value = this.defaultColor
    this.inputs[0].dispatchEvent(new Event('input'));
    this.deactivated()
  }

  execute() {
    this.activated()
  }

  bindColor(e) {
    // gets the color selected by the user
    const chosenColor = e.currentTarget.value

    // tells the editor a primary or secondary color was selected
    if (this.specialColorSlot) {
      this.editor[this.specialColorSlot + 'Color'].set(chosenColor)
    }
  }
}


// class KeyboardTool {
//   #shortcut

//   constructor(shortcut) {
//     this.#shortcut = Array.isArray(shortcut) ? shortcut : shortcut.split(' ')
//   }

//   attachToEditor(editor) {
//     const doc = editor.containerEl.getRootNode()
//     doc.addEventListener('paste', this.handleKeyboardTool)
//   }

//   handleKeyboardTool(e) {
    
//   }
// }


/**
 * Tool that allows pasting images (Ctrl+V) from the clipboard into the main canvas.
 * TODO: add support for dragging images (from outside the page) into the canvas.
 */
export class CanvasPaster {
  constructor() {
    this.execute = this.execute.bind(this)
  }

  attachToEditor(editor) {
    this.editor = editor
    const doc = editor.containerEl.getRootNode()
    doc.addEventListener('paste', this.execute)
  }

  findImageInClipboard(e) {
    const items = e.clipboardData?.items

    if (!items?.length) {
      return
    }

    return new Promise((resolve, reject) => {
      for (let item of items) {
        if (item.type.includes('image')) {
          e.preventDefault()

          const blob = item.getAsFile()
          const imageAsUrl = window.URL.createObjectURL(blob)

          const pastedImage = new Image()
          pastedImage.addEventListener('load', () => {
            resolve(pastedImage)
          }, { once: true })
          pastedImage.src = imageAsUrl

          break
        }
      }
    })
  }

  async execute(e) {
    const image = await this.findImageInClipboard(e)

    // the clipboard might or might not have an image...
    // we only create a command if it's an image
    if (image) {
      e.preventDefault()
      const command = new PasteCommand(image)
      this.editor.executeCommand(command)
      this.editor.recordCommand(command)
    }
  }
}
