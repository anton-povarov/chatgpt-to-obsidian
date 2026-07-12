# Use Visible DOM with Best-Effort Session Metadata

The Visible Branch and its rendered content will be extracted from ChatGPT's conversation message containers in the page DOM, excluding surrounding application chrome. The extension may read same-session ChatGPT conversation data to enrich responses with model names and timestamps, but content export must still succeed when that undocumented metadata source changes or is unavailable; authentication cookies and tokens are never exported or persisted.
