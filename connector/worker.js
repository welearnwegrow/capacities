/*
 * Islands of Coherence — Notion → site connector
 * ------------------------------------------------
 * A Cloudflare Worker that reads your Notion "Resources" database and serves it
 * to the website as clean JSON, and accepts new "Suggest a resource" submissions
 * (written into Notion as Status = Pending).
 *
 * It holds your secret Notion token server-side, so the site can stay a free
 * static GitHub Pages site while still reading live data from Notion.
 *
 * Environment variables (Worker → Settings → Variables & Secrets):
 *   NOTION_TOKEN  — your Notion internal integration secret ("ntn_"/"secret_")   [Secret]
 *   NOTION_DB_ID  — the ID of your Resources database                          [Variable]
 *   QUERIES_DB_ID — the ID of your "Problem Statements from Guide Me" database   [Variable, optional]
 *   FEEDBACK_DB_ID — the ID of your "Guide Me Feedback" database                  [Variable, optional]
 *   ANTHROPIC_API_KEY — Anthropic API key, enables live AI matching via /ai      [Secret, optional]
 *
 * GET   /          → { resources: [ ... ] }
 * POST  /          → body {name, url, submitterName, submitterEmail} creates a Pending row
 * POST  /ai         → body {system, messages, model, max_tokens} → { text } (env ANTHROPIC_API_KEY)
 * POST  /cases      → body {context, exclude[]} → { cases:[{title,org,url,why}] } via web_search, verified links (env ANTHROPIC_API_KEY)
 *              /resources → body {context, exclude[]} → { resources:[{title,author,type,url,why}] } via web_search, verified links (env ANTHROPIC_API_KEY)
 * POST  /log-query  → body {problem, route[], areas[], resources[], matchedBy, consent} logs a Guide Me query (env QUERIES_DB_ID)
 * POST  /log-feedback → body {topic, rating, comment, email, turns} logs Guide Me exit feedback (env FEEDBACK_DB_ID)
 * POST  /subscribe → body {email} subscribes to the Substack newsletter
 *
 * Note: new submissions are created with Status = Pending and NO Description/Capacity.
 * Those are filled in during curation (in Notion, or by asking Claude to enrich the
 * pending rows), then Status is flipped to Approved to publish.
 */

const NOTION_VERSION = "2022-06-28";

// Notion's capacity-option names that differ from the framework's canonical labels.
// Left = what Notion sends, right = what the site expects. Add more as needed.
const CAP_ALIASES = {
  "Political Participation": "Advocacy & Political Participation",
  "Convening & Facilitating": "Convening & Facilitating Collaborations",
  "Critical Thinking and Reflexivity": "Critical Consciousness",
  "Critical Thinking & Reflexivity": "Critical Consciousness",
  "Cultural & Ancestral Inquiry": "Cultural & Epistemic Inquiry",
  "Cultural and Ancestral Inquiry": "Cultural & Epistemic Inquiry",
  "Data Analysis & Impact Evaluation": "Data Analysis & Evaluation",
  "Somatic Ecoregulation": "Somatic Eco-Regulation",
  "Spiritual and Moral Inquiry": "Spiritual & Moral Inquiry",
  "Systems Thinking and Modeling": "Systems Thinking & Modeling",
};
// The 24 canonical capacity labels the site expects.
const CANON = [
  "Somatic Eco-Regulation","Observing & Listening","Critical Consciousness",
  "Spiritual & Moral Inquiry","Socioeconomic & Political Inquiry","Agency & Expression",
  "Ecological & Planetary Inquiry","Cultural & Epistemic Inquiry","Systems Thinking & Modeling",
  "Complex Problem Solving","Futures Thinking & Foresight","Positionality & Power Analysis",
  "Regenerative Systems Design","Narrative & Media Analysis","Participatory Research & Design",
  "Data Analysis & Evaluation","Experimenting & Building","Convening & Facilitating Collaborations",
  "Conflict Transformation","Planning & Resource Mobilization","Leading in Complexity",
  "Ecosystem Engagement","Advocacy & Political Participation","Networking & Engaging Capital",
];
const CANON_LC = {};
CANON.forEach((c) => { CANON_LC[c.toLowerCase().replace(/\s+/g, " ").trim()] = c; });

