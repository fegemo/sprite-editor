import Canvas from './canvas.js'
import { Observable } from './observable.js'

export class Editor extends EventTarget {
  #zoom
  #mousePosition
  #primaryColor = new Observable()
  #secondaryColor = new Observable()
  #canvasSize = new Observable()
  #executedCommands = []
  #undoneCommands = []
  #setupCommands = []
  plugins = {}

  constructor(containerEl, canvasEl, tools, canvasSize) {
    super()
    this.containerEl = containerEl
    this.#canvasSize.set(canvasSize)
    this.tools = tools
    this.canvas = new Canvas(canvasEl, this, this.#canvasSize)
    this.#setupCommands = []
    this.#executedCommands = []
    this.#undoneCommands = []

    tools.forEach(t => t.attachToEditor(this))
    this.mouseStatsElements = {
      containerEl: containerEl.querySelector('#mouse-stats'),
      xEl: containerEl.querySelector('#mouse-stats #x-mouse'),
      yEl: containerEl.querySelector('#mouse-stats #y-mouse'),
      zoomEl: containerEl.querySelector('#mouse-stats #zoom')
    }

    this.zoom = 1

    this.containerEl.ownerDocument.defaultView.addEventListener('keydown', this.keyboardMultiplexer.bind(this))
  }

  updateMouseStats(info) {
    if (info.x !== undefined) {
      this.mouseStatsElements.xEl.innerHTML = info.x
    }
    if (info.y !== undefined) {
      this.mouseStatsElements.yEl.innerHTML = info.y
    }
    if (info.zoom !== undefined) {
      this.mouseStatsElements.zoomEl.innerHTML = info.zoom
    }
  }

  async executeCommand(command) {
    await command.execute(this)
    const taintsMainCanvas = command.taintsCanvas
    if (taintsMainCanvas) {
      this.#notifyCanvasChange()
      this.updateColorPalette()
    }
  }

  recordCommand(command) {
    this.#executedCommands.push(command)
    this.#undoneCommands.length = 0
  }

  undo() {
    const undone = this.#executedCommands.pop()
    if (undone) {
      this.#undoneCommands.push(undone)
      this.replayCommands()
    }
  }

  redo() {
    const redone = this.#undoneCommands.pop()
    if (redone) {
      this.#executedCommands.push(redone)
      this.replayCommands()
    }
  }

  async replayCommands() {
    this.canvas.clear()
    for (let cmd of this.#setupCommands) {
      await this.executeCommand(cmd)
    }
    for (let cmd of this.#executedCommands) {
      await this.executeCommand(cmd)
    }
  }

  addSetupCommand(command) {
    this.#setupCommands.push(command)
  }

  #notifyCanvasChange() {
    this.dispatchEvent(
      new CustomEvent('canvaschange', { detail: { canvas: this.canvas } })
    )
  }

  keyboardMultiplexer(e) {
    // Ctrl+z
    if (e.type === 'keydown' && e.ctrlKey && e.key === 'z') {
      e.preventDefault()
      this.undo()
    }
    // Ctrl+y
    else if (e.type === 'keydown' && e.ctrlKey && e.key === 'y') {
      e.preventDefault()
      this.redo()
    }
  }

  getActiveTool(toolGroup) {
    let toolsToConsider = this.tools || []
    if (toolGroup) {
      toolsToConsider = toolsToConsider.filter(tool => tool.exclusionGroup === toolGroup)
    }
    return toolsToConsider.find(tool => tool.active)
  }

  registerPlugin(plugin) {
    const { name } = plugin
    this.plugins[name] = plugin
  }

