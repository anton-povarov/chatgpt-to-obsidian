import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PROFILE,
  type ExportProfile,
} from "../../src/domain/export-profile";
import {
  INITIAL_CONVERSATION_TAGS,
  formatTagsInput,
  parseTagsInput,
} from "../../src/domain/conversation-tags";
import type { CollectionDiagnostics } from "../../src/domain/conversation-draft";
import {
  COLLECT_CONVERSATION,
  GET_STRUCTURED_DEBUG_LOG,
  TOGGLE_EMBEDDED_POPUP,
  isCollectionProgressMessage,
  type CollectConversationResponse,
  type GetStructuredDebugLogResponse,
} from "../../src/messaging/conversation";
import {
  formatObsidianDateTime,
  renderConversationBody,
  renderConversationDocument,
} from "../../src/rendering/conversation-markdown";
import {
  loadExportProfile,
  saveExportProfile,
} from "../../src/storage/export-profile-storage";
import {
  saveToObsidian,
  type ObsidianSaveResult,
} from "../../src/obsidian/obsidian-save";
import {
  OPEN_OBSIDIAN_URI,
  type OpenObsidianUriResponse,
} from "../../src/messaging/obsidian";

type PopupState =
  | {
      status: "loading";
      messagesCollected?: number;
      pass?: number;
      position?: number;
      maximumPosition?: number;
      elapsedMs?: number;
      stablePasses?: number;
    }
  | { status: "error"; message: string }
  | {
      status: "ready";
      title: string;
      sourceUrl: string;
      exportedAt: string;
      markdownBody: string;
      warnings: string[];
      method?: "structured-data" | "dom-scroll";
      diagnostics?: CollectionDiagnostics;
    };

