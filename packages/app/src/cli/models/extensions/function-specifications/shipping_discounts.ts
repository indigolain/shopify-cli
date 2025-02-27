import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'shipping_discounts',
  externalIdentifier: 'shipping_discount',
  externalName: 'Function - Shipping discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  templatePath: (lang) => `discounts/${lang}/shipping-discounts/default`,
})

export default spec
