export function App() {
  const shellStyle = {
    margin: '0 auto',
    maxWidth: '960px',
    padding: '32px 24px',
    fontFamily: '\'IBM Plex Sans\', sans-serif',
  } as const

  return (
    <main style={shellStyle}>
      <h1>Admin App Scaffold</h1>
      <p>TODO: migrate existing admin pages without changing visual style.</p>
    </main>
  )
}
