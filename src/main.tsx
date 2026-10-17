import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { ArchiveProvider } from "./store/ArchiveContext";
import { I18nProvider } from "./locales/i18n";
import { ContentProvider } from "./store/ContentContext";
import { Layout } from "./components/Layout";
import { DiscoverPage } from "./pages/DiscoverPage";
import { ArtistsPage } from "./pages/ArtistsPage";
import { ArtistDetailPage } from "./pages/ArtistDetailPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ArchivePage } from "./pages/ArchivePage";
import { MySpacePage } from "./pages/MySpacePage";
import { UniversePage } from "./pages/UniversePage";
import { SearchPage } from "./pages/SearchPage";
import { NoticePage } from "./pages/NoticePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { MediaPage } from "./pages/MediaPage";
import { SocialProvider } from "./store/SocialContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ArchiveProvider>
        <ContentProvider>
          <SocialProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<DiscoverPage />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route
                  path="/artists/:artistId"
                  element={<ArtistDetailPage />}
                />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/archive" element={<ArchivePage />} />
                <Route path="/my-space" element={<MySpacePage />} />
                <Route path="/universe" element={<UniversePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/official" element={<NoticePage />} />
                <Route path="/media" element={<MediaPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
          </SocialProvider>
        </ContentProvider>
      </ArchiveProvider>
    </I18nProvider>
  </React.StrictMode>,
);
