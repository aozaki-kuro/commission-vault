interface ApiState {
  status: 'success' | 'error'
  message: string
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function success(message: string) {
  return json({
    status: 'success',
    message,
  } satisfies ApiState)
}

export function handleAdminWriteRequest(request: Request) {
  const { pathname } = new URL(request.url)

  if (request.method === 'POST' && pathname === '/api/admin/assets/refresh') {
    return success('Runtime assets are generated on demand. Refresh is no longer required.')
  }

  return null
}
