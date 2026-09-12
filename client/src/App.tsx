import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { ServiceOrdersPage } from './pages/ServiceOrdersPage'
import { AgendaPage } from './pages/AgendaPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orcamentos"
          element={
            <ProtectedRoute>
              <BudgetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordens-de-servico"
          element={
            <ProtectedRoute>
              <ServiceOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <AgendaPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
