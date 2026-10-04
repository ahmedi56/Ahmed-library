import { useEffect, useRef, useState } from 'react';
import { X, Upload, Trash2, Film, FileText } from 'lucide-react';
import { useCustomization } from '../../hooks/useCustomization';
import { fileToDataUrl } from '../../lib/imageProcessing';
import {
  readFileAsDataUrl,
  MAX_INLINE_VIDEO_BYTES,
  MAX_INLINE_PDF_BYTES,
  MAX_INLINE_IMAGE_CHARS,
  dataUrlBytes,
} from '../../lib/fileData';
import { firebaseConfigured } from '../../lib/firebaseClient';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  useCloseOnEscape(open, onClose);

  // Same reasoning as Navigation/BookContent: free the cursor so the form
  // controls are actually usable once Pointer Lock has captured it.
  useEffect(() => {
    if (open) document.exitPointerLock();
  }, [open]);

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl outline-none border border-ink/10 bg-paper/98 p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.65rem] tracking-[0.4em] text-brass">ROOM SETTINGS</p>
            <h2 id="settings-title" className="mt-2 font-serif text-2xl text-ink sm:text-3xl">
              Frames &amp; Photo
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full border border-ink/15 p-2 text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink/60">
          Choose what appears in each wall frame, in the small photo frame by the bed, and on the
          wall TV. Everything here is saved to the database and stays set the next time anyone opens
          the library.
        </p>

        <SaveErrorBanner />

        {!firebaseConfigured && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Database not configured. Changes made now will work for this visit but won't be saved.
            Add the VITE_FIREBASE_* keys to .env to persist them.
          </p>
        )}

        <div className="mt-6 space-y-4">
          <CertificateRows />
        </div>

        <div className="mt-6 border-t border-ink/10 pt-6">
          <PhotoRow />
        </div>

        <div className="mt-6 border-t border-ink/10 pt-6">
          <ResumeRow />
        </div>

        <div className="mt-6 border-t border-ink/10 pt-6">
          <ProjectRows />
        </div>
      </div>
    </div>
  );
}

/**
 * Frames, photo and wall-TV edits save in the background a moment after
 * the last change, so a failure can't be reported by the control that
 * caused it. It goes here instead, and stays until that save succeeds.
 */
function SaveErrorBanner() {
  const { saveError } = useCustomization();
  if (!saveError) return null;
  return (
    <p
      role="alert"
      className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-700"
    >
      {saveError}
    </p>
  );
}

function CertificateRows() {
  const { certificates, setCertificateImage, setCertificateTitle } = useCustomization();

  return (
    <>
      {certificates.map((c, i) => (
        <ImageSlotRow
          key={c.id}
          label={`Frame ${i + 1}`}
          title={c.title}
          onTitleChange={(title) => setCertificateTitle(c.id, title)}
          image={c.image}
          onImageChange={(image) => setCertificateImage(c.id, image)}
        />
      ))}
    </>
  );
}

function PhotoRow() {
  const { photo, setPhoto } = useCustomization();
  return (
    <ImageSlotRow label="Bedside photo" image={photo} onImageChange={setPhoto} />
  );
}

/**
 * The downloadable CV.
 *
 * Uploading here replaces the file at `identity.resumeUrl` without a
 * redeploy, which is the point: a CV changes more often than the site
 * does. The committed file stays as the fallback, so removing the upload
 * reverts to it rather than leaving visitors with no CV at all.
 */
