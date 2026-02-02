import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import Stocktakes from './pages/Stocktakes';
import StocktakeDetail from './pages/StocktakeDetail';
import MasterFile from './pages/MasterFile';
import Devices from './pages/Devices';

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>hoScan2000</h1>
          <p>Admin Dashboard</p>
        </div>
        <nav>
          <NavLink to="/" end>
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink to="/stores">
            <span>🏪</span> Stores
          </NavLink>
          <NavLink to="/stocktakes">
            <span>📋</span> Stocktakes
          </NavLink>
          <NavLink to="/master">
            <span>📦</span> Master File
          </NavLink>
          <NavLink to="/devices">
            <span>📱</span> Devices
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/stocktakes" element={<Stocktakes />} />
          <Route path="/stocktakes/:id" element={<StocktakeDetail />} />
          <Route path="/master" element={<MasterFile />} />
          <Route path="/devices" element={<Devices />} />
        </Routes>
      </main>
    </div>
  );
}