function normalizeCap(name) {
  if (CAP_ALIASES[name]) return CAP_ALIASES[name];
  // generic fallback: treat " and " like " & "
  const swapped = name.replace(/\s+and\s+/gi, " & ");
  if (CAP_ALIASES[swapped]) return CAP_ALIASES[swapped];
  // case-insensitive match against the canonical labels (fixes capitalisation typos)
  const key = swapped.toLowerCase().replace(/\s+/g, " ").trim();
  return CANON_LC[key] || swapped;
}

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const u = new URL(request.url);
    const path = u.pathname.replace(/\/+$/, "");

    // ---- POST /ai: thin proxy to Anthropic so the live static site can do AI matching ----
    // The site sends {system, messages, model, max_tokens}; the worker adds the
    // secret key (env ANTHROPIC_API_KEY) and returns { text }. Model is restricted
    // to haiku/sonnet and tokens are capped. No-ops cleanly if the key isn't set.
    {
      if (request.method === "POST" && path === "/ai") {
        const key = env.ANTHROPIC_API_KEY;
        if (!key) return json({ error: "AI not configured (set ANTHROPIC_API_KEY)." }, 200, cors);
        const body = await request.json().catch(() => ({}));
        let model = String(body.model || "claude-sonnet-4-5");
        if (!/haiku|sonnet/i.test(model)) model = "claude-sonnet-4-5";
        const max_tokens = Math.min(Math.max(parseInt(body.max_tokens, 10) || 4000, 64), 8192);
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!messages.length) return json({ error: "Missing messages." }, 400, cors);
        try {
          const { ok, status, data } = await anthropicCall(key, { model, max_tokens, system: body.system ? [{ type: "text", text: String(body.system), cache_control: { type: "ephemeral" } }] : undefined, messages });
          if (!ok) return json({ error: "Anthropic error.", detail: (data && data.error && data.error.message) || ("HTTP " + status) }, 502, cors);
          const text = (data.content || []).map((c) => c.text || "").join("");
          return json({ text, cost: anthropicCost(data) }, 200, cors);
        } catch (e) {
          return json({ error: String((e && e.message) || e) }, 502, cors);
        }
      }
    }

    // ---- POST /cases: web-search-grounded real case studies with VERIFIED links ----
    // Body { context } → { cases: [{title, org, url, why}] }. Uses Anthropic's
    // server-side web_search tool so every url is a real page the model actually
    // visited (citations), never a guessed URL. No-ops cleanly without the key.
    {
      if (request.method === "POST" && path === "/cases") {
        const key = env.ANTHROPIC_API_KEY;
        if (!key) return json({ cases: [] }, 200, cors);
        const body = await request.json().catch(() => ({}));
        const context = String(body.context || "").slice(0, 6000).trim();
        if (!context) return json({ cases: [] }, 400, cors);
        const exclude = Array.isArray(body.exclude)
          ? body.exclude.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40)
          : [];
        const sys =
          "You are a systems-change research librarian. Given someone's situation, use web search to find up to 3 REAL, well-documented real-world cases whose experience offers a practical, transferable lesson for this person. " +
          "CAST A WIDE NET, BEYOND THE RESOURCE LIBRARY: a case can be a concrete initiative, organisation, programme, movement, city or regional project, cooperative, campaign, experiment, policy, or a documented body of work or writing — anything real that genuinely did something someone here could learn from. The point is to widen their range beyond the curated library, so favour examples they are unlikely to have already been handed. " +
          "COMPOSITION: return exactly 3 cases in this order — the FIRST TWO must be bioregionally close to the person's situation (if their situation names or implies a place — a city, region, country, watershed, bioregion or ecosystem — draw these two from that same bioregion or region first, then the same country, then a similar ecological/cultural context nearby), and the THIRD is simply the strongest, most instructive match from ANYWHERE in the world regardless of location. Keep all three DISTINCT from each other. If no location is given, return three strong matches from anywhere. " +
          "SEARCH EFFICIENTLY TO KEEP COSTS LOW: keep searches to a minimum, but ALWAYS do at least TWO searches before concluding — e.g. one aimed at the person's own bioregion/region and one for the strongest match anywhere — so you don't give up prematurely. Do a THIRD search only if those two genuinely failed to surface usable cases. Never exceed three searches, and do not re-search to gild an answer that is already good enough. " +
          "ACCURACY IS CRITICAL: only include a case you have actually found and verified via search; never invent one, and do not state a location, date or figure unless the source supports it. " +
          "For each case, provide the single best real URL you found (an official page or a reputable article about it — never a guessed or constructed URL). " +
          (exclude.length
            ? "AVOID DUPLICATING THE RESOURCE LIBRARY: the person has already been pointed to these specific resources, so do NOT return these exact items or trivial restatements of them — but you are otherwise free across every type of example: " + exclude.join("; ") + ". "
            : "") +
          "After searching, output ONLY a final JSON array, no prose, no code fences: [{\"title\": short case name, \"org\": organisation or place, \"url\": the verified URL, \"why\": one sentence on the practical lesson for this person, noting the place when relevant}]. If you cannot verify any real case, output [].";
        try {
          const { ok, status, data } = await anthropicCall(key, {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1100,
            system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
            messages: [{ role: "user", content: context }],
          });
          if (!ok) return json({ cases: [], error: (data && data.error && data.error.message) || ("HTTP " + status) }, 200, cors);
          // concatenate all text blocks from the final assistant message
          const text = (data.content || []).map((c) => (typeof c.text === "string" ? c.text : "")).join("");
          let cases = [];
          try {
            let t = text.trim();
            const a = t.indexOf("["), b = t.lastIndexOf("]");
            if (a >= 0 && b > a) t = t.slice(a, b + 1);
            const arr = JSON.parse(t);
            if (Array.isArray(arr)) {
              cases = arr
                .filter((c) => c && c.title && /^https?:\/\//i.test(String(c.url || "")))
                .slice(0, 3)
                .map((c) => ({
                  title: clean(c.title, 140),
                  org: clean(c.org, 140),
                  url: String(c.url).slice(0, 400),
                  why: clean(c.why, 240),
                }));
            }
          } catch (e) {}
          return json({ cases, cost: anthropicCost(data) }, 200, cors);
        } catch (e) {
          return json({ cases: [], error: String((e && e.message) || e) }, 200, cors);
        }
      }
    }
    // ---- POST /resources: web-search-grounded HIGH-QUALITY learning resources with VERIFIED links ----
    // Body { context, exclude[] } → { resources: [{title, author, type, url, why}] }. Same
    // web_search grounding as /cases, but for books/podcasts/articles/talks/courses that best
    // match the person's problem. No-ops cleanly without the key.
    {
      if (request.method === "POST" && path === "/resources") {
        const key = env.ANTHROPIC_API_KEY;
        if (!key) return json({ resources: [] }, 200, cors);
        const body = await request.json().catch(() => ({}));
        const context = String(body.context || "").slice(0, 6000).trim();
        if (!context) return json({ resources: [] }, 400, cors);
        const exclude = Array.isArray(body.exclude)
          ? body.exclude.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40)
          : [];
        const sys =
          "You are a systems-change research librarian. Given someone's situation, use web search to find up to 3 REAL, HIGH-QUALITY learning resources that best match their problem and would genuinely help them go deeper. " +
          "RANGE: a resource can be a book, a podcast or a specific episode, a long-form article or essay, a talk or lecture, an academic paper, a documentary, or an online course — whatever fits best. Favour resources with lasting substance over passing news items. " +
          "QUALITY BAR IS HIGH: only recommend resources that are well-regarded, from credible authors or institutions, and directly relevant to this person's situation. Prefer a few excellent, on-point resources over filler, and keep the three DISTINCT in type or angle. " +
          "SEARCH EFFICIENTLY TO KEEP COSTS LOW: keep searches to a minimum, but ALWAYS do at least TWO searches before concluding. Do a THIRD only if those genuinely failed. Never exceed three searches. " +
          "ACCURACY IS CRITICAL: only include a resource you have actually found and verified via search; never invent one, and do not misstate an author or title. Provide the single best real URL you found (an official page, publisher, show page, or reputable source — never a guessed or constructed URL). " +
          (exclude.length
            ? "AVOID DUPLICATING these resources the person already has, so do NOT return these exact items: " + exclude.join("; ") + ". "
            : "") +
          "After searching, output ONLY a final JSON array, no prose, no code fences: [{\"title\": resource title, \"author\": author, creator or host (short), \"type\": one of Book|Podcast|Article|Essay|Talk|Paper|Course|Documentary, \"url\": the verified URL, \"why\": one sentence on why it helps this person}]. If you cannot verify any real resource, output [].";
        try {
          const { ok, status, data } = await anthropicCall(key, {
            model: "claude-sonnet-4-5",
            max_tokens: 1100,
            system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
            messages: [{ role: "user", content: context }],
          });
          if (!ok) return json({ resources: [], error: (data && data.error && data.error.message) || ("HTTP " + status) }, 200, cors);
          const text = (data.content || []).map((c) => (typeof c.text === "string" ? c.text : "")).join("");
          let resources = [];
          try {
            let t = text.trim();
            const a = t.indexOf("["), b = t.lastIndexOf("]");
            if (a >= 0 && b > a) t = t.slice(a, b + 1);
            const arr = JSON.parse(t);
            if (Array.isArray(arr)) {
              resources = arr
                .filter((c) => c && c.title && /^https?:\/\//i.test(String(c.url || "")))
                .slice(0, 3)
                .map((c) => ({
                  title: clean(c.title, 140),
                  author: String(c.author || "").slice(0, 140),
                  type: String(c.type || "").slice(0, 40),
                  url: String(c.url).slice(0, 400),
                  why: clean(c.why, 240),
                }));
            }
          } catch (e) {}
          return json({ resources, cost: anthropicCost(data) }, 200, cors);
        } catch (e) {
          return json({ resources: [], error: String((e && e.message) || e) }, 200, cors);
        }
      }
    }

    // ---- POST /canvas: bespoke divergence → emergence → convergence canvas per route stage ----
    // Body { context, stages[] } → { canvases: [{stage, phases:[{key, items:[{q, step}]}]}] }.
    // No web search — this reasons from the person's own situation. No-ops without the key.
    {
      if (request.method === "POST" && path === "/canvas") {
        const key = env.ANTHROPIC_API_KEY;
        if (!key) return json({ canvases: [] }, 200, cors);
        const body = await request.json().catch(() => ({}));
        const context = String(body.context || "").slice(0, 6000).trim();
        const stages = Array.isArray(body.stages)
          ? body.stages.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3)
          : [];
        if (!context || !stages.length) return json({ canvases: [] }, 400, cors);
        const sys =
          "You are a systems-change facilitator building ONE working canvas for ONE person's specific situation. " +
          "They are at these stages of the Route: " + stages.join(", ") + " (context only — the canvas is not organised by stage).\n\n" +
          "YOUR JOB IS TO DESIGN THE FRAMEWORK THIS PERSON NEEDS — not to fill in a template. You are a framework thinker: you work out what artefact would actually move them forward, name it in their language, and build it. There is no fixed list of canvas types. Invent the one that fits.\n\n" +
          "STEP 1 — DECIDE WHAT ARTEFACT WOULD ACTUALLY HELP. Read what they said, and above all anything they asked for directly. Ask yourself: if this person had one page in their hands tomorrow, what would it need to be for them to move? Then name that thing plainly, in a way they would recognise.\n" +
          "  Precedents, to show the RANGE — these are examples, NOT a menu, and you should invent beyond them whenever the situation calls for it:\n" +
          "    a process or session design — for someone who needs a gathering, clinic or forum they can actually run\n" +
          "    a map of who is in play — for someone whose block is political: mandate, interests, who can say no\n" +
          "    an experiment brief — for someone who knows the move and needs to test it small\n" +
          "    a sense-making frame — for someone genuinely still working out what the problem is\n" +
          "    a learning or curriculum design — for someone building a course, programme or pedagogy\n" +
          "    a boundary and capacity frame — for someone whose situation is personal and relational: overextension, a role that does not fit, a relationship pattern costing them\n" +
          "    a positioning frame — for someone deciding whether or how to enter a role, org or field\n" +
          "    a criteria or indicator frame — for someone designing a standard, rating or way of judging quality\n" +
          "    a narrative or artefact brief — for someone whose work is a story, campaign, exhibit or creative piece\n" +
          "  Many people who come here are not running a change programme at all — they are a person inside a system that is costing them something. Do not force that into project language. Build them the frame they actually need.\n" +
          "  Choose by what they need, not what sounds most sophisticated. If they told you what they need, believe them.\n\n" +
          "STEP 2 — GIVE THE FRAMEWORK THREE MOVEMENTS. Underneath, every canvas follows the same arc: open up, hold the tension, close down. But you must NAME each movement in the language of the framework you designed, and those names go on the page. Never use the words divergence, emergence or convergence anywhere in your output.\n" +
          "  So a process design might name its movements 'How the room opens', 'When it gets stuck', 'What leaves the room'. A boundary frame might use 'What it is costing', 'What you are protecting', 'What you will hold'. A learning design might use 'What they arrive with', 'Where it gets uncomfortable', 'What they leave able to do'. Invent names that fit YOUR framework — short, plain, 2-5 words, in their vocabulary.\n" +
          "  THE MIDDLE MOVEMENT IS THE HARDEST AND MUST NOT BE DECORATIVE. It is where tension is held without being resolved early — the disagreement, the discomfort, the thing being avoided. If the framework involves other people, every item here must be a concrete move for when it gets stuck. If it is personal, it must name the difficulty honestly rather than smoothing it.\n" +
          "For every grouping give EXACTLY 2 items. Each item is a QUESTION (or, for process_design, a short design prompt) plus a PRACTICAL NEXT STEP.\n\n" +
          "YOU ARE A COACH, NOT A CONSULTANT. These are questions for someone to sit with, written on a canvas they will fill in by hand. That means SHORT. A question they cannot hold in their head is a question they cannot answer.\n" +
          "QUESTION RULES — all of them are hard limits:\n" +
          "  - ONE question only. Never two joined by 'and' or 'or'. Never a question with a second question tacked on after a dash.\n" +
          "  - Maximum 20 words. Aim for 12-15. Exactly one question mark, at the end.\n" +
          "  - Do not stack qualifying clauses ('which three X in different Y that recently Z, and what specifically...'). Ask the simple version and trust them.\n" +
          "  - Open, not multiple-choice: never supply the options ('was it the speed, the mix of people, the artefact?').\n" +
          "  - Still specific to THIS person — name their actual context or actors — but in few words. Not 'who are your stakeholders?', and not a paragraph either.\n" +
          "NEXT STEP RULES:\n" +
          "  - Maximum 30 words, one or two short sentences. Something they could genuinely do in the next week or two: a conversation to have, a thing to map, a small test to run, a meeting to convene.\n" +
          "  - One action, not a procedure. Do not chain three instructions together, do not add success criteria or caveats, do not explain why it works.\n" +
          "  - Concrete and modest, not 'develop a strategy'.\n" +
          "The 'focus' byline: maximum 15 words, one plain phrase on what this canvas is for.\n" +
          "Be warm and plain-spoken. No jargon for its own sake. Do not invent facts about their situation that they did not tell you.\n\n" +
          "Output ONLY a JSON array containing EXACTLY ONE object, no prose, no code fences: " +
          "[{\"label\": what KIND of artefact this is, 2-4 words, as you would say it to them (e.g. 'Process design', 'Boundary and capacity frame', 'Learning design' — invent what fits), \"stage\": a short plain title for THIS canvas in their own words (max 6 words, e.g. 'Designing the unblocking clinic'), \"focus\": one sentence, max 15 words, on what this canvas is for in their situation, \"phases\": [{\"key\": \"divergence\"|\"emergence\"|\"convergence\", \"title\": the movement's name in your framework's language (2-5 words), \"items\": [{\"q\": question or design prompt, \"step\": practical next step}]}]}]. " +
          "The three key values are INTERNAL ordering labels only — keep them exactly as given, and never show those three words to the person. The 'title' you write is what they actually see.";
        try {
          const { ok, status, data } = await anthropicCall(key, {
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: context }],
          });
          if (!ok) return json({ canvases: [], error: (data && data.error && data.error.message) || ("HTTP " + status) }, 200, cors);
          const text = (data.content || []).map((c) => (typeof c.text === "string" ? c.text : "")).join("");
          let canvases = [];
          try {
            let t = text.trim();
            const a = t.indexOf("["), b = t.lastIndexOf("]");
            if (a >= 0 && b > a) t = t.slice(a, b + 1);
            const arr = JSON.parse(t);
            const ORDER = ["divergence", "emergence", "convergence"];
            if (Array.isArray(arr)) {
              canvases = arr.filter((c) => c && c.stage && Array.isArray(c.phases)).slice(0, 1).map((c) => ({
                label: clean(c.label, 40) || "Working canvas",
                stage: clean(c.stage, 60),
                focus: clean(c.focus, 110),
                phases: ORDER.map((k) => {
                  const src = c.phases.find((p) => p && String(p.key || "").toLowerCase() === k) || {};
                  const items = Array.isArray(src.items) ? src.items : [];
                  return {
                    key: k,
                    title: clean(src.title, 40),
                    items: items.filter((it) => it && it.q).slice(0, 2).map((it) => ({
                      q: clean(it.q, 150),
                      step: clean(it.step, 200),
                    })),
                  };
                }).filter((p) => p.items.length),
              })).filter((c) => c.phases.length);
            }
          } catch (e) {}
          return json({ canvases, cost: anthropicCost(data) }, 200, cors);
        } catch (e) {
          return json({ canvases: [], error: String((e && e.message) || e) }, 200, cors);
        }
      }
    }

    // Lets the site's teal newsletter form subscribe people directly to
    // https://systemschangelearning.substack.com without exposing anything
    // server-side. No Notion token needed for this route.
    {
      if (request.method === "POST" && path === "/subscribe") {
        const body = await request.json().catch(() => ({}));
        const email = (body.email || "").trim();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return json({ ok: false, error: "Please enter a valid email address." }, 400, cors);
        }
        const PUB = "https://systemschangelearning.substack.com";
        try {
          const r = await fetch(PUB + "/api/v1/free", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              email,
              first_url: PUB + "/",
              first_referrer: "",
              current_url: PUB + "/",
              current_referrer: "",
              referral_code: "",
              source: "embed",
            }),
          });
          const detail = await r.text();
          if (!r.ok) return json({ ok: false, error: "Substack subscribe failed.", detail }, 502, cors);
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ ok: false, error: String((e && e.message) || e) }, 502, cors);
        }
      }
    }

    const token = env.NOTION_TOKEN;
    const dbId = env.NOTION_DB_ID;
    if (!token || !dbId) {
      return json({ error: "Worker not configured: set NOTION_TOKEN and NOTION_DB_ID." }, 500, cors);
    }
    const headers = {
      Authorization: "Bearer " + token,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };

    // ---- POST /log-query: save a Guide Me problem statement + what was suggested ----
    // Writes into a SEPARATE Notion database (env QUERIES_DB_ID). Fire-and-forget
    // from the site; if the DB isn't configured, it quietly no-ops so nothing breaks.
    {
      if (request.method === "POST" && path === "/log-query") {
        const qDb = env.QUERIES_DB_ID;
        if (!qDb) return json({ ok: false, error: "No QUERIES_DB_ID configured." }, 200, cors);
        const body = await request.json().catch(() => ({}));
        const consent = body.consent !== false;
        const status = body.status === "error" ? "error" : "ok";
        const problem = (body.problem || "").trim();
        // On a successful turn we require a problem; error turns are logged even so.
        if (!problem && status !== "error") return json({ ok: false, error: "Missing problem." }, 400, cors);
        const matchedBy = body.matchedBy === "Keyword" ? "Keyword" : "AI";
        // Title = a clean generated label (never the raw prompt); the full prompt lives
        // in Prompt raw. On no-consent, keep the title neutral and drop content columns.
        const title = consent ? String(body.topic || problem || "Guide Me query").slice(0, 80) : "(opted out)";
        const props = Object.assign({
          Topic: { title: [{ text: { content: title } }] },
          "Matched by": { select: { name: matchedBy } },
          Consent: { select: { name: consent ? "Yes" : "No" } },
        }, trackingProps(body));
        if (consent) Object.assign(props, contentProps(body));
        const gateEmail = (body.email || "").trim();
        if (gateEmail) props["Email"] = { email: gateEmail.slice(0, 200) };
        try {
          const up = await notionUpsert(headers, qDb, body.pageId || "", props);
          if (!up.ok) return json({ ok: false, error: "Notion create failed.", detail: up.detail }, 502, cors);
          return json({ ok: true, pageId: up.pageId }, 200, cors);
        } catch (e) {
          return json({ ok: false, error: String((e && e.message) || e) }, 502, cors);
        }
      }
    }

    // ---- POST /log-feedback: save Guide Me exit feedback (env FEEDBACK_DB_ID) ----
    // Optional email so the team can follow up. Fire-and-forget from the client.
    {
      if (request.method === "POST" && path === "/log-feedback") {
        const fDb = env.FEEDBACK_DB_ID;
        if (!fDb) return json({ ok: false, error: "No FEEDBACK_DB_ID configured." }, 200, cors);
        const body = await request.json().catch(() => ({}));
        const rating = (body.rating || "").trim();
        const comment = (body.comment || "").trim();
        const email = (body.email || "").trim();
        if (!rating && !comment && !email) return json({ ok: false, error: "Empty feedback." }, 200, cors);
        const title = (body.topic || "Guide Me feedback").trim() || "Guide Me feedback";
        const props = {
          Name: { title: [{ text: { content: title.slice(0, 200) } }] },
          Source: { rich_text: [{ text: { content: (body.source || "guide-me-feedback").slice(0, 200) } }] },
        };
        if (Number(body.turns)) props["Turns"] = { number: Number(body.turns) };
        if (comment) props["Feedback"] = { rich_text: [{ text: { content: comment.slice(0, 1900) } }] };
        if (email) props["Email"] = { email: email.slice(0, 200) };
        if (rating) props["Rating"] = { select: { name: rating.slice(0, 90) } };
        const create = (p) =>
          fetch("https://api.notion.com/v1/pages", {
            method: "POST", headers,
            body: JSON.stringify({ parent: { database_id: fDb }, properties: p }),
          });
        try {
          let r = await create(props);
          if (!r.ok) {
            // A missing Rating select option (or unknown prop) shouldn't lose the
            // feedback — retry with the rating folded into the comment text.
            const detail = await r.text();
            const p2 = Object.assign({}, props);
            delete p2["Rating"];
            if (rating) {
              const merged = (rating + (comment ? " — " + comment : "")).slice(0, 1900);
              p2["Feedback"] = { rich_text: [{ text: { content: merged } }] };
            }
            r = await create(p2);
            if (!r.ok) { const d2 = await r.text(); return json({ ok: false, error: "Notion create failed.", detail: d2 || detail }, 502, cors); }
          }
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ ok: false, error: String((e && e.message) || e) }, 502, cors);
        }
      }
    }

    try {
      // ---- POST: a visitor suggested a resource → create a Pending row ----
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const name = (body.name || "").trim();
        if (!name) return json({ ok: false, error: "Missing resource name." }, 400, cors);

        const props = { Name: { title: [{ text: { content: name.slice(0, 1900) } }] } };
        if (body.url) props["URL"] = { url: String(body.url).slice(0, 1900) };
        const sName = (body.submitterName || body.suggestedBy || "").trim();
        const sEmail = (body.submitterEmail || "").trim();
        if (sName) props["Submitted by"] = { rich_text: [{ text: { content: sName.slice(0, 1900) } }] };
        if (sEmail) props["Submitter email"] = { email: sEmail.slice(0, 200) };
        props["Status"] = { select: { name: "Pending" } };

        const r = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers,
          body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
        });
        if (!r.ok) {
          // If there is no "Status" select option yet, retry without it so the
          // suggestion is never lost.
          const detail = await r.text();
          if (/Status/i.test(detail)) {
            delete props["Status"];
            const r2 = await fetch("https://api.notion.com/v1/pages", {
              method: "POST", headers,
              body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
            });
            if (r2.ok) return json({ ok: true, note: "Created without Status (add a Status select column to enable pending/approve)." }, 200, cors);
          }
          return json({ ok: false, error: "Notion create failed.", detail }, 502, cors);
        }
        return json({ ok: true }, 200, cors);
      }

      const debug = u.searchParams.get("debug");
      const health = u.searchParams.get("health");
      const nocache = u.searchParams.get("nocache");

      // ---- Edge cache: serve the resource list from Cloudflare's cache when we
      // can, so most GETs are instant and don't wait on Notion (which is what
      // was making the list intermittently fall back to the bundled copy). ----
      const cache = caches.default;
      const cacheKey = new Request(u.origin + "/__resources_v2", { method: "GET" });
      if (request.method === "GET" && !debug && !health && !nocache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
      }

      // Health check you can open in a browser: /?health=1
      if (health) {
        return json({
          ok: true,
          ai_configured: !!env.ANTHROPIC_API_KEY,
          queries_db_configured: !!env.QUERIES_DB_ID,
          resources_db_configured: !!(env.NOTION_TOKEN && env.NOTION_DB_ID),
        }, 200, cors);
      }

      // ---- GET: return all approved resources ----
      // Ask Notion to return ONLY approved rows, so the worker doesn't pull
      // (and then discard) every pending/archived draft. This keeps the
      // response fast as the database grows. If the filter shape doesn't match
      // this workspace's Status column, we transparently fall back to an
      // unfiltered scan (mapRow still gates on Status), so nothing is lost.
      const APPROVED = "Approved";
      const filterVariants = [
        { property: "Status", select: { equals: APPROVED } },
        { property: "Status", status: { equals: APPROVED } },
      ];

      async function queryAll(filter) {
        let out = [], cursor = undefined, guard = 0;
        do {
          const bodyObj = { page_size: 100 };
          if (cursor) bodyObj.start_cursor = cursor;
          if (filter) bodyObj.filter = filter;
          const r = await fetch("https://api.notion.com/v1/databases/" + dbId + "/query", {
            method: "POST",
            headers,
            body: JSON.stringify(bodyObj),
          });
          if (!r.ok) { const detail = await r.text(); const err = new Error(detail); err.detail = detail; throw err; }
          const data = await r.json();
          out = out.concat(data.results || []);
          cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor && ++guard < 25);
        return out;
      }

      let results = null;
      for (const f of filterVariants) {
        try { const got = await queryAll(f); if (got && got.length) { results = got; break; } }
        catch (e) { /* wrong filter type for this column → try next */ }
      }
      if (results === null || !results.length) {
        // filters didn't apply or matched nothing (e.g. Status uses a different
        // "approved" value, or there is no Status column) → unfiltered scan.
        // mapRow still gates on Status, so we never leak drafts.
        try { const all = await queryAll(null); if (all && all.length) results = all; }
        catch (e) { if (results === null) return json({ error: "Notion query failed.", detail: e.detail || String(e) }, 502, cors); }
        if (results === null) results = [];
      }

      // Diagnostic: ?debug=1 shows the real property names/types so we can map them.
      if (debug) {
        const sample = results.slice(0, 3).map((pg) => {
          const out = {};
          for (const k in (pg.properties || {})) out[k] = pg.properties[k].type;
          return out;
        });
        const firstValues = results[0] ? results[0].properties : {};
        return json({ propertyNamesAndTypes: sample, firstRowRaw: firstValues }, 200, cors);
      }

      const resources = results.map(mapRow).filter((x) => x && x.name && !x._skip)
        .map(({ _skip, ...keep }) => keep);

      const resp = new Response(JSON.stringify({ resources }), {
        headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }, cors),
      });
      // Store in the edge cache for fast, reliable subsequent loads (5 min TTL).
      if (request.method === "GET" && !debug && !health && resources.length) {
        try { ctx.waitUntil(cache.put(cacheKey, resp.clone())); } catch (e) {}
      }
      return resp;
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500, cors);
    }
  },
};

