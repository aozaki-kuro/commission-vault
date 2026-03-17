import type {
  AdminCrudBackend,
  CharacterOrderPayload,
  CreateCharacterInput,
  CreateCommissionInput,
  UpdateCharacterInput,
  UpdateCommissionInput,
} from './adminApi'
import { describe, expect, it, vi } from 'vitest'
import {
  handleAdminApiRequest,
} from './adminApi'

const baseUrl = 'http://127.0.0.1:8787'

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createCrudBackend(overrides: Partial<AdminCrudBackend> = {}): AdminCrudBackend {
  return {
    getCharacterCommissions: vi.fn(async () => createJsonResponse({ commissions: [] })),
    createCharacter: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    updateCharacter: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    updateCharacterOrder: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    deleteCharacter: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    createCommission: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    updateCommission: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    deleteCommission: vi.fn(async () => createJsonResponse({ status: 'success', message: 'ok' })),
    ...overrides,
  }
}

interface StatementExecution {
  query: string
  values: unknown[]
}

function createD1Recorder() {
  const executions: StatementExecution[] = []

  function createStatement(query: string, values: unknown[] = []) {
    return {
      bind(...nextValues: unknown[]) {
        return createStatement(query, nextValues)
      },
      async all() {
        executions.push({ query, values })
        return { results: [] }
      },
      async run() {
        executions.push({ query, values })
        return { success: true }
      },
    }
  }

  return {
    db: {
      prepare(query: string) {
        return createStatement(query)
      },
    },
    executions,
  }
}

function createAdminReadD1Database() {
  const characters = [
    { id: 1, name: 'Alice', status: 'active', sortOrder: 1, commissionCount: 1 },
    { id: 2, name: 'Beta', status: 'stale', sortOrder: 2, commissionCount: 1 },
  ]
  const commissions = [
    {
      id: 10,
      characterId: 1,
      characterName: 'Alice',
      fileName: '20250301_alice-maker',
      links: JSON.stringify(['https://alice.example/a', 'https://alice.example/b']),
      design: 'maid outfit',
      description: 'soft lighting',
      keyword: 'maid, cafe',
      hidden: 0,
    },
    {
      id: 11,
      characterId: 2,
      characterName: 'Beta',
      fileName: '20240105_beta-maker',
      links: JSON.stringify(['https://beta.example/1']),
      design: 'armor',
      description: 'battle scene',
      keyword: 'armor',
      hidden: 1,
    },
  ]

  function queryResults(query: string, values: unknown[]) {
    if (query.includes('sqlite_master')) {
      const tableName = String(values[1] ?? '')
      return tableName
        ? [{ name: tableName }]
        : []
    }

    if (query.includes('PRAGMA table_info(commissions)')) {
      return [{ name: 'id' }, { name: 'keyword' }]
    }

    if (query.includes('COUNT(commissions.id) as commissionCount') && query.includes('characters.status as status')) {
      return characters
    }

    if (query.includes('COUNT(commissions.id) as commissionCount') && query.includes('characters.name as characterName')) {
      return characters.map(item => ({
        characterName: item.name,
        commissionCount: item.commissionCount,
      }))
    }

    if (query.includes('SELECT file_name as fileName FROM commissions')) {
      return commissions.map(item => ({ fileName: item.fileName }))
    }

    if (query.includes('FROM creator_aliases') && query.includes('ORDER BY creator_name ASC')) {
      return [{ creatorName: 'maker', aliasesJson: JSON.stringify(['mk']) }]
    }

    if (query.includes('FROM creator_aliases') && !query.includes('ORDER BY creator_name ASC')) {
      return [{ creatorName: 'maker', aliasesJson: JSON.stringify(['mk']) }]
    }

    if (query.includes('FROM character_aliases')) {
      return [
        { characterName: 'Alice', aliasesJson: JSON.stringify(['Alicia']) },
        { characterName: 'Beta', aliasesJson: JSON.stringify(['B']) },
      ]
    }

    if (query.includes('FROM keyword_aliases')) {
      return [{ baseKeyword: 'maid', aliasesJson: JSON.stringify(['uniform']) }]
    }

    if (query.includes('SELECT keyword FROM commissions')) {
      return commissions.map(item => ({ keyword: item.keyword }))
    }

    if (
      query.includes('commissions.id as id')
      && query.includes('ORDER BY characters.sort_order ASC, commissions.file_name DESC')
    ) {
      return commissions.map(item => ({
        id: item.id,
        characterId: item.characterId,
        characterName: item.characterName,
        fileName: item.fileName,
        design: item.design,
        description: item.description,
        keyword: item.keyword,
      }))
    }

    if (query.includes('FROM home_featured_search_keywords')) {
      return [{ keyword: 'maid' }, { keyword: 'maker' }]
    }

    if (
      query.includes('commissions.file_name as fileName')
      && query.includes('JOIN characters ON characters.id = commissions.character_id')
      && !query.includes('commissions.id as id')
    ) {
      return commissions.map(item => ({
        characterName: item.characterName,
        fileName: item.fileName,
        design: item.design,
        description: item.description,
        keyword: item.keyword,
      }))
    }

    if (query.includes('WHERE commissions.character_id = ?')) {
      const characterId = Number(values[0])
      return commissions
        .filter(item => item.characterId === characterId)
        .map(item => ({
          id: item.id,
          characterId: item.characterId,
          characterName: item.characterName,
          fileName: item.fileName,
          links: item.links,
          design: item.design,
          description: item.description,
          keyword: item.keyword,
          hidden: item.hidden,
        }))
    }

    return []
  }

  function createStatement(query: string, values: unknown[] = []) {
    return {
      bind(...nextValues: unknown[]) {
        return createStatement(query, nextValues)
      },
      async all<TRow>() {
        return {
          results: queryResults(query, values) as TRow[],
        }
      },
      async run() {
        return { success: true }
      },
    }
  }

  return {
    db: {
      prepare(query: string) {
        return createStatement(query)
      },
    },
  }
}

