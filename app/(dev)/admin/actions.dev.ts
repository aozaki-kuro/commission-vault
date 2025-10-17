'use server'

import { revalidatePath } from 'next/cache'

import {
  createCharacter,
  createCommission,
  updateCharacter,
  updateCharactersOrder,
  updateCommission,
  deleteCommission,
  type CharacterStatus,
} from '#lib/admin/db'
import type { FormState } from './types'

const isDevelopment = process.env.NODE_ENV !== 'production'

const devGuard = (): FormState | null => {
  if (!isDevelopment) {
    return {
      status: 'error',
      message: 'Writable actions are only available in development mode.',
    }
  }

  return null
}

const ensureWritable = () => {
  if (!isDevelopment) {
    throw new Error('Writable actions are only available in development mode.')
  }
}

export const addCharacterAction = async (
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> => {
  const guard = devGuard()
  if (guard) return guard

  const name = formData.get('name')?.toString().trim() ?? ''
  const statusValue = (formData.get('status')?.toString() ?? 'active') as CharacterStatus

  if (!name) {
    return { status: 'error', message: 'Character name is required.' }
  }

  const status: CharacterStatus = statusValue === 'stale' ? 'stale' : 'active'

  try {
    createCharacter({ name, status })
    revalidatePath('/admin')
    return { status: 'success', message: `Character "${name}" created.` }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to create character. Please try again.',
    }
  }
}

export const addCommissionAction = async (
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> => {
  const guard = devGuard()
  if (guard) return guard

  const characterId = Number(formData.get('characterId'))
  const fileName = formData.get('fileName')?.toString().trim() ?? ''
  const linksRaw = formData.get('links')?.toString() ?? ''
  const design = formData.get('design')?.toString().trim() || undefined
  const description = formData.get('description')?.toString().trim() || undefined
  const hidden = formData.get('hidden') === 'on'

  if (!Number.isFinite(characterId) || characterId <= 0) {
    return { status: 'error', message: 'Character selection is required.' }
  }

  if (!fileName) {
    return { status: 'error', message: 'File name is required.' }
  }

  const links = linksRaw
    .split('\n')
    .map(link => link.trim())
    .filter(Boolean)

  if (links.length === 0) {
    return {
      status: 'error',
      message: 'At least one link is required (separate multiple links by newline).',
    }
  }

  try {
    const { characterName } = createCommission({
      characterId,
      fileName,
      links,
      design,
      description,
      hidden,
    })
    revalidatePath('/admin')
    return {
      status: 'success',
      message: `Commission "${fileName}" added to ${characterName}.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to add commission. Please try again.',
    }
  }
}

export async function saveCharacterOrder(payload: {
  active: number[]
  stale: number[]
}): Promise<FormState> {
  ensureWritable()

  try {
    updateCharactersOrder(payload)
    revalidatePath('/admin')
    return { status: 'success', message: 'Character order updated.' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update character order.',
    }
  }
}

export async function renameCharacter(payload: {
  id: number
  name: string
  status: CharacterStatus
}): Promise<FormState> {
  ensureWritable()

  const trimmed = payload.name.trim()
  if (!trimmed) {
    return { status: 'error', message: 'Character name is required.' }
  }

  try {
    updateCharacter({ id: payload.id, name: trimmed, status: payload.status })
    revalidatePath('/admin')
    return { status: 'success', message: `Character "${trimmed}" updated.` }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to update character. Please try again.',
    }
  }
}

export const updateCommissionAction = async (
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> => {
  const guard = devGuard()
  if (guard) return guard

  const id = Number(formData.get('id'))
  const characterId = Number(formData.get('characterId'))
  const fileName = formData.get('fileName')?.toString().trim() ?? ''
  const linksRaw = formData.get('links')?.toString() ?? ''
  const design = formData.get('design')?.toString().trim() || undefined
  const description = formData.get('description')?.toString().trim() || undefined
  const hidden = formData.get('hidden') === 'on'

  if (!Number.isFinite(id) || id <= 0) {
    return { status: 'error', message: 'Invalid commission identifier.' }
  }

  if (!Number.isFinite(characterId) || characterId <= 0) {
    return { status: 'error', message: 'Character selection is required.' }
  }

  if (!fileName) {
    return { status: 'error', message: 'File name is required.' }
  }

  const links = linksRaw
    .split('\n')
    .map(link => link.trim())
    .filter(Boolean)

  if (links.length === 0) {
    return {
      status: 'error',
      message: 'At least one link is required (separate multiple links by newline).',
    }
  }

  try {
    updateCommission({
      id,
      characterId,
      fileName,
      links,
      design,
      description,
      hidden,
    })
    revalidatePath('/admin')
    return { status: 'success', message: `Commission "${fileName}" updated.` }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to update commission. Please try again.',
    }
  }
}

export async function deleteCommissionAction(id: number): Promise<FormState> {
  ensureWritable()

  try {
    deleteCommission(id)
    revalidatePath('/admin')
    return { status: 'success', message: 'Commission deleted.' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to delete commission.',
    }
  }
}
