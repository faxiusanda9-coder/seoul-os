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
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/artists", label: "Artists", icon: Disc3 },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/archive", label: "Archive", icon: FolderHeart },
  { to: "/my-space", label: "My Space", icon: UserRound },
];

export function Layout() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    setNotificationsOpen(false);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="SEOUL.OS 首页">
            SEOUL<span className="brand-dot">.</span>OS
          </Link>
          <nav className="desktop-nav" aria-label="主导航">
            {nav.map((item) => (
              <NavLink
                end={item.to === "/"}
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            <Link
              className={`icon-button ${location.pathname === "/search" ? "is-active" : ""}`}
              to="/search"
              aria-label="搜索内容与艺人"
            >
              <Search size={20} />
            </Link>
            <div className="notification-wrap">
              <button
                className={`icon-button ${notificationsOpen ? "is-active" : ""}`}
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="通知"
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
                    aria-label="关闭通知"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X size={16} />
                  </button>
                  <strong>通知中心</strong>
                  <p>实时通知将在后续版本开放。当前没有新通知。</p>
                  <span>COMING SOON</span>
                </div>
              )}
            </div>
            <Link className="avatar" to="/my-space" aria-label="打开 My Space">
              S
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page-wrap footer-inner">
          <span className="brand">
            SEOUL<span className="brand-dot">.</span>OS
          </span>
          <p>One company. Every artist. Your universe.</p>
          <span>独立粉丝概念原型 · 非 JYP 官方产品</span>
        </div>
      </footer>
      <nav className="mobile-nav" aria-label="移动端主导航">
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
