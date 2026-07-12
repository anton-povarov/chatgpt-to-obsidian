import { useEffect, useState } from 'react';

import { DEFAULT_EXPORT_PROFILE } from '../../src/domain/export-profile';
import type { CollectionDiagnostics } from '../../src/domain/conversation-draft';
import {
  COLLECT_CONVERSATION,
  GET_STRUCTURED_DEBUG_LOG,
  isCollectionProgressMessage,
  type CollectConversationResponse,
  type GetStructuredDebugLogResponse,
} from '../../src/messaging/conversation';
import {
  formatObsidianDateTime,
  renderConversationMarkdown,
} from '../../src/rendering/conversation-markdown';

type PopupState =
  | {
      status: 'loading';
      messagesCollected?: number;
      pass?: number;
      position?: number;
      maximumPosition?: number;
      elapsedMs?: number;
      stablePasses?: number;
    }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      title: string;
      markdown: string;
      warnings: string[];
      method?: 'structured-data' | 'dom-scroll';
      diagnostics?: CollectionDiagnostics;
    };

export function App() {
  const [state, setState] = useState<PopupState>({ status: 'loading' });
  const [debugDownload, setDebugDownload] = useState<
    { status: 'idle' | 'downloading' | 'success' } | { status: 'error'; message: string }
  >({ status: 'idle' });

  useEffect(() => {
    let active = true;
    void collectCurrentConversation((progress) => {
      if (active) {
        setState({ status: 'loading', ...progress });
      }
    }).then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="popup">
      <header>
        <p className="eyebrow">Vault export</p>
        <h1>ChatGPT to Obsidian</h1>
      </header>

      {state.status === 'loading' && (
        <p className="status">
          {state.messagesCollected === undefined
            ? 'Preparing to read the current conversation…'
            : formatProgress(state)}
        </p>
      )}

      {state.status === 'error' && (
        <section className="notice notice-error" role="alert">
          <h2>Could not read this page</h2>
          <p>{state.message}</p>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <label>
            <span>Note title</span>
            <input defaultValue={state.title} />
          </label>

          {state.method && (
            <p className="collection-method">
              Collection method:{' '}
              {state.method === 'structured-data'
                ? 'ChatGPT structured conversation data'
                : 'visible DOM scrolling'}
            </p>
          )}

          {state.warnings.map((warning) => (
            <p className="notice" role="status" key={warning}>
              {warning}
            </p>
          ))}

          {state.diagnostics && <CollectionDiagnosticsView diagnostics={state.diagnostics} />}

          <section className="debug-export">
            <button
              type="button"
              disabled={debugDownload.status === 'downloading'}
              onClick={() => {
                setDebugDownload({ status: 'downloading' });
                void downloadStructuredDebugLog(state.title).then(setDebugDownload);
              }}
            >
              {debugDownload.status === 'downloading'
                ? 'Preparing diagnostic JSON…'
                : 'Download structured JSON (sensitive)'}
            </button>
            <p>
              Includes the raw Conversation response, hidden branches, and parse outcomes. Review
              before sharing.
            </p>
            {debugDownload.status === 'success' && (
              <p className="download-success" role="status">
                Diagnostic JSON downloaded.
              </p>
            )}
            {debugDownload.status === 'error' && (
              <p className="download-error" role="alert">
                {debugDownload.message}
              </p>
            )}
          </section>

          <label>
            <span>Markdown preview</span>
            <textarea defaultValue={state.markdown} spellCheck={false} />
          </label>
        </>
      )}
    </main>
  );
}

async function downloadStructuredDebugLog(
  conversationTitle: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { status: 'error', message: 'The active ChatGPT tab is no longer available.' };
    }

    const response = (await browser.tabs.sendMessage(tab.id, {
      type: GET_STRUCTURED_DEBUG_LOG,
    })) as GetStructuredDebugLogResponse;
    if (!response.ok || !response.log) {
      return {
        status: 'error',
        message: response.error ?? 'No structured Conversation response is available.',
      };
    }

    const json = JSON.stringify(response.log, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${diagnosticFilenameStem(conversationTitle)}-structured.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { status: 'success' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? `Could not download diagnostic JSON: ${error.message}`
          : 'Could not download diagnostic JSON.',
    };
  }
}

