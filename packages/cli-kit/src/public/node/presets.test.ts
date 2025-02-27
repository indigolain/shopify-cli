import * as presets from './presets.js'
import {presetsFilename} from './presets.js'
import {encodeToml as tomlEncode} from './toml.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

const preset1 = {
  flag1: 'value',
  flag2: true,
  flag3: 0,
  flag4: ['hello', 'world'],
}
const preset2 = {
  flag1: 'value2',
  flag2: false,
  flag3: 1,
  flag4: ['goodbye', 'world'],
}

describe('loading presets', async () => {
  test('returns an empty object when no presets file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      const loaded = await presets.loadPresetsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('returns an empty object when an empty presets file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(joinPath(tmpDir, presetsFilename), '# no content')

      // When
      const loaded = await presets.loadPresetsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('returns available presets when they exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(joinPath(tmpDir, 'shopify.presets.toml'), tomlEncode({preset1, preset2}))

      // When
      const loaded = await presets.loadPresetsFromDirectory(tmpDir)

      // Then
      expect(loaded).toEqual({preset1, preset2})
    })
  })

  test('does not search upwards for presets when no file exists and searching up is disabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(`${tmpDir}/shopify.presets.toml`, tomlEncode({preset1}))
      const subdir = joinPath(tmpDir, 'subdir')
      await mkdir(subdir)

      // When
      const loaded = await presets.loadPresetsFromDirectory(subdir)

      // Then
      expect(loaded).toEqual({})
    })
  })

  test('searches upwards for presets when no file exists and searching up is enabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(`${tmpDir}/shopify.presets.toml`, tomlEncode({preset1}))
      const subdir = joinPath(tmpDir, 'subdir')
      await mkdir(subdir)

      // When
      const loaded = await presets.loadPresetsFromDirectory(subdir, {findUp: true})

      // Then
      expect(loaded).toEqual({preset1})
    })
  })
})
