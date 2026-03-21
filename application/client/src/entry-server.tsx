import { renderToString } from "react-dom/server";
import { HelmetProvider } from "react-helmet";
import { Provider } from "react-redux";
import { StaticRouter } from "react-router";

import { AppPage } from "@web-speed-hackathon-2026/client/src/components/application/AppPage";
import { TimelinePage } from "@web-speed-hackathon-2026/client/src/components/timeline/TimelinePage";
import { store } from "@web-speed-hackathon-2026/client/src/store";

// ホームページ専用のSSRレンダリング
// lazy() を使わず直接インポートし、renderToString で解決可能にする
export function renderHome(posts: Models.Post[]): string {
  const noop = () => {};
  return renderToString(
    <Provider store={store}>
      <StaticRouter location="/">
        <HelmetProvider>
          <AppPage
            activeUser={null}
            authModalId="ssr-auth"
            newPostModalId="ssr-post"
            onLogout={noop}
          >
            <section>
              <TimelinePage timeline={posts} />
            </section>
          </AppPage>
        </HelmetProvider>
      </StaticRouter>
    </Provider>,
  );
}
