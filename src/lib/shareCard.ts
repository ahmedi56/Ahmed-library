import { CHALLENGES } from '../hooks/useChallenges';
import { identity } from '../data/books';

/**
 * Sharing the borrower's card: a line of text with the site's link, and a
 * 1200×630 picture of the card (the size LinkedIn, X and WhatsApp preview
 * at) drawn on a canvas in the room's own paper-and-brass look.
 *
 * Nothing leaves the browser except through the visitor's own share sheet,
 * clipboard or download — no upload, no server.
 */

export interface CardSummary {
  earned: Readonly<Record<string, number>>;
  rank: string;
  requiredDone: number;
  requiredTotal: number;
  complete: boolean;
}

const SECRETS = CHALLENGES.filter((c) => c.secret);
const OWNER = identity.name
  .toLowerCase()
  .replace(/\b\w/g, (c) => c.toUpperCase());

/** The site's own address, without whatever ?book= or ?time= is in the bar. */
function siteUrl() {
  return `${window.location.origin}/`;
}

export function shareText(s: CardSummary): string {
  const secrets = SECRETS.filter((c) => s.earned[c.id]).length;
  const secretPart = secrets > 0 ? ` and ${secrets} of ${SECRETS.length} secrets` : '';
  return s.complete
    ? `I made ${s.rank} in ${OWNER}'s 3D library: every stamp on the card${secretPart}. Can you fill yours?`
    : `I'm a ${s.rank} in ${OWNER}'s 3D library: ${s.requiredDone} of ${s.requiredTotal} stamps${secretPart} so far. Come and explore.`;
}

const PAPER = '#f5efe4';
const INK = '#241a10';
const BRASS = '#c9a05c';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, at: number | undefined) {
  ctx.save();
  if (!at) {
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(36,26,16,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = BRASS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.round(r * 0.36)}px Fraunces, Georgia, serif`;
  ctx.fillText('DUE', 0, -r * 0.24);
  ctx.font = `600 ${Math.round(r * 0.34)}px Fraunces, Georgia, serif`;
  ctx.fillText(new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(at), 0, r * 0.26);
  ctx.restore();
}

/** The card as a PNG. */
export async function drawCardImage(s: CardSummary): Promise<Blob> {
  // Draw with the site's own type, not the fallback, if it can be had.
  await Promise.allSettled([
    document.fonts.load('600 64px Fraunces'),
    document.fonts.load('500 24px Fraunces'),
    document.fonts.load('400 26px Inter'),
  ]);

  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  roundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 64px Fraunces, Georgia, serif';
  ctx.fillText('Borrower’s card', 100, 160);
  ctx.fillStyle = 'rgba(36,26,16,0.6)';
  ctx.font = '400 26px Inter, system-ui, sans-serif';
  ctx.fillText(`${OWNER}’s library`, 102, 204);

  // Rank, right-aligned opposite the title.
  ctx.textAlign = 'right';
  ctx.fillStyle = BRASS;
  ctx.font = '600 44px Fraunces, Georgia, serif';
  ctx.fillText(s.rank, W - 100, 150);
  ctx.fillStyle = 'rgba(36,26,16,0.6)';
  ctx.font = '400 24px Inter, system-ui, sans-serif';
  ctx.fillText(`${s.requiredDone} of ${s.requiredTotal} stamps`, W - 100, 192);
  ctx.textAlign = 'left';

  // Progress rule.
  ctx.fillStyle = 'rgba(36,26,16,0.1)';
  roundRect(ctx, 100, 240, W - 200, 8, 4);
  ctx.fill();
  ctx.fillStyle = BRASS;
  roundRect(ctx, 100, 240, Math.max(8, (W - 200) * (s.requiredDone / s.requiredTotal)), 8, 4);
  ctx.fill();

  // Every challenge in card order; secrets only once found.
  const shown = CHALLENGES.filter((c) => !c.secret || s.earned[c.id]);
  // No titles under them: eleven labels across 1000 px collide, and the
  // dated stamps carry the picture on their own.
  const r = 40;
  const gap = (W - 200 - shown.length * r * 2) / Math.max(shown.length - 1, 1);
  shown.forEach((c, i) => {
    drawStamp(ctx, 100 + r + i * (r * 2 + gap), 360, r, s.earned[c.id]);
  });

  ctx.fillStyle = INK;
  ctx.font = '500 30px Fraunces, Georgia, serif';
  ctx.fillText(s.complete ? 'Every stamp collected. Can you fill yours?' : 'Can you fill yours?', 100, 510);
  ctx.fillStyle = 'rgba(36,26,16,0.5)';
  ctx.font = '400 22px Inter, system-ui, sans-serif';
  ctx.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), 100, 548);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the card.'))), 'image/png')
  );
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * The visitor's own share sheet where there is one (phones, some desktops),
 * with the card image attached when the browser accepts files; otherwise
 * the text and link go on the clipboard.
 */
export async function shareCard(s: CardSummary): Promise<ShareOutcome> {
  const text = shareText(s);
  const url = siteUrl();

  if (navigator.share) {
    try {
      const blob = await drawCardImage(s).catch(() => null);
      const file = blob ? new File([blob], 'borrowers-card.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text, url, files: [file] });
      } else {
        await navigator.share({ text, url });
      }
      return 'shared';
    } catch (err) {
      // Closing the share sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return 'copied';
}

export async function downloadCardImage(s: CardSummary) {
  const blob = await drawCardImage(s);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = 'borrowers-card.png';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 5000);
}
