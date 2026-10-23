import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Role } from '@damage/shared'
import { useAuth } from './auth'
import { Shell } from './components/Shell'
import { AidPage } from './pages/AidPage'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { NewReportPage } from './pages/NewReportPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { StatsPage } from './pages/StatsPage'
import { UsersPage } from './pages/UsersPage'

function Gate({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()
  if (!ready) return <p className="p-8 text-sm text-muted" role="status">جارٍ فتح الجلسة…</p>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <Navigate to="/map" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <Gate>
            <Shell />
          </Gate>
        }
      >
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/reports/new"
          element={
            <RoleGate roles={[Role.CITIZEN, Role.RESIDENT, Role.SUPERVISOR]}>
              <NewReportPage />
            </RoleGate>
          }
        />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route
          path="/stats"
          element={
            <RoleGate roles={[Role.SUPERVISOR, Role.ORGANIZATION]}>
              <StatsPage />
            </RoleGate>
          }
        />
        <Route
          path="/aid"
          element={
            <RoleGate roles={[Role.ORGANIZATION, Role.SUPERVISOR]}>
              <AidPage />
            </RoleGate>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleGate roles={[Role.SUPERVISOR]}>
              <UsersPage />
            </RoleGate>
          }
        />
        <Route
          path="/admin/organizations"
          element={
            <RoleGate roles={[Role.SUPERVISOR]}>
              <OrganizationsPage />
            </RoleGate>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  )
}
