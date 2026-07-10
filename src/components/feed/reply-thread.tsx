"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addReply,
  beepComment,
  deleteReply,
  updateReply,
} from "@/app/(app)/feed/actions";
import { StateIcon } from "@/components/icons";
import { DriverId } from "@/components/ui/driver-id";
import { pageTitleColorClassName } from "@/components/ui/page-title";
import { formatFeedTimestamp } from "@/lib/format-time";
import { displayFirstOrFull } from "@/lib/profile-name";
import { usStateName } from "@/lib/us-states";
import type { DamageReportComment } from "@/types/database";

/** Root (0) + up to two nested levels — keeps mobile indent sane. */
const MAX_REPLY_DEPTH = 2;

export type FeedReply = DamageReportComment & {
  author_name: string | null;
  author_work_state: string | null;
  /** Only populated when the viewer may see this author’s Driver ID. */
  author_driver_id: string | null;
  beep_count: number;
  beeped_by_me: boolean;
};

type ReplyNode = FeedReply & { children: ReplyNode[] };

type ReplyThreadProps = {
  reportId: string;
  currentUserId: string | null;
  isAdmin: boolean;
  replies: FeedReply[];
};

function AuthorTag({ reply }: { reply: FeedReply }) {
  const displayName = displayFirstOrFull(reply.author_name, "");
  const workState = reply.author_work_state?.trim() || null;
  const workStateLabel = workState ? usStateName(workState) : null;

  if (!displayName && !workState) {
    if (reply.author_driver_id) {
      return (
        <>
          Driver <DriverId>{reply.author_driver_id}</DriverId>
        </>
      );
    }
    return "Fleet member";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {displayName ? (
        <span className={pageTitleColorClassName}>{displayName}</span>
      ) : null}
      {workState ? (
        <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
          out of
          <StateIcon
            state={workState}
            className="size-5 shrink-0 text-brand"
            aria-label={workStateLabel ?? workState}
          />
        </span>
      ) : null}
    </span>
  );
}

function buildReplyTree(replies: FeedReply[]): ReplyNode[] {
  const byId = new Map<string, ReplyNode>();
  for (const reply of replies) {
    byId.set(reply.id, { ...reply, children: [] });
  }

  const roots: ReplyNode[] = [];
  for (const reply of replies) {
    const node = byId.get(reply.id)!;
    const parentId = reply.parent_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function ReplyThread({
  reportId,
  currentUserId,
  isAdmin,
  replies,
}: ReplyThreadProps) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [localReplies, setLocalReplies] = useState(replies);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalReplies(replies);
  }, [replies]);

  const tree = buildReplyTree(localReplies);
  const replyTo = replyToId
    ? (localReplies.find((r) => r.id === replyToId) ?? null)
    : null;

  useEffect(() => {
    if (replyToId) composeRef.current?.focus();
  }, [replyToId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addReply(reportId, body, replyToId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setReplyToId(null);
    });
  }

  function startReplyTo(reply: FeedReply) {
    setReplyToId(reply.id);
    setEditingId(null);
    setError(null);
  }

  function cancelReplyTo() {
    setReplyToId(null);
  }

  function startEdit(reply: FeedReply) {
    setEditingId(reply.id);
    setEditBody(reply.body);
    setReplyToId(null);
    setError(null);
  }

  function saveEdit(commentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateReply(reportId, commentId, editBody);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
    });
  }

  function onDelete(commentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteReply(reportId, commentId);
      if (!result.ok) setError(result.error);
    });
  }

  function onBeep(commentId: string) {
    const current = localReplies.find((r) => r.id === commentId);
    if (!current || current.beeped_by_me || pending) return;

    setError(null);
    setLocalReplies((prev) =>
      prev.map((r) =>
        r.id === commentId
          ? { ...r, beeped_by_me: true, beep_count: r.beep_count + 1 }
          : r,
      ),
    );

    startTransition(async () => {
      const result = await beepComment(reportId, commentId);
      if (!result.ok) {
        setLocalReplies((prev) =>
          prev.map((r) =>
            r.id === commentId
              ? {
                  ...r,
                  beeped_by_me: false,
                  beep_count: Math.max(0, r.beep_count - 1),
                }
              : r,
          ),
        );
        setError(result.error);
      }
    });
  }

  function renderNode(node: ReplyNode, depth: number) {
    const canEdit = currentUserId === node.author_id;
    const canDelete = canEdit || isAdmin;
    const isEditing = editingId === node.id;
    const canNestReply =
      Boolean(currentUserId) &&
      currentUserId !== node.author_id &&
      depth < MAX_REPLY_DEPTH;
    const isTarget = replyToId === node.id;

    return (
      <li key={node.id} className="flex flex-col gap-2">
        <div
          className={
            depth > 0
              ? "ml-4 border-l-2 border-muted-foreground/30 pl-3 py-2"
              : "rounded-lg border border-border px-3 py-3"
          }
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              <AuthorTag reply={node} />
            </p>
            <time
              dateTime={node.created_at}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatFeedTimestamp(node.created_at)}
            </time>
          </div>

          {isEditing ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => saveEdit(node.id)}
                  className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingId(null)}
                  className="min-h-10 rounded-md px-3 text-sm font-medium text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {node.body}
            </p>
          )}

          {!isEditing ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {canNestReply ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startReplyTo(node)}
                  className={
                    isTarget
                      ? "text-xs font-medium text-foreground underline underline-offset-2"
                      : "text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                  }
                >
                  Reply
                </button>
              ) : null}
              {currentUserId ? (
                <button
                  type="button"
                  disabled={pending || node.beeped_by_me}
                  onClick={() => onBeep(node.id)}
                  aria-label="Beep"
                  aria-pressed={node.beeped_by_me}
                  title={
                    node.beeped_by_me
                      ? `Beeped · ${node.beep_count}`
                      : `Beep · ${node.beep_count}`
                  }
                  className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                    node.beeped_by_me
                      ? "text-brand disabled:opacity-100"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Megaphone className="size-3.5 shrink-0" aria-hidden />
                  <span>{node.beep_count}</span>
                  <span className="sr-only">
                    {node.beep_count === 1 ? "beep" : "beeps"}
                  </span>
                </button>
              ) : node.beep_count > 0 ? (
                <span
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  title={`${node.beep_count} beep${node.beep_count === 1 ? "" : "s"}`}
                >
                  <Megaphone className="size-3.5 shrink-0" aria-hidden />
                  <span>{node.beep_count}</span>
                </span>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startEdit(node)}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  Edit
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(node.id)}
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {node.children.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Replies</h2>

      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tree.map((node) => renderNode(node, 0))}
        </ul>
      )}

      {currentUserId ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          {replyTo ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex flex-wrap items-center gap-x-1">
                Replying to <AuthorTag reply={replyTo} />
              </span>
              <button
                type="button"
                onClick={cancelReplyTo}
                className="shrink-0 font-medium underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <textarea
            ref={composeRef}
            id="reply-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
            aria-label={replyTo ? "Reply to comment" : "Add a reply"}
            placeholder={
              replyTo ? "Write a nested reply…" : "Write a reply…"
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Posting…" : replyTo ? "Post nested reply" : "Post reply"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Sign in to reply.</p>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
