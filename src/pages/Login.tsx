import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function Login() {
  const { user, loading, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signInWithEmail(email, password)
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-pip-600 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-none">Internal PIP</p>
            <p className="text-xs text-gray-500">AI Agent Hub</p>
          </div>
        </div>

        {/* Card */}
        <div className="pip-card">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 mb-6">Access your AI agents</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="pip-label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pip-input"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="pip-label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pip-input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="pip-button-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Internal use only — HeatherManuel
        </p>
      </div>
    </div>
  )
}