// Normalise model / web-search text for display: strip citation markup and stray
// tags, collapse whitespace, and truncate on a word boundary with an ellipsis.
function clean(s, n) {
  let t = String(s == null ? "" : s)
    .replace(/<\/?cite[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (n && t.length > n) {
    t = t.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,;:\u2014-]+$/, "") + "\u2026";
  }
  return t;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors || {}),
  });
}

// Single POST to the Anthropic Messages API. Returns { ok, status, data }.
// Guarded by an AbortController timeout so a stalled web-search / long generation
// fails fast (502 with a clear message) instead of holding the worker request
// open until the browser or the edge silently drops the connection — the main
// cause of intermittent "can't reach the guide" stalls. Web-search turns get a
// longer budget than plain text turns.
async function anthropicCall(key, payload, timeoutMs) {
  const ms = timeoutMs || (Array.isArray(payload.tools) && payload.tools.length ? 45000 : 30000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    const aborted = e && (e.name === "AbortError" || /abort/i.test(String(e.message || "")));
    return {
      ok: false,
      status: aborted ? 504 : 502,
      data: { error: { message: aborted ? ("Upstream timed out after " + Math.round(ms / 1000) + "s.") : String((e && e.message) || e) } },
    };
  } finally {
    clearTimeout(timer);
  }
}

