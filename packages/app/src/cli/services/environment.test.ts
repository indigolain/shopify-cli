import {
  fetchAppExtensionRegistrations,
  fetchAppFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  fetchStoreByDomain,
} from './dev/fetch.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {selectStore, convertToTestStoreIfNeeded} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './environment/identifiers.js'
import {
  DevEnvironmentOptions,
  ensureDevEnvironment,
  ensureDeployEnvironment,
  ensureThemeExtensionDevEnvironment,
  ensureGenerateEnvironment,
  DeployEnvironmentOptions,
} from './environment.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo, clearAppInfo, getAppInfo, setAppInfo} from './conf.js'
import {OrganizationApp, OrganizationStore} from '../models/organization.js'
import {updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {UIExtension} from '../models/app/extensions.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {testApp, testThemeExtensions} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {loadAppName} from '../models/app/loader.js'
import {App} from '../models/app/app.js'
import {AllOrganizationsQuerySchemaOrganization} from '../api/graphql/all_orgs.js'
import {beforeEach, describe, expect, it, test, vi} from 'vitest'
import {ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'

beforeEach(() => {
  vi.mock('./conf.js')
  vi.mock('./dev/fetch')
  vi.mock('./dev/create-extension')
  vi.mock('./dev/select-app')
  vi.mock('./dev/select-store')
  vi.mock('../prompts/dev')
  vi.mock('../models/app/app')
  vi.mock('../models/app/identifiers')
  vi.mock('./environment/identifiers')
  vi.mock('../models/app/loader.js')
  vi.mock('@shopify/cli-kit/node/session')
  vi.mock('@shopify/cli-kit/node/node-package-manager.js')
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
})

const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  organizationId: '1',
  apiSecretKeys: [{secret: 'secret1'}],
  grantedScopes: [],
}
const APP2: OrganizationApp = {
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  organizationId: '1',
  apiSecretKeys: [{secret: 'secret2'}],
  grantedScopes: [],
}

const ORG1: AllOrganizationsQuerySchemaOrganization = {
  id: '1',
  businessName: 'org1',
  appsNext: true,
  website: '',
}
const ORG2: AllOrganizationsQuerySchemaOrganization = {
  id: '2',
  businessName: 'org2',
  appsNext: false,
  website: '',
}

const CACHED1: CachedAppInfo = {appId: 'key1', orgId: '1', storeFqdn: 'domain1', directory: '/cached'}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: true,
  convertableToPartnerTest: true,
}
const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

const EXTENSION_A: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_ID',
  localIdentifier: 'EXTENSION_A',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {block_progress: false, network_access: false, api_access: false},
  },
  entrySourceFilePath: '',
  outputBundlePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: () => true,
}

const INPUT: DevEnvironmentOptions = {
  directory: 'app_directory',
  reset: false,
}

const INPUT_WITH_DATA: DevEnvironmentOptions = {
  directory: 'app_directory',
  reset: false,
  apiKey: 'key1',
  storeFqdn: 'domain1',
}

const BAD_INPUT_WITH_DATA: DevEnvironmentOptions = {
  directory: 'app_directory',
  reset: false,
  apiKey: 'key1',
  storeFqdn: 'invalid_store_domain',
}

const FETCH_RESPONSE = {
  organization: ORG1,
  apps: {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
  stores: [STORE1, STORE2],
}

const options = (app: App): DeployEnvironmentOptions => {
  return {
    app,
    reset: false,
    force: false,
  }
}

beforeEach(async () => {
  vi.mocked(getAppIdentifiers).mockResolvedValue({app: undefined})
  vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
  vi.mocked(selectOrCreateApp).mockResolvedValue(APP1)
  vi.mocked(selectStore).mockResolvedValue(STORE1)
  vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])
  vi.mocked(fetchOrgFromId).mockResolvedValueOnce(ORG1)
  vi.mocked(fetchOrgAndApps).mockResolvedValue(FETCH_RESPONSE)
  vi.mocked(getPackageManager).mockResolvedValue('npm')
})

