import { useEffect, useRef } from "react";
import { translateStrings } from "@/lib/i18n/translate.functions";

/**
 * Whole-interface translation.
 *
 * The keyed STRINGS table only ever covered the navigation, so switching
 * language left the rest of the app in English. Rather than key every screen
 * by hand, this walks the rendered text and translates it in place, caching
 * each phrase per language so a screen is only ever paid for once.
 *
 * Deliberately never touched:
 *  - `.paper` — the report document. English is the record copy and report
 *    language is a separate, per-report decision.
 *  - anything marked `data-no-translate`, plus form fields, code and scripts.
 */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
]);

const cacheKey = (language: string) => `instructbrain.ui.${language}`;

function loadCache(language: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(cacheKey(language));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCache(language: string, cache: Record<string, string>) {
  try {
    localStorage.setItem(cacheKey(language), JSON.stringify(cache));
  } catch {
    /* storage full or unavailable — translation still works this session */
  }
}

/** Worth translating: real words, not numbers, refs, symbols or huge blobs. */
function translatable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 400) return false;
  if (!/\p{L}{2}/u.test(trimmed)) return false;
  return true;
}

function skipped(node: Node): boolean {
  let element = node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute("data-no-translate")) return true;
    if (element.classList.contains("paper")) return true;
    element = element.parentElement;
  }
  return false;
}

function collect(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    if (translatable(text.data) && !skipped(text)) nodes.push(text);
    current = walker.nextNode();
  }
  return nodes;
}

export function InterfaceTranslator({ language }: { language: string }) {
  /** Original English for every node we have touched, so revert is exact. */
  const originals = useRef(new WeakMap<Text, string>());
  const cache = useRef<Record<string, string>>({});
  const pending = useRef(new Set<string>());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const restore = () => {
      for (const node of collect(document.body)) {
        const original = originals.current.get(node);
        if (original !== undefined) node.data = original;
      }
    };

    if (language === "en") {
      restore();
      originals.current = new WeakMap();
      return;
    }

    let cancelled = false;
    cache.current = loadCache(language);

    const apply = (nodes: Text[]) => {
      for (const node of nodes) {
        const original = originals.current.get(node) ?? node.data;
        const key = original.trim();
        const translated = cache.current[key];
        if (!translated) continue;
        if (!originals.current.has(node)) originals.current.set(node, original);
        // Keep the surrounding whitespace so inline layout does not shift.
        node.data = original.replace(key, translated);
      }
    };

    const request = async () => {
      const wanted = Array.from(pending.current);
      pending.current.clear();
      const missing = wanted.filter((phrase) => !(phrase in cache.current));
      if (missing.length === 0 || cancelled) return;

      // Batched so a busy screen is one or two calls, not hundreds.
      for (let index = 0; index < missing.length; index += 60) {
        const batch = missing.slice(index, index + 60);
        const payload: Record<string, string> = {};
        batch.forEach((phrase, position) => {
          payload[`s${index + position}`] = phrase;
        });
        try {
          const result = await translateStrings({ data: { language, strings: payload } });
          if (cancelled) return;
          for (const [id, value] of Object.entries(result.translations ?? {})) {
            const english = payload[id];
            if (english && typeof value === "string" && value.trim() !== "") {
              cache.current[english] = value;
            }
          }
        } catch (error) {
          console.error("Interface translation failed", error);
          return;
        }
      }
      saveCache(language, cache.current);
      if (!cancelled) apply(collect(document.body));
    };

    const scan = (root: Node) => {
      const nodes = collect(root);
      apply(nodes);
      for (const node of nodes) {
        const key = (originals.current.get(node) ?? node.data).trim();
        if (!(key in cache.current)) pending.current.add(key);
      }
      if (pending.current.size > 0) {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void request(), 150);
      }
    };

    scan(document.body);

    // Navigation and data loading both arrive as DOM mutations.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) {
          const node = record.target as Text;
          if (translatable(node.data) && !skipped(node)) scan(node);
          continue;
        }
        record.addedNodes.forEach((added) => {
          if (added.nodeType === Node.TEXT_NODE || added.nodeType === Node.ELEMENT_NODE) {
            scan(added);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [language]);

  return null;
}
