import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 px-8 py-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