  async installPlugins() {
    const pluginsInOrder = []

    // check for plugin dependencies, adding them to a list in a proper order to be installed
    for (let name of Object.keys(this.plugins)) {
      const plugin = this.plugins[name]
      let deps = plugin.dependencies
      if (deps && !Array.isArray(deps)) {
        deps = [deps]
      }

      for (let dependencyName of deps) {
        if (!(dependencyName in this.plugins)) {
          throw new Error(`Plugin ${plugin.name} required ${dependencyName}, but it was not registered before installation`)
        }
      }

      // inserts at the left, but it'll move to the right until all dependencies are to the left
      pluginsInOrder.unshift(plugin)
    }

    // preinstall hook - can do it as all dependencies have been satisfied
    for (let name of Object.keys(this.plugins)) {
      this.plugins[name].preInstall(this)
    }

    // puts plugins in correct order for the install hook
    for (let name of Object.keys(this.plugins)) {
      // move to the right until all dependencies are to the left
      const plugin = this.plugins[name]
      const index = pluginsInOrder.indexOf(plugin)
      let lastDependencyIndex = index
      for (let dependencyName of plugin.dependencies) {
        const dependencyIndex = pluginsInOrder.indexOf(this.plugins[dependencyName])
        lastDependencyIndex = Math.max(lastDependencyIndex, dependencyIndex)
      }

      pluginsInOrder.splice(index, 1)
      pluginsInOrder.splice(lastDependencyIndex, 0, plugin)
      // TODO: in case of cycles this fails... should do topological sorting
    }

    for (let plugin of pluginsInOrder) {
      await plugin.readyToInstall
      await plugin.install(this)
    }
  }

  updateColorPalette() {
    const ctx = this.canvas.ctx;
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    let colorPalette = document.querySelector("#swatch-list-section>div");

    colorPalette.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    })

    while(colorPalette.firstChild || false) {
      colorPalette.removeChild(colorPalette.firstChild);
    }

    const colors = new Set();

    for (let i = 0; i < imageData.data.length; i += 4) {

      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a > 0) {
        const rgb = `${r},${g},${b}`;
        colors.add(rgb);
      }
    }

    const uniqueColors = Array.from(colors);

    for(let color of uniqueColors) {
      let [r, g, b] = color.split(",")
      let colorPaletteItem = document.createElement("div")

      let span = document.createElement('span')
      span.classList.add("tooltip")
      let spanText = `rgb(${r}, ${g}, ${b})`
      span.textContent = spanText

      colorPaletteItem.appendChild(span)

      colorPaletteItem.classList.add("color-palette-item")
      colorPaletteItem.setAttribute("id", color)
      colorPaletteItem.style.backgroundColor = spanText
      colorPalette.appendChild(colorPaletteItem)
    }

    colorPalette.addEventListener("mousedown", (e) => this.updateColorPicker(e))
  }

    updateColorPicker(e) {
    const clickedItem = e.target
    const color = clickedItem.style.backgroundColor 
    if(clickedItem.classList.contains("color-palette-item")) {
      if(e.button === 0) {
        this.primaryColor.set(color)
      }
      else if (e.button === 2) {
        this.secondaryColor.set(color)
      }
    }
  }

  get canvasSize() {
    return this.#canvasSize
  }

  get zoom() {
    return this.#zoom
  }

  set zoom(value) {
    this.#zoom = value
    this.canvas.el.style.transform = `scale(${value})`
    this.updateMouseStats({ zoom: value.toFixed(2) })
  }

  get mousePosition() {
    return this.#mousePosition
  }

  set mousePosition(pos) {
    this.#mousePosition = pos
    this.updateMouseStats(pos)
  }

  get primaryColor() {
    return this.#primaryColor
  }

  set primaryColor(value) {
    this.#primaryColor.set(value)
  }

  get primaryColorAsInt() {
    return Editor.hexToRGB(this.#primaryColor.get())
  }

  get secondaryColor() {
    return this.#secondaryColor
  }

  set secondaryColor(value) {
    this.#secondaryColor.set(value)
  }

  get secondaryColorAsInt() {
    return Editor.hexToRGB(this.#secondaryColor.get())
  }

  get executedCommands() {
    return this.#executedCommands
  }

  set executedCommands(item) {
    this.#executedCommands.push(item)
  }

  get setupCommands() {
    return this.#setupCommands
  }

  get undoneCommands() {
    return this.#undoneCommands
  }

  set undoneCommands(item) {
    this.#undoneCommands.push(item)
  }

  static hexToRGB(hex) {
    hex = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
    return hex.substring(1).match(/.{2}/g)
      .map(x => parseInt(x, 16))
  }
}
