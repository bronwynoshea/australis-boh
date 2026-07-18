import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Code2, FileCode2, History, MessageSquareText, Plus, Save, Send, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  applyCookbookInstruction,
  createCookbookAsset,
  createCookbookVersion,
  listCookbookAssets,
  loadCookbookAssetWorkspace,
  saveCookbookWorkingFile,
  setCookbookReviewState,
} from "./studioApi";
import type { CookbookAsset, CookbookAssetFile, CookbookAssetMessage, CookbookAssetVersion } from "./types";

type StudioTab = "files" | "versions" | "review";
const panel = "rounded-xl border border-boh-border-light/80 bg-boh-surface-light shadow-sm dark:border-boh-border dark:bg-boh-surface";
const button = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} bg-boh-primary text-white hover:bg-boh-primary/90`;
const secondary = `${button} border border-boh-border-light bg-boh-bg-light text-boh-text-light hover:bg-boh-surface-light dark:border-boh-border dark:bg-boh-bg dark:text-boh-text`;

function AssetCard({ asset, selected, onSelect }: { key?: React.Key; asset: CookbookAsset; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? "border-boh-primary bg-boh-primary/10" : "border-boh-border-light bg-boh-bg-light hover:border-boh-primary/40 dark:border-boh-border dark:bg-boh-bg"}`}>
    <div className="flex items-start justify-between gap-3"><span className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">{asset.title}</span><span className="whitespace-nowrap rounded-full bg-boh-bg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-boh-text-sub-light dark:bg-boh-surface dark:text-boh-text-sub">{asset.status.replace("_", " ")}</span></div>
    <p className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Web page · Updated {new Date(asset.updated_at).toLocaleDateString()}</p>
  </button>;
}

