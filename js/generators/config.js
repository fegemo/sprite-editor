import { zipDistinct } from '../functional-util.js'

export const DOMAINS = {
  front: 'front',
  left: 'left',
  back: 'back',
  right: 'right',

  any: 'any',
  many: 'many'
}

const localOrRemoteModels = window.location.href.includes('github.io') ? 'remote' : 'local'
const modelUrlPrefix = localOrRemoteModels === 'remote' ? 'https://fegemo.github.io/' : ''

export const config = {
  /*-- pix2pix-based models --*/
  pix2pix: {
    name: 'pix2pix',
    version: 'all,230224',
    inputs: ['sourceImage'],
    comment: "Trained for 240k iterations on the Larger dataset, on Feb./2024 for the CollaGAN paper/dissertation proposal.",
    get checkpoints() {
      return Array.from(zipDistinct([DOMAINS.front, DOMAINS.right, DOMAINS.back, DOMAINS.left]))
        .map(([source, target]) => ({
          source,
          target,
          file: `${modelUrlPrefix}pixel-sides-models/${this.name}/${this.version}/${source}-to-${target}/model.json`
        })
        )
    },
    get endpoint() {
      return `/api/${this.name}/${this.version}/{source}/2/{target}`
    }
  },

  /*-- stargan-based models --*/
  "stargan-original": {
    name: 'stargan original',
    version: 'all,301222',
    inputs: ['sourceImage', 'targetDomain-channelized'],
    inputTransforms: [{
      concat:{
        inputs: ['sourceImage', 'targetDomain-channelized'],
        axis: -1
      },
    }],
    comment: "Trained with fewer iterations on the Larger dataset using capacity 1. The inputs required "  +
      "the target domain to be channelized beforehand. The generator topology is the same as in the original " +
      "StarGAN paper and it receives only the source image and the target domain. This made it good for regeneration.",
    get checkpoints() {
      return [{
          file: `${modelUrlPrefix}pixel-sides-models/stargan/${this.version}/model.json`,
          source: DOMAINS.any,
          target: DOMAINS.any
        }]
      },
    get endpoint() {
      return `/api/stargan/${this.version}/2/{target}`
    }
  },
  "stargan-4x": {
    name: 'stargan 4x capacity',
    version: 'all,200224,network-none',
    inputs: ['targetDomain', 'sourceImage'],
    comment: "Trained with more iterations on the Larger dataset using capacity 4. The inputs allow " +
      "the target domain to be passed as a number (0-3). The generator topology is the same " +
      "as in the original StarGAN paper and it receives only the source image and the target domain.",
    get checkpoints() {
      return [{
          file: `${modelUrlPrefix}pixel-sides-models/stargan/${this.version}/model.json`,
          source: DOMAINS.any,
          target: DOMAINS.any
        }]
      },
    get endpoint() {
      return `/api/stargan/${this.version}/2/{target}`
    }
  },
  stargan: {
    name: 'stargan 4x capacity + source domain',
    version: 'all,200224,network-generator',
    inputs: ['sourceDomain', 'targetDomain', 'sourceImage'],
    comment: "Trained with more iterations on the Larger dataset using capacity 4. The inputs allow " +
      "the target domain to be passed as a number (0-3). The generator topology involves receiving an " +
      "additional label with the source domain. This sort of made the model worse for regeneration. " +
      "This model was trained for the CollaGAN paper/dissertation proposal.",
    get checkpoints() {
      return [{
          file: `${modelUrlPrefix}pixel-sides-models/stargan/${this.version}/model.json`,
          source: DOMAINS.any,
          target: DOMAINS.any
        }]
      },
    get endpoint() {
      return `/api/stargan/${this.version}/2/{target}`
    }
  },

  /*-- collagan-based models --*/
  collagan: {
    name: 'collagan',
    version: 'all,280824,sbgames24',
    inputs: ['targetDomain', 'sourceImages'],
    comment: "Trained with 240k iterations on the Larger dataset using capacity 4. This model was trained " +
      "for the CollaGAN paper/dissertation proposal. It receives the source images as a (b, d, s, s, c) tensor " +
      "and the target domain as a (b, d) tensor).",
    checkpoints: [
      {
        get file() {
          return `${modelUrlPrefix}pixel-sides-models/${this.name}/${this.version}/model.json`
        },
        source: DOMAINS.many,
        target: DOMAINS.any
      }
    ],
    get endpoint() {
      return `/api/${this.name}/${this.version}/2/{target}`
    }
  }
}
