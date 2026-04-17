"use client";

import { useEffect, useRef, useState } from "react";

interface StoneType {
  id: string;
  name: string;
  descriptionEn: string | null;
  active: boolean;
  _count: { inventoryItems: number; colors: number };
}

export default function StoneTypesPage() {
  const [types, setTypes] = useState<StoneType[]>([]);
  const [stoneImages, setStoneImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState<Record<string, boolean>>({});
  const imgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setLoadError(false);
    try {
      const [typesRes, settingsRes] = await Promise.all([
        fetch("/api/settings/stone-types"),
        fetch("/api/settings/catalog-site"),
      ]);
      if (!typesRes.ok || !settingsRes.ok) throw new Error("fetch failed");
      const [typesData, settingsData] = await Promise.all([typesRes.json(), settingsRes.json()]);
      setTypes(Array.isArray(typesData) ? typesData : []);
      try { setStoneImages(JSON.parse(settingsData.stone_type_images ?? "{}")); } catch { /* empty */ }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    setAddError(null);
    const r = await fetch("/api/settings/stone-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName.trim(), descriptionEn: addDesc.trim() || undefined }),
    });
    if (r.ok) {
      setAddName("");
      setAddDesc("");
      await load();
    } else {
      const { error } = await r.json().catch(() => ({ error: "Failed to add stone type" }));
      setAddError(error ?? "Failed to add stone type");
    }
    setAdding(false);
  }

  function startEdit(st: StoneType) {
    setEditId(st.id);
    setEditName(st.name);
    setEditDesc(st.descriptionEn ?? "");
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    setSavingId(id);
    setSaveError(null);
    const r = await fetch(`/api/settings/stone-types/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), descriptionEn: editDesc.trim() || null }),
    });
    if (r.ok) {
      setTypes((prev) =>
        prev.map((t) => t.id === id ? { ...t, name: editName.trim(), descriptionEn: editDesc.trim() || null } : t)
      );
      setEditId(null);
    } else {
      const { error } = await r.json().catch(() => ({ error: "Save failed" }));
      setSaveError(error ?? "Save failed");
    }
    setSavingId(null);
  }

  async function toggleActive(st: StoneType) {
    const r = await fetch(`/api/settings/stone-types/${st.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !st.active }),
    });
    if (r.ok) {
      setTypes((prev) => prev.map((t) => t.id === st.id ? { ...t, active: !st.active } : t));
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const r = await fetch(`/api/settings/stone-types/${id}`, { method: "DELETE" });
    if (r.ok) {
      setTypes((prev) => prev.filter((t) => t.id !== id));
    } else {
      const { error } = await r.json().catch(() => ({ error: "Delete failed" }));
      alert(error ?? "Delete failed");
    }
    setConfirmDel(null);
    setDeleting(null);
  }

  async function uploadCoverImage(stoneName: string, file: File) {
    setUploadingImg((p) => ({ ...p, [stoneName]: true }));
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(
      `/api/settings/stone-type-images?stoneName=${encodeURIComponent(stoneName)}`,
      { method: "POST", body: fd }
    );
    if (r.ok) {
      const { url } = await r.json();
      setStoneImages((p) => ({ ...p, [stoneName]: url }));
    }
    setUploadingImg((p) => ({ ...p, [stoneName]: false }));
  }

  if (loadError) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center space-y-3 max-w-3xl">
        <p className="text-sm text-destructive font-medium">Failed to load stone types.</p>
        <button onClick={load} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stone Types</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add, edit, or remove stone types. Active types appear in the public catalog and inventory filters.
        </p>
      </div>

      {/* Add new */}
      <form onSubmit={handleAdd} className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Add New Stone Type</p>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddError(null); }}
            placeholder="Stone name (e.g. Sapphire)"
            className="flex-1 min-w-0 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
          <input
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="flex-1 min-w-0 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={adding || !addName.trim()}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {adding ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : "＋ Add"}
          </button>
        </div>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </form>

      {/* List */}
      <div className="space-y-2">
        {types.length === 0 && (
          <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
            No stone types yet. Add one above.
          </div>
        )}
        {types.map((st) => {
          const img = stoneImages[st.name];
          const isEditing = editId === st.id;
          const isDelConfirm = confirmDel === st.id;
          return (
            <div
              key={st.id}
              className={`rounded-xl border bg-card p-4 transition-all ${!st.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                {/* Cover image thumbnail */}
                <div className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted border">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={st.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl opacity-20">💎</div>
                  )}
                  {uploadingImg[st.name] && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{st.name}</span>
                        {!st.active && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                            Hidden from catalog
                          </span>
                        )}
                      </div>
                      {st.descriptionEn && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{st.descriptionEn}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{st._count.inventoryItems}</span> inventory items
                        {" · "}
                        <span className="font-medium text-foreground">{st._count.colors}</span> colors
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {/* Upload cover photo */}
                  {!isEditing && (
                    <label
                      title="Upload cover photo"
                      className={`text-xs rounded-lg border px-2 py-1 cursor-pointer hover:bg-accent transition-colors ${uploadingImg[st.name] ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      🖼 Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { imgRefs.current[st.name] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadCoverImage(st.name, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}

                  {/* Show / Hide toggle */}
                  {!isEditing && (
                    <button
                      onClick={() => toggleActive(st)}
                      className={`text-xs rounded-lg border px-2 py-1 transition-colors ${
                        st.active
                          ? "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                          : "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                      }`}
                    >
                      {st.active ? "Hide" : "Show"}
                    </button>
                  )}

                  {/* Edit / Save / Cancel */}
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(st.id)}
                        disabled={savingId === st.id}
                        className="text-xs rounded-lg bg-primary text-primary-foreground px-2 py-1 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {savingId === st.id ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        ) : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditId(null); setSaveError(null); }}
                        className="text-xs rounded-lg border px-2 py-1 hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      {saveError && editId === st.id && (
                        <span className="text-[10px] text-destructive">{saveError}</span>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(st)}
                      className="text-xs rounded-lg border px-2 py-1 hover:bg-accent transition-colors"
                    >
                      Edit
                    </button>
                  )}

                  {/* Delete */}
                  {!isEditing && (
                    isDelConfirm ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(st.id)}
                          disabled={deleting === st.id}
                          className="text-xs rounded-lg bg-red-600 text-white px-2 py-1 hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deleting === st.id ? "…" : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDel(null)}
                          className="text-xs rounded-lg border px-2 py-1 hover:bg-accent transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (st._count.inventoryItems > 0) {
                            alert(`Cannot delete "${st.name}" — it has ${st._count.inventoryItems} inventory item(s). Remove those first.`);
                            return;
                          }
                          setConfirmDel(st.id);
                        }}
                        className="text-xs rounded-lg border px-2 py-1 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