describe('ensureGenerateEnvironment', () => {
  it('returns the provided app apiKey if valid, without cached state', async () => {
    // Given
    const input = {apiKey: 'key2', directory: '/app', reset: false, token: 'token'}
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)

    // When
    const got = await ensureGenerateEnvironment(input)

    // Then
    expect(got).toEqual(APP2.apiKey)
  })
  it('returns the cached api key', async () => {
    // Given
    const input = {directory: '/app', reset: false, token: 'token'}
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(getAppInfo).mockReturnValue(CACHED1)

    // When
    const got = await ensureGenerateEnvironment(input)

    // Then
    expect(got).toEqual(APP2.apiKey)
  })
  it('selects a new app and returns the api key', async () => {
    // Given
    const input = {directory: '/app', reset: true, token: 'token'}
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(loadAppName).mockResolvedValueOnce('my-app')
    vi.mocked(getAppInfo).mockReturnValue(undefined)

    // When
    const got = await ensureGenerateEnvironment(input)

    // Then
    expect(got).toEqual(APP1.apiKey)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      'my-app',
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      'token',
    )
    expect(setAppInfo).toHaveBeenCalledWith({
      appId: APP1.apiKey,
      title: APP1.title,
      directory: '/app',
      orgId: ORG1.id,
    })
  })
})

describe('ensureDevEnvironment', () => {
  it('returns selected data and updates internal state, without cached state', async () => {
    // Given
    vi.mocked(getAppInfo).mockReturnValue(undefined)

    // When
    const got = await ensureDevEnvironment(INPUT, 'token')

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      tunnelPlugin: undefined,
      updateURLs: undefined,
    })
    expect(setAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      directory: INPUT.directory,
      orgId: ORG1.id,
    })
    expect(setAppInfo).toHaveBeenNthCalledWith(2, {
      appId: APP1.apiKey,
      directory: INPUT.directory,
      storeFqdn: STORE1.shopDomain,
    })

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      api_key: APP1.apiKey,
      partner_id: 1,
    })
  })

  it('returns selected data and updates internal state, with cached state', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(getAppInfo).mockReturnValue(CACHED1)
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP1)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const got = await ensureDevEnvironment(INPUT, 'token')

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      tunnelPlugin: undefined,
      updateURLs: undefined,
    })
    expect(fetchOrganizations).not.toBeCalled()
    expect(selectOrganizationPrompt).not.toBeCalled()
    expect(setAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      directory: INPUT.directory,
      orgId: ORG1.id,
    })
    expect(setAppInfo).toHaveBeenNthCalledWith(2, {
      appId: APP1.apiKey,
      directory: INPUT.directory,
      storeFqdn: STORE1.shopDomain,
    })
    expect(outputMock.output()).toMatch(/Using your previous dev settings:/)
    expect(fetchOrgAndApps).not.toBeCalled()
  })

  it('returns selected data and updates internal state, with inputs from flags', async () => {
    // Given
    vi.mocked(getAppInfo).mockReturnValue(undefined)
    vi.mocked(convertToTestStoreIfNeeded).mockResolvedValueOnce()
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const got = await ensureDevEnvironment(INPUT_WITH_DATA, 'token')

    // Then
    expect(got).toEqual({
      remoteApp: {...APP2, apiSecret: 'secret2'},
      storeFqdn: STORE1.shopDomain,
      tunnelPlugin: undefined,
      updateURLs: undefined,
    })
    expect(setAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP2.apiKey,
      directory: INPUT_WITH_DATA.directory,
      storeFqdn: STORE1.shopDomain,
      orgId: ORG1.id,
    })
    expect(fetchOrganizations).toBeCalled()
    expect(selectOrganizationPrompt).toBeCalled()
    expect(selectOrCreateApp).not.toBeCalled()
    expect(selectStore).not.toBeCalled()
    expect(fetchOrgAndApps).not.toBeCalled()
  })

  it('throws if the store input is not valid', async () => {
    // Given
    vi.mocked(getAppInfo).mockReturnValue(undefined)
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: undefined})

    // When
    const got = ensureDevEnvironment(BAD_INPUT_WITH_DATA, 'token')

    await expect(got).rejects.toThrow(/Could not find invalid_store_domain/)
  })

  it('resets cached state if reset is true', async () => {
    // When
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    await ensureDevEnvironment({...INPUT, reset: true}, 'token')

    // Then
    expect(clearAppInfo).toHaveBeenCalledWith(BAD_INPUT_WITH_DATA.directory)
    expect(fetchOrgAndApps).toBeCalled()
  })
})

