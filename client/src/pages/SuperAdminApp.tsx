import { Routes, Route } from 'react-router-dom'
import { SuperAdminAuthProvider } from '../context/SuperAdminAuthContext'
import { SuperAdminProtectedRoute } from '../components/SuperAdminProtectedRoute'
import { SuperAdminLoginPage } from './SuperAdminLoginPage'
import { SuperAdminDashboardPage } from './SuperAdminDashboardPage'

// Painel secreto da CriaTech (Seção 6): caminho não linkado em nenhum menu do
// tenant, com login próprio e totalmente separado do login das empresas.
export function SuperAdminApp() {
  return (
    <SuperAdminAuthProvider>
      <Routes>
        <Route path="login" element={<SuperAdminLoginPage />} />
        <Route
          path=""
          element={
            <SuperAdminProtectedRoute>
              <SuperAdminDashboardPage />
            </SuperAdminProtectedRoute>
          }
        />
      </Routes>
    </SuperAdminAuthProvider>
  )
}
