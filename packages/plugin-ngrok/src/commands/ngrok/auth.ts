import {authenticate} from '../../tunnel.js'
import {Command} from '@oclif/core'
import {outputSuccess} from '@shopify/cli-kit/node/output'

export default class NgrokAuth extends Command {
  static description =
    'Saves a token to authenticate against ngrok. Visit https://dashboard.ngrok.com/signup to create an account.'

  static args = [{name: 'token'}]

  async run() {
    const {args} = await this.parse(NgrokAuth)
    await authenticate(args.token)
    outputSuccess('Auth token saved')
  }
}
