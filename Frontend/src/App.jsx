import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import PredictForm from './pages/PredictForm'
import HistoricalDataDashboard from './pages/HistoricalDataDashboard'
import DeviceRiskPage from './pages/DeviceRiskPage'
import Navbar from './components/Navbar'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DeviceRiskPage />} />
            <Route path="/home" element={<DeviceRiskPage />} />
            <Route path="/device-risk" element={<DeviceRiskPage />} />
            <Route path="/predict" element={<PredictForm />} />
            <Route path="/dashboard" element={<HistoricalDataDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
