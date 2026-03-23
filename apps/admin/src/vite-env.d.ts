/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ADMIN_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