function diagnosticFilenameStem(title: string): string {
  const stem = title
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\p{Cc}/gu, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return stem || 'chatgpt-conversation';
}

async function collectCurrentConversation(
  onProgress: (progress: Omit<Extract<PopupState, { status: 'loading' }>, 'status'>) => void,
): Promise<PopupState> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) {
    return { status: 'error', message: 'Open a conversation on chatgpt.com and try again.' };
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const progressListener = (message: unknown): void => {
    if (isCollectionProgressMessage(message) && message.requestId === requestId) {
      onProgress({
        messagesCollected: message.messagesCollected,
        pass: message.pass,
        position: message.position,
        maximumPosition: message.maximumPosition,
        elapsedMs: message.elapsedMs,
        stablePasses: message.stablePasses,
      });
    }
  };

  browser.runtime.onMessage.addListener(progressListener);

  try {
    const response = (await browser.tabs.sendMessage(tab.id, {
      type: COLLECT_CONVERSATION,
      requestId,
    })) as CollectConversationResponse;

    if (!response.ok || !response.result) {
      return { status: 'error', message: response.error ?? 'No conversation data was returned.' };
    }

    return {
      status: 'ready',
      title: response.result.draft.title,
      markdown: renderConversationMarkdown(response.result.draft, {
        exportedAt: formatObsidianDateTime(new Date()),
        tags: [...DEFAULT_EXPORT_PROFILE.defaultTags],
      }),
      warnings: response.result.warnings,
      method: response.result.method,
      diagnostics: response.result.diagnostics,
    };
  } catch (error) {
    const details = error instanceof Error ? ` (${error.message})` : '';
    return {
      status: 'error',
      message: `Reload the ChatGPT tab so the newly installed content script can connect.${details}`,
    };
  } finally {
    browser.runtime.onMessage.removeListener(progressListener);
  }
}

function formatProgress(state: Extract<PopupState, { status: 'loading' }>): string {
  const percentage =
    state.maximumPosition && state.position !== undefined
      ? Math.round((state.position / state.maximumPosition) * 100)
      : 0;
  const elapsedSeconds = ((state.elapsedMs ?? 0) / 1000).toFixed(1);
  const stability = state.stablePasses ? `, stable ${state.stablePasses}` : '';

  return `Reading the current conversation… ${state.messagesCollected} messages, pass ${state.pass}, ${percentage}% of current scroll range, ${elapsedSeconds}s${stability}.`;
}

function CollectionDiagnosticsView({ diagnostics }: { diagnostics: CollectionDiagnostics }) {
  const scroll = ({ position, maximum }: { position: number; maximum: number }) =>
    `${Math.round(position)} / ${Math.round(maximum)}`;

  return (
    <details className="diagnostics" open>
      <summary>Collection diagnostics</summary>
      <dl>
        <dt>Termination</dt>
        <dd>{diagnostics.termination}</dd>
        <dt>Elapsed / passes</dt>
        <dd>
          {(diagnostics.elapsedMs / 1000).toFixed(1)}s / {diagnostics.passes}
        </dd>
        <dt>Messages (initial / traversal / merged)</dt>
        <dd>
          {diagnostics.initialMessages} / {diagnostics.traversedMessages} /{' '}
          {diagnostics.finalMessages}
        </dd>
        <dt>Scroll (initial)</dt>
        <dd>{scroll(diagnostics.originalScroll)}</dd>
        <dt>Scroll (last pass)</dt>
        <dd>{scroll(diagnostics.lastScroll)}</dd>
        <dt>Scroll (restored)</dt>
        <dd>{scroll(diagnostics.restoredScroll)}</dd>
      </dl>
    </details>
  );
}
