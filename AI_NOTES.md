## The hardest bug (and how I actually found it)

This turned out to be three connected bugs, discovered in sequence as each fix
exposed the next layer.

**Bug 1 — deprecated embedding model (silent 404).** Every chat request
returned nothing, with Render logs showing a bare `"SSE stream failed"` and a
404 ApiError with no indication of what had 404'd. Tracing the call graph
(chat.routes → chat.service → rag.service → embeddings.ts) showed the model
name `text-embedding-004` had been shut down by Google on Jan 14, 2026. Every
retrieval call embeds the user's question before searching, so this broke
100% of chat requests regardless of workspace or content.

**Bug 2 — corrupted embeddings already in the database.** After fixing the
model name, chat still failed, now with a different, more specific error:
`different vector dimensions 16 and 768`. The ingestion pipeline has a
fallback path that inserts a 16-dimension zero-vector placeholder when the
real embedding call fails — intended for local/offline dev, but it had fired
in production during the outage window in Bug 1, silently, with no visible
failure state on the document. Re-uploading the same file didn't fix it,
because the fallback fired again (the API key/model issue wasn't fully
resolved yet at that point). Root cause was confirmed by querying
`document_chunks` directly and finding rows where `vector_dims(embedding) = 16`
sitting next to normal 768-dim rows. Fixed by deleting the corrupted rows and
their parent document records, then re-ingesting cleanly.

**Bug 3 — tool results never reaching the final answer in streaming mode.**
Once retrieval was healthy, `summarize_document` and other tool calls executed
successfully (visible in `toolEvents` with real, correct output — full resume
text was fetched and summarized correctly by the tool), but the user-facing
answer still said "I don't know based on the documents in this workspace."
The non-streaming code path (`generateReply`) already looped correctly:
tool call → feed result back to Gemini → get final text. The streaming path
(`streamReplyTokens`) did not — it executed the tool, yielded a `tool_event`,
and then fell straight through to the "I don't know" fallback because it
never sent the tool's result back to the model for a concluding response.
Fixed by rewriting the streaming loop to match the non-streaming pattern:
after any function call, feed the result back via `sendMessageStream` again
and keep looping until the model produces plain text with no further calls.

**Lesson:** each of these three bugs individually produced the same visible
symptom to the end user (chat either silent or answering "I don't know"), but
each had a distinct root cause at a different layer — provider-side model
deprecation, a dev-only fallback leaking into production, and an incomplete
port of tool-calling logic between the streaming and non-streaming code
paths. Fixing the first surfaced the second; fixing the second surfaced the
third. Treating "no answer" as one bug rather than tracing each new error
signature to its own cause would have led to guessing rather than a real fix
each time.
