import DOMPurify from "dompurify";

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "strong", "em", "a", "img", "div", "span",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead",
      "tbody", "tr", "td", "th", "blockquote", "pre", "code", "hr", "sup", "sub",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "style", "target", "width", "height",
      "colspan", "rowspan", "align", "valign",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
