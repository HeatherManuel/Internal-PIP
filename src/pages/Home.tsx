import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { AGENTS } from '@/lib/agents'
import { useAuth } from '@/hooks/useAuth'

export function Home() {
  const { user } = useAuth()
  const firstName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div>
      <Header
        title={`Hey, ${firstName} 👋`}
        subtitle="Your AI agents are ready to work."
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active Agents', value: AGENTS.length },
          { label: 'Jobs Today', value: '—' },
          { label: 'Credits Used', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="pip-card">
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Agents grid */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Your Agents
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENTS.map((agent) => (
          <Link
            key={agent.slug}
            to={agent.path}
            className="pip-card hover:border-pip-700 hover:bg-gray-800/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{agent.icon}</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                <Zap size={11} />
                Ready
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">{agent.description}</p>
            <div className="flex items-center gap-1.5 text-pip-400 text-sm font-medium group-hover:gap-2.5 transition-all">
              Open agent <ArrowRight size={14} />
            </div>
          </Link>
        ))}

        {/* Placeholder for future agents */}
        <div className="pip-card border-dashed opacity-40 flex flex-col items-center justify-center text-center py-8">
          <p className="text-2xl mb-2">+</p>
          <p className="text-sm text-gray-400">More agents coming soon</p>
        </div>
      </div>
    </div>
  )
}
