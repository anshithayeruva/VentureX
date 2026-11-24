"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { Notice } from "@/components/forms";
import { Button, Card, cx } from "@/components/ui";
import { api } from "@/lib/api";

/* Shared pieces for the founder and investor profile and settings pages. */

function initialsOf(name?: string) {
  return (
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** An image the API serves only to signed-in users (photos, logos), with initials as the fallback. */
export function AuthImage({
  path,
  name,
  size = 40,
  rounded = "full",
  version,
}: {
  path: string | null;
  name?: string;
  size?: number;
  rounded?: "full" | "lg";
  version?: number | string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let made: string | null = null;
    if (path) {
      api.imageUrl(path).then((u) => {
        made = u;
        if (active) setUrl(u);
        else if (u) URL.revokeObjectURL(u);
      });
    }
    return () => {
      active = false;
      setUrl(null);
      if (made) URL.revokeObjectURL(made);
    };
  }, [path, version]);
  const shape = rounded === "full" ? "rounded-full" : "rounded-lg";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name || ""} width={size} height={size} className={cx(shape, "shrink-0 object-cover")} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cx(shape, "flex shrink-0 items-center justify-center bg-subtle font-semibold text-ink-2")}
      style={{ width: size, height: size, fontSize: Math.max(11, size / 3) }}
      aria-hidden={!name}
    >
      {initialsOf(name)}
    </div>
  );
}

/** Profile photo with upload / remove. */
export function PhotoUploader({ userId, name, hasPhoto, onChanged }: { userId: string; name: string; hasPhoto: boolean; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("Use an image under 2 MB.");
    setBusy(true);
    setError(null);
    try {
      await api.uploadMyPhoto(file);
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex items-center gap-4">
      <AuthImage path={hasPhoto ? `/users/${userId}/photo` : null} name={name} size={72} version={version} />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            <Camera className="h-4 w-4" />
            {busy ? "Uploading…" : hasPhoto ? "Change photo" : "Add photo"}
          </Button>
          {hasPhoto && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.removeMyPhoto();
                  onChanged();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-faint">PNG, JPEG or WebP, up to 2 MB.</p>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Profile photo" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** A profile section shown read-only, with Edit → (fields) → Save / Cancel. */
export function EditableSection({
  title,
  description,
  view,
  edit,
  onSave,
  onCancel,
  editable = true,
}: {
  title: string;
  description?: string;
  view: React.ReactNode;
  edit: React.ReactNode;
  onSave: () => Promise<void>;
  onCancel: () => void;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg text-ink">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {editable && !editing && (
          <Button variant="ghost" onClick={() => { setNotice(null); setEditing(true); }}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>
      {notice && <Notice {...notice} />}
      {editing ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setNotice(null);
            try {
              await onSave();
              setEditing(false);
              setNotice({ text: "Saved.", ok: true });
            } catch (err) {
              setNotice({ text: err instanceof Error ? err.message : "Couldn't save.", ok: false });
            } finally {
              setBusy(false);
            }
          }}
        >
          {edit}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" disabled={busy} onClick={() => { onCancel(); setEditing(false); setNotice(null); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      ) : (
        view
      )}
    </Card>
  );
}

/** Read-only label/value rows for a section's view mode. */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-ink">{value === "" || value == null || (Array.isArray(value) && !value.length) ? <span className="text-faint">Not added</span> : value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function TagList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-md bg-subtle px-2 py-0.5 text-xs text-ink-2">{t}</span>
      ))}
    </span>
  );
}

export function ExternalLink({ href }: { href: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
      {href.replace(/^https?:\/\/(www\.)?/, "")}
    </a>
  );
}