describe('ensureDeployEnvironment', () => {
  test("fetches the app from the partners' API and returns it alongside the id when identifiers are available locally and the app has no extensions", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
    }
    vi.mocked(getAppIdentifiers).mockResolvedValue({app: APP2.apiKey})
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)

    // When
    const got = await ensureDeployEnvironment({app, reset: false, force: false})

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)

    expect(metadata.getAllPublicMetadata()).toMatchObject({api_key: APP2.apiKey, partner_id: 1})
  })

  test("fetches the app from the partners' API and returns it alongside the id when there are no identifiers but user chooses to reuse dev store.cliKitStore()", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
    }
    vi.mocked(getAppIdentifiers).mockResolvedValue({app: undefined})
    vi.mocked(getAppInfo).mockReturnValueOnce(CACHED1)
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(reuseDevConfigPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureDeployEnvironment(options(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(reuseDevConfigPrompt).toHaveBeenCalled()
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)
  })

  test('prompts the user to create or select an app and returns it with its id when the app has no extensions', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
    }
    vi.mocked(getAppIdentifiers).mockResolvedValue({app: undefined})
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    // When
    const got = await ensureDeployEnvironment(options(app))

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith('token')
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      'token',
    )
    expect(updateAppIdentifiers).toBeCalledWith({
      app,
      identifiers,
      command: 'deploy',
    })
    expect(got.partnersApp.id).toEqual(APP1.id)
    expect(got.partnersApp.title).toEqual(APP1.title)
    expect(got.partnersApp.appType).toEqual(APP1.appType)
    expect(got.identifiers).toEqual({app: APP1.apiKey, extensions: {}, extensionIds: {}})
  })

  test("throws an app not found error if the app with the API key doesn't exist", async () => {
    // Given
    const app = testApp()
    vi.mocked(getAppIdentifiers).mockResolvedValue({app: APP1.apiKey})
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(undefined)

    // When
    await expect(ensureDeployEnvironment(options(app))).rejects.toThrow(/Couldn't find the app with API key key1/)
  })

  test('prompts the user to create or select an app if reset is true', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
    }

    // There is a cached app but it will be ignored
    vi.mocked(getAppIdentifiers).mockResolvedValue({app: APP2.apiKey})
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)

    const opts = options(app)
    opts.reset = true

    // When
    const got = await ensureDeployEnvironment(opts)

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith('token')
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      'token',
    )
    expect(updateAppIdentifiers).toBeCalledWith({
      app,
      identifiers,
      command: 'deploy',
    })
    expect(got.partnersApp.id).toEqual(APP1.id)
    expect(got.partnersApp.title).toEqual(APP1.title)
    expect(got.partnersApp.appType).toEqual(APP1.appType)
    expect(got.identifiers).toEqual({app: APP1.apiKey, extensions: {}, extensionIds: {}})
  })
})

describe('ensureThemeExtensionDevEnvironment', () => {
  test('fetches theme extension when it exists', async () => {
    // Given
    const token = 'token'
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
      app: {
        extensionRegistrations: [
          {
            id: 'other ID',
            uuid: 'other UUID',
            title: 'other extension',
            type: 'other',
          },
          {
            id: 'existing ID',
            uuid: 'UUID',
            title: 'theme app extension',
            type: 'THEME_APP_EXTENSION',
          },
        ],
        functions: [],
      },
    })

    // When
    const got = await ensureThemeExtensionDevEnvironment(extension, apiKey, token)

    // Then
    expect('existing ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
  })

  test('creates theme extension when it does not exist', async () => {
    // Given
    const token = 'token'
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
      app: {extensionRegistrations: [], functions: []},
    })
    vi.mocked(createExtension).mockResolvedValue({
      id: 'new ID',
      uuid: 'UUID',
      title: 'theme app extension',
      type: 'THEME_APP_EXTENSION',
    })

    // When
    const got = await ensureThemeExtensionDevEnvironment(extension, apiKey, token)

    // Then
    expect('new ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
  })
})
