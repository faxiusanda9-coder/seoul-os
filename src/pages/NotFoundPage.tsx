import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page-wrap page-pad not-found">
      <p className="eyebrow">404 / OFF THE RECORD</p>
      <h1>We lost this track.</h1>
      <p>这个页面不存在，回到首页继续探索。</p>
      <Link className="primary-button" to="/">
        <ArrowLeft size={17} /> Back to Discover
      </Link>
    </div>
  );
}
