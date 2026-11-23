#!/usr/bin/env python3
"""Read-only HTML/CSS evidence extractor for the frontend-spec-engineer skill."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


COLOR_RE = re.compile(r"(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:black|white|red|blue|green|gray|grey|transparent)\b)")
NUMBER_RE = re.compile(r"(?<![\w.-])(-?\d+(?:\.\d+)?)(px|rem|em|vh|vw|%)(?![\w.-])")
FONT_SIZE_RE = re.compile(r"font-size\s*:\s*([^;{}]+)", re.IGNORECASE)
FONT_WEIGHT_RE = re.compile(r"font-weight\s*:\s*([^;{}]+)", re.IGNORECASE)
LINE_HEIGHT_RE = re.compile(r"line-height\s*:\s*([^;{}]+)", re.IGNORECASE)
RADIUS_RE = re.compile(r"border-radius\s*:\s*([^;{}]+)", re.IGNORECASE)
SHADOW_RE = re.compile(r"box-shadow\s*:\s*([^;{}]+)", re.IGNORECASE)
RULE_RE = re.compile(r"([^{}]+)\{([^{}]+)\}", re.DOTALL)
MEDIA_RE = re.compile(r"@media\s*([^{}]+)", re.IGNORECASE)
VAR_RE = re.compile(r"(--[\w-]+)\s*:\s*([^;]+)")

SEMANTIC_TAGS = {
    "header", "nav", "aside", "main", "section", "article", "footer",
    "form", "table", "thead", "tbody", "ul", "ol", "figure",
}
INTERACTIVE_TAGS = {"a", "button", "input", "select", "textarea", "summary"}


class PrototypeParser(HTMLParser):
    """Collect structural and interaction evidence without executing markup."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: Counter[str] = Counter()
        self.classes: Counter[str] = Counter()
        self.ids: Counter[str] = Counter()
        self.semantic: Counter[str] = Counter()
        self.interactive: list[dict[str, object]] = []
        self.assets: list[dict[str, object]] = []
        self.headings: list[dict[str, object]] = []
        self.forms: list[dict[str, object]] = []
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.lower()
        line = self.getpos()[0]
        attr_map = {key.lower(): value or "" for key, value in attrs}
        self.tags[normalized] += 1
        if normalized in SEMANTIC_TAGS:
            self.semantic[normalized] += 1
        for class_name in attr_map.get("class", "").split():
            self.classes[class_name] += 1
        if attr_map.get("id"):
            self.ids[attr_map["id"]] += 1
        if normalized in INTERACTIVE_TAGS or any(key.startswith("on") for key in attr_map):
            self.interactive.append({
                "tag": normalized,
                "line": line,
                "type": attr_map.get("type", ""),
                "name": attr_map.get("name", ""),
                "aria_label": attr_map.get("aria-label", ""),
                "href": attr_map.get("href", ""),
                "has_inline_handler": any(key.startswith("on") for key in attr_map),
            })
        if normalized in {"img", "source", "video", "audio", "iframe", "script"}:
            source = attr_map.get("src") or attr_map.get("srcset") or attr_map.get("data-src", "")
            if source:
                self.assets.append({"tag": normalized, "line": line, "path": source, "alt": attr_map.get("alt", "")})
        if normalized in {"link"} and attr_map.get("href"):
            self.assets.append({"tag": normalized, "line": line, "path": attr_map["href"], "rel": attr_map.get("rel", "")})
        if normalized in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.headings.append({"level": int(normalized[1]), "line": line, "text": ""})
        if normalized == "form":
            self.forms.append({"line": line, "method": attr_map.get("method", "get"), "action": attr_map.get("action", "")})
        if normalized == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        if self._in_title:
            self.title_parts.append(text)
        if self.headings:
            current = self.headings[-1]
            if not current["text"]:
                current["text"] = text


def read_text(path: Path) -> str:
    """Read local text with a deterministic UTF-8/GB18030 fallback."""
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def local_styles(html: str, html_path: Path) -> tuple[str, list[dict[str, object]]]:
    """Collect inline CSS and readable local linked stylesheets."""
    chunks = re.findall(r"<style[^>]*>(.*?)</style>", html, re.IGNORECASE | re.DOTALL)
    linked: list[dict[str, object]] = []
    for link_match in re.finditer(r"<link\b[^>]*>", html, re.IGNORECASE):
        tag = link_match.group(0)
        attrs = {key.lower(): value or "" for key, value in re.findall(r"([\w:-]+)\s*=\s*[\"']([^\"']*)[\"']", tag)}
        rel_values = {item.lower() for item in attrs.get("rel", "").split()}
        href = attrs.get("href", "")
        if "stylesheet" not in rel_values or not href:
            continue
        if re.match(r"^[a-z][a-z0-9+.-]*://", href, re.IGNORECASE) or href.startswith("//"):
            continue
        candidate = (html_path.parent / href.split("#", 1)[0].split("?", 1)[0]).resolve()
        if candidate.is_file():
            chunks.append(read_text(candidate))
            linked.append({"path": str(candidate), "line": html[:link_match.start()].count("\n") + 1})
    for style in re.findall(r"style=[\"']([^\"']+)[\"']", html, re.IGNORECASE):
        chunks.append(f"inline-style {{ {style} }}")
    return "\n".join(chunks), linked


