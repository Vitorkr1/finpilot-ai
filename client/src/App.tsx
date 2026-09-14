import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ClientsPage = lazy(() =>
  import('./pages/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  })),
)
const ClientHistoryPage = lazy(() =>
  import('./pages/ClientHistoryPage').then((module) => ({
    default: module.ClientHistoryPage,
  })),
)
const BudgetsPage = lazy(() =>
  import('./pages/BudgetsPage').then((module) => ({
    default: module.BudgetsPage,
  })),
)
const ServiceOrdersPage = lazy(() =>
  import('./pages/ServiceOrdersPage').then((module) => ({
    default: module.ServiceOrdersPage,
  })),
)
const AgendaPage = lazy(() =>
  import('./pages/AgendaPage').then((module) => ({
    default: module.AgendaPage,
  })),
)
const StockPage = lazy(() =>
  import('./pages/StockPage').then((module) => ({ default: module.StockPage })),
)
const FinancialPage = lazy(() =>
  import('./pages/FinancialPage').then((module) => ({
    default: module.FinancialPage,
  })),
)
const AiAssistantPage = lazy(() =>
  import('./pages/AiAssistantPage').then((module) => ({
    default: module.AiAssistantPage,
  })),
)
const WhatsAppSettingsPage = lazy(() =>
  import('./pages/WhatsAppSettingsPage').then((module) => ({
    default: module.WhatsAppSettingsPage,
  })),
)
const CompanyUsersPage = lazy(() =>
  import('./pages/CompanyUsersPage').then((module) => ({
    default: module.CompanyUsersPage,
  })),
)
const SuperAdminApp = lazy(() =>
  import('./pages/SuperAdminApp').then((module) => ({
    default: module.SuperAdminApp,
  })),
)
import { SUPER_ADMIN_PATH } from './lib/superAdminPath'

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Carregando workspace...
        </div>
      }
    >
      <Routes>
        <Route path={`${SUPER_ADMIN_PATH}/*`} element={<SuperAdminApp />} />
        <Route
          path="*"
          element={
            <AuthProvider>
              <TenantRoutes />
            </AuthProvider>
          }
        />
      </Routes>
    </Suspense>
  )
}

function TenantRoutes() {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Carregando módulo...
        </div>
      }
    >
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
          path="/clientes/:id/historico"
          element={
            <ProtectedRoute>
              <ClientHistoryPage />
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
        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <StockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <ProtectedRoute>
              <FinancialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assistente-ia"
          element={
            <ProtectedRoute>
              <AiAssistantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/whatsapp"
          element={
            <ProtectedRoute>
              <WhatsAppSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <CompanyUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <div className="empty-state">
                  <h2 className="text-2xl font-semibold">
                    Página não encontrada
                  </h2>
                  <p>Este endereço não faz parte do seu workspace.</p>
                  <Link to="/" className="primary-button">
                    Voltar ao início
                  </Link>
                </div>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}
