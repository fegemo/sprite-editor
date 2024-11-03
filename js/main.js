import { Pencil, Bucket, Eraser, Line, Rectangle, EyeDropper, ColorPicker, CanvasPaster } from './tools.js'
import { MultiCanvasPlugin } from './plugins/multi-canvas.js'
import { DomainTransferPlugin } from './plugins/domain-transfer.js'
import { Editor } from './editor.js'

// creates the editor, specifying the canvas element and the tools
const editor = new Editor(
  document.querySelector('#main-canvas-section'),   // container element for the editor on the page
  document.querySelector('#main-canvas'),           // the main canvas element
  [                                                 // list of tools available for the editor
    new Pencil(document.querySelectorAll('#pencil-tool')),
    new Bucket(document.querySelectorAll('#bucket-tool')),
    new Eraser(document.querySelectorAll('#eraser-tool')),
    new Line(document.querySelectorAll('#line-tool')),
    new Rectangle(document.querySelectorAll('#rectangle-tool')),
    new EyeDropper(document.querySelectorAll('#eye-dropper-tool')),
    new ColorPicker('Primary Color', document.querySelectorAll('#primary-color'), '#7890e8'),
    new ColorPicker('Secondary Color', document.querySelectorAll('#secondary-color'), '#ffffff'),
    new CanvasPaster()
  ],
  [64, 64]                                          // resolution of the canvas (width, height)
)


// after creating the editor, we register the following plugins: 
//  1. MultiCanvas, so we can have one canvas for each domain (e.g., front, right, back, left)
editor.registerPlugin(new MultiCanvasPlugin(
  ['front', 'right', 'back', 'left'],
  ['front', 'right', 'back', 'left'],
  document.querySelector('#colateral-section'),
  'multi-canvas.css'))

//  2. DomainTransfer, so we can access the generative models by dragging one canvas into another
//     to trigger generations among the domains.
//     We specify the model we want to use (e.g., 'stargan' -- options defined in config.js)
//     and the domains available. We also specify how many suggestions we want to show (e.g., 1).
editor.registerPlugin(new DomainTransferPlugin(
  'stargan',
  ['front', 'right', 'back', 'left'],
  document.querySelector('#colateral-section'),
  1,                                                // number of suggestions to show (i.e., 1 for now)
  'ai.css'))

// finally, we install the plugins
editor.installPlugins()
