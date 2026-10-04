import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface State {
  failed: boolean;
}

/**
 * Catches anything the 3D room throws and hands control back so the app
 * can show the flat view instead of a blank page.
 *
 * Two failure modes this covers, neither of which had any handling:
 *
 *   1. The room is behind a dynamic import now. If that chunk can't be
 *      fetched — a dropped mobile connection, or a tab left open across a
 *      redeploy so the hashed filename 404s — the import rejects, and
 *      without a boundary React unmounts the whole tree. The visitor gets
 *      a white screen on a portfolio that otherwise works perfectly.
 *   2. WebGL can fail at runtime after a clean start: a lost context, a
 *      driver bug, a GPU reset. Same white screen.
 *
 * The flat view is complete and already built, so there is no reason for
 * either to cost the visitor the whole site.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The 3D room failed; falling back to the flat view.', error, info);
    this.props.onError(error);
  }

  render() {
    // Render nothing on failure: the parent switches to the flat view on
    // the render triggered by onError, and re-mounting the thing that just
    // threw would only throw again.
    return this.state.failed ? null : this.props.children;
  }
}
