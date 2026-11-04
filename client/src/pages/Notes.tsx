import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Heading2, Highlighter, Italic, List, ListOrdered, NotebookPen, Pin, Plus, Quote, Search, Strikethrough, Trash2, Underline, ArrowLeft } from 'lucide-react';
import { api, fmtDateTime, type Note } from '../lib/api';
import { errMsg, toast } from '../store';
import { Empty, Spinner } from '../components/ui';

const COLORS: Record<string, string> = {
  default: 'bg-white dark:bg-slate-900',
  yellow: 'bg-yellow-50 dark:bg-yellow-500/10',
  green: 'bg-emerald-50 dark:bg-emerald-500/10',
  blue: 'bg-sky-50 dark:bg-sky-500/10',
  pink: 'bg-pink-50 dark:bg-pink-500/10',
  purple: 'bg-violet-50 dark:bg-violet-500/10',
};
const DOT: Record<string, string> = { default: 'bg-slate-300', yellow: 'bg-yellow-400', green: 'bg-emerald-400', blue: 'bg-sky-400', pink: 'bg-pink-400', purple: 'bg-violet-400' };
const clean = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark', 'h2', 'p', 'div', 'br', 'ul', 'ol', 'li', 'blockquote', 'span'], ALLOWED_ATTR: [] });
const plain = (html: string) => clean(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function Editor({ note, onSaved, onDelete, onBack }: { note: Note; onSaved: (n: Note) => void; onDelete: () => void; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = clean(note.contentHtml);
    setTitle(note.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note._id]);

  const save = useCallback(
    async (patch: Partial<Note>) => {
      setStatus('saving');
      try {
        const r = await api<{ note: Note }>(`/notes/${note._id}`, { method: 'PATCH', body: patch });
        onSaved(r.note);
        setStatus('saved');
      } catch (e) {
        setStatus('dirty');
        toast(errMsg(e), 'error');
      }
    },
    [note._id, onSaved],
  );

  const scheduleSave = () => {
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ title: title || 'Untitled', contentHtml: clean(ref.current?.innerHTML ?? '') }), 800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    scheduleSave();
  };
  const highlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) return toast('Select some text to highlight');
    const range = sel.getRangeAt(0);
    const mark = document.createElement('mark');
    try {
      range.surroundContents(mark);
    } catch {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    scheduleSave();
  };

  const tools = [
    { icon: Bold, label: 'Bold', on: () => exec('bold') },
    { icon: Italic, label: 'Italic', on: () => exec('italic') },
    { icon: Underline, label: 'Underline', on: () => exec('underline') },
    { icon: Strikethrough, label: 'Strikethrough', on: () => exec('strikeThrough') },
    { icon: Highlighter, label: 'Highlight', on: highlight },
    { icon: Heading2, label: 'Heading', on: () => exec('formatBlock', 'h2') },
    { icon: List, label: 'Bullet list', on: () => exec('insertUnorderedList') },
    { icon: ListOrdered, label: 'Numbered list', on: () => exec('insertOrderedList') },
    { icon: Quote, label: 'Quote', on: () => exec('formatBlock', 'blockquote') },
  ];

  return (
    <div className={`card flex min-h-[60vh] flex-col gap-3 ${COLORS[note.color]}`}>
      <div className="flex items-center gap-2">
        <button className="btn-ghost !p-2 lg:hidden" onClick={onBack} aria-label="Back to notes"><ArrowLeft size={18} /></button>
        <input
          className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setStatus('dirty'); clearTimeout(timer.current); timer.current = setTimeout(() => save({ title: e.target.value || 'Untitled' }), 800); }}
          placeholder="Untitled"
          aria-label="Note title"
        />
        <span className="shrink-0 text-xs text-slate-400">{status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Unsaved'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/70 pb-2 dark:border-slate-700">
        {tools.map(({ icon: Icon, label, on }) => (
          <button key={label} className="btn-ghost !p-1.5" onMouseDown={(e) => e.preventDefault()} onClick={on} title={label} aria-label={label}><Icon size={16} /></button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {Object.keys(COLORS).map((c) => (
            <button key={c} onClick={() => save({ color: c })} className={`h-5 w-5 rounded-full ${DOT[c]} ${note.color === c ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`} aria-label={`Color ${c}`} />
          ))}
          <button className={`btn-ghost !p-1.5 ${note.pinned ? 'text-brand-600' : ''}`} onClick={() => save({ pinned: !note.pinned })} aria-label={note.pinned ? 'Unpin' : 'Pin'}><Pin size={16} /></button>
          <button className="btn-danger !p-1.5" onClick={onDelete} aria-label="Delete note"><Trash2 size={16} /></button>
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="note-editor min-h-[40vh] flex-1 break-words outline-none"
        data-placeholder="Start writing… select text and use the toolbar to format or highlight."
        onInput={scheduleSave}
        onBlur={() => status === 'dirty' && save({ title: title || 'Untitled', contentHtml: clean(ref.current?.innerHTML ?? '') })}
      />
    </div>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api<{ notes: Note[] }>('/notes').then((r) => setNotes(r.notes)).catch((e) => toast(errMsg(e), 'error'));
  }, []);

  const create = async () => {
    try {
      const r = await api<{ note: Note }>('/notes', { method: 'POST', body: { title: 'Untitled', contentHtml: '' } });
      setNotes((n) => [r.note, ...(n ?? [])]);
      setActiveId(r.note._id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const del = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await api(`/notes/${id}`, { method: 'DELETE' });
    setNotes((n) => n?.filter((x) => x._id !== id) ?? null);
    setActiveId(null);
    toast('Note deleted');
  };
  const onSaved = useCallback((note: Note) => setNotes((n) => n?.map((x) => (x._id === note._id ? note : x)) ?? null), []);

  const s = search.toLowerCase();
  const visible = (notes ?? [])
    .filter((n) => !s || n.title.toLowerCase().includes(s) || plain(n.contentHtml).toLowerCase().includes(s))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const active = notes?.find((n) => n._id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Notes</h1>
        <button className="btn-primary" onClick={create}><Plus size={18} /> New note</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`space-y-3 ${active ? 'hidden lg:block' : ''}`}>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-9" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search notes" />
          </div>
          {!notes ? <Spinner /> : visible.length === 0 ? (
            <div className="card"><Empty icon={<NotebookPen />} title={notes.length ? 'No matching notes' : 'No notes yet'} hint="Capture ideas, meeting notes and plans with rich formatting." /></div>
          ) : visible.map((n) => (
            <button key={n._id} onClick={() => setActiveId(n._id)} className={`card block w-full text-left transition hover:shadow-md ${COLORS[n.color]} ${n._id === activeId ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-center gap-1">
                {n.pinned && <Pin size={13} className="shrink-0 text-brand-600" />}
                <p className="truncate font-semibold">{n.title || 'Untitled'}</p>
              </div>
              <p className="mt-1 line-clamp-2 break-words text-sm text-slate-500">{plain(n.contentHtml) || 'Empty note'}</p>
              <p className="mt-2 text-xs text-slate-400">{fmtDateTime(n.updatedAt)}</p>
            </button>
          ))}
        </div>
        <div className={`lg:col-span-2 ${active ? '' : 'hidden lg:block'}`}>
          {active ? (
            <Editor key={active._id} note={active} onSaved={onSaved} onDelete={() => del(active._id)} onBack={() => setActiveId(null)} />
          ) : (
            <div className="card"><Empty icon={<NotebookPen />} title="Select a note" hint="Or create a new one to start writing." action={<button className="btn-outline mt-2" onClick={create}>New note</button>} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
