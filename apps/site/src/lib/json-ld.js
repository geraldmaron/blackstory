/**
 * Serialize a JSON-LD object for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>` would end the tag and let
 * the rest run as markup. Escaping `<`, `>`, `&` and the two JS line separators keeps the payload
 * valid JSON that cannot break out of the element. Plain CommonJS so node tests and Metro share it.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

function jsonLdString(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');
}

module.exports = { jsonLdString };
