import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { ClientHistoryPage } from './pages/ClientHistoryPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { ServiceOrdersPage } from './pages/ServiceOrdersPage'
import { AgendaPage } from './pages/AgendaPage'
import { StockPage } from './pages/StockPage'
import { FinancialPage } from './pages/FinancialPage'
import { AiAssistantPage } from './pages/AiAssistantPage'
import { WhatsAppSettingsPage } from './pages/WhatsAppSettingsPage'

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
      </Routes>
    </AuthProvider>
  )
}
