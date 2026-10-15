import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/Nav";
import { PujaBanner } from "@/components/PujaBanner";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import PandalDetail from "@/pages/PandalDetail";
import MyPujas from "@/pages/MyPujas";
import Planner from "@/pages/Planner";
import MapPage from "@/pages/MapPage";
import Guide from "@/pages/Guide";
import NotFound from "@/pages/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Nav />
      <PujaBanner />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/pandal/:id" element={<PandalDetail />} />
          <Route path="/my-pujas" element={<MyPujas />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>PujoPath · a Durga Puja 2026 companion for Kolkata</p>
          <p>
            Directory data from pujomap.com (ODbL) · map & metro data © OpenStreetMap contributors ·
            never fabricates unverified locations
          </p>
        </div>
      </footer>
      <Toaster position="bottom-right" />
    </div>
  );
}
