(function () {
  const sent = new Set();
  let lastPromptText = "";
  let lastPromptAt = 0;

  function platformFromHost() {
    const host = location.hostname;
    if (host.includes("gemini.google.com") || host.includes("bard.google.com")) return "Gemini";
    if (host.includes("chatgpt") || host.includes("openai")) return "ChatGPT";
    if (host.includes("claude")) return "Claude";
    if (host.includes("moonshot") || host.includes("kimi.com")) return "Kimi";
    if (host.includes("deepseek")) return "DeepSeek";
    if (host.includes("perplexity")) return "Perplexity";
    if (host.includes("google")) return "Google";
    if (host.includes("bing")) return "Bing";
    if (host.includes("baidu")) return "Baidu";
    return host;
  }

  function sendLog(question) {
    question = (question || "").trim();
    if (!question || question.length < 2) return;

    const key = `${platformFromHost()}::${question}::${location.href}`;
    if (sent.has(key)) return;
    sent.add(key);

    console.log("[Query2Card] sendLog", {question, platform: platformFromHost(), url: location.href});

    chrome.runtime.sendMessage({
      type: "QUERY2CARD_LOG",
      payload: {
        question,
        platform: platformFromHost(),
        url: location.href,
        title: document.title,
        source: "browser"
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[Query2Card] sendMessage error", chrome.runtime.lastError.message);
      } else {
        console.log("[Query2Card] background response", response);
      }
    });
  }

  function extractSearchQueryFromUrl() {
    const url = new URL(location.href);
    const host = location.hostname;

    if (host.includes("google") && !host.includes("gemini.google.com")) return url.searchParams.get("q");
    if (host.includes("bing")) return url.searchParams.get("q");
    if (host.includes("baidu")) return url.searchParams.get("wd") || url.searchParams.get("word");

    return null;
  }

  function recordSearchPage() {
    const q = extractSearchQueryFromUrl();
    console.log("[Query2Card] recordSearchPage", q);
    if (q) sendLog(q);
  }

  function closestPromptElement(el) {
    if (!el || !el.closest) return null;
    return el.closest([
      "textarea",
      "input",
      "[contenteditable='true']",
      "[role='textbox']",
      "[data-slate-editor='true']",
      "[data-lexical-editor='true']",
      "rich-textarea",
      "rich-textarea [contenteditable='true']",
      ".ProseMirror",
      ".ql-editor",
      ".tox-edit-area",
      ".input",
      ".editor"
    ].join(","));
  }

  function elementTextHints(el) {
    if (!el || !el.getAttribute) return "";
    return [
      el.getAttribute("id"),
      el.getAttribute("class"),
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("data-placeholder"),
      el.getAttribute("data-testid"),
      el.getAttribute("aria-placeholder")
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isLikelyPromptElement(el) {
    if (!el) return false;

    const promptEl = closestPromptElement(el) || el;
    const tag = promptEl.tagName ? promptEl.tagName.toLowerCase() : "";
    const role = promptEl.getAttribute && promptEl.getAttribute("role");

    if (tag === "textarea" || tag === "input" || tag === "rich-textarea") return true;
    if (role === "textbox") return true;
    if (promptEl.isContentEditable) return true;

    const haystack = elementTextHints(promptEl);
    return (
      haystack.includes("prompt") ||
      haystack.includes("message") ||
      haystack.includes("ask") ||
      haystack.includes("editor") ||
      haystack.includes("input") ||
      haystack.includes("query") ||
      haystack.includes("prosemirror")
    );
  }

  function cleanPromptText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getTextFromElement(el) {
    if (!el) return "";

    el = closestPromptElement(el) || el;

    if ("value" in el) return cleanPromptText(el.value);

    const text = el.innerText || el.textContent || "";
    return cleanPromptText(text);
  }

  function findPromptElement() {
    if (isLikelyPromptElement(document.activeElement)) {
      return closestPromptElement(document.activeElement) || document.activeElement;
    }

    const selectors = [
      "#prompt-textarea",
      "textarea[data-testid='prompt-textarea']",
      "textarea[placeholder*='Message']",
      "textarea[placeholder*='message']",
      "textarea[placeholder*='Ask']",
      "textarea[aria-label*='prompt']",
      "textarea[aria-label*='message']",
      "rich-textarea",
      "rich-textarea [contenteditable='true']",
      "div[contenteditable='true'][id='prompt-textarea']",
      "div[contenteditable='true'][data-testid='prompt-textarea']",
      "div[contenteditable='true'][aria-label*='prompt']",
      "div[contenteditable='true'][aria-label*='message']",
      "div[contenteditable='true'][role='textbox']",
      "[data-slate-editor='true']",
      "[data-lexical-editor='true']",
      ".ProseMirror",
      ".ql-editor",
      "[class*='input'][contenteditable='true']",
      "[class*='editor'][contenteditable='true']",
      "[class*='Input'][contenteditable='true']",
      "[class*='Editor'][contenteditable='true']",
      "div[role='textbox']",
      "textarea",
      "[contenteditable='true']"
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements[elements.length - 1];
      }
    }

    return null;
  }

  function updatePromptCache(el) {
    const target = isLikelyPromptElement(el) ? (closestPromptElement(el) || el) : findPromptElement();
    const text = getTextFromElement(target);
    if (text.length >= 2) {
      lastPromptText = text;
      lastPromptAt = Date.now();
      console.log("[Query2Card] prompt cached", lastPromptText);
    }
    return text;
  }

  function recordCurrentPrompt() {
    const text = updatePromptCache(document.activeElement);
    if (text.length >= 2) {
      sendLog(text);
      return;
    }

    if (lastPromptText && Date.now() - lastPromptAt < 30000) {
      sendLog(lastPromptText);
    }
  }

  function isSendButton(target) {
    const button = target && target.closest && target.closest("button, [role='button']");
    if (!button) return false;

    const haystack = [
      button.innerText,
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.getAttribute("data-testid"),
      button.getAttribute("class"),
      button.getAttribute("mattooltip")
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      haystack.includes("send") ||
      haystack.includes("submit") ||
      haystack.includes("发送") ||
      haystack.includes("提交")
    );
  }

  recordSearchPage();

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(recordSearchPage, 800);
    }
  }, 1000);

  document.addEventListener("input", (e) => {
    updatePromptCache(e.target);
  }, true);

  document.addEventListener("keyup", (e) => {
    updatePromptCache(e.target);
  }, true);

  document.addEventListener("paste", (e) => {
    setTimeout(() => updatePromptCache(e.target), 0);
  }, true);

  document.addEventListener("compositionend", (e) => {
    updatePromptCache(e.target);
  }, true);

  document.addEventListener("keydown", (e) => {
    updatePromptCache(e.target);

    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      recordCurrentPrompt();
    }
  }, true);

  document.addEventListener("pointerdown", (e) => {
    updatePromptCache(document.activeElement);
    if (isSendButton(e.target)) {
      recordCurrentPrompt();
    }
  }, true);

  document.addEventListener("click", (e) => {
    updatePromptCache(document.activeElement);
    if (isSendButton(e.target)) {
      recordCurrentPrompt();
    }
  }, true);
})();
