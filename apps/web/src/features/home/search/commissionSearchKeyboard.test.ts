import type { ListboxController } from './commissionSearchKeyboard'
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createListboxController } from './commissionSearchKeyboard'

function buildFixture() {
  const input = document.createElement('input')
  const list = document.createElement('ul')

  for (let i = 0; i < 3; i++) {
    const li = document.createElement('li')
    li.setAttribute('role', 'option')
    li.id = `item-${i}`
    // jsdom doesn't implement scrollIntoView
    li.scrollIntoView = vi.fn()
    list.appendChild(li)
  }

  document.body.append(input, list)
  return { input, list }
}

function press(el: HTMLElement, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('createListboxController', () => {
  let input: HTMLInputElement
  let list: HTMLUListElement
  let controller: ListboxController
  let onSelect: ReturnType<typeof vi.fn>
  let onDismiss: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const fixture = buildFixture()
    input = fixture.input
    list = fixture.list as HTMLUListElement

    onSelect = vi.fn()
    onDismiss = vi.fn()

    controller = createListboxController({
      inputEl: input,
      listEl: list,
      getItemCount: () => list.querySelectorAll('[role="option"]').length,
      onSelect,
      onDismiss,
    })

    controller.bind()
    controller.reset()
  })

  afterEach(() => {
    controller.unbind()
    document.body.innerHTML = ''
  })

  it('arrowDown cycles through items', () => {
    expect(controller.getActiveIndex()).toBe(0)

    press(input, 'ArrowDown')
    expect(controller.getActiveIndex()).toBe(1)

    press(input, 'ArrowDown')
    expect(controller.getActiveIndex()).toBe(2)
  })

  it('arrowDown wraps from last to 0', () => {
    controller.setActiveIndex(2)

    press(input, 'ArrowDown')
    expect(controller.getActiveIndex()).toBe(0)
  })

  it('arrowUp wraps from 0 to last', () => {
    controller.setActiveIndex(0)

    press(input, 'ArrowUp')
    expect(controller.getActiveIndex()).toBe(2)
  })

  it('enter calls onSelect with active index', () => {
    controller.setActiveIndex(1)

    press(input, 'Enter')
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('escape calls onDismiss', () => {
    press(input, 'Escape')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('sets data-selected and aria-activedescendant correctly', () => {
    const items = list.querySelectorAll('[role="option"]')

    // reset() sets index 0
    expect(items[0].getAttribute('data-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe('item-0')

    controller.setActiveIndex(2)
    expect(items[0].getAttribute('data-selected')).toBe('false')
    expect(items[2].getAttribute('data-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe('item-2')

    controller.setActiveIndex(-1)
    expect(items[2].getAttribute('data-selected')).toBe('false')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })
})
