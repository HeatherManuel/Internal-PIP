export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

export interface Agent {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  status: AgentStatus
  path: string
}

export interface AgentJob {
  id: string
  agent_id: string
  user_id: string
  status: AgentStatus
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  created_at: string
  completed_at: string | null
}

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}
