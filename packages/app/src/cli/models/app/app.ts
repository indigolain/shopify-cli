import {Extension, FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {AppErrors} from './loader.js'
import {schema} from '@shopify/cli-kit/node/schema'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {getDependencies, PackageManager, readAndParsePackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {fileRealPath, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'

export const AppConfigurationSchema = schema.object({
  scopes: schema.string().default(''),
  extensionDirectories: schema.array(schema.string()).optional(),
  webDirectories: schema.array(schema.string()).optional(),
})

export enum WebType {
  Frontend = 'frontend',
  Backend = 'backend',
}

const WebConfigurationAuthCallbackPathSchema = schema.preprocess(
  (arg) => (typeof arg === 'string' && !arg.startsWith('/') ? `/${arg}` : arg),
  schema.string(),
)

export const WebConfigurationSchema = schema.object({
  type: schema.enum([WebType.Frontend, WebType.Backend]),
  authCallbackPath: schema
    .union([WebConfigurationAuthCallbackPathSchema, WebConfigurationAuthCallbackPathSchema.array()])
    .optional(),
  commands: schema.object({
    build: schema.string().optional(),
    dev: schema.string(),
  }),
})

export type AppConfiguration = schema.infer<typeof AppConfigurationSchema>
export type WebConfiguration = schema.infer<typeof WebConfigurationSchema>
export type WebConfigurationCommands = keyof WebConfiguration['commands']

export interface Web {
  directory: string
  configuration: WebConfiguration
  framework?: string
}

export interface AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }
  errors?: AppErrors
  hasExtensions: () => boolean
  hasUIExtensions: () => boolean
  updateDependencies: () => Promise<void>
  extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => Extension[]
}

export class App implements AppInterface {
  name: string
  idEnvironmentVariableName: string
  directory: string
  packageManager: PackageManager
  configuration: AppConfiguration
  configurationPath: string
  nodeDependencies: {[key: string]: string}
  webs: Web[]
  usesWorkspaces: boolean
  dotenv?: DotEnvFile
  errors?: AppErrors
  extensions: {
    ui: UIExtension[]
    theme: ThemeExtension[]
    function: FunctionExtension[]
  }

  // eslint-disable-next-line max-params
  constructor(
    name: string,
    idEnvironmentVariableName: string,
    directory: string,
    packageManager: PackageManager,
    configuration: AppConfiguration,
    configurationPath: string,
    nodeDependencies: {[key: string]: string},
    webs: Web[],
    ui: UIExtension[],
    theme: ThemeExtension[],
    functions: FunctionExtension[],
    usesWorkspaces: boolean,
    dotenv?: DotEnvFile,
    errors?: AppErrors,
  ) {
    this.name = name
    this.idEnvironmentVariableName = idEnvironmentVariableName
    this.directory = directory
    this.packageManager = packageManager
    this.configuration = configuration
    this.configurationPath = configurationPath
    this.nodeDependencies = nodeDependencies
    this.webs = webs
    this.dotenv = dotenv
    this.extensions = {
      ui,
      theme,
      function: functions,
    }
    this.errors = errors
    this.usesWorkspaces = usesWorkspaces
  }

  async updateDependencies() {
    const nodeDependencies = await getDependencies(joinPath(this.directory, 'package.json'))
    this.nodeDependencies = nodeDependencies
  }

  hasExtensions(): boolean {
    return (
      this.extensions.ui.length !== 0 || this.extensions.function.length !== 0 || this.extensions.theme.length !== 0
    )
  }

  hasUIExtensions(): boolean {
    return this.extensions.ui.length > 0
  }

  extensionsForType(specification: {identifier: string; externalIdentifier: string}): Extension[] {
    const allExternsions = [...this.extensions.ui, ...this.extensions.function, ...this.extensions.theme]
    return allExternsions.filter(
      (extension) => extension.type === specification.identifier || extension.type === specification.externalIdentifier,
    )
  }
}

type RendererVersionResult = {name: string; version: string} | undefined | 'not_found'

/**
 * Given a UI extension and the app it belongs to, it returns the version of the renderer package.
 * Looks for `/node_modules/@shopify/{renderer-package-name}/package.json` to find the real version used.
 * @param uiExtensionType - UI extension whose renderer version will be obtained.
 * @param app - App object containing the extension.
 * @returns The version if the dependency exists.
 */
export async function getUIExtensionRendererVersion(
  extension: UIExtension,
  app: AppInterface,
): Promise<RendererVersionResult> {
  // Look for the vanilla JS version of the dependency (the react one depends on it, will always be present)
  const rendererDependency = extension.dependency
  if (!rendererDependency) return undefined
  return getDependencyVersion(rendererDependency.name, app.directory)
}

export async function getDependencyVersion(dependency: string, directory: string): Promise<RendererVersionResult> {
  const isReact = dependency.includes('-react')
  let cwd = directory
  /**
   * PNPM creates a symlink to a global cache where dependencies are hoisted. Therefore
   * we need to first look up the *-react package and use that as a working directory from
   * where to look up the non-react package.
   */
  if (isReact) {
    const dependencyName = dependency.split('/')
    const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')
    const reactPackageJsonPath = await findPathUp(pattern, {
      type: 'file',
      cwd: directory,
      allowSymlinks: true,
    })
    if (!reactPackageJsonPath) {
      return 'not_found'
    }
    cwd = await fileRealPath(dirname(reactPackageJsonPath))
  }

  // Split the dependency name to avoid using "/" in windows
  const dependencyName = dependency.replace('-react', '').split('/')
  const pattern = joinPath('node_modules', dependencyName[0]!, dependencyName[1]!, 'package.json')

  let packagePath = await findPathUp(pattern, {
    cwd,
    type: 'file',
    allowSymlinks: true,
  })
  if (!packagePath) return 'not_found'
  packagePath = await fileRealPath(packagePath)

  // Load the package.json and extract the version
  const packageContent = await readAndParsePackageJson(packagePath)
  if (!packageContent.version) return 'not_found'
  return {name: dependency, version: packageContent.version}
}
