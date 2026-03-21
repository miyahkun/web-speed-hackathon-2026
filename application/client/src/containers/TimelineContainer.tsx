import { Helmet } from "react-helmet";

import { InfiniteScroll } from "@web-speed-hackathon-2026/client/src/components/foundation/InfiniteScroll";
import { TimelinePage } from "@web-speed-hackathon-2026/client/src/components/timeline/TimelinePage";
import { useInfiniteFetch } from "@web-speed-hackathon-2026/client/src/hooks/use_infinite_fetch";
import { fetchJSON } from "@web-speed-hackathon-2026/client/src/utils/fetchers";

declare global {
  interface Window {
    __SSR_POSTS__?: Models.Post[];
  }
}

function consumeSSRPosts(): Models.Post[] | undefined {
  if (typeof window !== "undefined" && window.__SSR_POSTS__) {
    const posts = window.__SSR_POSTS__;
    delete window.__SSR_POSTS__;
    return posts;
  }
  return undefined;
}

export const TimelineContainer = () => {
  const { data: posts, fetchMore } = useInfiniteFetch<Models.Post>(
    "/api/v1/posts",
    fetchJSON,
    consumeSSRPosts(),
  );

  return (
    <InfiniteScroll fetchMore={fetchMore} items={posts}>
      <Helmet>
        <title>タイムライン - CaX</title>
      </Helmet>
      <TimelinePage timeline={posts} />
    </InfiniteScroll>
  );
};