// Estimate the USD cost of one Anthropic call from its usage block. Rates are
// Claude Sonnet 4.5 list prices (per token) + web search at $10 / 1000 calls.
// An estimate: constants below drift if Anthropic changes pricing.
function anthropicCost(data) {
  const u = (data && data.usage) || {};
  const inTok = u.input_tokens || 0;
  const outTok = u.output_tokens || 0;
  const cacheWrite = u.cache_creation_input_tokens || 0;
  const cacheRead = u.cache_read_input_tokens || 0;
  const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  const cost = inTok * 3e-6 + outTok * 15e-6 + cacheWrite * 3.75e-6 + cacheRead * 0.3e-6 + searches * 0.01;
  return Math.round(cost * 1e6) / 1e6;
}

// Chunk a long string across Notion rich_text items (each capped ~1900 chars,
// up to 100 items) so nothing is truncated.
function richChunks(str, cap) {
  const t = String(str == null ? "" : str);
  const lim = cap || 1900;
  const out = [];
  for (let i = 0; i < t.length && out.length < 100; i += lim) out.push({ text: { content: t.slice(i, i + lim) } });
  return out.length ? out : [{ text: { content: "" } }];
}

// Content columns for /log-query: Route, Learning areas,
// Resources suggested, Cases to learn from, Transcript. Only sets a key when the
// corresponding field is present, so it's safe to Object.assign onto any props.
function contentProps(body) {
  const props = {};
  const routeArr = Array.isArray(body.route) ? body.route.filter(Boolean).slice(0, 5) : [];
  const areas = Array.isArray(body.areas) ? body.areas.filter(Boolean).join(", ") : "";
  const resources = Array.isArray(body.resources) ? body.resources.filter(Boolean).join(", ") : "";
  const cases = Array.isArray(body.cases) ? body.cases.filter(Boolean).join("\n") : "";
  if (routeArr.length) props["Route"] = { multi_select: routeArr.map((n) => ({ name: String(n).slice(0, 90) })) };
  if (areas) props["Learning areas"] = { rich_text: [{ text: { content: areas.slice(0, 1900) } }] };
  if (resources) props["Resources suggested"] = { rich_text: [{ text: { content: resources.slice(0, 1900) } }] };
  if (cases) props["Cases to learn from"] = { rich_text: [{ text: { content: cases.slice(0, 1900) } }] };
  if (body.canvases && (!Array.isArray(body.canvases) || body.canvases.length)) {
    const cv = Array.isArray(body.canvases) ? body.canvases.join("\n\n———\n\n") : String(body.canvases);
    props["Canvases"] = { rich_text: richChunks(cv, 1900) };
  }
  if (body.transcript) props["Transcript"] = { rich_text: richChunks(body.transcript, 1900) };
  return props;
}

