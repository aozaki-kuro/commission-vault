import React from 'react'
import ReactDOM from 'react-dom/server'

const contexts = new WeakMap<object, { currentIndex: number }>()
const idPrefix = 'r'

function incrementId(rendererContextResult: object) {
  const existingContext = contexts.get(rendererContextResult)
  if (existingContext) {
    const id = `${idPrefix}${existingContext.currentIndex}`
    existingContext.currentIndex += 1
    return id
  }

  const context = { currentIndex: 1 }
  contexts.set(rendererContextResult, context)
  return `${idPrefix}0`
}

function StaticHtml({
  value,
  name,
  hydrate = true,
}: {
  value: string
  name?: string
  hydrate?: boolean
}) {
  if (!value)
    return null

  const tagName = hydrate ? 'astro-slot' : 'astro-static-slot'
  return React.createElement(tagName, {
    name,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: value },
  })
}

StaticHtml.shouldComponentUpdate = () => false

const reactTypeof = Symbol.for('react.element')
const reactTransitionalTypeof = Symbol.for('react.transitional.element')

function needsHydration(metadata?: { astroStaticSlot?: boolean, hydrate?: boolean }) {
  return metadata?.astroStaticSlot ? Boolean(metadata.hydrate) : true
}

async function getNodeWritable() {
  const { Writable } = await import('node:stream')
  return Writable
}

async function readResult(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (value)
        result += decoder.decode(value)
      else
        decoder.decode(new Uint8Array())
      return result
    }

    result += decoder.decode(value, { stream: true })
  }
}

async function renderToReadableStreamAsync(vnode: React.ReactNode, options: Record<string, unknown>) {
  return readResult(
    await ReactDOM.renderToReadableStream(
      vnode,
      options as Parameters<typeof ReactDOM.renderToReadableStream>[1],
    ),
  )
}

async function renderToPipeableStreamAsync(vnode: React.ReactNode, options: Record<string, unknown>) {
  const Writable = await getNodeWritable()
  let html = ''

  return new Promise<string>((resolve, reject) => {
    let stream = ReactDOM.renderToPipeableStream(vnode, {
      ...(options as Parameters<typeof ReactDOM.renderToPipeableStream>[1]),
      onError(error) {
        reject(error)
      },
      onAllReady() {
        stream.pipe(new Writable({
          write(chunk, _encoding, callback) {
            html += chunk.toString('utf-8')
            callback()
          },
          destroy() {
            resolve(html)
          },
        }))
      },
    })
  })
}

const formContentTypes = ['application/x-www-form-urlencoded', 'multipart/form-data']

function isFormRequest(contentType: string | null) {
  const type = contentType?.split(';')[0].toLowerCase()
  return formContentTypes.some(candidate => type === candidate)
}

async function getFormState({ result }: { result?: { request: Request, actionResult?: unknown } }) {
  if (!result?.actionResult)
    return undefined
  if (!isFormRequest(result.request.headers.get('content-type')))
    return undefined

  const { searchParams } = new URL(result.request.url)
  const formData = await result.request.clone().formData()
  const actionKey = formData.get('$ACTION_KEY')?.toString()
  const actionName = searchParams.get('_action')
  if (!actionKey || !actionName)
    return undefined

  return [result.actionResult, actionKey, actionName] as const
}

async function renderToStaticMarkup(
  this: { result?: { request: Request, actionResult?: unknown } } | undefined,
  Component: unknown,
  props: Record<string, unknown>,
  { default: children, ...slotted }: Record<string, unknown>,
  metadata?: { astroStaticSlot?: boolean, hydrate?: boolean },
) {
  let prefix: string | undefined
  if (this?.result)
    prefix = incrementId(this.result)

  const attrs: Record<string, unknown> = { prefix }
  delete props.class

  const slots: Record<string, React.ReactNode> = {}
  for (const [key, value] of Object.entries(slotted)) {
    const name = key.trim().replace(/[-_]([a-z])/g, (_, letter: string) => letter.toUpperCase())
    slots[name] = React.createElement(StaticHtml, {
      hydrate: needsHydration(metadata),
      value: String(value ?? ''),
      name,
    })
  }

  const newProps = {
    ...props,
    ...slots,
  }

  const newChildren = children ?? props.children
  if (newChildren != null) {
    newProps.children = React.createElement(StaticHtml, {
      hydrate: needsHydration(metadata),
      value: String(newChildren),
    })
  }

  const formState = this ? await getFormState(this) : undefined
  if (formState) {
    attrs['data-action-result'] = JSON.stringify(formState[0])
    attrs['data-action-key'] = formState[1]
    attrs['data-action-name'] = formState[2]
  }

  const vnode = React.createElement(Component as React.ComponentType, newProps)
  const renderOptions = {
    identifierPrefix: prefix,
    formState,
  }

  const html = 'renderToReadableStream' in ReactDOM
    ? await renderToReadableStreamAsync(vnode, renderOptions)
    : await renderToPipeableStreamAsync(vnode, renderOptions)

  return { html, attrs }
}

async function check(
  this: { result?: { request: Request, actionResult?: unknown } } | undefined,
  Component: unknown,
  props: Record<string, unknown>,
  children: Record<string, unknown>,
) {
  if (typeof Component === 'object' && Component !== null) {
    return String((Component as { $$typeof?: symbol }).$$typeof).slice('Symbol('.length).startsWith('react')
  }

  if (typeof Component !== 'function')
    return false

  if (Component.name === 'QwikComponent')
    return false

  if ((Component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref'))
    return false

  if (Component.prototype != null && typeof Component.prototype.render === 'function') {
    return React.Component.isPrototypeOf(Component) || React.PureComponent.isPrototypeOf(Component)
  }

  let isReactComponent = false
  const renderCandidate = Component as (...args: unknown[]) => unknown

  function Tester(...args: unknown[]) {
    try {
      const vnode = renderCandidate(...args)
      if (vnode && ((vnode as { $$typeof?: symbol }).$$typeof === reactTypeof || (vnode as { $$typeof?: symbol }).$$typeof === reactTransitionalTypeof))
        isReactComponent = true
    }
    catch {
    }

    return React.createElement('div')
  }

  await renderToStaticMarkup.call(this, Tester, props, children)
  return isReactComponent
}

const renderer = {
  name: '@astrojs/react',
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
}

export default renderer
