// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PopularKeywordsRow from './PopularKeywordsRow'

const REFRESH_ICON_SPIN_DURATION_MS = 650
const REFRESH_ICON_SPIN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

describe('popularKeywordsRow', () => {
  const originalAnimate = HTMLElement.prototype.animate
  const originalGetAnimations = HTMLElement.prototype.getAnimations

  afterEach(() => {
    HTMLElement.prototype.animate = originalAnimate
    HTMLElement.prototype.getAnimations = originalGetAnimations
    vi.restoreAllMocks()
  })

  it('animates the refresh icon counterclockwise when clicked', () => {
    const onRotate = vi.fn()
    const animateSpy = vi.fn()
    const cancelSpy = vi.fn()

    HTMLElement.prototype.animate = animateSpy
    HTMLElement.prototype.getAnimations = vi.fn(() => [{ cancel: cancelSpy }] as Animation[])

    render(
      <PopularKeywordsRow
        keywords={['alpha', 'beta']}
        refreshLabel="Refresh popular keywords"
        onRotate={onRotate}
      />,
    )

    const button = screen.getByRole('button', { name: 'Refresh popular keywords' })

    fireEvent.click(button)

    expect(onRotate).toHaveBeenCalledTimes(1)
    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(animateSpy).toHaveBeenCalledWith(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-360deg)' },
      ],
      {
        duration: REFRESH_ICON_SPIN_DURATION_MS,
        easing: REFRESH_ICON_SPIN_EASING,
        iterations: 1,
      },
    )
  })
})