// Common Guide Me tracking columns for /log-query.
// Consent handling: when consent is false we still record Session ID, Turn index,
// Status and Entry point (so volume + error rates stay measurable) but NEVER the
// Visitor ID, the raw prompt, or the ranked candidate list.
function trackingProps(body) {
  const consent = body.consent !== false;
  const status = body.status === "error" ? "error" : "ok";
  const props = {};
  if (body.sessionId) props["Session ID"] = { rich_text: [{ text: { content: String(body.sessionId).slice(0, 80) } }] };
  const ti = Number(body.turnIndex);
  if (Number.isFinite(ti) && ti > 0) props["Turn index"] = { number: ti };
  const ec = Number(body.estCost);
  if (Number.isFinite(ec) && ec >= 0) props["Est. cost (USD)"] = { number: Math.round(ec * 1e6) / 1e6 };
  props["Status"] = { select: { name: status } };
  if (consent && body.visitorId) props["Visitor ID"] = { rich_text: [{ text: { content: String(body.visitorId).slice(0, 80) } }] };
  if (consent && body.promptRaw) props["Prompt raw"] = { rich_text: richChunks(body.promptRaw, 1900) };
  return props;
}

// Create a page, or PATCH an existing one when pageId is supplied, so a session's
// row is UPDATED IN PLACE as it deepens (one row per session, not per turn write).
// If Notion rejects a property that doesn't exist in the database, strip ONLY that
// one column (parsed from the error) and retry, so every column that DOES exist
// still fills. Falls back to stripping all optional columns if a name can't be
// parsed. Returns { ok, pageId, detail }.
async function notionUpsert(headers, dbId, pageId, props) {
  const OPTIONAL = ["Session ID", "Visitor ID", "Turn index", "Status", "Prompt raw", "Est. cost (USD)", "Matched by", "Email"];
  async function attempt(p) {
    if (pageId) {
      const r = await fetch("https://api.notion.com/v1/pages/" + pageId, { method: "PATCH", headers, body: JSON.stringify({ properties: p }) });
      if (r.ok) return { ok: true, pageId };
      return { ok: false, detail: await r.text() };
    }
    const r = await fetch("https://api.notion.com/v1/pages", { method: "POST", headers, body: JSON.stringify({ parent: { database_id: dbId }, properties: p }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, pageId: d.id };
    return { ok: false, detail: JSON.stringify(d) };
  }
  const p = Object.assign({}, props);
  for (let i = 0; i < 12; i++) {
    const res = await attempt(p);
    if (res.ok) return res;
    if (!/Could not find|is not a property|validation_error/i.test(res.detail || "")) return res;
    // Notion names the offending property; strip only that one.
    let bad = null;
    let m = /"?([A-Za-z0-9 ().\-\/]+?)"? is not a property that exists/i.exec(res.detail || "");
    if (m) bad = m[1].trim();
    if (!bad) { m = /Could not find property with name or id:\s*"?([A-Za-z0-9 ().\-\/]+?)"?[.\\"]/i.exec(res.detail || ""); if (m) bad = m[1].trim(); }
    if (bad && Object.prototype.hasOwnProperty.call(p, bad)) { delete p[bad]; continue; }
    // Couldn't parse a name — strip all optional columns once, then give up.
    let stripped = false;
    OPTIONAL.forEach((k) => { if (Object.prototype.hasOwnProperty.call(p, k)) { delete p[k]; stripped = true; } });
    if (stripped) continue;
    return res;
  }
  return await attempt(p);
}


// Map a Notion page → the shape the site expects.
// Tolerant of property naming: matches by Notion property type first, then by name.
function mapRow(page) {
  const p = page.properties || {};
  const byName = (re) => { for (const k in p) if (re.test(k)) return p[k]; return null; };
  const byType = (t) => { for (const k in p) if (p[k].type === t) return p[k]; return null; };

  const titleProp = byType("title");
  const name = titleProp ? plain(titleProp.title) : "";

  const urlProp = byName(/^(url|link)$/i) || byType("url");
  const url = urlProp ? (urlProp.url || plain(urlProp.rich_text) || "") : "";

  const descProp = byName(/^desc/i);
  const desc = descProp ? plain(descProp.rich_text) : "";

  const typeProp = byName(/^type/i);
  const types = msNames(typeProp);

  const capProp = byName(/^capacit/i);
  const caps = msNames(capProp).map(normalizeCap);

  const featProp = byName(/^(featured|editor|pick)/i);
  const featured = featProp && featProp.type === "checkbox" ? !!featProp.checkbox : false;

  // Status gate: if a Status column exists, only show Approved/Published/Live rows.
  // If there is no Status column at all, every row is shown.
  let _skip = false;
  const statusProp = byName(/^status$/i) || byType("status");
  if (statusProp) {
    const sv = statusProp.type === "status" && statusProp.status ? statusProp.status.name
             : statusProp.type === "select" && statusProp.select ? statusProp.select.name
             : "";
    if (!sv || !/approv|publish|live|done/i.test(sv)) _skip = true;
  }

  return { name, url, desc, types, caps: caps.filter(Boolean), featured, _skip };
}

function msNames(prop) {
  if (!prop) return [];
  if (prop.type === "multi_select") return prop.multi_select.map((o) => o.name);
  if (prop.type === "select" && prop.select) return [prop.select.name];
  return [];
}

function plain(rich) {
  if (!rich || !Array.isArray(rich)) return "";
  return rich.map((t) => t.plain_text || (t.text && t.text.content) || "").join("");
}
