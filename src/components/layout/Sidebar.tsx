import { NavLink } from 'react-router-dom'
import { Sparkles, LayoutDashboard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AGENTS } from '@/lib/agents'

export function Sidebar() {
  const { signOut, user } = useAuth()

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-pip-600 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-none">Internal PIP</p>
            <p className="text-xs text-gray-500 mt-0.5">AI Agent Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-2">
          Overview
        </p>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-pip-600/20 text-pip-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`
          }
        >
          <LayoutDashboard size={16} />
          Dashboard
        </NavLink>

        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mt-4 mb-2">
          Agents
        </p>
        {AGENTS.map((agent) => (
          <NavLink
            key={agent.slug}
            to={agent.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                isActive
                  ? 'bg-pip-600/20 text-pip-300'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`
            }
          >
            <span>{agent.icon}</span>
            <span className="flex-1">{agent.name}</span>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800 space-y-1">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <Settings size={16} />
          Settings
        </NavLink>
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-pip-700 flex items-center justify-center text-xs font-medium text-pip-200">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 truncate">{user?.email}</p>
          </div>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-300 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
