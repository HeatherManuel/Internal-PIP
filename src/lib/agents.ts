import { Agent } from '@/types'

export const AGENTS: Agent[] = [
  {
    id: 'voice-agent',
    name: 'Voice Agent',
    slug: 'voice-agent',
    description: 'Generate on-brand content in your voice by ingesting your content from Google Drive.',
    icon: '🎙️',
    status: 'idle',
    path: '/agents/voice-agent',
  },
  // Future agents added here
]