function Message({ message }: { key?: React.Key; message: CookbookAssetMessage }) {
  const user = message.role === "user";
  return <div className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-5 ${user ? "ml-auto bg-boh-primary text-white" : "bg-boh-bg-light text-boh-text-light dark:bg-boh-bg dark:text-boh-text"}`}>
    {!user && <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-boh-primary"><Sparkles size={11}/>Bounded assistant</span>}
    {message.content}
  </div>;
}

function NewAssetSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (asset: CookbookAsset) => void }) {
  const [title, setTitle] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { onCreated(await createCookbookAsset(title)); toast.success("Asset created"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create asset."); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-stretch sm:justify-end sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={submit} className="w-full max-h-[75vh] overflow-y-auto rounded-t-2xl bg-boh-surface-light p-5 shadow-2xl dark:bg-boh-surface sm:max-h-none sm:max-w-md sm:rounded-2xl">
      <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">New web asset</h2><p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Start with a safe static HTML working draft.</p></div><button type="button" onClick={onClose} className={secondary} aria-label="Close"><X size={16}/></button></div>
      <label className="mt-6 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub" htmlFor="asset-title">Asset name</label>
      <input id="asset-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Spring campaign landing page" className="mt-2 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2.5 text-sm text-boh-text-light outline-none focus:border-boh-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"/>
      <button disabled={saving} className={`${primary} mt-5 w-full`}><Plus size={16}/>{saving ? "Creating…" : "Create asset"}</button>
    </form>
  </div>;
}

export default function AssetStudioPage() {
  const [assets, setAssets] = useState<CookbookAsset[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<CookbookAssetFile[]>([]); const [messages, setMessages] = useState<CookbookAssetMessage[]>([]); const [versions, setVersions] = useState<CookbookAssetVersion[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null); const [source, setSource] = useState(""); const [previewOverride, setPreviewOverride] = useState<string | null>(null);
  const [instruction, setInstruction] = useState(""); const [versionSummary, setVersionSummary] = useState(""); const [tab, setTab] = useState<StudioTab>("files");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [showNew, setShowNew] = useState(false);
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? null;
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0] ?? null;

  const refreshAssets = useCallback(async (preferredId?: string) => { try { const next = await listCookbookAssets(); setAssets(next); setSelectedId((current) => preferredId ?? (next.some((asset) => asset.id === current) ? current : next[0]?.id ?? null)); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load assets."); } finally { setLoading(false); } }, []);
  const refreshWorkspace = useCallback(async (assetId: string) => { try { const workspace = await loadCookbookAssetWorkspace(assetId); setFiles(workspace.files); setMessages(workspace.messages); setVersions(workspace.versions); const file = workspace.files.find((item) => item.id === activeFileId) ?? workspace.files[0]; setActiveFileId(file?.id ?? null); setSource(file?.content ?? ""); setPreviewOverride(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load workspace."); } }, [activeFileId]);
  useEffect(() => { void refreshAssets(); }, [refreshAssets]);
  useEffect(() => { if (selectedId) void refreshWorkspace(selectedId); else { setFiles([]); setMessages([]); setVersions([]); setSource(""); } }, [selectedId]);
  useEffect(() => { if (activeFile) setSource(activeFile.content); }, [activeFileId]);

  const previewHtml = useMemo(() => previewOverride ?? (activeFile?.mime_type === "text/html" ? source : ""), [previewOverride, activeFile, source]);
  const send = async () => { if (!selectedId || !instruction.trim()) return; setBusy(true); try { await applyCookbookInstruction(selectedId, instruction); setInstruction(""); await Promise.all([refreshWorkspace(selectedId), refreshAssets(selectedId)]); toast.success("HTML starter updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to apply instruction."); } finally { setBusy(false); } };
  const saveDraft = async () => { if (!activeFile) return; setBusy(true); try { await saveCookbookWorkingFile(activeFile, source); await Promise.all([refreshWorkspace(activeFile.asset_id), refreshAssets(activeFile.asset_id)]); toast.success("Working draft saved"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save draft."); } finally { setBusy(false); } };
  const saveVersion = async () => { if (!selectedId) return; setBusy(true); try { if (activeFile && source !== activeFile.content) await saveCookbookWorkingFile(activeFile, source); await createCookbookVersion(selectedId, versionSummary); setVersionSummary(""); setTab("versions"); await Promise.all([refreshWorkspace(selectedId), refreshAssets(selectedId)]); toast.success("Immutable version created"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create version."); } finally { setBusy(false); } };
  const review = async (state: "ready" | "changes_requested" | "approved") => { if (!selectedId) return; setBusy(true); try { await setCookbookReviewState(selectedId, state); await refreshAssets(selectedId); toast.success("Review status updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update review."); } finally { setBusy(false); } };

  return <div className="min-h-[calc(100vh-9rem)] text-boh-text-light dark:text-boh-text">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Code2 className="text-boh-primary" size={20}/><h1 className="text-xl font-semibold">Asset Studio</h1><span className="rounded-full bg-boh-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-boh-primary">Static web MVP</span></div><p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Create, edit, preview, and version tenant-owned Cookbook assets.</p></div><button className={primary} onClick={() => setShowNew(true)}><Plus size={16}/>New asset</button></header>
    {loading ? <div className={`${panel} p-10 text-center text-sm text-boh-text-sub-light`}>Loading Asset Studio…</div> : assets.length === 0 ? <div className={`${panel} grid min-h-[28rem] place-items-center p-8 text-center`}><div><Sparkles className="mx-auto text-boh-primary"/><h2 className="mt-3 text-lg font-semibold">Create your first web asset</h2><p className="mt-2 max-w-md text-sm text-boh-text-sub-light dark:text-boh-text-sub">Use a bounded assistant to generate static HTML, then edit and save immutable versions.</p><button className={`${primary} mt-5`} onClick={() => setShowNew(true)}><Plus size={16}/>New asset</button></div></div> :
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(420px,1fr)_320px]">
      <aside className="flex min-h-[44rem] flex-col gap-4">
        <section className={`${panel} p-3`}><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Assets</h2><span className="text-xs text-boh-text-sub-light">{assets.length}</span></div><div className="max-h-56 space-y-2 overflow-y-auto">{assets.map((asset) => <AssetCard key={asset.id} asset={asset} selected={asset.id === selectedId} onSelect={() => setSelectedId(asset.id)}/>)}</div></section>
        <section className={`${panel} flex min-h-0 flex-1 flex-col p-3`}><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquareText size={16} className="text-boh-primary"/>Instructions</div><div className="min-h-52 flex-1 space-y-2 overflow-y-auto pr-1">{messages.length ? messages.map((message) => <Message key={message.id} message={message}/>) : <p className="rounded-lg border border-dashed border-boh-border-light p-3 text-xs leading-5 text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub">Describe the page you need. The bounded assistant creates static HTML only—no autonomous actions or backend execution.</p>}</div><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} rows={3} placeholder="Create a polished launch page for…" className="mt-3 resize-none rounded-lg border border-boh-border-light bg-boh-bg-light p-3 text-sm outline-none focus:border-boh-primary dark:border-boh-border dark:bg-boh-bg"/><button disabled={busy || !instruction.trim()} className={`${primary} mt-2 w-full`} onClick={() => void send()}><Send size={15}/>{busy ? "Working…" : "Apply instruction"}</button></section>
      </aside>
      <main className={`${panel} flex min-h-[44rem] min-w-0 flex-col overflow-hidden`}><div className="flex items-center justify-between border-b border-boh-border-light px-4 py-3 dark:border-boh-border"><div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedAsset?.title}</p><p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Sandboxed browser preview</p></div><button disabled={busy || !activeFile} className={secondary} onClick={() => void saveDraft()}><Save size={15}/>Save draft</button></div><div className="flex-1 bg-[#eef2ef] p-3 sm:p-5">{previewHtml ? <iframe title={`${selectedAsset?.title ?? "Asset"} preview`} sandbox="" srcDoc={previewHtml} className="h-full min-h-[38rem] w-full rounded-lg border border-boh-border-light bg-white shadow-sm"/> : <div className="grid h-full min-h-[38rem] place-items-center text-sm text-boh-text-sub-light">Select an HTML file to preview.</div>}</div></main>
      <aside className={`${panel} min-h-[44rem] overflow-hidden`}><div role="tablist" aria-label="Asset detail" className="grid grid-cols-3 border-b border-boh-border-light dark:border-boh-border">{(["files","versions","review"] as StudioTab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`border-b-2 px-2 py-3 text-xs font-semibold capitalize ${tab === item ? "border-boh-primary text-boh-primary" : "border-transparent text-boh-text-sub-light dark:text-boh-text-sub"}`}>{item}</button>)}</div>
        <div className="p-4">{tab === "files" && <div><h2 className="text-sm font-semibold">Working files</h2><div className="mt-3 space-y-2">{files.map((file) => <button key={file.id} onClick={() => { setActiveFileId(file.id); setPreviewOverride(null); }} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs ${activeFile?.id === file.id ? "border-boh-primary bg-boh-primary/10" : "border-boh-border-light dark:border-boh-border"}`}><FileCode2 size={14}/><span className="truncate">{file.path}</span></button>)}</div>{activeFile && <><label htmlFor="source-editor" className="mt-5 block text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub">Source</label><textarea id="source-editor" spellCheck={false} value={source} onChange={(event) => { setSource(event.target.value); setPreviewOverride(null); }} className="mt-2 h-80 w-full resize-y rounded-lg border border-boh-border-light bg-boh-bg-light p-3 font-mono text-[11px] leading-5 outline-none focus:border-boh-primary dark:border-boh-border dark:bg-boh-bg"/></>}</div>}
        {tab === "versions" && <div><div className="flex items-center gap-2"><History size={16} className="text-boh-primary"/><h2 className="text-sm font-semibold">Saved versions</h2></div><input value={versionSummary} onChange={(event) => setVersionSummary(event.target.value)} placeholder="What changed?" className="mt-3 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-sm outline-none focus:border-boh-primary dark:border-boh-border dark:bg-boh-bg"/><button disabled={busy} className={`${primary} mt-2 w-full`} onClick={() => void saveVersion()}><Save size={15}/>Create version</button><div className="mt-4 space-y-2">{versions.map((version) => <button key={version.id} className="w-full rounded-lg border border-boh-border-light p-3 text-left dark:border-boh-border" onClick={() => { const html = version.file_snapshot.find((file) => file.path === "index.html")?.content; if (html) setPreviewOverride(html); }}><span className="text-xs font-semibold">Version {version.version_number}</span><p className="mt-1 line-clamp-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{version.change_summary}</p><p className="mt-2 text-[10px] text-boh-text-sub-light">{new Date(version.created_at).toLocaleString()}</p></button>)}{!versions.length && <p className="text-xs text-boh-text-sub-light">No saved versions yet.</p>}</div></div>}
        {tab === "review" && <div><div className="flex items-center gap-2"><Check size={16} className="text-boh-primary"/><h2 className="text-sm font-semibold">Review</h2></div><div className="mt-4 rounded-lg bg-boh-bg-light p-3 dark:bg-boh-bg"><p className="text-[10px] font-bold uppercase tracking-wide text-boh-text-sub-light">Current state</p><p className="mt-1 text-sm font-semibold capitalize">{selectedAsset?.review_state.replace("_", " ")}</p></div><p className="mt-4 text-xs leading-5 text-boh-text-sub-light dark:text-boh-text-sub">Review applies to the selected canonical Cookbook asset. Saved versions remain immutable.</p><div className="mt-4 grid gap-2"><button disabled={busy} className={secondary} onClick={() => void review("ready")}>Ready for review</button><button disabled={busy} className={secondary} onClick={() => void review("changes_requested")}>Request changes</button><button disabled={busy || !versions.length} className={primary} onClick={() => void review("approved")}><Check size={15}/>Approve current asset</button></div></div>}</div>
      </aside>
    </div>}
    {showNew && <NewAssetSheet onClose={() => setShowNew(false)} onCreated={(asset) => { setShowNew(false); setAssets((current) => [asset, ...current]); setSelectedId(asset.id); }}/>}
  </div>;
}
