import classNames from "classnames";
import {
  ChangeEvent,
  useCallback,
  useId,
  useRef,
  useState,
  KeyboardEvent,
  FormEvent,
  useEffect,
} from "react";

import { FontAwesomeIcon } from "@web-speed-hackathon-2026/client/src/components/foundation/FontAwesomeIcon";
import { DirectMessageFormData } from "@web-speed-hackathon-2026/client/src/direct_message/types";
import { debounce } from "@web-speed-hackathon-2026/client/src/utils/debounce";
import { formatHM } from "@web-speed-hackathon-2026/client/src/utils/format_date";
import { getProfileImagePath } from "@web-speed-hackathon-2026/client/src/utils/get_path";

interface Props {
  conversationError: Error | null;
  conversation: Models.DirectMessageConversation;
  activeUser: Models.User;
  isPeerTyping: boolean;
  isSubmitting: boolean;
  onTyping: () => void;
  onSubmit: (params: DirectMessageFormData) => Promise<void>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export const DirectMessagePage = ({
  conversationError,
  conversation,
  activeUser,
  isPeerTyping,
  isSubmitting,
  onTyping,
  onSubmit,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: Props) => {
  const formRef = useRef<HTMLFormElement>(null);
  const textAreaId = useId();
  const messageListRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isInitialMount = useRef(true);

  const peer =
    conversation.initiator.id !== activeUser.id ? conversation.initiator : conversation.member;

  const [text, setText] = useState("");
  const textAreaRows = Math.min((text || "").split("\n").length, 5);
  const isInvalid = text.trim().length === 0;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
      onTyping();
    },
    [onTyping],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    [formRef],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void onSubmit({ body: text.trim() }).then(() => {
        setText("");
      });
    },
    [onSubmit, text],
  );

  // 初回マウント時とメッセージ追加時に最下部へスクロール
  useEffect(() => {
    const currentCount = conversation.messages.length;
    const prevCount = prevMessageCountRef.current;

    if (isInitialMount.current) {
      // 初回: レイアウト完了後に最下部へ
      isInitialMount.current = false;
      requestAnimationFrame(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    } else if (currentCount > prevCount && prevCount > 0) {
      const addedAtEnd = currentCount - prevCount;
      // 末尾に追加（新着メッセージ）の場合のみスクロール
      if (addedAtEnd <= 5) {
        requestAnimationFrame(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [conversation.messages.length]);

  // 上端スクロールで過去メッセージを読み込み
  useEffect(() => {
    if (!hasMore) return;

    const handleScroll = debounce(() => {
      if (window.scrollY < 200 && !isLoadingMore) {
        onLoadMore();
      }
    }, 150);

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoadingMore, onLoadMore]);

  // 過去メッセージ読み込み後にスクロール位置を維持
  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 && window.scrollY < 200) {
          // レイアウト読み取りをrAFに遅延して強制レイアウトを回避
          requestAnimationFrame(() => {
            let addedHeight = 0;
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                addedHeight += node.offsetHeight;
              }
            });
            if (addedHeight > 0) {
              window.scrollBy(0, addedHeight);
            }
          });
        }
      }
    });

    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, []);

  if (conversationError != null) {
    return (
      <section className="px-6 py-10">
        <p className="text-cax-danger text-sm">メッセージの取得に失敗しました</p>
      </section>
    );
  }

  return (
    <section className="bg-cax-surface flex min-h-[calc(100vh-(--spacing(12)))] flex-col lg:min-h-screen">
      <header className="border-cax-border bg-cax-surface sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-3">
        <img
          alt={peer.profileImage.alt}
          className="h-12 w-12 rounded-full object-cover"
          loading="eager"
          fetchPriority="high"
          src={getProfileImagePath(peer.profileImage.id)}
        />
        <div className="min-w-0">
          <h1 className="overflow-hidden text-xl font-bold text-ellipsis whitespace-nowrap">
            {peer.name}
          </h1>
          <p className="text-cax-text-muted overflow-hidden text-xs text-ellipsis whitespace-nowrap">
            @{peer.username}
          </p>
        </div>
      </header>

      <div ref={messageListRef} className="bg-cax-surface-subtle flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-8">
        {hasMore && (
          <div className="text-center py-2">
            {isLoadingMore ? (
              <span className="text-cax-text-muted text-sm">読み込み中...</span>
            ) : (
              <button
                className="text-cax-accent text-sm hover:underline"
                onClick={onLoadMore}
                type="button"
              >
                過去のメッセージを読み込む
              </button>
            )}
          </div>
        )}

        {conversation.messages.length === 0 && !hasMore && (
          <p className="text-cax-text-muted text-center text-sm">
            まだメッセージはありません。最初のメッセージを送信してみましょう。
          </p>
        )}

        <ul className="grid gap-3" data-testid="dm-message-list">
          {conversation.messages.map((message) => {
            const isActiveUserSend = message.sender.id === activeUser.id;

            return (
              <li
                key={message.id}
                className={classNames(
                  "flex flex-col w-full",
                  isActiveUserSend ? "items-end" : "items-start",
                )}
              >
                <p
                  className={classNames(
                    "max-w-3/4 rounded-xl border px-4 py-2 text-sm whitespace-pre-wrap leading-relaxed wrap-anywhere",
                    isActiveUserSend
                      ? "rounded-br-sm border-transparent bg-cax-brand text-cax-surface-raised"
                      : "rounded-bl-sm border-cax-border bg-cax-surface text-cax-text",
                  )}
                >
                  {message.body}
                </p>
                <div className="flex gap-1 text-xs">
                  <time dateTime={message.createdAt}>{formatHM(message.createdAt)}</time>
                  {isActiveUserSend && message.isRead && (
                    <span className="text-cax-text-muted">既読</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-12 z-10 lg:bottom-0">
        {isPeerTyping && (
          <p className="bg-cax-surface-raised/75 text-cax-brand absolute inset-x-0 top-0 -translate-y-full px-4 py-1 text-xs">
            <span className="font-bold">{peer.name}</span>さんが入力中…
          </p>
        )}

        <form
          className="border-cax-border bg-cax-surface flex items-end gap-2 border-t p-4"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <div className="flex grow">
            <label className="sr-only" htmlFor={textAreaId}>
              内容
            </label>
            <textarea
              id={textAreaId}
              className="border-cax-border placeholder-cax-text-subtle focus:outline-cax-brand w-full resize-none rounded-xl border px-3 py-2 focus:outline-2 focus:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={textAreaRows}
              disabled={isSubmitting}
            />
          </div>
          <button
            className="bg-cax-brand text-cax-surface-raised hover:bg-cax-brand-strong rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isInvalid || isSubmitting}
            type="submit"
          >
            <FontAwesomeIcon iconType="arrow-right" styleType="solid" />
          </button>
        </form>
      </div>
    </section>
  );
};