describe('admin worker CRUD contract routing', () => {
  it('normalizes create-character payload before delegating to backend', async () => {
    const createCharacter = vi.fn(async (_input: CreateCharacterInput) =>
      createJsonResponse({ status: 'success', message: 'Character "Alice" created.' }))
    const backend = createCrudBackend({ createCharacter })

    const request = new Request(`${baseUrl}/api/admin/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '  Alice  ',
        status: 'stale',
      }),
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Character "Alice" created.',
    })
    expect(createCharacter).toHaveBeenCalledWith({
      name: 'Alice',
      status: 'stale',
    })
  })

  it('rejects empty character names before hitting backend', async () => {
    const createCharacter = vi.fn(async (_input: CreateCharacterInput) =>
      createJsonResponse({ status: 'success', message: 'unexpected' }))
    const backend = createCrudBackend({ createCharacter })

    const request = new Request(`${baseUrl}/api/admin/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '   ',
      }),
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Character name is required.',
    })
    expect(createCharacter).not.toHaveBeenCalled()
  })

  it('passes normalized character ordering arrays to backend', async () => {
    const updateCharacterOrder = vi.fn(async (_payload: CharacterOrderPayload) =>
      createJsonResponse({ status: 'success', message: 'Character order updated.' }))
    const backend = createCrudBackend({ updateCharacterOrder })

    const request = new Request(`${baseUrl}/api/admin/characters/order`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        active: ['1', 2],
        stale: ['3'],
      }),
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Character order updated.',
    })
    expect(updateCharacterOrder).toHaveBeenCalledWith({
      active: [1, 2],
      stale: [3],
    })
  })

  it('normalizes create-commission form data before delegating to backend', async () => {
    const createCommission = vi.fn(async (_input: CreateCommissionInput) =>
      createJsonResponse({ status: 'success', message: 'Commission saved.' }))
    const backend = createCrudBackend({ createCommission })

    const formData = new FormData()
    formData.set('characterId', '7')
    formData.set('fileName', '  sample-piece  ')
    formData.set('links', ' https://a.example \n\nhttps://b.example ')
    formData.set('design', '  outfit  ')
    formData.set('description', '  desc  ')
    formData.set('keyword', '  tag  ')
    formData.set('hidden', 'on')
    formData.set('sourceImage', new File(['png'], 'sample.png', { type: 'image/png' }))

    const request = new Request(`${baseUrl}/api/admin/commissions`, {
      method: 'POST',
      body: formData,
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Commission saved.',
    })

    expect(createCommission).toHaveBeenCalledTimes(1)
    const [payload] = createCommission.mock.calls[0] as [CreateCommissionInput]
    expect(payload).toMatchObject({
      characterId: 7,
      fileName: 'sample-piece',
      links: ['https://a.example', 'https://b.example'],
      design: 'outfit',
      description: 'desc',
      keyword: 'tag',
      hidden: true,
    })
    expect(payload.sourceImage).toBeInstanceOf(File)
    expect(payload.sourceImage.name).toBe('sample.png')
  })

  it('rejects missing source image for create-commission before delegating to backend', async () => {
    const createCommission = vi.fn(async (_input: CreateCommissionInput) =>
      createJsonResponse({ status: 'success', message: 'unexpected' }))
    const backend = createCrudBackend({ createCommission })

    const formData = new FormData()
    formData.set('characterId', '7')
    formData.set('fileName', 'sample-piece')

    const request = new Request(`${baseUrl}/api/admin/commissions`, {
      method: 'POST',
      body: formData,
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Source image is required for new commission entries.',
    })
    expect(createCommission).not.toHaveBeenCalled()
  })

  it('normalizes update-commission payload before delegating to backend', async () => {
    const updateCommission = vi.fn(async (_input: UpdateCommissionInput) =>
      createJsonResponse({ status: 'success', message: 'Commission updated.' }))
    const backend = createCrudBackend({ updateCommission })

    const request = new Request(`${baseUrl}/api/admin/commissions/19`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        characterId: '3',
        fileName: '  updated-piece  ',
        links: ' one \n two ',
        design: '  new design  ',
        description: '',
        keyword: '  glow  ',
        hidden: true,
      }),
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Commission updated.',
    })
    expect(updateCommission).toHaveBeenCalledWith({
      id: 19,
      characterId: 3,
      fileName: 'updated-piece',
      links: ['one', 'two'],
      design: 'new design',
      description: undefined,
      keyword: 'glow',
      hidden: true,
    })
  })

  it('returns a 404 payload for unknown admin routes', async () => {
    const backend = createCrudBackend()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/unknown`, { method: 'GET' }),
      {},
      backend,
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Not Found',
    })
  })

  it('normalizes update-character payload before delegating to backend', async () => {
    const updateCharacter = vi.fn(async (_input: UpdateCharacterInput) =>
      createJsonResponse({ status: 'success', message: 'Character updated.' }))
    const backend = createCrudBackend({ updateCharacter })

    const request = new Request(`${baseUrl}/api/admin/characters/14`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '  Renamed  ',
        status: 'active',
      }),
    })

    const response = await handleAdminApiRequest(request, {}, backend)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Character updated.',
    })
    expect(updateCharacter).toHaveBeenCalledWith({
      id: 14,
      name: 'Renamed',
      status: 'active',
    })
  })

  it('loads bootstrap data natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db } = createAdminReadD1Database()
    const legacyFetch = vi.fn(async () => createJsonResponse({ status: 'success', message: 'legacy' }))

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/bootstrap`, { method: 'GET' }),
      {
        DB: db,
        LEGACY_ADMIN_API_BASE_URL: 'http://legacy.test',
      },
      backend,
      legacyFetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      characters: [
        {
          id: 1,
          name: 'Alice',
          status: 'active',
          sortOrder: 1,
          commissionCount: 1,
        },
        {
          id: 2,
          name: 'Beta',
          status: 'stale',
          sortOrder: 2,
          commissionCount: 1,
        },
      ],
      creatorAliases: [
        {
          creatorName: 'alice-maker',
          aliases: [],
          commissionCount: 1,
        },
        {
          creatorName: 'beta-maker',
          aliases: [],
          commissionCount: 1,
        },
        {
          creatorName: 'maker',
          aliases: ['mk'],
          commissionCount: 0,
        },
      ],
      commissionSearchRows: [
        {
          id: 10,
          characterId: 1,
          characterName: 'Alice',
          fileName: '20250301_alice-maker',
          design: 'maid outfit',
          description: 'soft lighting',
          keyword: 'maid, cafe',
        },
        {
          id: 11,
          characterId: 2,
          characterName: 'Beta',
          fileName: '20240105_beta-maker',
          design: 'armor',
          description: 'battle scene',
          keyword: 'armor',
        },
      ],
    })
    expect(legacyFetch).not.toHaveBeenCalled()
  })

  it('loads aliases bootstrap data natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db } = createAdminReadD1Database()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/aliases/bootstrap`, { method: 'GET' }),
      { DB: db },
      backend,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      characterAliases: [
        {
          characterName: 'Alice',
          aliases: ['Alicia'],
          commissionCount: 1,
        },
        {
          characterName: 'Beta',
          aliases: ['B'],
          commissionCount: 1,
        },
      ],
      creatorAliases: [
        {
          creatorName: 'alice-maker',
          aliases: [],
          commissionCount: 1,
        },
        {
          creatorName: 'beta-maker',
          aliases: [],
          commissionCount: 1,
        },
        {
          creatorName: 'maker',
          aliases: ['mk'],
          commissionCount: 0,
        },
      ],
      keywordAliases: [
        {
          baseKeyword: 'armor',
          aliases: [],
          commissionCount: 1,
        },
        {
          baseKeyword: 'cafe',
          aliases: [],
          commissionCount: 1,
        },
        {
          baseKeyword: 'maid',
          aliases: ['uniform'],
          commissionCount: 1,
        },
      ],
    })
  })

  it('loads suggestion data natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db } = createAdminReadD1Database()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/suggestion`, { method: 'GET' }),
      { DB: db },
      backend,
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      featuredKeywords: string[]
      keywordOptions: string[]
    }

    expect(payload.featuredKeywords).toEqual(['maid', 'maker'])
    expect(payload.keywordOptions.slice(0, 6)).toEqual([
      'Alice',
      'alice-maker',
      'Alicia',
      'armor',
      'B',
      'Beta',
    ])
  })

  it('loads character commissions natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db } = createAdminReadD1Database()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/characters/1/commissions`, { method: 'GET' }),
      { DB: db },
      backend,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      commissions: [
        {
          id: 10,
          characterId: 1,
          characterName: 'Alice',
          fileName: '20250301_alice-maker',
          links: ['https://alice.example/a', 'https://alice.example/b'],
          design: 'maid outfit',
          description: 'soft lighting',
          keyword: 'maid, cafe',
          hidden: false,
        },
      ],
    })
  })

  it('loads source images natively when IMAGES binding exists', async () => {
    const backend = createCrudBackend()
    const imageBody = new Uint8Array([137, 80, 78, 71]).buffer
    const get = vi.fn(async (key: string) => {
      if (key !== '20250301_alice-maker.png') {
        return null
      }

      return {
        httpMetadata: {
          contentType: 'image/png',
        },
        async arrayBuffer() {
          return imageBody
        },
      }
    })

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/source-image/20250301_alice-maker`, { method: 'GET' }),
      { IMAGES: { get } },
      backend,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenNthCalledWith(1, '20250301_alice-maker.jpg')
    expect(get).toHaveBeenNthCalledWith(2, '20250301_alice-maker.jpeg')
    expect(get).toHaveBeenNthCalledWith(3, '20250301_alice-maker.png')
    expect(await response.arrayBuffer()).toEqual(imageBody)
  })

  it('handles suggestion writes natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db, executions } = createD1Recorder()
    const legacyFetch = vi.fn(async () => createJsonResponse({ status: 'success', message: 'legacy' }))

    const request = new Request(`${baseUrl}/api/admin/suggestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywordsJson: JSON.stringify(['  Kanaut Nishe ', 'maid', 'kanaut   nishe']),
      }),
    })

    const response = await handleAdminApiRequest(
      request,
      {
        DB: db,
        LEGACY_ADMIN_API_BASE_URL: 'http://legacy.test',
      },
      backend,
      legacyFetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Home featured keywords saved.',
    })
    expect(legacyFetch).not.toHaveBeenCalled()

    const deleteOps = executions.filter(item =>
      item.query.includes('DELETE FROM home_featured_search_keywords'),
    )
    const insertOps = executions.filter(item =>
      item.query.includes('INSERT INTO home_featured_search_keywords'),
    )

    expect(deleteOps).toHaveLength(1)
    expect(insertOps).toHaveLength(2)
    expect(insertOps.map(item => item.values)).toEqual([
      ['Kanaut Nishe', 1],
      ['maid', 2],
    ])
  })

  it('handles creator alias writes natively when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db, executions } = createD1Recorder()
    const legacyFetch = vi.fn(async () => createJsonResponse({ status: 'success', message: 'legacy' }))

    const request = new Request(`${baseUrl}/api/admin/aliases/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rows: [
          { creatorName: 'Q (part 1)', aliases: ['Cue'] },
          { creatorName: 'Q (part 2)', aliases: ['cue'] },
        ],
      }),
    })

    const response = await handleAdminApiRequest(
      request,
      {
        DB: db,
        LEGACY_ADMIN_API_BASE_URL: 'http://legacy.test',
      },
      backend,
      legacyFetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Creator aliases saved.',
    })
    expect(legacyFetch).not.toHaveBeenCalled()

    const insertOps = executions.filter(item => item.query.includes('INSERT INTO creator_aliases'))
    expect(insertOps).toHaveLength(1)
    expect(insertOps[0]?.values[0]).toBe('Q')
    expect(JSON.parse(String(insertOps[0]?.values[1]))).toEqual(expect.arrayContaining(['Cue', 'cue']))
  })

  it('keeps creator alias rowsJson compatibility and delete semantics when DB binding exists', async () => {
    const backend = createCrudBackend()
    const { db, executions } = createD1Recorder()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/aliases/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowsJson: JSON.stringify([
            { creatorName: 'Q (part 1)', alias: '' },
          ]),
        }),
      }),
      { DB: db },
      backend,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Creator aliases saved.',
    })

    const deleteOps = executions.filter(item => item.query.includes('DELETE FROM creator_aliases'))
    const insertOps = executions.filter(item => item.query.includes('INSERT INTO creator_aliases'))

    expect(deleteOps).toHaveLength(1)
    expect(deleteOps[0]?.values).toEqual(['Q'])
    expect(insertOps).toHaveLength(0)
  })

  it('falls back to legacy suggestion write route when DB binding is missing', async () => {
    const backend = createCrudBackend()
    const legacyFetch = vi.fn(async () =>
      createJsonResponse({ status: 'success', message: 'legacy suggestion save' }))

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: ['maid'],
        }),
      }),
      { LEGACY_ADMIN_API_BASE_URL: 'http://legacy.test' },
      backend,
      legacyFetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'legacy suggestion save',
    })
    expect(legacyFetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to legacy bootstrap route when DB binding is missing', async () => {
    const backend = createCrudBackend()
    const legacyFetch = vi.fn(async () =>
      createJsonResponse({ characters: [{ id: 1, name: 'legacy' }] }))

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/bootstrap`, { method: 'GET' }),
      { LEGACY_ADMIN_API_BASE_URL: 'http://legacy.test' },
      backend,
      legacyFetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      characters: [{ id: 1, name: 'legacy' }],
    })
    expect(legacyFetch).toHaveBeenCalledTimes(1)
  })

  it('handles refresh-assets natively without requiring the legacy bridge', async () => {
    const backend = createCrudBackend()

    const response = await handleAdminApiRequest(
      new Request(`${baseUrl}/api/admin/assets/refresh`, { method: 'POST' }),
      {},
      backend,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'success',
      message: 'Runtime assets are generated on demand. Refresh is no longer required.',
    })
  })
})
