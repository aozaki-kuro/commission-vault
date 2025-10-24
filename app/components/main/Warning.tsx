'use client'

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import Image from 'next/image'
import { Fragment, useCallback, useRef } from 'react'
import { useSyncExternalStore } from 'react'

import HeadImage from 'public/nsfw-cover-s.webp'

const CONFIRMED_AGE_KEY = 'hasConfirmedAge'
const AGE_CONFIRM_DURATION = 30 * 24 * 60 * 60 * 1000
const AGE_CONFIRM_EVENT = 'age-confirm-changed'

/** 读取当前是否应该显示弹窗 */
function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false // SSR 安全：服务端不弹窗
  const timestamp = Number(localStorage.getItem(CONFIRMED_AGE_KEY))
  const valid = Boolean(timestamp && Date.now() - timestamp < AGE_CONFIRM_DURATION)
  return !valid // true 表示需要显示弹窗
}

/** SSR 期间的快照（与 getSnapshot 返回类型一致） */
function getServerSnapshot(): boolean {
  return false
}

/** 订阅“年龄确认状态”变化 */
function subscribe(callback: () => void) {
  // 跨 Tab 更新时，原生 storage 事件会触发
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONFIRMED_AGE_KEY) callback()
  }
  // 同 Tab 内按钮点击后，我们派发自定义事件来触发回调
  const onCustom = () => callback()

  window.addEventListener('storage', onStorage)
  window.addEventListener(AGE_CONFIRM_EVENT, onCustom)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(AGE_CONFIRM_EVENT, onCustom)
  }
}

export default function Warning() {
  // 用外部存储（localStorage）作为“单一事实来源”，不再在 effect 里 setState
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const handleConfirmAge = useCallback(() => {
    localStorage.setItem(CONFIRMED_AGE_KEY, String(Date.now()))
    // 同页内不会触发 storage 事件，手动通知订阅者
    window.dispatchEvent(new Event(AGE_CONFIRM_EVENT))
  }, [])

  const handleLeave = () => {
    window.location.href = 'https://www.google.com'
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={() => null}
        initialFocus={confirmButtonRef}
        static
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-xl dark:bg-white/5" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-950">
                <Image
                  src={HeadImage}
                  alt="Commission Vault"
                  quality={80}
                  placeholder="blur"
                  className="mb-4 select-none"
                  priority
                />
                <DialogTitle
                  as="h3"
                  className="text-center text-lg leading-6 font-bold text-gray-900 select-none dark:text-gray-300"
                >
                  [ Warning ]
                </DialogTitle>
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
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 font-mono text-xs font-medium text-blue-900 select-none hover:bg-blue-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={handleConfirmAge}
                  >
                    I am over 18
                  </button>
                  <div className="mx-3" />
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 font-mono text-xs font-medium text-red-900 hover:bg-red-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    onClick={handleLeave}
                  >
                    Leave Now
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
