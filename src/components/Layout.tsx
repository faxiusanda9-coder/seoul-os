import { useEffect, useState } from "react";
import {
  Bell,
  Compass,
  CalendarDays,
  Disc3,
  FolderHeart,
  Search,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useArchive } from "../store/ArchiveContext";
import { useI18n, type MessageKey } from "../locales/i18n";

const nav: Array<{
  to: string;
  label: string;
  key: MessageKey;
  icon: LucideIcon;
}> = [
  { to: "/", label: "Discover", key: "nav.discover", icon: Compass },
  { to: "/artists", label: "Artists", key: "nav.artists", icon: Disc3 },
  {
    to: "/calendar",
    label: "Calendar",
    key: "nav.calendar",
    icon: CalendarDays,
  },
  { to: "/archive", label: "Archive", key: "nav.archive", icon: FolderHeart },
  { to: "/my-space", label: "My Space", key: "nav.mySpace", icon: UserRound },
];

export function Layout() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const { storageWarning } = useArchive();
  const { t, storageWarning: languageStorageWarning } = useI18n();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: "auto" });
      } else {
        window.scrollTo(0, 0);
      }
    });
    setNotificationsOpen(false);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("nav.skip")}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label={t("nav.home")}>
            SEOUL<span className="brand-dot">.</span>OS
          </Link>
          <nav className="desktop-nav" aria-label={t("nav.main")}>
            {nav.map((item) => (
              <NavLink
                end={item.to === "/"}
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                title={t(item.key)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            <Link
              className={`icon-button ${location.pathname === "/search" ? "is-active" : ""}`}
              to="/search"
              aria-label={t("nav.search")}
            >
              <Search size={20} />
            </Link>
            <div className="notification-wrap">
              <button
                className={`icon-button ${notificationsOpen ? "is-active" : ""}`}
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label={t("nav.notifications")}
                aria-expanded={notificationsOpen}
                type="button"
              >
                <Bell size={20} />
              </button>
              {notificationsOpen && (
                <div className="notification-popover" role="status">
                  <button
                    className="popover-close"
                    type="button"
                    aria-label={t("nav.closeNotifications")}
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X size={16} />
                  </button>
                  <strong>{t("nav.notificationCenter")}</strong>
                  <p>{t("nav.noNotifications")}</p>
                  <span>{t("common.comingSoon")}</span>
                </div>
              )}
            </div>
            <Link
              className="avatar"
              to="/my-space"
              aria-label={t("nav.openSpace")}
            >
              S
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content">
        {(storageWarning || languageStorageWarning) && (
          <p className="storage-warning" role="status">
            {t("common.storageWarning")}
          </p>
        )}
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page-wrap footer-inner">
          <span className="brand">
            SEOUL<span className="brand-dot">.</span>OS
          </span>
          <p>One company. Every artist. Your universe.</p>
          <span>{t("common.disclosure")}</span>
        </div>
      </footer>
      <nav className="mobile-nav" aria-label={t("nav.mobile")}>
        {nav.map((item) => (
          <NavLink
            end={item.to === "/"}
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "mobile-link active" : "mobile-link"
            }
          >
            <item.icon size={21} strokeWidth={1.8} />
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
