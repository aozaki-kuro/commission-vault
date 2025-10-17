import { notFound } from 'next/navigation'

const AdminPage = async () => {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  const [{ default: AdminDashboard }, { getAdminData }] = await Promise.all([
    import('./AdminDashboard'),
    import('#lib/admin/db'),
  ])

  const { characters, commissions } = getAdminData()

  return <AdminDashboard characters={characters} commissions={commissions} />
}

export default AdminPage
