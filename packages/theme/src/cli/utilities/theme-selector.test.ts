import {fetchStoreThemes} from './theme-selector/fetch.js'
import {findOrSelectTheme, findThemes} from './theme-selector.js'
import {Theme} from '../models/theme.js'
import {test, describe, vi, expect} from 'vitest'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('./theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const storeThemes = [
  theme(1, 'unpublished'),
  theme(2, 'unpublished'),
  theme(3, 'live'),
  theme(4, 'unpublished'),
  theme(5, 'unpublished'),
  theme(6, 'unpublished'),
  theme(7, 'development'),
  theme(8, 'development'),
]

describe('findOrSelectTheme', () => {
  test('returns selected theme when no filter is specified', async () => {
    // Given
    const selectedTheme = storeThemes[0]
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)
    vi.mocked(renderSelectPrompt).mockResolvedValue(selectedTheme)

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {},
    })

    // Then
    expect(theme).toBe(selectedTheme)
  })

  test('returns selected theme when filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {theme: 'theme 2'},
    })

    // Then
    expect(theme).toBe(storeThemes[1])
  })
})

describe('findThemes', () => {
  test('returns selected theme when no filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const themes = await findThemes(session, {})

    // Then
    expect(themes).toHaveLength(0)
  })

  test('returns selected themes when filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const themes = await findThemes(session, {
      themes: ['theme 2', 'theme 3', 'theme 5'],
    })

    // Then
    expect(themes).toHaveLength(3)
    expect(themes[0]!.name).toEqual('theme 2')
    expect(themes[1]!.name).toEqual('theme 3')
    expect(themes[2]!.name).toEqual('theme 5')
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
