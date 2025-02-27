import {createUIExtensionSpecification} from '../ui.js'
import {defualtExtensionFlavors} from '../../../constants.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {schema} from '@shopify/cli-kit/node/schema'
import {AbortError} from '@shopify/cli-kit/node/error'

const dependency = {name: '@shopify/web-pixels-extension', version: '^0.1.1'}

const WebPixelSchema = BaseUIExtensionSchema.extend({
  runtimeContext: schema.string(),
  version: schema.string().optional(),
  configuration: schema.any(),
  settings: schema.any(),
})

const spec = createUIExtensionSpecification({
  identifier: 'web_pixel_extension',
  externalIdentifier: 'web_pixel',
  externalName: 'Web pixel',
  surface: 'unknown',
  dependency,
  partnersWebIdentifier: 'web_pixel',
  supportedFlavors: defualtExtensionFlavors.filter((flavor) => !flavor.value.includes('react')),
  schema: WebPixelSchema,
  deployConfig: async (config, _) => {
    return {
      runtime_context: config.runtimeContext,
      runtime_configuration_definition: config.settings,
    }
  },
  preDeployValidation: (config) => {
    if (config.configuration) {
      throw new AbortError(
        `The property configuration is deprecated and no longer supported.`,
        `It has been replaced by settings.`,
      )
    }
    return Promise.resolve()
  },
  previewMessage: () => undefined,
})

export default spec