function ResumeRow() {
  const { resume, setResume } = useCustomization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    // Checked before reading, same reasoning as the video upload: turning
    // a 20 MB scan into base64 first would spend real memory only to find
    // out it can never be stored.
    if (file.size > MAX_INLINE_PDF_BYTES) {
      setError(
        `That file is ${Math.round(file.size / 1024)} KB. The database can hold ${Math.round(
          MAX_INLINE_PDF_BYTES / 1024
        )} KB, so compress the PDF or commit it to public/cv/ instead.`
      );
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('That is not a PDF. Export the CV as PDF and try again.');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await setResume({ dataUrl, filename: file.name, size: file.size });
      flashSaved();
    } catch (err) {
      // Surfaced, not swallowed — see setResume's comment.
      setError(err instanceof Error ? `Could not save: ${err.message}` : 'Could not save that file.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      await setResume(null);
      flashSaved();
    } catch {
      setError('Could not remove the stored CV.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-[0.65rem] tracking-[0.4em] text-brass">CV</p>
      <p className="mt-2 mb-4 text-sm leading-relaxed text-ink/60">
        Upload the PDF visitors download from the CV button. Replacing it here updates the live site
        straight away — no redeploy. Max {Math.round(MAX_INLINE_PDF_BYTES / 1024)} KB.
      </p>

      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-ink/5 text-ink/30">
          <FileText size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] tracking-[0.25em] text-ink/40">CURRENT CV</p>
          {resume ? (
            <p className="mt-1 truncate text-sm text-ink/70">
              {resume.filename} ({Math.round(resume.size / 1024)} KB)
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/50">
              Nothing uploaded — the committed file in public/cv/ is used, if present.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] text-ink transition hover:border-brass hover:text-brass disabled:opacity-50"
          >
            <Upload size={12} />
            {busy ? 'SAVING…' : resume ? 'REPLACE' : 'UPLOAD'}
          </button>
          {resume && (
            <button
              onClick={() => void handleRemove()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] text-ink/60 transition hover:border-red-400 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 size={12} />
              REMOVE
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {saved && <p className="mt-2 text-xs text-green-700">Saved.</p>}
      {error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}
    </>
  );
}

interface ImageSlotRowProps {
  label: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  image: string | null;
  onImageChange: (image: string | null) => void;
}

function ImageSlotRow({ label, title, onTitleChange, image, onImageChange }: ImageSlotRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      // Checked after resizing, unlike the video and CV: the original's
      // size says little about what a 900 px JPEG of it will weigh.
      if (dataUrl.length > MAX_INLINE_IMAGE_CHARS) {
        setError(
          `Even resized, that image is ${Math.round(dataUrl.length / 1024)} KB and a frame can hold ${Math.round(
            MAX_INLINE_IMAGE_CHARS / 1024
          )} KB. Try a smaller or less detailed picture.`
        );
        return;
      }
      onImageChange(dataUrl);
    } catch {
      // The previous image stays in place.
      setError('Could not read that image. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 p-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-ink/5">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[0.55rem] tracking-widest text-ink/30">
              EMPTY
            </div>
          )}
        </div>
  
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] tracking-[0.25em] text-ink/40">{label.toUpperCase()}</p>
          {onTitleChange ? (
            <input
              value={title ?? ''}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label={`${label} caption`}
              placeholder="e.g. Bachelor's Degree"
              className="mt-1 w-full rounded-md border border-ink/15 bg-transparent px-2 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
            />
          ) : (
            <p className="mt-1 text-sm text-ink/70">Small frame near the bed</p>
          )}
        </div>
  
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] text-ink transition hover:border-brass hover:text-brass disabled:opacity-50"
          >
            <Upload size={12} />
            {busy ? 'LOADING…' : image ? 'REPLACE' : 'UPLOAD'}
          </button>
          {image && (
            <button
              onClick={() => onImageChange(null)}
              className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] text-ink/60 transition hover:border-red-400 hover:text-red-500"
            >
              <Trash2 size={12} />
              REMOVE
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}
    </div>
  );
}


/**
 * The wall TV's slots — one row per entry in data/projectVideos.ts, so
 * adding a project there adds its row here with no change to this file.
 *
 * Text is edited here directly; the clip is given as a URL rather than
 * uploaded. Firestore caps a document at 1 MiB and Firebase Storage needs
 * a paid plan, so a real video file has nowhere to go on the free tier.
 * Pointing at a file already on the web (or at /videos/name.mp4 in this
 * project) works on any plan and keeps the whole playlist editable
 * without a code change.
 */
