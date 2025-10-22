// next.config.ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

const projectDir = path.dirname(fileURLToPath(import.meta.url))

// 把绝对路径改成项目内的相对路径（以 ./ 开头，统一为 POSIX 斜杠）
const rel = (p: string) => {
  const r = path.posix.join('.', path.relative(projectDir, p).split(path.sep).join(path.posix.sep))
  return r.startsWith('.') ? r : `./${r}`
}

const getAdminActionsPath = (isDev: boolean) =>
  rel(path.join(projectDir, 'app/(dev)/admin', isDev ? 'actions.dev.ts' : 'actions.stub.ts'))

const nextConfig = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  const adminActionsPath = getAdminActionsPath(isDev)

  return {
    reactStrictMode: true,
    cleanDistDir: true,
    images: { unoptimized: true, minimumCacheTTL: 604800 },
    output: 'export',

    // ⚠️ 只保留 Turbopack 的 alias，避免和 webpack 重复配置打架
    turbopack: {
      resolveAlias: {
        '#admin/actions': adminActionsPath,
      },
    },

    // 可选：如果你偶尔用 webpack 模式再开（比如禁用 turbo），再同步一份
    webpack: config => {
      ;(config.resolve ??= {}).alias ??= {}
      config.resolve.alias['#admin/actions'] = adminActionsPath
      return config
    },
  }
}

export default nextConfig