def counter_values(pattern: re.Pattern[str], css: str, limit: int = 20) -> list[dict[str, object]]:
    values = Counter(match.group(1).strip() for match in pattern.finditer(css))
    return [{"value": value, "count": count} for value, count in values.most_common(limit)]


def css_evidence(css: str) -> dict[str, object]:
    """Extract token-like values and layout rules from CSS text."""
    rules: list[dict[str, object]] = []
    for rule_match in RULE_RE.finditer(css):
        selector, declarations = rule_match.groups()
        clean_selector = " ".join(selector.split())
        lowered = declarations.lower()
        layout = []
        for display in ("flex", "grid", "block", "inline-flex"):
            if re.search(rf"display\s*:\s*{display}\b", lowered):
                layout.append(f"display:{display}")
        if layout:
            rules.append({
                "selector": clean_selector[:240],
                "line": css[:rule_match.start()].count("\n") + 1,
                "layout": layout,
            })
    return {
        "colors": [{"value": value, "count": count} for value, count in Counter(COLOR_RE.findall(css)).most_common(30)],
        "spacing": [{"value": value, "count": count} for value, count in Counter(NUMBER_RE.findall(css)).most_common(30)],
        "font_sizes": counter_values(FONT_SIZE_RE, css),
        "font_weights": counter_values(FONT_WEIGHT_RE, css),
        "line_heights": counter_values(LINE_HEIGHT_RE, css),
        "radii": counter_values(RADIUS_RE, css),
        "shadows": counter_values(SHADOW_RE, css),
        "css_variables": [{"name": name, "value": value.strip()} for name, value in VAR_RE.findall(css)],
        "breakpoints": [value.strip() for value in MEDIA_RE.findall(css)],
        "layout_rules": rules[:50],
    }


def analyze_file(path: Path) -> dict[str, object]:
    html = read_text(path)
    parser = PrototypeParser()
    parser.feed(html)
    css, linked_styles = local_styles(html, path)
    return {
        "path": str(path),
        "source_kind": "document" if re.search(r"<html\b", html, re.IGNORECASE) else "fragment",
        "title": " ".join(parser.title_parts),
        "semantic_landmarks": dict(parser.semantic),
        "tag_counts": dict(parser.tags.most_common()),
        "class_counts": dict(parser.classes.most_common(50)),
        "ids": list(parser.ids),
        "headings": parser.headings,
        "interactive_elements": parser.interactive,
        "forms": parser.forms,
        "assets": parser.assets,
        "linked_stylesheets": linked_styles,
        "css": css_evidence(css),
    }


def paths_for_input(input_path: Path) -> Iterable[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in {".html", ".htm"}:
            raise ValueError("input file must use .html or .htm")
        return [input_path]
    if input_path.is_dir():
        return sorted(path for path in input_path.rglob("*") if path.is_file() and path.suffix.lower() in {".html", ".htm"})
    raise FileNotFoundError(f"input path does not exist: {input_path}")


def aggregate_css(pages: list[dict[str, object]]) -> dict[str, object]:
    """Merge CSS evidence across pages while retaining bounded output."""
    fields = ("colors", "spacing", "font_sizes", "font_weights", "line_heights", "radii", "shadows")
    aggregate: dict[str, object] = {}
    for field in fields:
        values: Counter[str] = Counter()
        for page in pages:
            for item in page["css"][field]:
                values[str(item["value"])] += int(item["count"])
        aggregate[field] = [{"value": value, "count": count} for value, count in values.most_common(30)]
    variables: dict[str, str] = {}
    breakpoints: list[str] = []
    for page in pages:
        for item in page["css"]["css_variables"]:
            variables[item["name"]] = item["value"]
        breakpoints.extend(page["css"]["breakpoints"])
    aggregate["css_variables"] = [{"name": name, "value": value} for name, value in sorted(variables.items())]
    aggregate["breakpoints"] = sorted(set(breakpoints))
    return aggregate


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract static HTML/CSS evidence as JSON")
    parser.add_argument("--input", required=True, help="HTML file or folder")
    args = parser.parse_args()
    input_path = Path(args.input).expanduser().resolve()
    paths = list(paths_for_input(input_path))
    pages = [analyze_file(path) for path in paths]
    result = {"input": str(input_path), "files": pages, "aggregate_css": aggregate_css(pages)}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
