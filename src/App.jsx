import { useState } from 'react'
import TicketTable from './components/TicketTable'
import DatabaseBrowser from './components/DatabaseBrowser'
import SubmitTicket from './components/SubmitTicket'

const NAV_ITEMS = [
  { id: 'tickets',  label: 'Tickets',        icon: TicketIcon },
  { id: 'submit',   label: 'Submit Ticket',   icon: PlusIcon },
  { id: 'database', label: 'Database',        icon: DatabaseIcon },
  { id: 'analytics',label: 'Analytics',       icon: ChartIcon,  soon: true },
  { id: 'rag',      label: 'RAG Knowledge Base', icon: RAGIcon,  soon: true },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('tickets')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        {/* logo / brand */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100 leading-tight">WIPL</p>
              <p className="text-[10px] text-gray-500 leading-tight">Ticket Intelligence</p>
            </div>
          </div>
        </div>

        {/* nav links */}
        <div className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => !item.soon && setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
                  ${active
                    ? 'bg-blue-600/20 text-blue-400'
                    : item.soon
                      ? 'text-gray-600 cursor-default'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.soon && (
                  <span className="ml-auto text-[10px] bg-gray-800 text-gray-500 rounded px-1.5 py-0.5 shrink-0">Soon</span>
                )}
              </button>
            )
          })}
        </div>

        {/* footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">Webspiders Interweb Pvt Ltd</p>
          <p className="text-[10px] text-gray-700">v0.1.0</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* top bar */}
        <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <div>
            <h1 className="text-base font-semibold text-gray-100">
              {NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Webspiders Interweb Pvt Ltd · n8n + Supabase powered</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
            Connected to Supabase
          </div>
        </header>

        {/* page content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'tickets'  && <TicketTable />}
          {activeTab === 'submit'   && <SubmitTicket />}
          {activeTab === 'database' && <DatabaseBrowser />}
          {activeTab !== 'tickets' && activeTab !== 'submit' && activeTab !== 'database' && (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Coming soon
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function TicketIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  )
}

function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function DatabaseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}

function RAGIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}
