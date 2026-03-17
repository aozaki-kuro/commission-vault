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
})
