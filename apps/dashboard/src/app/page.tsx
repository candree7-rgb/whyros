import { supabase } from '@/lib/supabase'

async function getStats() {
  const [visitors, events, touchpoints, contacts] = await Promise.all([
    supabase.from('visitors').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('touchpoints').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
  ])

  return {
    visitors: visitors.count || 0,
    events: events.count || 0,
    touchpoints: touchpoints.count || 0,
    contacts: contacts.count || 0,
  }
}

async function getRecentEvents() {
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
}

async function getRecentVisitors() {
  const { data } = await supabase
    .from('visitors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  return data || []
}

export const revalidate = 5 // Refresh every 5 seconds

export default async function Dashboard() {
  const stats = await getStats()
  const recentEvents = await getRecentEvents()
  const recentVisitors = await getRecentVisitors()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Overview</h2>
        <p className="text-slate-400">Echtzeit-Statistiken deines Attribution Systems</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Visitors" value={stats.visitors} color="blue" />
        <StatCard title="Events" value={stats.events} color="green" />
        <StatCard title="Touchpoints" value={stats.touchpoints} color="purple" />
        <StatCard title="Contacts" value={stats.contacts} color="orange" />
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Events */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Letzte Events</h3>
          {recentEvents.length === 0 ? (
            <p className="text-slate-400">Noch keine Events</p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event: any) => (
                <div key={event.id} className="bg-slate-700/50 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400">
                        {event.event_type}
                      </span>
                      {event.event_name && (
                        <span className="ml-2 text-sm text-slate-300">{event.event_name}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(event.created_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  {event.page_url && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{event.page_url}</p>
                  )}
                  {event.utm_source && (
                    <p className="text-xs text-slate-500 mt-1">
                      UTM: {event.utm_source} / {event.utm_medium} / {event.utm_campaign}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Visitors */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Letzte Visitors</h3>
          {recentVisitors.length === 0 ? (
            <p className="text-slate-400">Noch keine Visitors</p>
          ) : (
            <div className="space-y-3">
              {recentVisitors.map((visitor: any) => (
                <div key={visitor.id} className="bg-slate-700/50 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <code className="text-xs text-slate-300">{visitor.id.slice(0, 8)}...</code>
                      {visitor.device_type && (
                        <span className="ml-2 text-xs text-slate-500">{visitor.device_type}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(visitor.created_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  {visitor.first_utm_source && (
                    <p className="text-xs text-slate-500 mt-1">
                      First Touch: {visitor.first_utm_source} / {visitor.first_utm_campaign}
                    </p>
                  )}
                  {visitor.first_landing_page && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{visitor.first_landing_page}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }[color]

  return (
    <div className={`rounded-lg p-6 border ${colorClasses}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}
