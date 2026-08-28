import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GuardPage from './pages/GuardPage';
import AdminPage from './pages/AdminPage';
import NfcGuidePage from './pages/NfcGuidePage';
import ToastStack from './components/ToastStack';

export default function App() {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GuardPage notify={notify} />} />
        <Route path="/admin" element={<AdminPage notify={notify} />} />
        <Route path="/admin/*" element={<AdminPage notify={notify} />} />
        <Route path="/nfc-guide" element={<NfcGuidePage />} />
        <Route path="*" element={<GuardPage notify={notify} />} />
      </Routes>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </BrowserRouter>
  );
}