export function App() {
  const isEmbedded =
    new URLSearchParams(window.location.search).get("context") === "embedded";
  const [state, setState] = useState<PopupState>({ status: "loading" });
  const [profile, setProfile] = useState<ExportProfile>(() =>
    copyDefaultProfile(),
  );
  const [tagsInput, setTagsInput] = useState(() =>
    formatTagsInput(INITIAL_CONVERSATION_TAGS),
  );
  const [profileSave, setProfileSave] = useState<
    | { status: "idle" | "saving" | "saved" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const profileSaveVersion = useRef(0);
  const profileSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [debugDownload, setDebugDownload] = useState<
    | { status: "idle" | "downloading" | "success" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [obsidianSave, setObsidianSave] = useState<
    | { status: "idle" | "saving" }
    | { status: "sent"; file: string; usedFallback: boolean }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const obsidianSaveVersion = useRef(0);

  useEffect(() => {
    let active = true;
    void initializePopup();

    async function initializePopup(): Promise<void> {
      try {
        const loadedProfile = await loadExportProfile();
        if (active) {
          setProfile(loadedProfile);
        }
      } catch (error) {
        if (active) {
          setProfileSave({
            status: "error",
            message:
              error instanceof Error
                ? `Could not load export defaults: ${error.message}`
                : "Could not load export defaults.",
          });
        }
      }

      const nextState = await collectCurrentConversation((progress) => {
        if (active) {
          setState({ status: "loading", ...progress });
        }
      });
      if (active) {
        setState(nextState);
      }
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-embedded", isEmbedded);
    if (!isEmbedded) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        void closeEmbeddedPopup();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("is-embedded");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isEmbedded]);

  function persistProfile(nextProfile: ExportProfile): void {
    setProfile(nextProfile);
    const version = ++profileSaveVersion.current;
    setProfileSave({ status: "saving" });
    const save = profileSaveQueue.current.then(() =>
      saveExportProfile(nextProfile),
    );
    profileSaveQueue.current = save.catch(() => undefined);
    void save
      .then(() => {
        if (profileSaveVersion.current === version) {
          setProfileSave({ status: "saved" });
        }
      })
      .catch((error: unknown) => {
        if (profileSaveVersion.current === version) {
          setProfileSave({
            status: "error",
            message:
              error instanceof Error
                ? `Could not save export defaults: ${error.message}`
                : "Could not save export defaults.",
          });
        }
      });
  }

  return (
    <main className="popup">
      <header className="popup-header">
        <div>
          <h1>ChatGPT to Obsidian</h1>
        </div>
        {isEmbedded && (
          <button
            type="button"
            className="close-embedded"
            aria-label="Close ChatGPT to Obsidian"
            title="Close"
            onClick={() => void closeEmbeddedPopup()}
          >
            ×
          </button>
        )}
      </header>

      {state.status === "loading" && (
        <p className="status">
          {state.messagesCollected === undefined
            ? "Preparing to read the current conversation…"
            : formatProgress(state)}
        </p>
      )}

      {state.status === "error" && (
        <section className="notice notice-error" role="alert">
          <h2>Could not read this page</h2>
          <p>{state.message}</p>
        </section>
      )}

      {state.status === "ready" && (
        <>
          {state.method && (
            <p className="collection-method">
              Collection method:{" "}
              {state.method === "structured-data"
                ? "ChatGPT structured conversation data"
                : "visible DOM scrolling"}
            </p>
          )}

          {state.warnings.length > 0 && (
            <div className="editor-notices">
              {state.warnings.map((warning) => (
                <p className="notice" role="status" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          )}

          {state.diagnostics && (
            <CollectionDiagnosticsView diagnostics={state.diagnostics} />
          )}

          <section
            className="metadata-form"
            aria-label="Conversation Snapshot fields"
          >
            <label className="metadata-row">
              <span>Vault</span>
              <input
                value={profile.vault}
                placeholder="Last used vault"
                onChange={(event) => {
                  resetObsidianSave();
                  persistProfile({ ...profile, vault: event.target.value });
                }}
              />
            </label>
            <label className="metadata-row">
              <span>Folder</span>
              <input
                value={profile.folder}
                placeholder="ChatGPT"
                onChange={(event) => {
                  resetObsidianSave();
                  persistProfile({ ...profile, folder: event.target.value });
                }}
              />
            </label>
            <label className="metadata-row">
              <span>Title</span>
              <input
                value={state.title}
                onChange={(event) => {
                  resetObsidianSave();
                  setState({ ...state, title: event.target.value });
                }}
              />
            </label>
            <label className="metadata-row">
              <span>Tags</span>
              <input
                value={tagsInput}
                placeholder="chatgpt, reference"
                onChange={(event) => {
                  resetObsidianSave();
                  setTagsInput(event.target.value);
                }}
              />
            </label>
          </section>

          <div className="profile-status">
            {profileSave.status === "saving" && (
              <p className="profile-save-status" role="status">
                Saving defaults…
              </p>
            )}
            {profileSave.status === "saved" && (
              <p
                className="profile-save-status profile-save-success"
                role="status"
              >
                Defaults saved.
              </p>
            )}
            {profileSave.status === "error" && (
              <p className="notice notice-error" role="alert">
                {profileSave.message}
              </p>
            )}
          </div>

          <textarea
            className="markdown-editor"
            aria-label="Markdown preview"
            value={state.markdownBody}
            spellCheck={false}
            onChange={(event) => {
              resetObsidianSave();
              setState({ ...state, markdownBody: event.target.value });
            }}
          />

          <section className="debug-export">
            <button
              type="button"
              disabled={debugDownload.status === "downloading"}
              onClick={() => {
                setDebugDownload({ status: "downloading" });
                void downloadStructuredDebugLog(state.title).then(
                  setDebugDownload,
                );
              }}
            >
              {debugDownload.status === "downloading"
                ? "Preparing diagnostic JSON…"
                : "Download structured JSON (sensitive)"}
            </button>
            <p>
              Includes the raw Conversation response, hidden branches, and parse
              outcomes. Review before sharing.
            </p>
            {debugDownload.status === "success" && (
              <p className="download-success" role="status">
                Diagnostic JSON downloaded.
              </p>
            )}
            {debugDownload.status === "error" && (
              <p className="download-error" role="alert">
                {debugDownload.message}
              </p>
            )}
          </section>

          <section
            className="save-export"
            aria-label="Save Conversation Snapshot"
          >
            <button
              type="button"
              className="save-to-obsidian"
              disabled={obsidianSave.status === "saving"}
              onClick={() => {
                if (!state.markdownBody) {
                  setObsidianSave({
                    status: "error",
                    message: "The Markdown preview is empty.",
                  });
                  return;
                }
                const version = ++obsidianSaveVersion.current;
                setObsidianSave({ status: "saving" });
                void saveCurrentSnapshot({
                  vault: profile.vault,
                  folder: profile.folder,
                  title: state.title,
                  markdown: renderConversationDocument(state.markdownBody, {
                    title: state.title,
                    sourceUrl: state.sourceUrl,
                    exportedAt: state.exportedAt,
                    tags: parseTagsInput(tagsInput),
                  }),
                }).then((result) => {
                  if (obsidianSaveVersion.current !== version) {
                    return;
                  }
                  if (result.ok) {
                    setObsidianSave({
                      status: "sent",
                      file: result.file,
                      usedFallback: result.transfer === "uri-content",
                    });
                  } else {
                    setObsidianSave({
                      status: "error",
                      message: result.message,
                    });
                  }
                });
              }}
            >
              {obsidianSave.status === "saving"
                ? "Sending to Obsidian…"
                : "Save to Obsidian"}
            </button>
            {obsidianSave.status === "sent" && (
              <p className="save-success" role="status">
                Sent <strong>{obsidianSave.file}</strong> to Obsidian.
                {obsidianSave.usedFallback
                  ? " Clipboard access failed, so the complete Markdown was sent in the URI fallback."
                  : ""}{" "}
                If the note does not appear, open Obsidian and verify the vault
                name.
              </p>
            )}
            {obsidianSave.status === "error" && (
              <p className="notice notice-error" role="alert">
                {obsidianSave.message}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );

  function resetObsidianSave(): void {
    obsidianSaveVersion.current += 1;
    setObsidianSave({ status: "idle" });
  }
}

async function saveCurrentSnapshot(input: {
  vault: string;
  folder: string;
  title: string;
  markdown: string;
}): Promise<ObsidianSaveResult> {
  return saveToObsidian(input, {
    openUri: async (uri) => {
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id) {
          return {
            ok: false,
            message: "The active ChatGPT tab is no longer available.",
          };
        }

        const response = (await browser.runtime.sendMessage({
          type: OPEN_OBSIDIAN_URI,
          tabId: tab.id,
          uri,
        })) as OpenObsidianUriResponse | undefined;
        return (
          response ?? {
            ok: false,
            message:
              "The browser did not acknowledge the request to open Obsidian.",
          }
        );
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error
              ? `The browser could not send the request to Obsidian. ${error.message}`
              : "The browser could not send the request to Obsidian.",
        };
      }
    },
  });
}

async function closeEmbeddedPopup(): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, { type: TOGGLE_EMBEDDED_POPUP });
    }
  } catch {
    // Closing removes this iframe, so the sender can disappear before the response resolves.
  }
}

async function downloadStructuredDebugLog(
  conversationTitle: string,
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      return {
        status: "error",
        message: "The active ChatGPT tab is no longer available.",
      };
    }

    const response = (await browser.tabs.sendMessage(tab.id, {
      type: GET_STRUCTURED_DEBUG_LOG,
    })) as GetStructuredDebugLogResponse;
    if (!response.ok || !response.log) {
      return {
        status: "error",
        message:
          response.error ?? "No structured Conversation response is available.",
      };
    }

    const json = JSON.stringify(response.log, null, 2);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${diagnosticFilenameStem(conversationTitle)}-structured.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Could not download diagnostic JSON: ${error.message}`
          : "Could not download diagnostic JSON.",
    };
  }
}

function diagnosticFilenameStem(title: string): string {
  const stem = title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\p{Cc}/gu, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return stem || "chatgpt-conversation";
}

async function collectCurrentConversation(
  onProgress: (
    progress: Omit<Extract<PopupState, { status: "loading" }>, "status">,
  ) => void,
): Promise<PopupState> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.startsWith("https://chatgpt.com/")) {
    return {
      status: "error",
      message: "Open a conversation on chatgpt.com and try again.",
    };
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const progressListener = (message: unknown): void => {
    if (
      isCollectionProgressMessage(message) &&
      message.requestId === requestId
    ) {
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
      return {
        status: "error",
        message: response.error ?? "No conversation data was returned.",
      };
    }

    return {
      status: "ready",
      title: response.result.draft.title,
      sourceUrl: response.result.draft.sourceUrl,
      exportedAt: formatObsidianDateTime(new Date()),
      markdownBody: renderConversationBody(response.result.draft),
      warnings: response.result.warnings,
      method: response.result.method,
      diagnostics: response.result.diagnostics,
    };
  } catch (error) {
    const details = error instanceof Error ? ` (${error.message})` : "";
    return {
      status: "error",
      message: `Reload the ChatGPT tab so the newly installed content script can connect.${details}`,
    };
  } finally {
    browser.runtime.onMessage.removeListener(progressListener);
  }
}

function copyDefaultProfile(): ExportProfile {
  return {
    vault: DEFAULT_EXPORT_PROFILE.vault,
    folder: DEFAULT_EXPORT_PROFILE.folder,
  };
}

function formatProgress(
  state: Extract<PopupState, { status: "loading" }>,
): string {
  const percentage =
    state.maximumPosition && state.position !== undefined
      ? Math.round((state.position / state.maximumPosition) * 100)
      : 0;
  const elapsedSeconds = ((state.elapsedMs ?? 0) / 1000).toFixed(1);
  const stability = state.stablePasses ? `, stable ${state.stablePasses}` : "";

  return `Reading the current conversation… ${state.messagesCollected} messages, pass ${state.pass}, ${percentage}% of current scroll range, ${elapsedSeconds}s${stability}.`;
}

function CollectionDiagnosticsView({
  diagnostics,
}: {
  diagnostics: CollectionDiagnostics;
}) {
  const scroll = ({
    position,
    maximum,
  }: {
    position: number;
    maximum: number;
  }) => `${Math.round(position)} / ${Math.round(maximum)}`;

  return (
    <details className="diagnostics">
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
          {diagnostics.initialMessages} / {diagnostics.traversedMessages} /{" "}
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