function ProjectRows() {
  const { projects } = useCustomization();

  return (
    <>
      <p className="text-[0.65rem] tracking-[0.4em] text-brass">WALL TV</p>
      <p className="mt-2 mb-4 text-sm leading-relaxed text-ink/60">
        Each slot shows a card with this text, and plays a clip if you add one. Leave the clip empty
        to show the card on its own.
      </p>

      <div className="space-y-4">
        {projects.map((p, i) => (
          <ProjectRow key={p.id} slot={i + 1} />
        ))}
      </div>
    </>
  );
}

const FIELD =
  'mt-1 w-full rounded-md border border-ink/15 bg-transparent px-2 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass';

function ProjectRow({ slot }: { slot: number }) {
  const { projects, setProject } = useCustomization();
  const project = projects[slot - 1];
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!project) return null;
  const { id, src } = project;
  const uploaded = src.startsWith('data:');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    // Checked before reading, not after: a phone recording can be tens of
    // megabytes, and turning that into a base64 string first would spend
    // real memory just to discover it can never be saved.
    if (file.size > MAX_INLINE_VIDEO_BYTES) {
      setError(
        `That clip is ${Math.round(file.size / 1024)} KB. The database can hold ${Math.round(
          MAX_INLINE_VIDEO_BYTES / 1024
        )} KB per slot, so use a link for anything larger.`
      );
      return;
    }

    setBusy(true);
    try {
      setProject(id, { src: await readFileAsDataUrl(file) });
    } catch {
      setError('Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink/10 p-3">
      <p className="text-[0.6rem] tracking-[0.25em] text-ink/40">{`SLOT ${slot}`}</p>

      <input
        value={project.title}
        onChange={(e) => setProject(id, { title: e.target.value })}
        aria-label={`Slot ${slot} project name`}
        placeholder="e.g. Freshly…"
        className={FIELD}
      />
      <input
        value={project.stack}
        onChange={(e) => setProject(id, { stack: e.target.value })}
        aria-label={`Slot ${slot} tech stack`}
        placeholder="Tech stack, e.g. React · Node · SQLite"
        className={FIELD}
      />
      <textarea
        value={project.description}
        onChange={(e) => setProject(id, { description: e.target.value })}
        aria-label={`Slot ${slot} description`}
        placeholder="One or two sentences about it…"
        rows={2}
        className={`${FIELD} resize-y`}
      />

      {/* An uploaded clip is a base64 string thousands of characters long,
          so it gets a summary chip rather than being dumped into a text
          box the owner would have to scroll through. */}
      {uploaded ? (
        <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-ink/15 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm text-ink/70">
            <Film size={14} />
            Uploaded clip ({Math.round(dataUrlBytes(src) / 1024)} KB)
          </span>
          <button
            onClick={() => setProject(id, { src: '' })}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-2.5 py-1 text-[0.6rem] tracking-[0.15em] text-ink/60 transition hover:border-red-400 hover:text-red-500"
          >
            <Trash2 size={11} />
            REMOVE
          </button>
        </div>
      ) : (
        <input
          value={src}
          onChange={(e) => setProject(id, { src: e.target.value })}
          aria-label={`Slot ${slot} video link`}
          inputMode="url"
          spellCheck={false}
          placeholder="Video link, e.g. /videos/name.mp4"
          className={FIELD}
        />
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.6rem] tracking-[0.15em] text-ink transition hover:border-brass hover:text-brass disabled:opacity-50"
        >
          <Upload size={12} />
          {busy ? 'READING…' : uploaded ? 'REPLACE CLIP' : 'UPLOAD CLIP'}
        </button>
        <span className="text-[0.6rem] text-ink/40">
          max {Math.round(MAX_INLINE_VIDEO_BYTES / 1024)} KB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}
    </div>
  );
}
