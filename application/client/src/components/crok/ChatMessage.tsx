import "katex/dist/katex.min.css";
import { memo, useMemo, useRef } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { CodeBlock } from "@web-speed-hackathon-2026/client/src/components/crok/CodeBlock";
import { TypingIndicator } from "@web-speed-hackathon-2026/client/src/components/crok/TypingIndicator";
import { CrokLogo } from "@web-speed-hackathon-2026/client/src/components/foundation/CrokLogo";

interface Props {
  message: Models.ChatMessage;
}

/**
 * コードブロック内の空行を無視しつつ、\n\n でブロック分割する。
 * 完成ブロック（末尾以外）と未完成ブロック（末尾）を返す。
 */
function splitBlocks(content: string): { stable: string[]; tail: string } {
  const blocks: string[] = [];
  let current = "";
  let inCodeBlock = false;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock && line === "" && current.endsWith("\n")) {
      // 空行 = ブロック境界
      blocks.push(current);
      current = "";
    } else {
      current += line + "\n";
    }
  }

  // 最後のブロックは未完成の可能性がある
  const stable = blocks;
  const tail = current;
  return { stable, tail };
}

const remarkPlugins = [remarkMath, remarkGfm];
const rehypePlugins = [rehypeKatex];
const components = { pre: CodeBlock };

const MemoizedBlock = memo(({ content }: { content: string }) => (
  <Markdown components={components} rehypePlugins={rehypePlugins} remarkPlugins={remarkPlugins}>
    {content}
  </Markdown>
));

const AssistantMessage = ({ content }: { content: string }) => {
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());

  const rendered = useMemo(() => {
    if (!content) return null;

    const { stable, tail } = splitBlocks(content);
    const cache = cacheRef.current;

    // 安定ブロックをキャッシュから取得、なければ作成
    const stableElements = stable.map((block) => {
      if (!cache.has(block)) {
        cache.set(block, <MemoizedBlock content={block} key={block} />);
      }
      return cache.get(block)!;
    });

    // 末尾ブロックは常に再レンダリング
    const tailElement = tail ? (
      <MemoizedBlock content={tail} key={`tail-${tail.length}`} />
    ) : null;

    return [...stableElements, tailElement];
  }, [content]);

  return (
    <div className="mb-6 flex gap-4">
      <div className="h-8 w-8 shrink-0">
        <CrokLogo className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-cax-text mb-1 text-sm font-medium">Crok</div>
        <div className="markdown text-cax-text max-w-none">
          {content ? rendered : <TypingIndicator />}
        </div>
      </div>
    </div>
  );
};

const UserMessage = ({ content }: { content: string }) => {
  return (
    <div className="mb-6 flex justify-end">
      <div className="bg-cax-surface-subtle text-cax-text max-w-[80%] rounded-3xl px-4 py-2">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};

export const ChatMessage = memo(({ message }: Props) => {
  if (message.role === "user") {
    return <UserMessage content={message.content} />;
  }
  return <AssistantMessage content={message.content} />;
});
