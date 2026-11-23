#!/usr/bin/env node
/**
 * Read-only HTML/CSS evidence extractor for the frontend-spec-engineer skill.
 * JS port of scripts/analyze_html.py — zero dependencies, Node.js >= 18.
 *
 * Usage:
 *   node scripts/analyze_html.mjs --input <html_path|folder>
 *
 * Output: JSON with per-page structure and aggregate tokens (same contract as
 * the Python version).
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Regexes (mirror of the Python original)
// ---------------------------------------------------------------------------
const COLOR_RE = /(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:black|white|red|blue|green|gray|grey|transparent)\b)/g;
const NUMBER_RE = /(?<![\w.-])(-?\d+(?:\.\d+)?)(px|rem|em|vh|vw|%)(?![\w.-])/g;
const FONT_SIZE_RE = /font-size\s*:\s*([^;{}]+)/gi;
const FONT_WEIGHT_RE = /font-weight\s*:\s*([^;{}]+)/gi;
const LINE_HEIGHT_RE = /line-height\s*:\s*([^;{}]+)/gi;
const RADIUS_RE = /border-radius\s*:\s*([^;{}]+)/gi;
const SHADOW_RE = /box-shadow\s*:\s*([^;{}]+)/gi;
const RULE_RE = /([^{}]+)\{([^{}]+)\}/g;
const MEDIA_RE = /@media\s*([^{}]+)/gi;
const VAR_RE = /(--[\w-]+)\s*:\s*([^;]+)/g;
const STYLE_BLOCK_RE = /<style[^>]*>(.*?)<\/style>/gis;
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const ATTR_RE = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
const INLINE_STYLE_RE = /style=["']([^"']+)["']/gi;
const HTML_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*?)?)\/?\s*>/g;
const TAG_ATTR_RE = /([\w:-]+)(?:\s*=\s*["']([^"']*)["'])?/g;

const SEMANTIC_TAGS = new Set(['header', 'nav', 'aside', 'main', 'section', 'article', 'footer', 'form', 'table', 'thead', 'tbody', 'ul', 'ol', 'figure']);
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const ASSET_TAGS = new Set(['img', 'source', 'video', 'audio', 'iframe', 'script']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readText(filePath) {
  const raw = fs.readFileSync(filePath);
  for (const encoding of ['utf-8', 'gb18030', 'latin1']) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      return decoder.decode(raw);
    } catch {
      /* try next encoding */
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(raw);
}

