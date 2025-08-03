'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import HeadImage from 'public/nsfw-cover-s.webp'

const CONFIRMED_AGE_KEY = 'hasConfirmedAge'
const AGE_CONFIRM_DURATION = 30 * 24 * 60 * 60 * 1000

export default function Warning() {
  // 初始状态为 true，避免闪烁
  const [isOpen, setIsOpen] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // 检查是否需要显示警告框
  useEffect(() => {
    const checkAgeConfirmation = () => {
      try {
        const timestamp = Number(localStorage.getItem(CONFIRMED_AGE_KEY))
        const shouldShow = !(timestamp && Date.now() - timestamp < AGE_CONFIRM_DURATION)

        if (!shouldShow) {
          setIsOpen(false)
        } else {
          // 延迟触发动画，确保初始状态渲染
          requestAnimationFrame(() => setIsAnimating(true))
        }
      } catch {
        // localStorage 访问失败时默认显示警告
        requestAnimationFrame(() => setIsAnimating(true))
      } finally {
        setIsChecking(false)
      }
    }

    checkAgeConfirmation()
  }, [])

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      // 保存原始样式
      const originalStyle = window.getComputedStyle(document.body).overflow

      // 阻止滚动
      document.body.style.overflow = 'hidden'

      // 清理函数：恢复原始样式
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
    // 如果 isOpen 为 false，则不返回任何内容
    return undefined
  }, [isOpen])

  // 焦点管理
  useEffect(() => {
    if (isOpen && !isChecking && confirmButtonRef.current) {
      confirmButtonRef.current.focus()
    }
  }, [isOpen, isChecking])

  const handleConfirmAge = useCallback(() => {
    localStorage.setItem(CONFIRMED_AGE_KEY, String(Date.now()))
    setIsAnimating(false)
    // 动画结束后移除组件
    setTimeout(() => setIsOpen(false), 200)
  }, [])

  const handleLeave = () => {
    window.location.href = 'https://www.google.com'
  }

  // 正在检查或不需要显示时返回 null
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/25 backdrop-blur-xl transition-opacity duration-300 ease-out dark:bg-white/5 ${isAnimating ? 'opacity-100' : 'opacity-0'} `}
      />

      {/* Content Container */}
      <div className="flex min-h-full items-center justify-center overflow-y-auto p-4 text-center">
        <div
          className={`w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all duration-300 ease-out dark:bg-gray-950 ${
            isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          } `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-title"
        >
          <Image
            src={HeadImage}
            alt="Commission Vault"
            quality={80}
            placeholder="blur"
            className="mb-4 select-none"
            priority
          />

          <h3
            id="warning-title"
            className="text-center text-lg leading-6 font-bold text-gray-900 select-none dark:text-gray-300"
          >
            [ Warning ]
          </h3>

          <div className="mt-2">
            <p className="text-center text-sm text-gray-500 select-none dark:text-gray-400">
              You have to be over 18 to view the contents.
              <br />
              Please <b>leave now</b> if you are under 18.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center">
            <button
              ref={confirmButtonRef}
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 font-mono text-xs font-medium text-blue-900 select-none hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              onClick={handleConfirmAge}
              disabled={isChecking}
            >
              I am over 18
            </button>
            <div className="mx-3" />
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 font-mono text-xs font-medium text-red-900 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
              onClick={handleLeave}
              disabled={isChecking}
            >
              Leave Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
