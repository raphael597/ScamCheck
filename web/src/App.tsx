import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { MetaProvider } from './hooks/useMeta';
import { CheckPage } from './pages/Check';
import { DemoPage } from './pages/Demo';
import { GuidePage } from './pages/Guide';
import { HelpPage } from './pages/Help';
import { HomePage } from './pages/Home';
import { NewsPage } from './pages/News';
import { NotFoundPage } from './pages/NotFound';

const AdminPage = lazy(() => import('./pages/Admin'));

export function App() {
  return (
    <BrowserRouter>
      <MetaProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pruefen" element={<CheckPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/ratgeber" element={<GuidePage />} />
            <Route path="/hilfe" element={<HelpPage />} />
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="container admin-loading" />}>
                  <AdminPage />
                </Suspense>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </MetaProvider>
    </BrowserRouter>
  );
}