function countValues(pattern, css, limit = 20, group = 1) {
  const counter = new Map();
  let match;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((match = re.exec(css)) !== null) {
    const value = (match[group] || '').trim();
    counter.set(value, (counter.get(value) || 0) + 1);
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function collectMatches(regex, text) {
  const out = [];
  let match;
  const re = new RegExp(regex.source, regex.flags);
  while ((match = re.exec(text)) !== null) {
    out.push(match[1].trim());
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// HTML parser (tag-stream based; executes nothing)
// ---------------------------------------------------------------------------
function parseHtml(html) {
  const result = {
    tags: new Map(),
    classes: new Map(),
    ids: [],
    semantic: new Map(),
    interactive: [],
    assets: [],
    headings: [],
    forms: [],
    titleParts: [],
    inTitle: false,
  };

  // Strip the inner content of <script> and <style> blocks before tokenizing,
  // mirroring HTMLParser's CDATA semantics (script/style content is not markup).
  const sanitized = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style></style>');

  let match;
  const re = new RegExp(HTML_TAG_RE.source, 'g');
  while ((match = re.exec(sanitized)) !== null) {
    const rawTag = match[0];
    const tag = match[1].toLowerCase();
    const attrsRaw = match[2] || '';
    const line = lineOf(sanitized, match.index);

    // collect attributes
    const attrs = {};
    let attrMatch;
    const attrRe = new RegExp(TAG_ATTR_RE.source, 'g');
    while ((attrMatch = attrRe.exec(attrsRaw)) !== null) {
      if (attrMatch[1]) attrs[attrMatch[1].toLowerCase()] = attrMatch[2] !== undefined ? attrMatch[2] : '';
    }

    const isClosing = rawTag.startsWith('</');
    if (isClosing) {
      if (tag === 'title') result.inTitle = false;
      continue;
    }

    result.tags.set(tag, (result.tags.get(tag) || 0) + 1);
    if (SEMANTIC_TAGS.has(tag)) result.semantic.set(tag, (result.semantic.get(tag) || 0) + 1);
    for (const cls of (attrs.class || '').split(/\s+/).filter(Boolean)) {
      result.classes.set(cls, (result.classes.get(cls) || 0) + 1);
    }
    if (attrs.id) result.ids.push(attrs.id);

    const hasInlineHandler = Object.keys(attrs).some((k) => k.startsWith('on'));
    if (INTERACTIVE_TAGS.has(tag) || hasInlineHandler) {
      result.interactive.push({
        tag,
        line,
        type: attrs.type || '',
        name: attrs.name || '',
        aria_label: attrs['aria-label'] || '',
        href: attrs.href || '',
        has_inline_handler: hasInlineHandler,
      });
    }

    if (ASSET_TAGS.has(tag)) {
      const source = attrs.src || attrs.srcset || attrs['data-src'] || '';
      if (source) result.assets.push({ tag, line, path: source, alt: attrs.alt || '' });
    }
    if (tag === 'link' && attrs.href) {
      result.assets.push({ tag, line, path: attrs.href, rel: attrs.rel || '' });
    }
    if (HEADING_TAGS.has(tag)) {
      result.headings.push({ level: Number(tag[1]), line, text: '' });
    }
    if (tag === 'form') {
      result.forms.push({ line, method: attrs.method || 'get', action: attrs.action || '' });
    }
    if (tag === 'title') result.inTitle = true;
  }

  // collect text inside <title> and headings
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) result.titleParts.push(titleMatch[1].replace(/\s+/g, ' ').trim());

  for (const heading of result.headings) {
    const reHeading = new RegExp(`<h${heading.level}[^>]*>([\\s\\S]*?)<\\/h${heading.level}>`, 'i');
    const hMatch = reHeading.exec(html.slice(html.indexOf(`<h${heading.level}`)));
    if (hMatch) heading.text = hMatch[1].replace(/\s+/g, ' ').trim();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Local CSS collection
// ---------------------------------------------------------------------------
function localStyles(html, htmlPath) {
  const chunks = [];
  const linked = [];

  for (const styleMatch of html.matchAll(STYLE_BLOCK_RE)) {
    chunks.push(styleMatch[1]);
  }

  for (const linkMatch of html.matchAll(LINK_TAG_RE)) {
    const tag = linkMatch[0];
    const attrs = {};
    let attrMatch;
    const attrRe = new RegExp(ATTR_RE.source, 'g');
    while ((attrMatch = attrRe.exec(tag)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2] || '';
    }
    const relValues = new Set((attrs.rel || '').toLowerCase().split(/\s+/));
    const href = attrs.href || '';
    if (!relValues.has('stylesheet') || !href) continue;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href) || href.startsWith('//')) continue;

    const cleanHref = href.split('#')[0].split('?')[0];
    const candidate = path.resolve(path.dirname(htmlPath), cleanHref);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      chunks.push(readText(candidate));
      linked.push({ path: candidate, line: lineOf(html, linkMatch.index) });
    }
  }

  for (const styleMatch of html.matchAll(INLINE_STYLE_RE)) {
    chunks.push(`inline-style { ${styleMatch[1]} }`);
  }

  return { css: chunks.join('\n'), linked };
}

// ---------------------------------------------------------------------------
// CSS evidence
// ---------------------------------------------------------------------------
function cssEvidence(css) {
  const rules = [];
  let ruleMatch;
  const ruleRe = new RegExp(RULE_RE.source, 'g');
  while ((ruleMatch = ruleRe.exec(css)) !== null) {
    const selector = ruleMatch[1].split(/\s+/).join(' ').trim();
    const declarations = ruleMatch[2].toLowerCase();
    const layout = [];
    for (const display of ['flex', 'grid', 'block', 'inline-flex']) {
      if (new RegExp(`display\\s*:\\s*${display}\\b`).test(declarations)) {
        layout.push(`display:${display}`);
      }
    }
    if (layout.length) {
      rules.push({ selector: selector.slice(0, 240), line: lineOf(css, ruleMatch.index), layout });
    }
  }

  const colorCounter = new Map();
  let colorMatch;
  const colorRe = new RegExp(COLOR_RE.source, 'g');
  while ((colorMatch = colorRe.exec(css)) !== null) {
    const v = colorMatch[0];
    colorCounter.set(v, (colorCounter.get(v) || 0) + 1);
  }

  const spacingCounter = new Map();
  let numMatch;
  const numRe = new RegExp(NUMBER_RE.source, 'g');
  while ((numMatch = numRe.exec(css)) !== null) {
    const v = numMatch[0];
    spacingCounter.set(v, (spacingCounter.get(v) || 0) + 1);
  }

  const variables = [];
  let varMatch;
  const varRe = new RegExp(VAR_RE.source, 'g');
  while ((varMatch = varRe.exec(css)) !== null) {
    variables.push({ name: varMatch[1], value: varMatch[2].trim() });
  }

  const sortByCount = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

  return {
    colors: sortByCount(colorCounter).slice(0, 30),
    spacing: sortByCount(spacingCounter).slice(0, 30),
    font_sizes: countValues(FONT_SIZE_RE, css, 20),
    font_weights: countValues(FONT_WEIGHT_RE, css, 20),
    line_heights: countValues(LINE_HEIGHT_RE, css, 20),
    radii: countValues(RADIUS_RE, css, 20),
    shadows: countValues(SHADOW_RE, css, 20),
    css_variables: variables,
    breakpoints: collectMatches(MEDIA_RE, css),
    layout_rules: rules.slice(0, 50),
  };
}

// ---------------------------------------------------------------------------
// File analysis
// ---------------------------------------------------------------------------
function analyzeFile(filePath) {
  const html = readText(filePath);
  const parsed = parseHtml(html);
  const { css, linked } = localStyles(html, filePath);

  const toCounter = (m, limit = Infinity) => {
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return Object.fromEntries(sorted.slice(0, limit).map(([k, v]) => [k, v]));
  };

  return {
    path: filePath,
    source_kind: /<html\b/i.test(html) ? 'document' : 'fragment',
    title: parsed.titleParts.join(' '),
    semantic_landmarks: toCounter(parsed.semantic),
    tag_counts: toCounter(parsed.tags),
    class_counts: toCounter(parsed.classes, 50),
    ids: parsed.ids,
    headings: parsed.headings,
    interactive_elements: parsed.interactive,
    forms: parsed.forms,
    assets: parsed.assets,
    linked_stylesheets: linked,
    css: cssEvidence(css),
  };
}

function pathsForInput(inputPath) {
  if (fs.statSync(inputPath).isFile()) {
    const ext = path.extname(inputPath).toLowerCase();
    if (!['.html', '.htm'].includes(ext)) {
      throw new Error('input file must use .html or .htm');
    }
    return [inputPath];
  }
  if (fs.statSync(inputPath).isDirectory()) {
    return walkHtml(inputPath);
  }
  throw new Error(`input path does not exist: ${inputPath}`);
}

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkHtml(full));
    } else if (entry.isFile() && ['.html', '.htm'].includes(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out.sort();
}

function aggregateCss(pages) {
  const fields = ['colors', 'spacing', 'font_sizes', 'font_weights', 'line_heights', 'radii', 'shadows'];
  const aggregate = {};

  for (const field of fields) {
    const counter = new Map();
    for (const page of pages) {
      for (const item of page.css[field]) {
        const key = String(item.value);
        counter.set(key, (counter.get(key) || 0) + Number(item.count));
      }
    }
    aggregate[field] = [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([value, count]) => ({ value, count }));
  }

  const variables = new Map();
  const breakpoints = new Set();
  for (const page of pages) {
    for (const item of page.css.css_variables) variables.set(item.name, item.value);
    for (const bp of page.css.breakpoints) breakpoints.add(bp);
  }
  aggregate.css_variables = [...variables.entries()].sort().map(([name, value]) => ({ name, value }));
  aggregate.breakpoints = [...breakpoints].sort();
  return aggregate;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  if (inputIndex === -1 || !args[inputIndex + 1]) {
    console.error('Usage: node analyze_html.mjs --input <html_file_or_folder>');
    process.exit(1);
  }
  const inputPath = path.resolve(args[inputIndex + 1]);
  if (!fs.existsSync(inputPath)) {
    console.error(`input path does not exist: ${inputPath}`);
    process.exit(1);
  }

  const paths = pathsForInput(inputPath);
  const pages = paths.map(analyzeFile);
  const result = { input: inputPath, files: pages, aggregate_css: aggregateCss(pages) };
  process.stdout.write(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
