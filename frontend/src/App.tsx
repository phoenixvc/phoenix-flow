const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export default function App() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-2">phoenix-flow</h1>
        <p className="text-zinc-400 mb-6">Human + agent shared task graph</p>
        <a
          href={`${API_BASE}/health`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded transition-colors"
        >
          Check backend health
        </a>
      </div>
    </div>
  )
}
